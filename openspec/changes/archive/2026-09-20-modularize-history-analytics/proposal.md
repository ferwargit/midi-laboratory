## Why

La Auditoría V6 (OLA 4.3 de remediación) detectó que `src/renderer/src/domain/analytics/historyAnalytics.ts` creció hasta **1342 líneas** mezclando catorce responsabilidades distintas bajo un mismo archivo: umbrales SSOT, contratos de tipos, clasificación de sesiones, psicometría (CPI/IRT/Shannon), estadísticas de latencia por nota, telemetría temporal de 4 factores, matriz de confusión 2D, filtrado avanzado, comparativas longitudinales y orquestación del pipeline. Ese monolito viola el Principio de Responsabilidad Única, dificulta la localización de los defectos (los hallazgos F-06, F-09, F-13, F-14 y F-16 pasaron desapercibidos en revisiones previas precisamente porque estaban enterrados en un archivo de ese tamaño) y multiplica el costo de toda evolución futura sobre la spec `05-analytics-psychometrics`.

Junto a la deuda estructural, la Auditoría Frente 3 verificó cinco defectos de coherencia y casos borde que deben corregirse en el mismo movimiento, porque la extracción de submódulos es el momento de menor riesgo para tocarlos.

## What Changes

- **Modularización SRP de `historyAnalytics.ts`** en `src/renderer/src/domain/analytics/`, extrayendo submódulos cohesivos (50–150 líneas cada uno):
  - `thresholds.ts`: `COGNITIVE_LATENCY_THRESHOLDS`, `MASTERY_THRESHOLDS`, `ISI_THRESHOLDS`, `BIAS_DOMINANCE_RATIO`.
  - `types.ts`: todos los interfaces y tipos de analítica (`AnalyticsMetrics`, `DetailedSessionAnalysis`, `SessionTimelineAnalysis`, `AnalyticsFilterOptions`, `ConfusionMatrix2DData`, etc.).
  - `sessionClassification.ts`: `resolveSessionFormat`, `resolveNominalPoolSize`, `formatInterSessionGap`, `computeInterSessionGapMap`, `resolveSessionInputMethod`, `resolveSessionDominantBias`, `InterSessionGapInfo` y los clasificadores `isSingleNoteSession` / `isIntervalSession` / `isSequenceSession` / `isRepertoireSession`.
  - `psychometrics.ts`: `calculateSessionCPI`.
  - `latencyStats.ts`: `computePerNoteLatencyStats`, `computeNotePerformancesFromAnswers`.
  - `timelineTelemetry.ts`: `analyzeSessionTimeline`.
  - `confusionMatrix.ts`: `computePitchClassConfusionMatrix`, `PITCH_CLASSES`.
  - `sessionFilters.ts`: `filterSessionsAdvanced`, `filterSessionsByMode`.
  - `longitudinal.ts`: `computeLongitudinalComparisons`, `reconstructSessionConfig`.
- **`historyAnalytics.ts` se convierte en módulo orquestador / barrel export**: implementa `computeAnalyticsMetrics` orquestando los submódulos y re-exporta la totalidad de funciones, tipos y constantes mediante `export * from ...`, de modo que **ningún import de los 35 sitios consumidores** (stores, hooks, components/views, dominio IA/adaptación y tests) se rompe.
- **F-06 / F-14 — `resolveNominalPoolSize`**: la rama regex (`notas (N)`) devolvía el valor parseado sin piso, y las ramas `.includes('nivel 1' | 'nivel 2' | ...)`) colisionaban con niveles de dos dígitos (`"nivel 10"` contiene `"nivel 1"`). Se unifica la resolución por regex con límites de dígito y se aplica `Math.max(2, ...)` a toda rama derivada.
- **F-09 — `computeLongitudinalComparisons`**: asignaba `totalAttempts: sorted.length` (cantidad de sesiones del grupo) en lugar del total de preguntas evaluadas; pasa a sumar `session.totalQuestions` de cada sesión del grupo.
- **F-13 — `analyzeSessionTimeline`**: para sesiones vacías (`total === 0`) devolvía `100` en `firstListenConfidencePercent` y `errorRepairRatePercent` (y `100` en la precisión de ambas mitades), presentando un 100% de confianza y reparación sobre datos inexistentes; pasan a valer `0` cuando no hay preguntas.
- **F-16 — `pedagogicalDictionary.ts`**: la fórmula del concepto `cpi_score` omite los límites de clamp que la implementación sí aplica; se documenta que la entropía tiene piso `0.5`, la latencia piso `0.6s` y el factor de velocidad está acotado a `[0.3, 2.5]`.
- **Pruebas**: la suite existente (`historyAnalytics.test.ts`, `thresholdsConsistency.test.tsx`) debe pasar al 100% sin modificaciones de contrato, y se añaden pruebas unitarias para los casos borde corregidos (sesión vacía en timeline, resolución de poolSize con niveles de dos dígitos, `totalAttempts` acumulado en longitudinales, clamps del CPI documentados).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

(ninguna — refactorización arquitectónica interna y de SRP que preserva al 100% la API pública observable y las especificaciones canónicas; declarado `skip_specs: true` en `.openspec.yaml`. Las correcciones F-06/F-14, F-09, F-13 y F-16 son arreglos de casos borde sobre comportamiento ya especificado — outputs previos eran defectos, no contratos —, por lo que no introducen deltas de requisitos.)

## Impact

- **`src/renderer/src/domain/analytics/historyAnalytics.ts`**: se reduce de 1342 líneas a un orquestador + barrel export (~250 líneas de `computeAnalyticsMetrics` más re-exportaciones).
- **`src/renderer/src/domain/analytics/`**: 9 nuevos archivos de submódulo (`thresholds.ts`, `types.ts`, `sessionClassification.ts`, `psychometrics.ts`, `latencyStats.ts`, `timelineTelemetry.ts`, `confusionMatrix.ts`, `sessionFilters.ts`, `longitudinal.ts`).
- **`src/renderer/src/domain/analytics/pedagogicalDictionary.ts`**: documentación del concepto `cpi_score` (sin cambio de comportamiento).
- **`src/renderer/src/domain/analytics/historyAnalytics.test.ts`**: nueva suite de casos borde (F-06/F-14, F-09, F-13); el resto se conserva intacto.
- **Consumidores externos** (35 sitios: `useAnalyticsStore`, `useAiStore`, `useSingleNoteTrainer`, `AnalyticsView` y sus 11 subcomponentes, `adaptiveEngine`, `promptBuilder`, `lmStudioService`, `fallbackGenerator`, `diagnosticReportGenerator` y 8 archivos de test): **cero cambios** gracias al barrel export; verificado por `npm run typecheck`.
- Sin cambios en persistencia, motor de entrenamiento, audio MIDI ni capa de presentación; verificación no interactiva mediante `npm run typecheck`, `npm run lint` y `npm run test` (vitest run).
