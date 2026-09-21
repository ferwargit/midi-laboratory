## 1. Baseline y pruebas TDD (Red primero)

- [x] 1.1 Ejecutar `npm run test` (vitest run, modo no interactivo) y registrar la baseline verde completa de `historyAnalytics.test.ts` y `thresholdsConsistency.test.tsx` antes de tocar código
- [x] 1.2 Añadir en `historyAnalytics.test.ts` tests del caso borde F-13: `analyzeSessionTimeline` con sesión vacía (`sessionAnswers === []`) afirma `firstListenConfidencePercent === 0`, `errorRepairRatePercent === 0`, `firstHalfAccuracy === 0`, `secondHalfAccuracy === 0`, `overallAccuracy === 0`, `avgLatencyMs === 0`; verificar que fallan (hoy devuelven 100)
- [x] 1.3 Añadir tests del caso borde F-06/F-14: `resolveNominalPoolSize` (vía `computeAnalyticsMetrics`) para preset `"Nivel 10 (Custom) • Notas personalizadas (11)"` afirma `poolSize === 11` y no `3`; y preset `"Notas personalizadas (1)"` afirma `poolSize === 2` (piso); verificar que fallan
- [x] 1.4 Añadir test del caso borde F-09: `computeLongitudinalComparisons` sobre dos sesiones del mismo contenido con `totalQuestions: 10` cada una afirma `totalAttempts === 20` y no `2`; verificar que falla
- [x] 1.5 Añadir test F-16 en `pedagogicalDictionary.test.ts`: `getConcept('cpi_score').formulaOrCalculation` contiene `0.5`, `0.6` y `2.5`; verificar que falla
- [x] 1.6 Confirmar que la suite existente sigue verde tras añadir solo los tests nuevos (no se modifica ningún assertion existente)

## 2. Submódulos sin dependencias: `thresholds.ts` y `types.ts`

- [x] 2.1 Crear `src/renderer/src/domain/analytics/thresholds.ts` moviendo `COGNITIVE_LATENCY_THRESHOLDS`, `MASTERY_THRESHOLDS`, `ISI_THRESHOLDS`, `BIAS_DOMINANCE_RATIO` (mantener `as const`); verificar `export *` desde el barrel y que `thresholdsConsistency.test.tsx` sigue afirmando los valores canónicos (1400/2800, 85/60/60)
- [x] 2.2 Crear `src/renderer/src/domain/analytics/types.ts` moviendo los 18 interfaces/tipos (`AnalyticsModeFilter`, `AnalyticsMasteryFilter`, `AnalyticsFilterOptions`, `ConfusionPair`, `SessionPsychometrics`, `SessionFormatInfo`, `DetailedSessionAnalysis`, `QuestionTelemetryPoint`, `SessionTimelineAnalysis`, `PitchClassConfusionCell`, `ConfusionMatrix2DData`, `PerNoteLatencyStat`, `OctaveLatencySummary`, `PerNoteLatencyAnalysis`, `LongitudinalComparison`, `AnalyticsMetrics`); importar `DbSessionRecord` desde `../database/types` (un nivel hacia arriba, ya que `database` es hermano de `analytics` bajo `domain/`) — se importa únicamente `DbSessionRecord` porque `DbAnswerRecord` no es referenciado por ningún interfaz de `types.ts` e importarlo sin uso violaría la regla `no-unused-vars` del linter
- [x] 2.3 Ejecutar `npm run typecheck` y verificar que no hay símbolos duplicados ni perdidos

## 3. Submódulos de dominio puro

- [x] 3.1 Crear `psychometrics.ts` moviendo `calculateSessionCPI` (importa de `./types`); verificar que el test existente de CPI en `historyAnalytics.test.ts` pasa
- [x] 3.2 Crear `latencyStats.ts` moviendo `computePerNoteLatencyStats` (importa `COGNITIVE_LATENCY_THRESHOLDS` de `./thresholds`, `midiNoteToName` de `../music/noteUtils`) y `computeNotePerformancesFromAnswers` (importa `NotePerformance` de `../adaptation/types`); verificar que `computeNotePerformancesFromAnswers` sigue devolviendo el `Map<number, NotePerformance>` contractual
- [x] 3.3 Crear `confusionMatrix.ts` moviendo `PITCH_CLASSES` y `computePitchClassConfusionMatrix`; verificar que `ConfusionMatrixTab` renderiza la grid 12×12 desde el barrel
- [x] 3.4 Crear `sessionClassification.ts` moviendo `resolveSessionFormat`, `formatInterSessionGap`, `computeInterSessionGapMap`, `InterSessionGapInfo`, `resolveSessionInputMethod`, `resolveSessionDominantBias` (usa `BIAS_DOMINANCE_RATIO`) y los 4 clasificadores `is*Session`; mover también `resolveNominalPoolSize` **exportada** (uso interno del dominio, excluida del barrel según Decisión 2 de design.md)
- [x] 3.5 Crear `timelineTelemetry.ts` moviendo `analyzeSessionTimeline` (importa `COGNITIVE_LATENCY_THRESHOLDS`, `midiNoteToName`); aplicar la corrección F-13 (Decisión 6): guarda `total === 0` → confianza, reparación y precisión de mitades en `0`; verificar que el test 1.2 pasa (Verde)
- [x] 3.6 Crear `sessionFilters.ts` moviendo `filterSessionsAdvanced` (importa `resolveSessionFormat`, `resolveNominalPoolSize`, `resolveSessionInputMethod`, `resolveSessionDominantBias`, `computeInterSessionGapMap`, `is*Session`, umbrales) y `filterSessionsByMode`
- [x] 3.7 Crear `longitudinal.ts` moviendo `reconstructSessionConfig` (importa `EXERCISE_PRESETS` de `../music/presets`, `AiExercisePrescription` de `../ai/types`) y `computeLongitudinalComparisons`; aplicar la corrección F-09 (Decisión 5): `totalAttempts` como suma de `session.totalQuestions`; verificar que el test 1.4 pasa (Verde)

## 4. Barrel export y orquestador en `historyAnalytics.ts`

- [x] 4.1 Reducir `historyAnalytics.ts` a los nueve `export * from './<submodulo>'` más la implementación de `computeAnalyticsMetrics` orquestando los submódulos (sin lógica de negocio nueva)
- [x] 4.2 Verificar con `npm run typecheck` que los 35 sitios consumidores (stores, hooks, components/views, domain/ai, domain/adaptation, tests) resuelven todos sus imports sin editar ninguno
- [x] 4.3 Actualizar `pedagogicalDictionary.ts`: `import { COGNITIVE_LATENCY_THRESHOLDS } from './thresholds'` (Decisión 8) eliminando la dependencia hacia el barrel; verificar que `cognitive_latency.practicalTakeaway` sigue mostrando las etiquetas calibradas

## 5. Correcciones de casos borde restantes

- [x] 5.1 Aplicar la corrección F-06/F-14 en `resolveNominalPoolSize` (Decisión 4): regex única `/nivel\s*(\d+)/i` con mapeo exacto de niveles, `pentatónica`, `notas (N)` con `Math.max(2, …)` y fallback empírico con piso; verificar que los tests 1.3 pasan (Verde)
- [x] 5.2 Aplicar la corrección F-16 en `pedagogicalDictionary.ts` (Decisión 7): la cadena `formulaOrCalculation` de `cpi_score` documenta los pisos de entropía (`0.5`) y latencia (`0.6s`) y el clamp de velocidad `[0.3 – 2.5]`; verificar que el test 1.5 pasa (Verde)
- [x] 5.3 Confirmar que no queda ningún literal de umbral (`1400`, `2800`, `900000`, `43200000`, `172800000`, `1.4`) fuera de `thresholds.ts` en `src/renderer/src/domain/analytics/`

## 6. Verificación final no interactiva

- [x] 6.1 Ejecutar `npm run typecheck` y confirmar que no reporta errores
- [x] 6.2 Ejecutar `npm run lint` y confirmar que no reporta errores nuevos
- [x] 6.3 Ejecutar `npm run test` (vitest run, modo no interactivo) y confirmar que la suite completa pasa al 100%, incluyendo los tests preexistentes sin modificar su contrato
- [x] 6.4 Verificar que cada nuevo submódulo está en el rango de líneas objetivo (50–150, con las exenciones documentadas de `types.ts` y `sessionClassification.ts`) y que `historyAnalytics.ts` se redujo de 1342 líneas al orquestador + barrel
- [x] 6.5 Confirmar mediante búsqueda en `src/renderer` que ningún consumidor cambió su sentencia `import ... from '.../historyAnalytics'` (cero ediciones de consumidores)
