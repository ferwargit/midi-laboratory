# Tasks

## 1. Preparación y Prueba TDD

- [x] 1.1 Añadir la prueba unitaria en `SessionDetailModal.test.tsx` que renderice el modal con una sesión mockea y respuestas hardware MIDI, asertando que el badge de cabecera "Score CPI" muestra el valor exacto devuelto por `calculateSessionCPI` con los mismos parámetros canónicos. Verificar que la prueba falla en rojo (TDD Red) porque el modal usa la fórmula incorrecta `correctAnswers * 12 + totalQuestions * 2`.

- [x] 1.2 Verificar que `npm run typecheck` y `npm run test` se ejecutan correctamente en el estado actual (antes de modificar el código) para establecer la línea base de los 600 tests existentes.

## 2. Implementación del Cálculo Canónico

- [x] 2.1 En `SessionDetailModal.tsx`, agregar los imports necesarios desde `historyAnalytics`: `calculateSessionCPI`, `resolveNominalPoolSize`, `resolveSessionInputMethod`. Verificar que `npm run typecheck` no reporta errores de imports.

- [x] 2.2 Crear un `useMemo` llamado `cpiParams` que dependa de `session` y `sessionAnswers`, y que calcule los parámetros canónicos:
  - `poolSize` = `resolveNominalPoolSize(session, uniqueExpected.size)` donde `uniqueExpected` es el Set de notas únicas de `sessionAnswers`.
  - `chanceBaseline` = `1 / poolSize`.
  - `normalizedAccuracy` = IRT formula: si `session.accuracyPercentage/100 <= chanceBaseline` → `0`; si no, `Math.round(((accDec - chanceBaseline) / (1 - chanceBaseline)) * 100)`.
  - `entropyBits` = `Number(Math.log2(poolSize).toFixed(2))`.
  - `responsesPerMinute` = `Number(((session.totalQuestions / Math.max(1, session.durationSeconds)) * 60).toFixed(1))`.
  - `avgResponseTimeMs` = `session.avgResponseTimeMs`.
  - `inputMethod` = `resolveSessionInputMethod(session, sessionAnswers)`.
  Verificar que `npm run typecheck` no reporta errores de tipos.

- [x] 2.3 Calcular el `cpiScore` final llamando `calculateSessionCPI(cpiParams.normalizedAccuracy, cpiParams.entropyBits, cpiParams.responsesPerMinute, cpiParams.avgResponseTimeMs, cpiParams.inputMethod)` dentro del mismo `useMemo` o como valor derivado. Verificar que `npm run typecheck` no reporta errores.

- [x] 2.4 Reemplazar la fórmula local divergente `{analysis.session.correctAnswers * 12 + analysis.totalQuestions * 2}` en la cabecera del modal por `{cpiScore}` (o el valor calculado). Verificar que `npm run typecheck` no reporta errores.

- [x] 2.5 Ejecutar `npm run test` y verificar que la prueba añadida en el paso 1.1 ahora pasa en verde (TDD Green), confirmando que el modal usa la misma fórmula canónica que la tabla.

## 3. Formateo y Verificación Final

- [x] 3.1 Formatear los archivos modificados con `npx prettier --write src/renderer/src/components/views/analytics/SessionDetailModal.tsx src/renderer/src/components/views/analytics/SessionDetailModal.test.tsx`.

- [x] 3.2 Ejecutar `npm run typecheck` y verificar que no hay errores de tipos.

- [x] 3.3 Ejecutar `npm run test` y verificar que los 600 tests pasan al 100%.

- [x] 3.4 Ejecutar `openspec validate unify-session-cpi-calculation --strict` y verificar que la validación pasa.