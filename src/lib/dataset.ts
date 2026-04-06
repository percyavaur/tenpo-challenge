export type DatasetSize = 100_000 | 500_000 | 1_000_000 | 2_000_000;
export type DatasetStrategy = "materialized" | "lazy";
export type DatasetSource = "synthetic" | "csv";

export const SYNTHETIC_COLUMNS = ["col1", "col2"] as const;

export interface RowData {
  id: number;
  cells: string[];
}

export interface DatasetBase {
  source: DatasetSource;
  strategy: DatasetStrategy;
  totalRows: number;
  columns: string[];
  generationMs: number;
  materializedObjects: number;
  approxMemoryBytes: number;
  warning: string | null;
  filterSummary: string;
  sourceLabel: string;
  getRow: (index: number) => RowData;
  fileName?: string;
  fileSizeBytes?: number;
}

export interface MaterializedDataset extends DatasetBase {
  strategy: "materialized";
  rows: RowData[];
}

export interface SyntheticMaterializedDataset extends MaterializedDataset {
  source: "synthetic";
  seed: number;
}

export interface SyntheticLazyDataset extends DatasetBase {
  source: "synthetic";
  strategy: "lazy";
  seed: number;
}

export interface CsvMaterializedDataset extends MaterializedDataset {
  source: "csv";
  fileName: string;
  fileSizeBytes: number;
}

export interface CsvIndexedDataset extends DatasetBase {
  source: "csv";
  strategy: "lazy";
  fileName: string;
  fileSizeBytes: number;
  rawBytes: Uint8Array;
  recordOffsets: Uint32Array;
  readRowAt: (index: number, useCache?: boolean) => RowData;
}

export type DatasetState =
  | SyntheticMaterializedDataset
  | SyntheticLazyDataset
  | CsvMaterializedDataset
  | CsvIndexedDataset;

export interface FilterResult {
  filteredCount: number;
  filterMs: number;
  filteredRows: RowData[] | null;
  matchingIndexes: number[] | null;
  cachedEntries: number;
  cacheBytes: number;
  description: string;
}

export interface SyntheticDatasetConfig {
  source: "synthetic";
  strategy: DatasetStrategy;
  totalRows: number;
  seed: number;
}

export interface CsvDatasetConfig {
  source: "csv";
  strategy: DatasetStrategy;
  file: File;
}

export type InitializeDatasetOptions = SyntheticDatasetConfig | CsvDatasetConfig;

const MATERIALIZE_CHUNK_SIZE = 20_000;
const FILTER_CHUNK_SIZE = 40_000;
const CSV_SCAN_CHUNK_BYTES = 4_000_000;
const CSV_ROW_CACHE_LIMIT = 1_024;
const STRING_HEADER_BYTES = 24;
const OBJECT_OVERHEAD_BYTES = 72;
const ARRAY_OVERHEAD_BYTES = 24;
const REFERENCE_BYTES = 8;
const QUOTE_BYTE = 34;
const LF_BYTE = 10;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Operation aborted", "AbortError");
  }
}

function yieldToMainThread(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Operation aborted", "AbortError"));
      return;
    }

    window.setTimeout(() => {
      if (signal?.aborted) {
        reject(new DOMException("Operation aborted", "AbortError"));
        return;
      }

      resolve();
    }, 0);
  });
}

function mix(value: number): number {
  let state = value | 0;
  state = Math.imul(state ^ 0x45d9f3b, 0x45d9f3b);
  state ^= state >>> 16;
  state = Math.imul(state, 0x45d9f3b);
  state ^= state >>> 16;
  return state >>> 0;
}

function estimateStringBytes(value: string): number {
  return STRING_HEADER_BYTES + value.length * 2;
}

function estimateCellsBytes(cells: string[]): number {
  return (
    ARRAY_OVERHEAD_BYTES +
    cells.length * REFERENCE_BYTES +
    cells.reduce((total, cell) => total + estimateStringBytes(cell), 0)
  );
}

function estimateRowBytes(sampleRow: RowData): number {
  return OBJECT_OVERHEAD_BYTES + 8 + estimateCellsBytes(sampleRow.cells);
}

function normalizeRowCells(cells: string[], expectedCount: number): string[] {
  if (cells.length === expectedCount) {
    return cells;
  }

  if (cells.length > expectedCount) {
    return cells.slice(0, expectedCount);
  }

  return [...cells, ...new Array(expectedCount - cells.length).fill("")];
}

function trimRecordEnding(value: string): string {
  let output = value;

  if (output.endsWith("\n")) {
    output = output.slice(0, -1);
  }

  if (output.endsWith("\r")) {
    output = output.slice(0, -1);
  }

  return output;
}

function parseCsvRecord(recordText: string): string[] {
  const values: string[] = [];
  let currentValue = "";
  let inQuotes = false;
  const text = trimRecordEnding(recordText);

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(currentValue);
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  values.push(currentValue);

  if (values[0]?.charCodeAt(0) === 0xfeff) {
    values[0] = values[0].slice(1);
  }

  return values;
}

function rowMatchesQuery(row: RowData, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  if (row.id.toString().includes(normalizedQuery)) {
    return true;
  }

  return row.cells.some((cell) => cell.toLowerCase().includes(normalizedQuery));
}

function buildSegment(index: number): string {
  return Math.floor(index / 1_000).toString().padStart(4, "0");
}

function buildBucket(hash: number): string {
  return (hash % 4_096).toString().padStart(4, "0");
}

export function createDatasetSeed(version: number, totalRows: number): number {
  return mix(version * 2_654_435_761 + totalRows);
}

export function getSyntheticRowByIndex(index: number, seed: number): RowData {
  const id = index + 1;
  const hashA = mix(id ^ seed);
  const hashB = mix(hashA ^ 0x9e3779b9);

  return {
    id,
    cells: [
      `cell-${hashA.toString(36).padStart(7, "0")}`,
      `segment-${buildSegment(index)}-bucket-${buildBucket(hashB)}`,
    ],
  };
}

function buildSyntheticWarning(strategy: DatasetStrategy, totalRows: number): string | null {
  if (strategy === "materialized") {
    if (totalRows >= 2_000_000) {
      return "2,000,000 de filas materializadas implican millones de objetos reales en memoria. La virtualización mantiene el DOM pequeño, pero no elimina ese costo.";
    }

    if (totalRows >= 1_000_000) {
      return "1,000,000 de filas materializadas ya es un escenario agresivo. El render seguirá virtualizado, pero la memoria crecerá con el array completo.";
    }

    if (totalRows >= 500_000) {
      return "500,000 filas materializadas ya muestran de forma clara el costo de generar y retener el dataset completo.";
    }
  }

  if (strategy === "lazy" && totalRows >= 1_000_000) {
    return "La estrategia lazy sintética mantiene solo el total lógico y resuelve las filas por índice cuando se necesitan.";
  }

  return null;
}

function buildCsvWarning(
  strategy: DatasetStrategy,
  totalRows: number,
  fileSizeBytes: number
): string | null {
  if (strategy === "materialized") {
    if (totalRows >= 1_000_000) {
      return `Materializar ${totalRows.toLocaleString("es-PE")} filas desde CSV crea millones de strings y objetos JS. El archivo local ya pesa ${formatBytes(
        fileSizeBytes
      )}; el costo total de memoria sube mucho más al parsearlo completo.`;
    }

    return `El CSV se parsea completo a objetos JS. Para un archivo de ${formatBytes(
      fileSizeBytes
    )}, la estrategia lazy/indexada suele ser más eficiente.`;
  }

  if (totalRows >= 1_000_000) {
    return `El modo lazy/indexado evita millones de objetos JS, pero igual mantiene el archivo bruto (${formatBytes(
      fileSizeBytes
    )}) y el índice de offsets en memoria.`;
  }

  return "El modo lazy/indexado evita materializar filas completas y decodifica cada registro cuando la vista o el filtro lo necesitan.";
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

async function createSyntheticMaterializedDataset(
  totalRows: number,
  seed: number,
  signal?: AbortSignal
): Promise<SyntheticMaterializedDataset> {
  const startedAt = performance.now();
  const rows = new Array<RowData>(totalRows);

  for (let index = 0; index < totalRows; index += MATERIALIZE_CHUNK_SIZE) {
    const end = Math.min(index + MATERIALIZE_CHUNK_SIZE, totalRows);

    for (let cursor = index; cursor < end; cursor += 1) {
      rows[cursor] = getSyntheticRowByIndex(cursor, seed);
    }

    if (end < totalRows) {
      await yieldToMainThread(signal);
    }
  }

  const sampleRow = rows[Math.min(rows.length - 1, 9)] ?? getSyntheticRowByIndex(0, seed);

  return {
    source: "synthetic",
    strategy: "materialized",
    totalRows,
    columns: [...SYNTHETIC_COLUMNS],
    seed,
    rows,
    generationMs: performance.now() - startedAt,
    materializedObjects: rows.length,
    approxMemoryBytes: rows.length * estimateRowBytes(sampleRow),
    warning: buildSyntheticWarning("materialized", totalRows),
    filterSummary:
      "Filtro local real sobre un array ya materializado. El costo fuerte está en los objetos JS que representan todas las filas.",
    sourceLabel: "Dataset sintético local",
    getRow(index: number) {
      return rows[index]!;
    },
  };
}

function createSyntheticLazyDataset(totalRows: number, seed: number): SyntheticLazyDataset {
  const startedAt = performance.now();

  return {
    source: "synthetic",
    strategy: "lazy",
    totalRows,
    columns: [...SYNTHETIC_COLUMNS],
    seed,
    generationMs: performance.now() - startedAt,
    materializedObjects: 0,
    approxMemoryBytes: 0,
    warning: buildSyntheticWarning("lazy", totalRows),
    filterSummary:
      "Sin query, el dataset solo existe de forma lógica: totalRows + getRow(index). No se crea un array de filas.",
    sourceLabel: "Dataset sintético local",
    getRow(index: number) {
      return getSyntheticRowByIndex(index, seed);
    },
  };
}

async function countCsvRecords(bytes: Uint8Array, signal?: AbortSignal): Promise<number> {
  if (bytes.length === 0) {
    return 0;
  }

  let recordCount = 1;
  let inQuotes = false;

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index]!;

    if (byte === QUOTE_BYTE) {
      if (inQuotes && bytes[index + 1] === QUOTE_BYTE) {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && byte === LF_BYTE && index + 1 < bytes.length) {
      recordCount += 1;
    }

    if (index > 0 && index % CSV_SCAN_CHUNK_BYTES === 0) {
      await yieldToMainThread(signal);
    }
  }

  return recordCount;
}

async function buildCsvRecordOffsets(
  bytes: Uint8Array,
  recordCount: number,
  signal?: AbortSignal
): Promise<Uint32Array> {
  const offsets = new Uint32Array(recordCount + 1);
  let nextOffsetIndex = 1;
  let inQuotes = false;

  offsets[0] = 0;

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index]!;

    if (byte === QUOTE_BYTE) {
      if (inQuotes && bytes[index + 1] === QUOTE_BYTE) {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && byte === LF_BYTE && index + 1 < bytes.length) {
      offsets[nextOffsetIndex] = index + 1;
      nextOffsetIndex += 1;
    }

    if (index > 0 && index % CSV_SCAN_CHUNK_BYTES === 0) {
      await yieldToMainThread(signal);
    }
  }

  offsets[nextOffsetIndex] = bytes.length;
  return offsets;
}

function decodeCsvRecord(
  bytes: Uint8Array,
  start: number,
  end: number,
  decoder: TextDecoder
): string {
  return trimRecordEnding(decoder.decode(bytes.subarray(start, end)));
}

function createRowCache() {
  const cache = new Map<number, RowData>();

  return {
    get(index: number) {
      return cache.get(index);
    },
    set(index: number, row: RowData) {
      cache.set(index, row);

      if (cache.size > CSV_ROW_CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value as number | undefined;

        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }
    },
  };
}

function buildCsvRowReader(
  bytes: Uint8Array,
  recordOffsets: Uint32Array,
  columns: string[]
): (index: number, useCache?: boolean) => RowData {
  const decoder = new TextDecoder("utf-8");
  const cache = createRowCache();

  return (index: number, useCache = true) => {
    if (useCache) {
      const cachedRow = cache.get(index);

      if (cachedRow) {
        return cachedRow;
      }
    }

    const start = recordOffsets[index + 1]!;
    const end = recordOffsets[index + 2]!;
    const parsedCells = normalizeRowCells(
      parseCsvRecord(decodeCsvRecord(bytes, start, end, decoder)),
      columns.length
    );
    const row = {
      id: index + 1,
      cells: parsedCells,
    };

    if (useCache) {
      cache.set(index, row);
    }

    return row;
  };
}

async function loadCsvBase(
  file: File,
  signal?: AbortSignal
): Promise<{
  bytes: Uint8Array;
  columns: string[];
  recordOffsets: Uint32Array;
  totalRows: number;
}> {
  const buffer = await file.arrayBuffer();
  throwIfAborted(signal);

  const bytes = new Uint8Array(buffer);
  const recordCount = await countCsvRecords(bytes, signal);

  if (recordCount === 0) {
    throw new Error("El archivo CSV está vacío.");
  }

  const recordOffsets = await buildCsvRecordOffsets(bytes, recordCount, signal);
  const headerText = decodeCsvRecord(bytes, recordOffsets[0]!, recordOffsets[1]!, new TextDecoder("utf-8"));
  const columns = parseCsvRecord(headerText);

  if (columns.length === 0 || columns.every((column) => column.trim() === "")) {
    throw new Error("No se pudo leer la cabecera del CSV.");
  }

  return {
    bytes,
    columns,
    recordOffsets,
    totalRows: Math.max(recordCount - 1, 0),
  };
}

async function createCsvIndexedDataset(
  file: File,
  signal?: AbortSignal
): Promise<CsvIndexedDataset> {
  const startedAt = performance.now();
  const { bytes, columns, recordOffsets, totalRows } = await loadCsvBase(file, signal);
  const readRowAt = buildCsvRowReader(bytes, recordOffsets, columns);

  return {
    source: "csv",
    strategy: "lazy",
    totalRows,
    columns,
    fileName: file.name,
    fileSizeBytes: file.size,
    rawBytes: bytes,
    recordOffsets,
    readRowAt,
    generationMs: performance.now() - startedAt,
    materializedObjects: 0,
    approxMemoryBytes:
      bytes.byteLength +
      recordOffsets.byteLength +
      estimateCellsBytes(columns),
    warning: buildCsvWarning("lazy", totalRows, file.size),
    filterSummary:
      "El archivo se conserva como bytes UTF-8 y un índice de offsets por registro. Cada fila se decodifica bajo demanda.",
    sourceLabel: `CSV local: ${file.name}`,
    getRow(index: number) {
      return readRowAt(index, true);
    },
  };
}

async function createCsvMaterializedDataset(
  file: File,
  signal?: AbortSignal
): Promise<CsvMaterializedDataset> {
  const startedAt = performance.now();
  const { bytes, columns, recordOffsets, totalRows } = await loadCsvBase(file, signal);
  const readRowAt = buildCsvRowReader(bytes, recordOffsets, columns);
  const rows = new Array<RowData>(totalRows);

  for (let index = 0; index < totalRows; index += MATERIALIZE_CHUNK_SIZE) {
    const end = Math.min(index + MATERIALIZE_CHUNK_SIZE, totalRows);

    for (let cursor = index; cursor < end; cursor += 1) {
      rows[cursor] = readRowAt(cursor, false);
    }

    if (end < totalRows) {
      await yieldToMainThread(signal);
    }
  }

  const sampleRow =
    rows[Math.min(rows.length - 1, 9)] ?? {
      id: 1,
      cells: [...columns].fill(""),
    };

  return {
    source: "csv",
    strategy: "materialized",
    totalRows,
    columns,
    rows,
    fileName: file.name,
    fileSizeBytes: file.size,
    generationMs: performance.now() - startedAt,
    materializedObjects: rows.length,
    approxMemoryBytes: rows.length * estimateRowBytes(sampleRow),
    warning: buildCsvWarning("materialized", totalRows, file.size),
    filterSummary:
      "El CSV se parseó completo a objetos JS y strings. La vista sigue virtualizada, pero el archivo ya quedó materializado.",
    sourceLabel: `CSV local: ${file.name}`,
    getRow(index: number) {
      return rows[index]!;
    },
  };
}

export async function initializeDataset(
  options: InitializeDatasetOptions,
  signal?: AbortSignal
): Promise<DatasetState> {
  if (options.source === "synthetic") {
    if (options.strategy === "materialized") {
      return createSyntheticMaterializedDataset(options.totalRows, options.seed, signal);
    }

    return createSyntheticLazyDataset(options.totalRows, options.seed);
  }

  if (options.strategy === "materialized") {
    return createCsvMaterializedDataset(options.file, signal);
  }

  return createCsvIndexedDataset(options.file, signal);
}

async function filterMaterializedDataset(
  dataset: MaterializedDataset,
  normalizedQuery: string,
  signal?: AbortSignal
): Promise<FilterResult> {
  const startedAt = performance.now();

  if (!normalizedQuery) {
    return {
      filteredCount: dataset.rows.length,
      filterMs: performance.now() - startedAt,
      filteredRows: dataset.rows,
      matchingIndexes: null,
      cachedEntries: 0,
      cacheBytes: 0,
      description: `${dataset.filterSummary} Sin query, la vista reutiliza directamente el array materializado.`,
    };
  }

  const matches: RowData[] = [];

  for (let index = 0; index < dataset.rows.length; index += FILTER_CHUNK_SIZE) {
    const end = Math.min(index + FILTER_CHUNK_SIZE, dataset.rows.length);

    for (let cursor = index; cursor < end; cursor += 1) {
      const row = dataset.rows[cursor]!;

      if (rowMatchesQuery(row, normalizedQuery)) {
        matches.push(row);
      }
    }

    if (end < dataset.rows.length) {
      await yieldToMainThread(signal);
    }
  }

  return {
    filteredCount: matches.length,
    filterMs: performance.now() - startedAt,
    filteredRows: matches,
    matchingIndexes: null,
    cachedEntries: matches.length,
    cacheBytes: matches.length * REFERENCE_BYTES,
    description:
      "El filtro materializado opera sobre filas ya parseadas y conserva un arreglo adicional de referencias al resultado.",
  };
}

async function filterSyntheticLazyDataset(
  dataset: SyntheticLazyDataset,
  normalizedQuery: string,
  signal?: AbortSignal
): Promise<FilterResult> {
  const startedAt = performance.now();

  if (!normalizedQuery) {
    return {
      filteredCount: dataset.totalRows,
      filterMs: performance.now() - startedAt,
      filteredRows: null,
      matchingIndexes: null,
      cachedEntries: 0,
      cacheBytes: 0,
      description:
        "Sin búsqueda, el dataset sintético permanece completamente lógico: no hay filas retenidas ni índices cacheados.",
    };
  }

  const matchingIndexes: number[] = [];

  for (let index = 0; index < dataset.totalRows; index += FILTER_CHUNK_SIZE) {
    const end = Math.min(index + FILTER_CHUNK_SIZE, dataset.totalRows);

    for (let cursor = index; cursor < end; cursor += 1) {
      const row = dataset.getRow(cursor);

      if (rowMatchesQuery(row, normalizedQuery)) {
        matchingIndexes.push(cursor);
      }
    }

    if (end < dataset.totalRows) {
      await yieldToMainThread(signal);
    }
  }

  return {
    filteredCount: matchingIndexes.length,
    filterMs: performance.now() - startedAt,
    filteredRows: null,
    matchingIndexes,
    cachedEntries: matchingIndexes.length,
    cacheBytes: matchingIndexes.length * REFERENCE_BYTES,
    description:
      "El filtro lazy sintético no inventa un array de filas permanente: solo conserva los índices coincidentes de la búsqueda actual.",
  };
}

async function filterCsvIndexedDataset(
  dataset: CsvIndexedDataset,
  normalizedQuery: string,
  signal?: AbortSignal
): Promise<FilterResult> {
  const startedAt = performance.now();

  if (!normalizedQuery) {
    return {
      filteredCount: dataset.totalRows,
      filterMs: performance.now() - startedAt,
      filteredRows: null,
      matchingIndexes: null,
      cachedEntries: 0,
      cacheBytes: 0,
      description:
        "Sin búsqueda, el CSV sigue indexado por offsets y no se genera un conjunto adicional de filas en memoria.",
    };
  }

  const matchingIndexes: number[] = [];

  for (let index = 0; index < dataset.totalRows; index += FILTER_CHUNK_SIZE) {
    const end = Math.min(index + FILTER_CHUNK_SIZE, dataset.totalRows);

    for (let cursor = index; cursor < end; cursor += 1) {
      const row = dataset.readRowAt(cursor, false);

      if (rowMatchesQuery(row, normalizedQuery)) {
        matchingIndexes.push(cursor);
      }
    }

    if (end < dataset.totalRows) {
      await yieldToMainThread(signal);
    }
  }

  return {
    filteredCount: matchingIndexes.length,
    filterMs: performance.now() - startedAt,
    filteredRows: null,
    matchingIndexes,
    cachedEntries: matchingIndexes.length,
    cacheBytes: matchingIndexes.length * REFERENCE_BYTES,
    description:
      "El filtro sobre CSV indexado recorre el archivo lógico y conserva solo los offsets coincidentes; no materializa todas las filas del archivo.",
  };
}

export async function runFilter(
  dataset: DatasetState,
  rawQuery: string,
  signal?: AbortSignal
): Promise<FilterResult> {
  const normalizedQuery = rawQuery.trim().toLowerCase();

  if (dataset.strategy === "materialized") {
    return filterMaterializedDataset(dataset, normalizedQuery, signal);
  }

  if (dataset.source === "csv") {
    return filterCsvIndexedDataset(dataset, normalizedQuery, signal);
  }

  return filterSyntheticLazyDataset(dataset, normalizedQuery, signal);
}
