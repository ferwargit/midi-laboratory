# Tasks

## 1. Línea base de regresión (antes de tocar código)

- [x] 1.1 Ejecutar la suite de analítica en verde como línea base: `npx vitest run src/renderer/src/domain/analytics/historyAnalytics.test.ts src/renderer/src/domain/analytics/thresholdsConsistency.test.tsx src/renderer/src/domain/ai/aiDecoupling.test.ts` — verificar 0 fallos antes de cualquier edición.
- [x] 1.2 Ejecutar `npm test` completo, `npm run typecheck` y `npm run lint` y registrar que la línea base es verde (0 fallos, 0 errores de tipos, 0 errores de lint).

## 2. Pre-agrupación O(S+A) y resolución de modalidad única (D1 + D2)

- [x] 2.1 En `historyAnalytics.ts`, añadir helper privado `buildAnswersBySession(filteredAnswers)` que construya `Map<string, DbAnswerRecord[]>` en una única pasada O(A), y reemplazar el `filteredAnswers.filter((a) => a.sessionId === session.id)` del `.map()` de sesiones por `answersBySessionId.get(session.id) ?? []`. Verificar con la suite de analítica de la tarea 1.1 (exactitud matemática intacta, incl. sesiones sin respuestas).
- [x] 2.2 Resolver `sessionMode` una única vez por sesión con el SSOT `resolveSessionMode(session) ?? 'single_note'` y reutilizarlo en el bloque de psicometría y en la agregación por respuesta (eliminando el recálculo por respuesta de la línea 190); resolver `getLatencyThresholds(sessionMode)` también una vez por sesión. Verificar con los tests de umbrales por modalidad (`historyAnalytics.test.ts` describe "Umbrales de Latencia por Modalidad" y `thresholdsConsistency.test.tsx`).

## 3. Matriz de confusión tipada sin round-trip de strings (D3)

- [x] 3.1 Reemplazar `Map<string, number>` + `` `${expName} ➔ ${playName}` `` + `key.split(' ➔ ')` por un `Map` con clave compuesta por números MIDI (`expectedNote|playedNote`) y valor `ConfusionPair` acumulado (`{ expected, played, count }` con nombres resueltos una sola vez por par vía `midiNoteToName`); proyectar `topConfusions` ordenando por `count` descendente y cortando en 5, preservando el orden de inserción en empates. Verificar con las aserciones de `topConfusions` y sesgos de `historyAnalytics.test.ts` (describe "computeAnalyticsMetrics maneja conjunto vacío y calcula sesgos asimétricos" y afines).

## 4. Modularización interna para reducir complejidad ciclomática (D4)

- [x] 4.1 Extraer helpers privados cohesivos del cuerpo de `computeAnalyticsMetrics` (p. ej. `analyzeSessionPsychometrics(session, sAnswers, gapInfo)` y `aggregateAnswerStats(...)`), dejando la función pública como orquestador lineal con firma y contrato `AnalyticsMetrics` idénticos. Verificar que el barrel no cambia y que `historyAnalytics.test.ts`, `aiDecoupling.test.ts` y `analyticsStore.test.ts` pasan sin modificar imports.

## 5. Verificación integral

- [x] 5.1 Ejecutar `npm test` completo en verde (0 regresiones en toda la suite, incl. tests de gráficos y vistas que consumen métricas).
- [x] 5.2 Ejecutar `npm run typecheck` (node + web) y `npm run lint` con 0 errores; ejecutar `npm run format` si el proyecto lo exige tras las ediciones.
- [x] 5.3 Confirmar que el contrato observable no cambió: misma firma pública de `computeAnalyticsMetrics`, mismos tipos exportados por el barrel, y diff de `git diff` limitado a `src/renderer/src/domain/analytics/historyAnalytics.ts`.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
