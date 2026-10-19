# Proposal

## Why

La auditoría V9 (`AUDIT_REPORT_V9.md`, hallazgos F15, F16 y F17) midió ~95 MB de peso muerto dentro del `app.asar` del instalador: ~58 MB de artefactos de trabajo del repositorio (`.opencode/`, `coverage/`, `.codebase-memory/`, `openspec/`, `repomix-output.xml`, MDs de raíz) que electron-builder empaqueta porque el bloque `files` solo declara negaciones y no respeta `.gitignore`, y ~37,6 MB de dependencias (`lucide-react` 33,6 MB, `zustand` 0,09 MB, tooling de Tailwind ~3,94 MB) clasificadas como `dependencies` pese a que Vite ya las bundlea íntegramente en `out/renderer` y el renderer nunca resuelve `node_modules` en runtime. Esto infla el instalador NSIS y el ASAR sin ningún beneficio en runtime, y empeora cada distribución y actualización de la aplicación.

## What Changes

- `electron-builder.yml`: añadir exclusiones explícitas en la directiva `files` para que el ASAR no empaquete:
  - Directorios de tooling: `.opencode/**`, `.engram/**`, `.codebase-memory/**`, `.vscode/**`
  - `coverage/**`
  - `openspec/**`
  - `repomix-output.xml` y `*.backup`
  - Markdowns de documentación/auditoría de la raíz (`AUDIT_REPORT_*.md`, `PROJECT_EXPLANATION_*.md`, `README_V1.md`, `TECH_STACK_ANALYSIS.md`, `REPERTOIRE_LEARNING_*.md`, `ARCHITECTURE.md`)
  - Directorio residual `renderer/**` (vacío, en la raíz del repositorio)
- `package.json`: reclasificar a `devDependencies` los paquetes `lucide-react`, `zustand`, `@tailwindcss/vite` y `tailwindcss` (todos consumidos exclusivamente por el renderer, que Vite bundlea y tree-shakea en build time).
- `package.json`: mantener en `dependencies` únicamente `@electron-toolkit/preload` y `@electron-toolkit/utils` (única dependencia externa resuelta desde `node_modules` en runtime por los procesos Main/Preload; `react`/`react-dom` ya están correctamente en `devDependencies`).
- Verificación empírica obligatoria: `npm run build:unpack` midiendo la reducción del tamaño de `app.asar` (objetivo ≈ −95 MB), suite completa `npm test`, `npm run typecheck`, `npm run lint` sin regresiones, y arranque de la app desempaquetada sin errores de módulos no encontrados.

## Capabilities

### New Capabilities

- `10-build-packaging`: política de empaquetado de la distribución Electron — qué contenido del repositorio queda excluido del ASAR y qué dependencias son runtime (viajan en `node_modules` dentro del ASAR) frente a build-time (solo `devDependencies`, bundleadas por Vite). Continúa la numeración existente de capacidades (01–09) y es dueña de los requisitos verificables de tamaño y contenido del ASAR.

### Modified Capabilities

<!-- Ninguna: las capacidades 01–09 describen comportamiento en runtime y no cambian. -->

## Impact

- **Archivos de configuración**: `electron-builder.yml` (bloque `files`), `package.json` (secciones `dependencies`/`devDependencies`) y `package-lock.json` (regenerado por `npm install` tras la reclasificación).
- **Sin cambios en código fuente**: no se modifica ningún módulo de `src/`; el bundle del renderer (`out/renderer`) y los externalizados de Main/Preload (`out/main`, `out/preload`) se generan igual.
- **Riesgo controlado**: si una dependencia reclasificada fuera resuelta en runtime por Main/Preload, la app fallaría al arrancar desempaquetada; la inspección previa confirma que `src/main/index.ts` solo importa `@electron-toolkit/utils` y `src/preload/index.ts` solo usa built-ins de `electron`, por lo que el riesgo se cubre con la verificación de arranque.
- **Sistemas afectados**: tamaño del instalador NSIS y del `app.asar` (−~95 MB esperados); ningún cambio de API, comportamiento en runtime ni persistencia.
