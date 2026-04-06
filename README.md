# Lista Virtualizada

POC en React + Vite para explorar datasets masivos sin renderizar millones de nodos en el DOM.

## Qué quedó en el proyecto

- Lista virtualizada con `@tanstack/react-virtual`
- Dataset sintético configurable
- Carga local de archivos CSV
- Comparación entre estrategia `lazy` y `materialized`
- Métricas básicas de carga, filtrado y memoria estimada

## Estructura relevante

```text
src/
├── App.tsx
├── components/
│   └── VirtualizedGrid.tsx
├── lib/
│   └── dataset.ts
├── index.css
└── main.tsx
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`

## Desarrollo

```bash
npm install
npm run dev
```
