# Tasks

## 1. Tests mode-aware en el dominio (TDD: Red)

- [x] 1.1 En `src/renderer/src/domain/analytics/latencyStats.test.ts`: sustituir la importación de `COGNITIVE_LATENCY_THRESHOLDS` por `getLatencyThresholds`; añadir casos que verifiquen que `computePerNoteLatencyStats(answers, mode)` clasifica `fastReflexPercent` según la modalidad (latencias 2000/3000 ms → 0 % con `single_note`, 100 % con `sequences`) y que la frontera `< FAST_MAX_MS` es estricta por modalidad. Verificación: `npx vitest run src/renderer/src/domain/analytics/latencyStats.test.ts` falla (Red) porque la firma aún no acepta `mode`.
- [x] 1.2 En `src/renderer/src/domain/analytics/thresholdsConsistency.test.tsx`: eliminar las referencias al alias deprecado (líneas 6, 79-82, 102, 107, 151, 187, 191) sustituyéndolas por `getLatencyThresholds(...)`/`COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note`; añadir un test que afirme que el módulo `thresholds.ts` ya NO exporta `COGNITIVE_LATENCY_THRESHOLDS`. Verificación: el test de ausencia del export falla (Red) hasta completar 4.1.
- [x] 1.3 En `src/renderer/src/domain/ai/promptBuilder.test.ts`: añadir aserciones de que los prompts construidos con `metrics.modeFilter === 'intervals'` (y `'sequences'`) citan las etiquetas SSOT de esa modalidad (`< 2.4s`, `2.4s - 3.8s` / `< 3.5s`, `3.5s - 5.0s`) y no las de `single_note`. Verificación: `npx vitest run src/renderer/src/domain/ai/promptBuilder.test.ts` falla (Red).

## 2. Dominio: latencia mode-aware (TDD: Green)

- [x] 2.1 En `src/renderer/src/domain/analytics/latencyStats.ts`: extender la firma a `computePerNoteLatencyStats(answers: DbAnswerRecord[], mode?: string)`, importar `getLatencyThresholds` desde `./thresholds` y usar `getLatencyThresholds(mode).FAST_MAX_MS` en el conteo de `fastCount` (línea 58). Verificación: `npx vitest run src/renderer/src/domain/analytics/latencyStats.test.ts` pasa (Green), incluidos los casos nuevos de 1.1.

## 3. UI: gráfico de latencia coherente con la modalidad

- [x] 3.1 En `src/renderer/src/components/trainer/AnalyticsCharts.tsx`: eliminar la importación de `COGNITIVE_LATENCY_THRESHOLDS` (línea 8); añadir `const thresholds = useMemo(() => getLatencyThresholds(modeFilter), [modeFilter])` y pasar `modeFilter` a `computePerNoteLatencyStats(answers, modeFilter)` (línea 61, memo sobre `[answers, modeFilter]`). Verificación: `npx vitest run src/renderer/src/components/trainer/s3-render-performance.test.tsx` sigue pasando (sin regresión de memoización).
- [x] 3.2 En el mismo archivo: reemplazar los usos de `COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS`/`MEDIUM_MAX_MS` (líneas 491-545) por `thresholds.*`, y hacer dinámicos la etiqueta del eje (`1.4s` → valor de `thresholds.FAST_MAX_MS`, línea 511) y la leyenda (líneas 459-461) interpolando `FAST_LABEL`/`MEDIUM_LABEL`/`SLOW_LABEL`. Verificación: nuevo test de render en `thresholdsConsistency.test.tsx` con `modeFilter='sequences'` muestra la línea de referencia en `3.5s` y la leyenda `< 3.5s` / `3.5s - 5.0s` / `> 5.0s`, sin los literales `1.4s`/`2.8s`.
- [x] 3.3 En `src/renderer/src/components/views/AnalyticsView.tsx`: añadir `modeFilter={modeFilter}` al `<AnalyticsCharts ...>` de la pestaña `charts` (línea 456). Verificación: test de render de `AnalyticsView` (o del gráfico vía props) confirma que el prop llega; con filtro `'all'` el gráfico usa la configuración de `single_note`.

## 4. IA: prompts con etiquetas de la modalidad

- [x] 4.1 En `src/renderer/src/domain/ai/promptBuilder.ts`: eliminar `COGNITIVE_LATENCY_THRESHOLDS` del import (línea 5); en cada builder resolver `getLatencyThresholds(mode)` o `getLatencyThresholds(metrics.modeFilter)` y sustituir los 7 usos (líneas 22, 121, 151, 220, 274, 304). Verificación: `npx vitest run src/renderer/src/domain/ai/promptBuilder.test.ts` pasa (Green), incluidos los casos de 1.3.

## 5. SSOT: retirar el export deprecado

- [x] 5.1 En `src/renderer/src/domain/analytics/thresholds.ts`: eliminar las líneas 56-57 (comentario `@deprecated` + `export const COGNITIVE_LATENCY_THRESHOLDS`). Verificación: `npx vitest run src/renderer/src/domain/analytics/thresholdsConsistency.test.ts` pasa, incluida la aserción de ausencia del export de 1.2.

## 6. Verificación integral

- [x] 6.1 Grep de referencias huérfanas: buscar `COGNITIVE_LATENCY_THRESHOLDS` con frontera de palabra en todo `src/` (excluyendo `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE`) y confirmar 0 ocurrencias. Verificación: comando `rg "\bCOGNITIVE_LATENCY_THRESHOLDS\b" src/` (o `Select-String` equivalente) sin resultados.
- [x] 6.2 Suite completa sin regresiones: `npm test` (0 fallos), `npm run typecheck` (0 errores) y `npm run lint` (0 errores). Verificación: los tres comandos terminan con código 0.
- [x] 6.3 Verificación de escenarios del spec delta: repasar los escenarios de `specs/05-analytics-psychometrics/spec.md` (resolución por modalidad con fallback, variación de `fastReflexPercent`, línea de referencia/leyenda por modalidad, filtro `'all'` = `single_note`) y confirmar que cada uno está cubierto por un test automatizado existente o nuevo. Verificación: lista de escenarios → test correspondiente sin huecos.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied (`/opsx-archive`).
- Verify the archived result.
