## 1. Telemetría Metacognitiva Universal (F12)

- [x] 1.1 En `src/renderer/src/hooks/useIntervalTrainer.ts`, modificar `repeatCurrentInterval` (línea 311) para invocar `core.recordPreAnswerRepeat()` si `core.isWaitingAnswer`, o `core.recordPostErrorRepeat()` si `core.isWaitingManualAdvance`, antes de `onPlayInterval(...)` — replicando `useSingleNoteTrainer.ts:331-342`. Verificar con el nuevo test 4.1.
- [x] 1.2 En `src/renderer/src/hooks/useSequenceTrainer.ts`, aplicar la misma pauta a `repeatCurrentSequence` (línea 270) antes de `onPlaySequence(seq)`. Verificar con el nuevo test 4.2.
- [x] 1.3 En `src/renderer/src/hooks/useRepertoireTrainer.ts`, aplicar la misma pauta a `repeatCurrentSlice` (línea 605) antes de delegar a `triggerPlayCurrentSlice()`. Además (ver design.md D1.b): `triggerPlayCurrentSlice` recibe `regenerateToken = true` y `repeatCurrentSlice` lo pasa en `false`, porque `generateQuestionToken` reinicia los contadores de telemetría del kernel y borraba lo registrado. Verificar con el nuevo test 4.3.

## 2. Tiempo de Respuesta Real en Repertorio (F15)

- [x] 2.1 En `src/renderer/src/hooks/useRepertoireTrainer.ts`, importar `sanitizeResponseTime` desde `../domain/exercise/evalPolicy` y calcular `responseTimeMs` en `handleUserNotePlayed` (bloque a partir de la línea 643) como `sanitizeResponseTime(lastNote.timestampMs - firstNote.timestampMs)` usando el buffer clonado `playedNotesToEvaluate`; eliminar el literal `responseTimeMs: 1000` de la línea 666. Verificar con el test 4.4.

## 3. Higiene de Stderr en Tests

- [x] 3.1 En `src/renderer/src/hooks/useMidi.test.ts`, restablecer `mockOutput.send = vi.fn()` al final de la prueba `sendAllNotesOff contiene las excepciones del puerto de salida` (línea 224), tras las aserciones existentes. Verificar: `npm run test` corre con 0 stderr (inspeccionar la salida del runner de vitest).

## 4. Pruebas Unitarias

- [x] 4.1 En `src/renderer/src/hooks/useIntervalTrainer.test.ts`, añadir un caso que: inicie sesión con `[4], [60]`; invoque `repeatCurrentInterval()` N veces; complete la respuesta de 2 notas; y asserte `preAnswerListens === N + 1` sobre `saveSpy.mock.calls[0][1][0]` (pauta de `useIntervalTrainer.test.ts:304-337`). Añadir además un caso post-error con `advanceMode: 'manual'` que responda mal y asserte `postErrorListens === 1` tras invocar `repeatCurrentInterval()`.
- [x] 4.2 En `src/renderer/src/hooks/useSequenceTrainer.test.ts`, añadir los dos casos análogos para `repeatCurrentSequence` (pre-respuesta y post-error con avance manual).
- [x] 4.3 En `src/renderer/src/hooks/useRepertoireTrainer.test.ts`, añadir los dos casos análogos para `repeatCurrentSlice` (pre-respuesta y post-error con `advanceMode: 'manual'`), usando `MOCK_SCORE_DATA` y el espía de `useDatabaseStore.getState().saveSession`.
- [x] 4.4 En `src/renderer/src/hooks/useRepertoireTrainer.test.ts`, añadir un caso que responda la rebanada con dos pulsaciones separadas por un delta temporal conocido (p. ej. `vi.useFakeTimers()` + `vi.setSystemTime`, o dos llamadas con > 100 ms reales) y asserte que `savedAnswers[0].responseTimeMs !== 1000` y que está dentro de `[50, 30000]`.

## 5. Verificación No Interactiva

- [x] 5.1 Ejecutar `npm run typecheck` y `npm run lint` sin errores ni nuevas advertencias.
- [x] 5.2 Ejecutar `npm run test` (vitest run, modo no interactivo): todos los suites verde y 0 stderr — confirmando la remediación de F12, F15 y la limpieza de unmount.
