import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { VirtualizedGrid } from "./components/VirtualizedGrid";
import {
  createShuffledIndexOrder,
  initializeDataset,
  runFilter,
  type DatasetState,
  type FilterResult,
  type RowData,
} from "./lib/dataset";

const DEFAULT_STRATEGY = "lazy";
const CSV_SAMPLE_COLUMNS = ["Nombre", "Código"];
const ROW_HEIGHT = 16;
const LARGE_CSV_BYTES = 25_000_000;
const LARGE_ROW_COUNT = 1_000_000;

const numberFormatter = new Intl.NumberFormat("es-PE");

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "n/a";
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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isCsvFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === ""
  );
}

function buildShuffleSeed(totalRows: number, shuffleCount: number): number {
  return (
    (Math.imul(totalRows + 1, 0x9e3779b1) ^
      Math.imul(shuffleCount + 1, 0x85ebca6b)) >>>
    0
  );
}

function getWinnerName(row: RowData | null): string {
  if (!row) {
    return "Ganador pendiente";
  }

  return row.cells[0]?.trim() || `Participante ${row.id}`;
}

function getWinnerCode(row: RowData | null): string {
  if (!row) {
    return "Sin código";
  }

  return row.cells[1]?.trim() || `ID-${row.id}`;
}

function App() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isWinnerOverlayOpen, setIsWinnerOverlayOpen] = useState(false);
  const [winnerRow, setWinnerRow] = useState<RowData | null>(null);
  const [winnerIds, setWinnerIds] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [dataset, setDataset] = useState<DatasetState | null>(null);
  const [filterResult, setFilterResult] = useState<FilterResult | null>(null);
  const [displayOrder, setDisplayOrder] = useState<Uint32Array | null>(null);
  const [shuffleCount, setShuffleCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const shuffleControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    shuffleControllerRef.current?.abort();
    shuffleControllerRef.current = null;
    setDisplayOrder(null);
    setShuffleCount(0);
    setIsShuffling(false);
    setWinnerRow(null);
    setWinnerIds([]);
    setIsWinnerOverlayOpen(false);

    const controller = new AbortController();

    if (!csvFile) {
      setDataset(null);
      setFilterResult(null);
      setIsGenerating(false);
      return () => {
        controller.abort();
      };
    }

    const timer = window.setTimeout(() => {
      setIsGenerating(true);
      setErrorMessage(null);
      setDataset(null);
      setFilterResult(null);

      initializeDataset(
        {
          source: "csv",
          strategy: DEFAULT_STRATEGY,
          file: csvFile,
        },
        controller.signal
      )
        .then((nextDataset) => {
          if (controller.signal.aborted) {
            return;
          }

          startTransition(() => {
            setDataset(nextDataset);
          });
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "No se pudo inicializar el archivo CSV para la prueba."
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsGenerating(false);
          }
        });
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [csvFile]);

  useEffect(() => {
    if (!dataset) {
      setIsFiltering(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsFiltering(true);

      runFilter(dataset, deferredQuery, controller.signal, displayOrder)
        .then((nextFilterResult) => {
          if (controller.signal.aborted) {
            return;
          }

          startTransition(() => {
            setFilterResult(nextFilterResult);
          });
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "No se pudo aplicar el filtro al CSV."
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsFiltering(false);
          }
        });
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [dataset, deferredQuery, displayOrder]);

  useEffect(() => {
    return () => {
      shuffleControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isCsvModalOpen && !isWinnerOverlayOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCsvModalOpen(false);
        setIsWinnerOverlayOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCsvModalOpen, isWinnerOverlayOpen]);

  const clearCsvSelection = useCallback(() => {
    shuffleControllerRef.current?.abort();
    shuffleControllerRef.current = null;
    setCsvFile(null);
    setDataset(null);
    setFilterResult(null);
    setDisplayOrder(null);
    setShuffleCount(0);
    setIsShuffling(false);
    setWinnerRow(null);
    setWinnerIds([]);
    setIsWinnerOverlayOpen(false);
    setQuery("");
    setErrorMessage(null);

    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
  }, []);

  const handleCsvSelection = useCallback((file: File | null) => {
    if (!file) {
      return;
    }

    if (!isCsvFile(file)) {
      setErrorMessage(
        "Selecciona un archivo con extensión .csv para continuar."
      );
      return;
    }

    setCsvFile(file);
    setQuery("");
    setErrorMessage(null);
    setIsCsvModalOpen(false);
  }, []);

  const handleCsvDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingCsv(false);
      handleCsvSelection(event.dataTransfer.files?.[0] ?? null);
    },
    [handleCsvSelection]
  );

  const handleShuffleRows = useCallback(() => {
    if (!dataset || dataset.totalRows === 0 || isShuffling) {
      return;
    }

    shuffleControllerRef.current?.abort();

    const controller = new AbortController();
    const nextShuffleCount = shuffleCount + 1;
    shuffleControllerRef.current = controller;
    setIsShuffling(true);
    setErrorMessage(null);

    createShuffledIndexOrder(
      dataset.totalRows,
      buildShuffleSeed(dataset.totalRows, nextShuffleCount),
      controller.signal
    )
      .then((nextOrder) => {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setDisplayOrder(nextOrder);
          setShuffleCount(nextShuffleCount);
          setWinnerRow(null);
          setIsWinnerOverlayOpen(false);
        });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron chocolatear las filas."
        );
      })
      .finally(() => {
        if (shuffleControllerRef.current === controller) {
          shuffleControllerRef.current = null;
        }

        if (!controller.signal.aborted) {
          setIsShuffling(false);
        }
      });
  }, [dataset, isShuffling, shuffleCount]);

  const activeColumns = dataset?.columns ?? CSV_SAMPLE_COLUMNS;
  const filteredCount =
    filterResult?.filteredCount ??
    (dataset && deferredQuery.trim().length === 0 ? dataset.totalRows : 0);
  const isDatasetReady = Boolean(dataset && filterResult);
  const activeWarning =
    dataset &&
    (dataset.totalRows >= LARGE_ROW_COUNT ||
      (dataset.fileSizeBytes ?? 0) >= LARGE_CSV_BYTES)
      ? "Archivo grande detectado. La carga inicial, la búsqueda o el mezclado pueden tardar un poco."
      : null;
  const statusText = isGenerating
    ? "Procesando archivo..."
    : isShuffling
    ? "Chocolateando filas..."
    : isFiltering
    ? "Aplicando búsqueda..."
    : null;
  const shuffleSummary = displayOrder
    ? `Filas chocolateadas ${formatNumber(shuffleCount)} ${
        shuffleCount === 1 ? "vez" : "veces"
      }`
    : "Orden original cargado";
  const canChooseWinner =
    Boolean(dataset) &&
    filteredCount > 0 &&
    shuffleCount >= 3 &&
    !isGenerating &&
    !isFiltering &&
    !isShuffling;
  const isWinnerMode = shuffleCount >= 3;

  const getDisplayRow = useCallback(
    (displayIndex: number): RowData => {
      if (!dataset || !filterResult) {
        return {
          id: 0,
          cells: activeColumns.map(() => ""),
        };
      }

      const logicalIndex = filterResult.matchingIndexes
        ? filterResult.matchingIndexes[displayIndex]!
        : displayOrder
        ? displayOrder[displayIndex]!
        : displayIndex;

      return dataset.getRow(logicalIndex);
    },
    [activeColumns, dataset, displayOrder, filterResult]
  );

  const pickWinnerRow = useCallback((): RowData | null => {
    if (filteredCount <= 0) {
      return null;
    }

    const pickedIds = new Set(winnerIds);
    const maxRandomAttempts = Math.min(Math.max(filteredCount, 12), 60);

    for (let attempt = 0; attempt < maxRandomAttempts; attempt += 1) {
      const randomIndex = Math.floor(Math.random() * filteredCount);
      const candidate = getDisplayRow(randomIndex);

      if (!pickedIds.has(candidate.id)) {
        return candidate;
      }
    }

    for (let index = 0; index < filteredCount; index += 1) {
      const candidate = getDisplayRow(index);

      if (!pickedIds.has(candidate.id)) {
        return candidate;
      }
    }

    return null;
  }, [filteredCount, getDisplayRow, winnerIds]);

  const handleChooseWinner = useCallback(() => {
    const nextWinner = pickWinnerRow();

    if (!nextWinner) {
      setErrorMessage("No quedan participantes disponibles para elegir ganador.");
      return;
    }

    setWinnerRow(nextWinner);
    setWinnerIds((currentIds) =>
      currentIds.includes(nextWinner.id)
        ? currentIds
        : [...currentIds, nextWinner.id]
    );
    setErrorMessage(null);
    setIsWinnerOverlayOpen(true);
  }, [pickWinnerRow]);

  const handleResetForNextPrize = useCallback(() => {
    clearCsvSelection();
    setIsCsvModalOpen(false);
    setIsDraggingCsv(false);
  }, [clearCsvSelection]);

  return (
    <main className="shell">
      <input
        ref={csvInputRef}
        hidden
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          handleCsvSelection(event.target.files?.[0] ?? null);
        }}
      />

      {isCsvModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setIsCsvModalOpen(false);
            setIsDraggingCsv(false);
          }}
        >
          <section
            className="panel modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="csv-modal-title"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <article className="setup-card is-active">
              <div className="setup-header">
                <div>
                  <p className="section-kicker">Carga única</p>
                  <h2 id="csv-modal-title">Subir archivo CSV</h2>
                </div>
                <div className="modal-header-actions">
                  <span className="badge">
                    {csvFile ? "Archivo listo" : "Pendiente"}
                  </span>
                  <button
                    type="button"
                    className="secondary-button modal-close-button"
                    onClick={() => {
                      setIsCsvModalOpen(false);
                      setIsDraggingCsv(false);
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <p className="setup-copy">
                La tabla final conserva la columna <code>ID</code> para
                evidenciar el desorden y recorta la vista a <code>Nombre</code>{" "}
                y <code>Código</code>.
              </p>

              <div
                className={`dropzone${isDraggingCsv ? " is-dragging" : ""}`}
                onClick={() => {
                  if (csvInputRef.current) {
                    csvInputRef.current.value = "";
                    csvInputRef.current.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setIsDraggingCsv(true);
                }}
                onDragLeave={() => {
                  setIsDraggingCsv(false);
                }}
                onDrop={handleCsvDrop}
              >
                <p className="dropzone-title">
                  {csvFile
                    ? "Archivo listo para validar"
                    : "Arrastra tu CSV aquí"}
                </p>
                <p className="dropzone-copy">o selecciónalo desde tu equipo</p>
                <button type="button" className="secondary-button">
                  {csvFile ? "Reemplazar archivo" : "Seleccionar archivo"}
                </button>

                {csvFile && (
                  <div className="dropzone-file">
                    <strong>{csvFile.name}</strong>
                    <span>{formatBytes(csvFile.size)}</span>
                  </div>
                )}
              </div>

              <div className="setup-footer">
                <p className="setup-hint">
                  Cabecera esperada: <code>Nombre_Completo,Codigo_Usuario</code>
                  . Si el archivo usa otros nombres, se tomarán las dos columnas
                  más cercanas a nombre y código.
                </p>
                {csvFile && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      clearCsvSelection();
                    }}
                  >
                    Quitar archivo
                  </button>
                )}
              </div>
            </article>
          </section>
        </div>
      )}

      {isWinnerOverlayOpen && winnerRow && (
        <div
          className="winner-overlay"
          onClick={() => {
            setIsWinnerOverlayOpen(false);
          }}
        >
          <section
            className="winner-stage"
            role="dialog"
            aria-modal="true"
            aria-labelledby="winner-title"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              className="winner-close"
              onClick={() => {
                setIsWinnerOverlayOpen(false);
              }}
            >
              Cerrar
            </button>

            <div className="winner-prize-art" aria-hidden="true">
              <div className="winner-prize-cube"></div>
              <div className="winner-prize-base"></div>
              <div className="winner-prize-badge">CSV</div>
            </div>

            <h2 id="winner-title" className="winner-name">
              {getWinnerName(winnerRow)}
            </h2>

            <p className="winner-pill">Ganador</p>

            <p className="winner-code">
              Código: <strong>{getWinnerCode(winnerRow)}</strong>
            </p>

            <button
              type="button"
              className="winner-next-button"
              onClick={handleResetForNextPrize}
            >
              Siguiente premio
            </button>
          </section>
        </div>
      )}

      {(activeWarning || errorMessage) && (
        <section className="panel alert-panel">
          {activeWarning && <p className="alert warning">{activeWarning}</p>}
          {errorMessage && <p className="alert error">{errorMessage}</p>}
        </section>
      )}

      <section className="panel list-panel">
        <div className="list-header">
          <div className="list-action-card">
            <p className="list-action-title">Cargar lista de participantes</p>
            <p className="list-action-copy">
              {csvFile
                ? `${csvFile.name} listo para validar.`
                : "Abre el modal para cargar o reemplazar el archivo CSV base."}
            </p>
            <button
              type="button"
              className="secondary-button list-header-button"
              onClick={() => {
                setIsCsvModalOpen(true);
              }}
            >
              {csvFile ? "Cambiar CSV" : "Cargar CSV"}
            </button>
          </div>

          <div className="list-actions list-action-card">
            <p className="list-action-title">
              {isWinnerMode ? "Elegir ganador" : "Mezclar filas"}
            </p>
            <p className="list-proof-note">
              {dataset
                ? isWinnerMode
                  ? `Ya puedes elegir ganador. ${shuffleSummary}.`
                  : `ID original visible para auditoría. ${shuffleSummary}.`
                : "Carga un CSV para habilitar el mezclado de filas."}
            </p>
            <div className="action-row">
              <button
                type="button"
                className={`secondary-button list-header-button shuffle-button${
                  isWinnerMode ? " choose-winner-button" : ""
                }`}
                onClick={isWinnerMode ? handleChooseWinner : handleShuffleRows}
                disabled={
                  isWinnerMode
                    ? !canChooseWinner
                    : !dataset ||
                      dataset.totalRows === 0 ||
                      isGenerating ||
                      isShuffling
                }
              >
                {isWinnerMode
                  ? "Elegir ganador"
                  : isShuffling
                  ? "Chocolateando..."
                  : shuffleCount > 0
                  ? "Chocolatear otra vez"
                  : "Chocolatear filas"}
              </button>
            </div>
          </div>
        </div>

        {!dataset ? (
          <div className="empty-state">
            <p>
              {isGenerating
                ? "Preparando datos..."
                : "Carga un CSV para comenzar."}
            </p>
            <small>
              {isGenerating
                ? "Esto suele tardar solo unos instantes."
                : "La vista final mostrará solo ID, nombre y código."}
            </small>
          </div>
        ) : !isDatasetReady ? (
          <div className="empty-state">
            <p>Preparando resultados...</p>
            <small>Esto suele tardar solo unos instantes.</small>
          </div>
        ) : (
          <VirtualizedGrid
            columns={activeColumns}
            rowCount={filteredCount}
            rowHeight={ROW_HEIGHT}
            getRow={getDisplayRow}
            statusText={statusText}
            onVisibleRangeChange={() => {}}
          />
        )}
      </section>
    </main>
  );
}

export default App;
