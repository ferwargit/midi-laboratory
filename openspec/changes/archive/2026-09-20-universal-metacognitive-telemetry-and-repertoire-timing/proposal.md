## Why

La Auditoría V6 (OLA 4.2) detectó dos huecos de telemetría y un defecto de higiene en tests que degradan la calidad de los KPIs de autorregulación y la señal de tiempos de respuesta:

- **F12 — Telemetría metacognitiva inactiva en 3 de 4 modalidades**: los handlers de repetición de estímulo (`repeatCurrentInterval`, `repeatCurrentSequence`, `repeatCurrentSlice`) no invocan `core.recordPreAnswerRepeat()` / `core.recordPostErrorRepeat()`, dejando `preAnswerListens` y `postErrorListens` planchados en sus valores iniciales (1 y 0) en Intervalos, Secuencias y Repertorio. Solo `useSingleNoteTrainer` cumple la pauta. Los KPIs de escucha (p. ej. `🎧x{N}` en `SessionDetailModal.tsx:749`) quedan falsos para esas modalidades.
- **F15 — `responseTimeMs` hardcodeado en Repertorio**: `useRepertoireTrainer.ts:666` asigna el literal `1000` al construir el `DbAnswerRecord`, falseando `avgResponseTimeMs` del `DbSessionRecord` (`useRepertoireTrainer.ts:380-383`) y cualquier KPI de velocidad derivado de sesiones de repertorio.
- **Limpieza de stderr en tests**: en `useMidi.test.ts:224` el spy `mockOutput.send` conserva la implementación que lanza al final del test; al desmontarse el hook, el cleanup de `useMidi.ts:216-220` vuelve a llamar `sendAllNotesOff()` y emite `console.warn` real a stderr, ruidizando la salida de `npm run test`.

## What Changes

- **Telemetría metacognitiva universal (F12)**: `repeatCurrentInterval` (`useIntervalTrainer.ts:311`), `repeatCurrentSequence` (`useSequenceTrainer.ts:270`) y `repeatCurrentSlice` (`useRepertoireTrainer.ts:605`) replican la pauta de `useSingleNoteTrainer.ts:331-342`: si `core.isWaitingAnswer` → `core.recordPreAnswerRepeat()`; si no, `core.isWaitingManualAdvance` → `core.recordPostErrorRepeat()`. Sin cambios en la firma pública ni en el flujo de reproducción del estímulo.
- **Tiempo de respuesta real en Repertorio (F15)**: al evaluar la rebanada en `handleUserNotePlayed`, se calcula el `responseTimeMs` a partir de las marcas temporales del buffer de notas tocadas (`playedNotesBufferRef`, `RawPlayedMidiNote.timestampMs`) y se pasa por `sanitizeResponseTime` de `evalPolicy.ts` antes de estamparlo en el `DbAnswerRecord`. Se elimina el literal `1000`.
- **Higiene de tests**: en `useMidi.test.ts:224` se restablece `mockOutput.send = vi.fn()` antes de finalizar la prueba, de modo que el unmount pasivo del hook no lance y `npm run test` corra con 0 stderr.
- **Pruebas unitarias**: nuevos casos en `useIntervalTrainer.test.ts`, `useSequenceTrainer.test.ts` y `useRepertoireTrainer.test.ts` validando que `repeatCurrent*` incrementa `preAnswerListens` (en espera de respuesta) y `postErrorListens` (en pausa manual post-error); y un caso en `useRepertoireTrainer.test.ts` validando que `responseTimeMs` es dinámico y no el literal `1000`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

(ninguna — este cambio refina la captura de telemetría y la higiene de tests sin alterar contratos de spec: `02-trainer-core-engine` R7 ya exige recolectar `preAnswerListens` / `postErrorListens` / `postErrorDwellTimeMs` estampadas en cada `DbAnswerRecord`, y `03-practice-modalities` R1 ya exige que las cuatro modalidades expongan `repeatCurrent*()`. La brecha es de conformidad de implementación, no de contrato. `skip_specs: true` declarado en `.openspec.yaml`.)

## Impact

- **Hooks afectados**: `src/renderer/src/hooks/useIntervalTrainer.ts`, `useSequenceTrainer.ts`, `useRepertoireTrainer.ts` (handlers `repeatCurrent*` y `handleUserNotePlayed`), `useMidi.test.ts`.
- **Dominio**: consumo existente de `sanitizeResponseTime` (`domain/exercise/evalPolicy.ts`); sin cambios en la política ni en los evaluadores.
- **Persistencia y analítica**: los `DbAnswerRecord` y `DbSessionRecord` de Repertorio pasan a llevar `responseTimeMs` y `avgResponseTimeMs` reales; `historyAnalytics.ts` y `SessionDetailModal.tsx` consumen los mismos campos (sin cambio de schema — `preAnswerListens`/`postErrorListens` ya son opcionales en `domain/database/types.ts:33`).
- **Tests**: `npm run test` debe mantenerse verde y con 0 stderr; `npm run typecheck` y `npm run lint` sin regresiones.
- **Sin cambios breaking** en APIs públicas, contratos MIDI/audio ni flujos de usuario.
