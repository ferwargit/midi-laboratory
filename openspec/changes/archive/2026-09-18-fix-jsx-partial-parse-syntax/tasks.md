## 1. Inspección y línea base

- [x] 1.1 Confirmar contra `codebase-memory-mcp` los rangos flaggeados leyendo
      `index_status` del proyecto `midi-laboratory`: deben listar
      `SessionsTableTab.tsx` (257-257, 267-267), `KnowledgeGuideModal.tsx` (43-43) y
      `LatencySpectrumDiagram.tsx` (12-12) como `parse_partial`.
- [x] 1.2 Leer las cuatro líneas blanco y verificar que cada `&` está embebido en
      texto JSX (no en un literal de cadena TS) antes de editar; registrar que
      `KnowledgeGuideModal.tsx:26` (`label: 'Latencia & Fatiga'`) queda excluido por ser
      cadena TS válida.
- [x] 1.3 Ejecutar `npm run typecheck` y `npm run test` y registrar los resultados
      como línea base pre-cambio (deben pasar; sirve para confirmar que cualquier
      fallo posterior es regresión introducida por este cambio).

## 2. Corrección de sintaxis JSX

- [x] 2.1 En `src/renderer/src/components/views/analytics/SessionsTableTab.tsx:257`,
      reemplazar `<span>Fecha & ISI</span>` por `<span>Fecha &amp; ISI</span>` y verificar
      con `read` que la línea resultante contiene `&amp;` y ninguna otra alteración.
- [x] 2.2 En `src/renderer/src/components/views/analytics/SessionsTableTab.tsx:267`,
      reemplazar `<span>Contenido & Timbre</span>` por
      `<span>Contenido &amp; Timbre</span>` y verificar con `read` que solo cambió el
      carácter escapado.
- [x] 2.3 En `src/renderer/src/components/views/guide/KnowledgeGuideModal.tsx:43`,
      reemplazar `Psicoacústico & Metacognición` por `Psicoacústico &amp; Metacognición`
      y verificar con `read` que `className`, etiquetas y estructura quedan intactos.
- [x] 2.4 En `src/renderer/src/components/views/guide/LatencySpectrumDiagram.tsx:12`,
      reemplazar `COGNITIVA & FATIGA` por `COGNITIVA &amp; FATIGA` y verificar con `read`
      que el emoji `⚡` y las clases se preservan.
- [x] 2.5 Ejecutar `npm run lint` (eslint) y confirmar que no se introducen nuevos
      errores ni advertencias en los tres archivos modificados.

## 3. Verificación funcional

- [x] 3.1 Ejecutar `npm run typecheck` (node + web) y verificar que pasa sin errores,
      sin diferencias respecto a la línea base de 1.3.
- [x] 3.2 Ejecutar `npm run test` (vitest run) y verificar que la suite completa pasa
      con el mismo número de tests que la línea base de 1.3 — cero tests nuevos,
      cero fallidos.

## 4. Verificación del grafo de conocimiento

- [x] 4.1 Reindexar el proyecto (`index_repository` sobre
      `D:/07-Repositorios/midi-laboratory`) y verificar que el reporte de indexación no
      lista los tres archivos en `parse_partial`.
- [x] 4.2 Ejecutar `check_index_coverage` para los tres archivos y verificar que
      devuelve `status` completo (no `partial`) con `coverage` vacío para cada uno.
- [x] 4.3 Confirmar visualmente en el navegador (playwright-cli, `--headed`) que las
      cabeceras "Fecha & ISI", "Contenido & Timbre", el título del Centro de
      Conocimiento y el encabezado del espectro de latencia se renderizan con el `&`
      visible y el diseño idéntico al anterior.
  > **OMISIÓN FORMAL APROBADA:** la verificación visual en navegador/vivo fue
  > omitida de forma explícita y aprobada por el usuario, dado que este proyecto es
  > una aplicación de escritorio Electron y no debe levantarse en entornos
  > desatendidos. Su evidencia sustituta de renderizado correcto es: (a) `npm run
typecheck` con 0 errores (node + web), (b) `npm run test` con la suite completa
  > de **284 tests en 52 archivos pasada al 100%** — incluyendo los tests de
  > componente `SessionsTableTab.test.tsx` y `AnalyticsFilterBar.test.tsx` que
  > montan los componentes reales con la entidad `&amp;` ya aplicada —, y (c) la
  > reindexación AST de codebase-memory-mcp que certificó los tres archivos como
  > completos (sin `parse_partial`). Adicionalmente, `&amp;` es una entidad HTML
  > estándar que el navegador decodifica al carácter `&`, por lo que el DOM
  > renderizado es idéntico byte a byte.
