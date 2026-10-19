# Tasks

## 1. Línea base de medición

- [x] 1.1 Ejecutar `npm run build:unpack` SIN aplicar cambios y registrar el tamaño de `app.asar` (línea base) en las notas de verificación del cambio — verificado cuando el tamaño queda registrado con fecha y comando.

## 2. Exclusiones de artefactos de trabajo en `electron-builder.yml` (F15)

- [x] 2.1 Añadir al bloque `files` de `electron-builder.yml` los patrones de negación del diseño D1: `!coverage/**`, `!{.opencode,.engram,.codebase-memory,.vscode}/**`, `!openspec/**`, `!repomix-output.xml`, `!*.backup`, `!{AUDIT_REPORT_*.md,PROJECT_EXPLANATION_*.md,README_V1.md,TECH_STACK_ANALYSIS.md,REPERTOIRE_LEARNING_*.md,ARCHITECTURE.md}`, `!renderer/**` — verificado cuando el YAML parsea correctamente y los 7 patrones nuevos conviven con los existentes sin modificarlos.

## 3. Reclasificación de dependencias en `package.json` (F16, F17)

- [x] 3.1 Mover `lucide-react`, `zustand`, `@tailwindcss/vite` y `tailwindcss` de `dependencies` a `devDependencies` manteniendo las versiones actuales — verificado cuando `dependencies` contiene exactamente `@electron-toolkit/preload` y `@electron-toolkit/utils` y los cuatro paquetes aparecen en `devDependencies`.
- [x] 3.2 Ejecutar `npm install` para reclasificar y regenerar `package-lock.json`; revisar el diff del lockfile limitado a la reclasificación de los cuatro paquetes — verificado cuando `npm install` finaliza sin errores y el diff del lockfile no introduce cambios colaterales ajenos a la reclasificación.

## 4. Reempaquetado, medición e inspección del ASAR

- [x] 4.1 Ejecutar `npm run build:unpack` con los cambios aplicados y medir el nuevo tamaño de `app.asar`; comparar contra la línea base de 1.1 (35,05 MB) — verificado cuando la reducción medida es ≥ 29 MB y el ASAR final es ≤ 6 MB, y ambos valores quedan registrados en `verification.md`.
- [x] 4.2 Inspeccionar el contenido del `app.asar` generado (listado del asar) y contrastar con los escenarios del spec: ausencia de `.opencode/`, `.engram/`, `.codebase-memory/`, `.vscode/`, `coverage/`, `openspec/`, `repomix-output.xml`, `*.backup`, markdowns de auditoría/documentación de raíz y `renderer/`; presencia de `out/main/index.js`, `out/preload/index.js`, `out/renderer/**`, `package.json` y `node_modules` runtime; ausencia en `node_modules` de `lucide-react`, `zustand`, `@tailwindcss/vite`, `tailwindcss` y transitivas `@tailwindcss/oxide*`/`@tailwindcss/node` — verificado cuando el listado confirma todas las presencias y ausencias.

## 5. Verificación de integridad funcional

- [x] 5.1 Ejecutar `npm test` (vitest run, modo no interactivo) — verificado cuando todos los suites están en verde y 0 stderr.
- [x] 5.2 Ejecutar `npm run typecheck` — verificado cuando finaliza sin errores.
- [x] 5.3 Ejecutar `npm run lint` — verificado cuando finaliza sin errores.
- [x] 5.4 Arrancar la aplicación desde el directorio desempaquetado (`electron-builder --dir`) y confirmar que Main/Preload cargan sin errores de módulos no encontrados y que la ventana del renderer se muestra — verificado cuando la app arranca y funciona sin errores en consola.

## Workflow follow-up

- Archivar el cambio tras satisfacer los requisitos de revisión del proyecto (`/opsx-archive`).
- Verificar el resultado archivado.
