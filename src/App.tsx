import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  SAFE_SCROLLABLE_HEIGHT,
  VirtualizedGrid,
  type VisibleRange,
} from "./components/VirtualizedGrid";
import {
  SYNTHETIC_COLUMNS,
  createDatasetSeed,
  initializeDataset,
  runFilter,
  type DatasetSize,
  type DatasetSource,
  type DatasetState,
  type DatasetStrategy,
  type FilterResult,
  type RowData,
} from "./lib/dataset";

const DATASET_OPTIONS: DatasetSize[] = [100_000, 500_000, 1_000_000, 2_000_000];
const CSV_SAMPLE_COLUMNS = ["Nombre_Completo", "Codigo_Usuario", "Fecha_Compra"];
const ROW_HEIGHT = 16;

const EMPTY_RANGE: VisibleRange = {
  renderedRows: 0,
  startDisplayIndex: null,
  endDisplayIndex: null,
  startLogicalIndex: null,
  endLogicalIndex: null,
};

const numberFormatter = new Intl.NumberFormat("es-PE");

function formatNumber(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return numberFormatter.format(value);
}

function formatMilliseconds(value: number): string {
  if (value < 10) {
    return `${value.toFixed(2)} ms`;
  }

  if (value < 1_000) {
    return `${value.toFixed(1)} ms`;
  }

  return `${(value / 1_000).toFixed(2)} s`;
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

function sameVisibleRange(left: VisibleRange, right: VisibleRange): boolean {
  return (
    left.renderedRows === right.renderedRows &&
    left.startDisplayIndex === right.startDisplayIndex &&
    left.endDisplayIndex === right.endDisplayIndex &&
    left.startLogicalIndex === right.startLogicalIndex &&
    left.endLogicalIndex === right.endLogicalIndex
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function buildStrategyLabel(source: DatasetSource, strategy: DatasetStrategy): string {
  if (source === "csv") {
    return strategy === "materialized" ? "CSV materializado" : "CSV indexado / lazy";
  }

  return strategy === "materialized" ? "Materializada" : "Lazy / por índice";
}

function buildSearchModeText(source: DatasetSource, strategy: DatasetStrategy): string {
  if (source === "csv" && strategy === "materialized") {
    return "Filtro real sobre filas parseadas desde el CSV. Es honesto, pero el costo fuerte ya está en haber creado todos los objetos y strings.";
  }

  if (source === "csv" && strategy === "lazy") {
    return "Filtro real sobre el CSV indexado: recorre registros del archivo y cachea solo los índices coincidentes, no millones de objetos JS.";
  }

  if (strategy === "materialized") {
    return "Filtro local real sobre el array materializado; no crea nuevos objetos de fila, pero sí un arreglo adicional de referencias al resultado.";
  }

  return "Búsqueda lógica: recorre índices, genera la fila al evaluar y solo cachea los índices coincidentes cuando la consulta no está vacía.";
}

function buildNarrative(source: DatasetSource, strategy: DatasetStrategy): string {
  if (source === "csv" && strategy === "materialized") {
    return "El CSV se parsea completo y se convierte a objetos JS. La virtualización mantiene el DOM pequeño, pero no evita el costo de haber materializado todas las filas.";
  }

  if (source === "csv" && strategy === "lazy") {
    return "El CSV se carga como bytes UTF-8 y un índice de offsets por registro. Las filas se decodifican bajo demanda, lo que evita millones de objetos JS.";
  }

  if (strategy === "materialized") {
    return "La estrategia materializada crea un array real de objetos. La virtualización mantiene el DOM pequeño, pero no elimina el costo de haber creado el dataset completo.";
  }

  return "La estrategia lazy conserva solo el total lógico y resuelve cada fila con getRow(index). Eso reduce drásticamente memoria base y escala mejor para volúmenes altos.";
}

function App() {
  const [source, setSource] = useState<DatasetSource>("synthetic");
  const [selectedSize, setSelectedSize] = useState<DatasetSize>(2_000_000);
  const [strategy, setStrategy] = useState<DatasetStrategy>("lazy");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [regenerationTick, setRegenerationTick] = useState(0);
  const [dataset, setDataset] = useState<DatasetState | null>(null);
  const [filterResult, setFilterResult] = useState<FilterResult | null>(null);
  const [visibleRange, setVisibleRange] = useState<VisibleRange>(EMPTY_RANGE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    if (source === "csv" && !csvFile) {
      setDataset(null);
      setFilterResult(null);
      setVisibleRange(EMPTY_RANGE);
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
      setVisibleRange(EMPTY_RANGE);

      const initializationPromise =
        source === "synthetic"
          ? initializeDataset(
              {
                source: "synthetic",
                strategy,
                totalRows: selectedSize,
                seed: createDatasetSeed(regenerationTick, selectedSize),
              },
              controller.signal
            )
          : initializeDataset(
              {
                source: "csv",
                strategy,
                file: csvFile!,
              },
              controller.signal
            );

      initializationPromise
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
              : "No se pudo inicializar el dataset de la POC."
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
  }, [csvFile, regenerationTick, selectedSize, source, strategy]);

  useEffect(() => {
    if (!dataset) {
      setIsFiltering(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsFiltering(true);

      runFilter(dataset, deferredQuery, controller.signal)
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
              : "No se pudo aplicar el filtro al dataset."
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
  }, [dataset, deferredQuery]);

  const activeColumns = dataset?.columns ?? (source === "synthetic" ? [...SYNTHETIC_COLUMNS] : CSV_SAMPLE_COLUMNS);
  const configuredRowCount = dataset?.totalRows ?? (source === "synthetic" ? selectedSize : 0);
  const filteredCount = filterResult?.filteredCount ?? 0;
  const logicalListHeight = filteredCount * ROW_HEIGHT;
  const usesCompressedScroll = logicalListHeight > SAFE_SCROLLABLE_HEIGHT;
  const isCsvWithoutFile = source === "csv" && !csvFile;

  const getDisplayRow = useCallback(
    (displayIndex: number): RowData => {
      if (!dataset || !filterResult) {
        return {
          id: 0,
          cells: activeColumns.map(() => ""),
        };
      }

      if (dataset.strategy === "materialized") {
        return filterResult.filteredRows![displayIndex]!;
      }

      const logicalIndex = filterResult.matchingIndexes
        ? filterResult.matchingIndexes[displayIndex]!
        : displayIndex;

      return dataset.getRow(logicalIndex);
    },
    [activeColumns, dataset, filterResult]
  );

  const totalApproxMemory = useMemo(() => {
    return (dataset?.approxMemoryBytes ?? 0) + (filterResult?.cacheBytes ?? 0);
  }, [dataset, filterResult]);

  const sourceLabel =
    source === "synthetic"
      ? "Dataset sintético local"
      : csvFile
        ? `CSV local: ${csvFile.name}`
        : "CSV local sin archivo";

  const strategyLabel = buildStrategyLabel(source, strategy);
  const searchModeText = buildSearchModeText(source, strategy);
  const strategyNarrative = buildNarrative(source, strategy);
  const searchPlaceholder =
    source === "csv"
      ? "Busca por nombre, código de usuario, fecha o número de fila"
      : strategy === "materialized"
        ? "Filtra por id, cell-... o segment-... sobre objetos reales en memoria"
        : "Búsqueda lógica por id, cell-..., segment-... o bucket-...";

  const activeWarning = dataset?.warning ?? null;

  const statusText = isGenerating
    ? source === "csv"
      ? strategy === "materialized"
        ? "Cargando y materializando CSV..."
        : "Cargando e indexando CSV..."
      : strategy === "materialized"
        ? "Generando dataset materializado..."
        : "Inicializando dataset lógico..."
    : isFiltering
      ? source === "csv"
        ? "Filtrando CSV..."
        : "Aplicando filtro..."
      : null;

  const visibleRangeLabel =
    visibleRange.startLogicalIndex === null || visibleRange.endLogicalIndex === null
      ? "n/a"
      : `${formatNumber(visibleRange.startLogicalIndex)} - ${formatNumber(
          visibleRange.endLogicalIndex
        )}`;

  const metrics = [
    {
      label: "Fuente",
      value: source === "synthetic" ? "Sintética" : "CSV local",
      detail: sourceLabel,
    },
    {
      label: "Total de filas",
      value: formatNumber(configuredRowCount),
      detail:
        source === "synthetic"
          ? "Cantidad lógica configurada para la simulación."
          : "Cantidad detectada en el archivo CSV cargado.",
    },
    {
      label: "Estrategia",
      value: strategyLabel,
      detail: "Comparación directa entre costo de memoria y costo de render.",
    },
    {
      label: "Tamaño de archivo",
      value: formatBytes(dataset?.fileSizeBytes ?? csvFile?.size ?? 0),
      detail:
        source === "csv"
          ? "Peso del CSV local seleccionado."
          : "No aplica para la fuente sintética.",
    },
    {
      label: "Filas visibles renderizadas",
      value: formatNumber(visibleRange.renderedRows),
      detail: "DOM real montado por la virtualización.",
    },
    {
      label: "Índice visible",
      value: visibleRangeLabel,
      detail: "Rango lógico actualmente visible en el viewport.",
    },
    {
      label: "Altura por fila",
      value: `${ROW_HEIGHT}px`,
      detail: "Las filas visibles siguen midiendo 16px aunque el scroll físico pueda comprimirse.",
    },
    {
      label: "Modo de scroll",
      value: usesCompressedScroll ? "Comprimido" : "1:1",
      detail: usesCompressedScroll
        ? "El scrollbar físico se comprime para seguir recorriendo todo el rango lógico sin chocar con el límite del navegador."
        : "La altura física y la altura lógica coinciden.",
    },
    {
      label: "Init / carga",
      value: dataset ? formatMilliseconds(dataset.generationMs) : "Pendiente",
      detail: "Tiempo aproximado para preparar la fuente y la estrategia actual.",
    },
    {
      label: "Filtrado",
      value: filterResult ? formatMilliseconds(filterResult.filterMs) : "Pendiente",
      detail: "Costo aproximado de la búsqueda actual.",
    },
    {
      label: "Objetos materializados",
      value: dataset ? formatNumber(dataset.materializedObjects) : "0",
      detail: "Filas reales creadas como objetos y retenidas en memoria.",
    },
    {
      label: "Memoria estimada",
      value: formatBytes(totalApproxMemory),
      detail: "Estimación aproximada: dataset base + estructura auxiliar del filtro.",
    },
  ];

  return (
    <main className="shell">
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">POC React + Vite + virtualización real</p>
          <h1>Visualización local de datasets masivos y CSV enormes</h1>
          <p className="hero-text">
            La lista completa existe a nivel lógico, pero solo se renderizan las filas visibles
            para mantener el rendimiento.
          </p>
        </div>
        <div className="hero-notes">
          <p>{strategyNarrative}</p>
          <p>{searchModeText}</p>
          <p>
            Cuando la altura lógica supera {formatNumber(SAFE_SCROLLABLE_HEIGHT)}px, la POC
            comprime el scroll físico para no quedar cortada por el límite real de altura del
            navegador. El rango lógico completo sigue siendo alcanzable.
          </p>
        </div>
      </section>

      <section className="panel controls">
        <div className="control-group">
          <label htmlFor="source">Fuente de datos</label>
          <select
            id="source"
            value={source}
            onChange={(event) => {
              setSource(event.target.value as DatasetSource);
            }}
          >
            <option value="synthetic">Dataset sintético</option>
            <option value="csv">CSV local</option>
          </select>
        </div>

        {source === "synthetic" ? (
          <div className="control-group">
            <label htmlFor="dataset-size">Tamaño del dataset</label>
            <select
              id="dataset-size"
              value={selectedSize}
              onChange={(event) => {
                setSelectedSize(Number(event.target.value) as DatasetSize);
              }}
            >
              {DATASET_OPTIONS.map((sizeOption) => (
                <option key={sizeOption} value={sizeOption}>
                  {formatNumber(sizeOption)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="control-group">
            <label htmlFor="csv-file">Archivo CSV</label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setCsvFile(nextFile);
                setErrorMessage(null);
              }}
            />
            <small>
              Cabecera obligatoria. Para millones de filas, usa preferentemente la estrategia
              indexada / lazy.
            </small>
          </div>
        )}

        <div className="control-group">
          <label htmlFor="strategy">Estrategia</label>
          <select
            id="strategy"
            value={strategy}
            onChange={(event) => {
              setStrategy(event.target.value as DatasetStrategy);
            }}
          >
            <option value="lazy">
              {source === "csv" ? "Indexada / lazy desde CSV" : "Lazy / por índice"}
            </option>
            <option value="materialized">Materializada</option>
          </select>
        </div>

        <div className="control-group search-group">
          <label htmlFor="search">Búsqueda / filtro</label>
          <input
            id="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={searchPlaceholder}
            spellCheck={false}
          />
          <small>
            {source === "csv" ? (
              <>
                Ejemplos: <code>Ayumi</code>, <code>8DCA</code>, <code>2025-12</code>.
              </>
            ) : (
              <>
                Ejemplos: <code>42</code>, <code>cell-</code>, <code>segment-0010</code>,{" "}
                <code>bucket-0042</code>.
              </>
            )}
          </small>
        </div>

        <div className="control-group action-group">
          <label>Acción</label>
          <button
            type="button"
            onClick={() => {
              setRegenerationTick((value) => value + 1);
            }}
          >
            {source === "csv" ? "Recargar dataset" : "Regenerar dataset"}
          </button>
        </div>
      </section>

      {(activeWarning || errorMessage) && (
        <section className="panel alert-panel">
          {activeWarning && <p className="alert warning">{activeWarning}</p>}
          {errorMessage && <p className="alert error">{errorMessage}</p>}
        </section>
      )}

      <section className="metrics-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="panel metric-card">
            <p className="metric-label">{metric.label}</p>
            <strong className="metric-value">{metric.value}</strong>
            <p className="metric-detail">{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="panel list-panel">
        <div className="list-toolbar">
          <div>
            <h2>Lista virtualizada</h2>
            <p>
              Scroll vertical real sobre {formatNumber(filteredCount)} filas visibles para la vista
              actual.
            </p>
          </div>
          <div className="list-badges">
            <span className="badge">{sourceLabel}</span>
            <span className="badge">{strategyLabel}</span>
            <span className="badge">
              {usesCompressedScroll ? "Scroll lógico comprimido" : "Scroll 1:1"}
            </span>
            <span className="badge">{statusText ?? "Lista lista"}</span>
          </div>
        </div>

        <div className="tech-explain">
          <p>
            Materializada: parsea o genera filas completas y las retiene como objetos JS listos
            para render y filtro local.
          </p>
          <p>
            Lazy: mantiene solo el total lógico y resuelve cada fila bajo demanda. En CSV, eso se
            logra con bytes del archivo + offsets de registros; en sintético, con generación por
            índice.
          </p>
        </div>

        {isCsvWithoutFile ? (
          <div className="upload-empty-state">
            <p>Selecciona un archivo CSV local para poblar la grilla.</p>
            <small>
              Se espera una cabecera en la primera línea, por ejemplo:{" "}
              <code>Nombre_Completo,Codigo_Usuario,Fecha_Compra</code>.
            </small>
          </div>
        ) : (
          <VirtualizedGrid
            columns={activeColumns}
            rowCount={filteredCount}
            rowHeight={ROW_HEIGHT}
            getRow={getDisplayRow}
            statusText={statusText}
            onVisibleRangeChange={(nextRange) => {
              setVisibleRange((currentRange) =>
                sameVisibleRange(currentRange, nextRange) ? currentRange : nextRange
              );
            }}
          />
        )}
      </section>

      <section className="panel footer-notes">
        <p>
          Virtualizar resuelve el problema de render: el DOM sigue pequeño y el scroll se mantiene
          usable. No resuelve automáticamente el costo de haber materializado millones de objetos.
        </p>
        <p>
          En CSV lazy, el archivo bruto sí se carga en memoria junto con un índice de offsets; lo
          que se evita es crear millones de filas JS desde el inicio.
        </p>
        <p>
          En sintético lazy, la memoria base es todavía menor porque solo existen el total y la
          función generadora por índice.
        </p>
        {filterResult && <p>{filterResult.description}</p>}
      </section>
    </main>
  );
}

export default App;
