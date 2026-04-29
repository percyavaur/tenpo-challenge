import { yieldToMainThread } from "./async";
import type { DatasetState, RowData } from "./dataset";

export interface FilterResult {
  filteredCount: number;
  filterMs: number;
  filteredRows: RowData[] | null;
  matchingIndexes: number[] | null;
  cachedEntries: number;
  cacheBytes: number;
  description: string;
}

const FILTER_CHUNK_SIZE = 40_000;
const REFERENCE_BYTES = 8;

function rowMatchesQuery(row: RowData, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  if (row.id.toString().includes(normalizedQuery)) {
    return true;
  }

  return row.cells.some((cell) => cell.toLowerCase().includes(normalizedQuery));
}

export async function runFilter(
  dataset: DatasetState,
  rawQuery: string,
  signal?: AbortSignal,
  displayOrder?: Uint32Array | null
): Promise<FilterResult> {
  const startedAt = performance.now();
  const normalizedQuery = rawQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return {
      filteredCount: dataset.totalRows,
      filterMs: performance.now() - startedAt,
      filteredRows: null,
      matchingIndexes: null,
      cachedEntries: 0,
      cacheBytes: 0,
      description:
        "Sin busqueda, el CSV sigue indexado por offsets y no se genera un conjunto adicional de filas en memoria.",
    };
  }

  const matchingIndexes: number[] = [];
  const orderedIndexes = displayOrder ?? null;
  const totalIndexes = orderedIndexes?.length ?? dataset.totalRows;

  for (let index = 0; index < totalIndexes; index += FILTER_CHUNK_SIZE) {
    const end = Math.min(index + FILTER_CHUNK_SIZE, totalIndexes);

    for (let cursor = index; cursor < end; cursor += 1) {
      const logicalIndex = orderedIndexes ? orderedIndexes[cursor]! : cursor;
      const row = dataset.readRowAt(logicalIndex, false);

      if (rowMatchesQuery(row, normalizedQuery)) {
        matchingIndexes.push(logicalIndex);
      }
    }

    if (end < totalIndexes) {
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
      "El filtro recorre el CSV indexado y conserva solo los indices coincidentes; no materializa todas las filas del archivo.",
  };
}
