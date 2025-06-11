# Tenpo Challenge

Una aplicación construida con Vite, React y TypeScript siguiendo la metodología **Atomic Design**. Este repo contiene el código fuente del challenge asignado para demostrar mis habilidades.

[Demo en producción](https://tenpochallenge-5f62e.web.app/)

---

## Tabla de Contenidos

- [Descripción](#descripción)  
- [Demo](#demo)  
- [Tecnologías](#tecnologías)  
- [Estructura del Proyecto](#estructura-del-proyecto)  
- [Requisitos Previos](#requisitos-previos)  
- [Instalación](#instalación)  
- [Scripts Disponibles](#scripts-disponibles)  
- [Atomic Design](#atomic-design)  
- [Despliegue](#despliegue)  
- [Contribuir](#contribuir)  
- [Licencia](#licencia)  
- [Contacto](#contacto)  

---

## Descripción

Tenpo Challenge es un reto de front-end donde debes levantar un proyecto creado con Vite, React y TypeScript, demostrando:

- Configuración de Vite para desarrollo y producción  
- Uso de React y TypeScript para componentes tipados  
- Estructura de carpetas basada en Atomic Design  
- Despliegue continuo a Firebase Hosting  

---

## Demo

La aplicación está desplegada y accesible en:

> https://tenpochallenge-5f62e.web.app/

---

## Tecnologías

- [Vite](https://vitejs.dev/) – Bundler ultrarrápido  
- [React](https://reactjs.org/) – Biblioteca de UI  
- [TypeScript](https://www.typescriptlang.org/) – Tipado estático  
- [Tailwind CSS](https://tailwindcss.com/) (opcional) – Utilidades de estilos  
- [Firebase Hosting](https://firebase.google.com/products/hosting) – Hosting gratuito para SPAs  

---

## Estructura del Proyecto

```
├── .firebase/             # Configuración de Firebase
├── dist/                  # Build de producción
├── node_modules/          # Dependencias instaladas
├── public/                # Archivos estáticos (favicon, index.html)
├── src/
│   ├── assets/            # Imágenes, fuentes, SVGs
│   ├── components/        # Componentes atómicos y compuestos
│   ├── context/           # React Context providers
│   ├── core/              # Lógica central, utils generales
│   ├── layouts/           # Layouts y templates de página
│   ├── models/            # Definición de tipos y modelos
│   ├── pages/             # Vistas/páginas para rutas
│   ├── services/          # Lógica para consumo de APIs
│   ├── index.css          # Estilos globales
│   ├── main.tsx           # Punto de entrada de la app
│   └── vite-env.d.ts      # Tipos para entorno Vite
├── .firebaserc            # Config de Firebase CLI
├── firebase.json          # Config de Firebase Hosting
├── index.html             # Plantilla HTML principal
├── package.json           # Dependencias y scripts
├── tailwind.config.js     # Configuración de Tailwind CSS
├── tsconfig.app.json      # Configuración TS para la app
├── tsconfig.json          # Configuración TS general
├── tsconfig.node.json     # Config TS para entorno Node
└── vite.config.ts         # Configuración de Vite
```

---

## Requisitos Previos

- Node.js v16+  
- npm v8+ o yarn v1/v2  

---

## Instalación

1. Clona el repositorio  
   ```bash
   gh repo clone https://github.com/percyavaur/tenpo-challenge.git
   cd tenpo-challenge
   ```
2. Instala dependencias  
   ```bash
   npm install
   ```
3. Crea un archivo `.env` en la raíz con tus variables (opcional):  
   ```
   VITE_API_URL=https://openlibrary.org
   ```
4. Levanta el servidor de desarrollo  
   ```bash
   npm run dev
   ```
5. Abre tu navegador en `http://localhost:5173`

---

## Scripts Disponibles

| Script       | Descripción                                  |
| ------------ | -------------------------------------------- |
| `dev`        | Inicia Vite en modo desarrollo               |
| `build`      | Genera versión optimizada para producción    |
| `preview`    | Levanta servidor para revisión de `build`    |

---

## Atomic Design

Se siguió la metodología Atomic Design para organizar los componentes:

1. **Átomos**: Botones, Inputs, Labels  
2. **Moléculas**: Form Groups, Card sencillo  
3. **Organismos**: Cabeceras, Menús, Formularios completos  
4. **Pages**: Vistas finales que combinas los templates con datos reales  

---

## Propuesta de mejora
1. **Debounce** Implementar debounce cuando sea innecesario llamar a una api en cada cambio, ejemplo:
   - Un input que llame al endpoint al momento de acabar la escritura y no en cada carácter añadido.
2. **Caching** Uso de cache para información poco mutable, esto reduce el tiempo de petición en un endpoint
   y evita abrir una conexión a la base de datos innecesaria.