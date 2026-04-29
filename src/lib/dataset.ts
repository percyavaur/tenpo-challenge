import { throwIfAborted, yieldToMainThread } from "./async";

export interface RowData {
  id: number;
  cells: string[];
}

export interface DatasetState {
  totalRows: number;
  columns: string[];
  fileName: string;
  fileSizeBytes: number;
  rawBytes: Uint8Array;
  recordOffsets: Uint32Array;
  generationMs: number;
  approxMemoryBytes: number;
  readRowAt: (index: number, useCache?: boolean) => RowData;
  getRow: (index: number) => RowData;
}

const CSV_SCAN_CHUNK_BYTES = 4_000_000;
const CSV_ROW_CACHE_LIMIT = 1_024;
const STRING_HEADER_BYTES = 24;
const ARRAY_OVERHEAD_BYTES = 24;
const REFERENCE_BYTES = 8;
const QUOTE_BYTE = 34;
const LF_BYTE = 10;
const FINAL_VIEW_COLUMNS = ["Nombre", "Código"] as const;

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

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function pickCsvColumnIndexes(rawColumns: string[]): number[] {
  const normalizedColumns = rawColumns.map(normalizeHeader);
  const selectedIndexes: number[] = [];

  const tryAddIndex = (index: number) => {
    if (index < 0 || selectedIndexes.includes(index)) {
      return;
    }

    selectedIndexes.push(index);
  };

  tryAddIndex(
    normalizedColumns.findIndex((column) => column.includes("nombre") || column.includes("name"))
  );
  tryAddIndex(
    normalizedColumns.findIndex(
      (column) =>
        column.includes("codigo") ||
        column.includes("code") ||
        (column.includes("cod") && !column.includes("nombre"))
    )
  );

  for (
    let index = 0;
    index < rawColumns.length && selectedIndexes.length < FINAL_VIEW_COLUMNS.length;
    index += 1
  ) {
    tryAddIndex(index);
  }

  return selectedIndexes.slice(0, FINAL_VIEW_COLUMNS.length);
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
  sourceColumnCount: number,
  selectedColumnIndexes: number[]
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
      sourceColumnCount
    );
    const row = {
      id: index + 1,
      cells: selectedColumnIndexes.map((columnIndex) => parsedCells[columnIndex] ?? ""),
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
  sourceColumnCount: number;
  selectedColumnIndexes: number[];
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
  const headerText = decodeCsvRecord(
    bytes,
    recordOffsets[0]!,
    recordOffsets[1]!,
    new TextDecoder("utf-8")
  );
  const rawColumns = parseCsvRecord(headerText);

  if (rawColumns.length === 0 || rawColumns.every((column) => column.trim() === "")) {
    throw new Error("No se pudo leer la cabecera del CSV.");
  }

  if (rawColumns.length < FINAL_VIEW_COLUMNS.length) {
    throw new Error("El CSV debe incluir al menos las columnas de nombre y código.");
  }

  const selectedColumnIndexes = pickCsvColumnIndexes(rawColumns);

  return {
    bytes,
    columns: [...FINAL_VIEW_COLUMNS],
    sourceColumnCount: rawColumns.length,
    selectedColumnIndexes,
    recordOffsets,
    totalRows: Math.max(recordCount - 1, 0),
  };
}

export async function initializeDataset(
  file: File,
  signal?: AbortSignal
): Promise<DatasetState> {
  const startedAt = performance.now();
  const { bytes, columns, sourceColumnCount, selectedColumnIndexes, recordOffsets, totalRows } =
    await loadCsvBase(file, signal);
  const readRowAt = buildCsvRowReader(bytes, recordOffsets, sourceColumnCount, selectedColumnIndexes);

  return {
    totalRows,
    columns,
    fileName: file.name,
    fileSizeBytes: file.size,
    rawBytes: bytes,
    recordOffsets,
    readRowAt,
    generationMs: performance.now() - startedAt,
    approxMemoryBytes: bytes.byteLength + recordOffsets.byteLength + estimateCellsBytes(columns),
    getRow(index: number) {
      return readRowAt(index, true);
    },
  };
}
