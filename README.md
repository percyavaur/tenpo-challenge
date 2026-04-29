# Lista Virtualizada

POC en React + Vite para explorar archivos CSV masivos sin renderizar millones de nodos en el DOM.

## Qué quedó en el proyecto

- Lista virtualizada con `@tanstack/react-virtual`
- Carga local de archivos CSV
- Lectura indexada del CSV bajo demanda
- Filtro separado del flujo de lectura/render
- Shuffle separado del flujo de lectura/render
- Métricas básicas de carga, filtrado y memoria estimada

## Estructura relevante

```text
src/
├── App.tsx
├── components/
│   └── VirtualizedGrid.tsx
├── hooks/
│   └── useShuffleOrder.ts
├── lib/
│   ├── async.ts
│   ├── dataset.ts
│   ├── filter.ts
│   └── shuffle.ts
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
