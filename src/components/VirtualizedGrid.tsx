import { memo, useEffect, useRef } from "react";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import type { RowData } from "../lib/dataset";

export const SAFE_SCROLLABLE_HEIGHT = 8_000_000;
const DEFAULT_VIEWPORT_HEIGHT = 760;

type ScrollElement = HTMLDivElement;
type RowElement = HTMLDivElement;
type ObserveOffsetCallback = (offset: number, isScrolling: boolean) => void;

export interface VisibleRange {
  renderedRows: number;
  startDisplayIndex: number | null;
  endDisplayIndex: number | null;
  startLogicalIndex: number | null;
  endLogicalIndex: number | null;
}

interface VirtualizedGridProps {
  columns: string[];
  rowCount: number;
  rowHeight: number;
  getRow: (index: number) => RowData;
  statusText: string | null;
  onVisibleRangeChange: (range: VisibleRange) => void;
}

interface RowViewProps {
  row: RowData;
  columnTemplate: string;
  rowHeight: number;
  top: number;
  isOdd: boolean;
}

const EMPTY_RANGE: VisibleRange = {
  renderedRows: 0,
  startDisplayIndex: null,
  endDisplayIndex: null,
  startLogicalIndex: null,
  endLogicalIndex: null,
};

function mapPhysicalToLogicalOffset(element: ScrollElement, totalLogicalHeight: number): number {
  const logicalMaxScrollOffset = Math.max(totalLogicalHeight - element.clientHeight, 0);
  const physicalMaxScrollOffset = Math.max(element.scrollHeight - element.clientHeight, 0);

  if (logicalMaxScrollOffset === 0 || physicalMaxScrollOffset === 0) {
    return 0;
  }

  return (element.scrollTop / physicalMaxScrollOffset) * logicalMaxScrollOffset;
}

function mapLogicalToPhysicalOffset(
  element: ScrollElement,
  totalLogicalHeight: number,
  logicalOffset: number
): number {
  const logicalMaxScrollOffset = Math.max(totalLogicalHeight - element.clientHeight, 0);
  const physicalMaxScrollOffset = Math.max(element.scrollHeight - element.clientHeight, 0);

  if (logicalMaxScrollOffset === 0 || physicalMaxScrollOffset === 0) {
    return 0;
  }

  return (logicalOffset / logicalMaxScrollOffset) * physicalMaxScrollOffset;
}

function observeLogicalOffset(
  instance: Virtualizer<ScrollElement, RowElement>,
  cb: ObserveOffsetCallback,
  totalLogicalHeight: number
) {
  const element = instance.scrollElement;
  const targetWindow = instance.targetWindow;

  if (!element || !targetWindow) {
    return undefined;
  }

  let logicalOffset = 0;
  let timeoutId = 0;

  const emitOffset = (isScrolling: boolean) => {
    logicalOffset = mapPhysicalToLogicalOffset(element, totalLogicalHeight);
    cb(logicalOffset, isScrolling);
  };

  const clearScheduledIdle = () => {
    if (timeoutId !== 0) {
      targetWindow.clearTimeout(timeoutId);
      timeoutId = 0;
    }
  };

  const handler = () => {
    clearScheduledIdle();
    emitOffset(true);
    timeoutId = targetWindow.setTimeout(() => {
      emitOffset(false);
    }, instance.options.isScrollingResetDelay);
  };

  emitOffset(false);
  element.addEventListener("scroll", handler, { passive: true });

  return () => {
    clearScheduledIdle();
    element.removeEventListener("scroll", handler);
  };
}

const RowView = memo(function RowView({
  row,
  columnTemplate,
  rowHeight,
  top,
  isOdd,
}: RowViewProps) {
  return (
    <div
      className={`virtual-row${isOdd ? " odd" : ""}`}
      style={{
        height: rowHeight,
        gridTemplateColumns: columnTemplate,
        transform: `translateY(${top}px)`,
      }}
    >
      <div className="cell id-cell" title={row.id.toString()}>
        {row.id}
      </div>
      {row.cells.map((cell, cellIndex) => (
        <div key={cellIndex} className="cell" title={cell}>
          {cell}
        </div>
      ))}
    </div>
  );
});

export function VirtualizedGrid({
  columns,
  rowCount,
  rowHeight,
  getRow,
  onVisibleRangeChange,
  statusText,
}: VirtualizedGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const onVisibleRangeChangeRef = useRef(onVisibleRangeChange);
  const totalLogicalHeight = rowCount * rowHeight;
  const columnTemplate =
    columns.length === 2
      ? "84px minmax(0, 1.6fr) minmax(0, 1fr)"
      : `110px repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`;

  useEffect(() => {
    onVisibleRangeChangeRef.current = onVisibleRangeChange;
  }, [onVisibleRangeChange]);

  const rowVirtualizer = useVirtualizer<ScrollElement, RowElement>({
    count: rowCount,
    estimateSize: () => rowHeight,
    getScrollElement: () => scrollRef.current,
    observeElementOffset: (instance, cb) => observeLogicalOffset(instance, cb, totalLogicalHeight),
    scrollToFn: (offset, { behavior }, instance) => {
      const element = instance.scrollElement;

      if (!element) {
        return;
      }

      const physicalOffset = mapLogicalToPhysicalOffset(element, totalLogicalHeight, offset);

      element.scrollTo({
        top: physicalOffset,
        behavior: behavior === "smooth" ? "smooth" : "auto",
      });
    },
    overscan: 12,
  });

  const viewportHeight = rowVirtualizer.scrollRect?.height ?? DEFAULT_VIEWPORT_HEIGHT;
  const logicalMaxScrollOffset = Math.max(totalLogicalHeight - viewportHeight, 0);
  const physicalScrollRange = Math.min(logicalMaxScrollOffset, SAFE_SCROLLABLE_HEIGHT);
  const logicalScrollOffset = rowVirtualizer.scrollOffset ?? 0;
  const virtualRows = rowVirtualizer.getVirtualItems();
  const startDisplayIndex = virtualRows[0]?.index ?? null;
  const endDisplayIndex = virtualRows[virtualRows.length - 1]?.index ?? null;

  useEffect(() => {
    if (startDisplayIndex === null || endDisplayIndex === null) {
      onVisibleRangeChangeRef.current(EMPTY_RANGE);
      return;
    }

    const startRow = getRow(startDisplayIndex);
    const endRow = getRow(endDisplayIndex);

    onVisibleRangeChangeRef.current({
      renderedRows: virtualRows.length,
      startDisplayIndex,
      endDisplayIndex,
      startLogicalIndex: startRow.id - 1,
      endLogicalIndex: endRow.id - 1,
    });
  }, [endDisplayIndex, getRow, startDisplayIndex, virtualRows.length]);

  return (
    <div className="virtual-list-shell">
      <div className="grid-header" style={{ gridTemplateColumns: columnTemplate }}>
        <span>ID</span>
        {columns.map((column) => (
          <span key={column} title={column}>
            {column}
          </span>
        ))}
      </div>

      <div className="virtual-stage">
        {rowCount === 0 ? (
          <div className="empty-state">
            <p>No hay filas para mostrar con el filtro actual.</p>
            <small>{statusText ?? "Ajusta la búsqueda o carga otro CSV."}</small>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="virtual-scroll-region">
              <div
                aria-hidden="true"
                className="virtual-spacer"
                style={{
                  height: physicalScrollRange,
                }}
              />
            </div>

            <div className="virtual-overlay" aria-hidden="true">
              {virtualRows.map((virtualRow) => {
                const row = getRow(virtualRow.index);

                return (
                  <RowView
                    key={virtualRow.index}
                    row={row}
                    columnTemplate={columnTemplate}
                    rowHeight={virtualRow.size}
                    top={virtualRow.start - logicalScrollOffset}
                    isOdd={virtualRow.index % 2 === 1}
                  />
                );
              })}
            </div>
          </>
        )}

        {statusText && rowCount > 0 && <div className="status-overlay">{statusText}</div>}
      </div>
    </div>
  );
}
