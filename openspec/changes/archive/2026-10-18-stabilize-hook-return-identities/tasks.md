# Tasks

## 1. useMidi — Pruebas de estabilidad referencial (TDD Red)

- [x] 1.1 Añadir en `src/renderer/src/hooks/useMidi.test.ts` un bloque `describe` de estabilidad referencial: montar con `renderHook`, `rerender()` sin cambios de props y afirmar `result1.current` `toBe` `result2.current`, además de identidad `toBe` de `sendNote`, `sendAllNotesOff`, `changeProgram`, `clearAllPressedNotes` y `addLog` entre ambos renders. Verificar ejecutando `npx vitest run src/renderer/src/hooks/useMidi.test.ts` y confirmando que los casos nuevos FALLAN (Red) por el literal fresco actual.
- [x] 1.2 Añadir caso de invalidación: tras `act` que provoca un Note On (`pressedNotes` cambia), afirmar identidad de objeto nueva y `pressedNotes` fresco en el retorno. Verificar con `npx vitest run src/renderer/src/hooks/useMidi.test.ts` (Red esperado).
- [x] 1.3 Añadir caso de comportamiento preservado: tras cambiar `selectedOutputId`, `sendNote` emite por el puerto vigente pese a identidad estable del método. Verificar con `npx vitest run src/renderer/src/hooks/useMidi.test.ts` (este caso debe pasar ya o pasar tras 2.1; documentar el estado observado).

## 2. useMidi — Implementación (TDD Green)

- [x] 2.1 En `src/renderer/src/hooks/useMidi.ts`, envolver el objeto de retorno (líneas 369-385) en `useMemo` con deps explícitas según design D2 (`status`, `inputs`, `outputs`, `selectedInputId`, `selectedOutputId`, `isDeviceDisconnected`, `pressedNotes`, `activeStimulusNotes`, `addLog`, `sendNote`, `changeProgram`, `clearAllPressedNotes`, `sendAllNotesOff`), sin alterar propiedades ni firmas. Verificar con `npx vitest run src/renderer/src/hooks/useMidi.test.ts`: los casos de 1.1 y 1.2 pasan (Green) y la suite completa del archivo queda en 0 fallos.

## 3. useTrainerCore — Pruebas de estabilidad referencial (TDD Red)

- [x] 3.1 Añadir en `src/renderer/src/hooks/useTrainerCore.test.ts` un bloque de estabilidad referencial: `renderHook` + `rerender()` sin cambios → `result1.current` `toBe` `result2.current` e identidad `toBe` de `startCoreSession`, `advanceToNextQuestion`, `recordAnswer`, `stopCoreSession` y `resetCoreToConfig`. Verificar con `npx vitest run src/renderer/src/hooks/useTrainerCore.test.ts` (Red esperado).
- [x] 3.2 Añadir casos de invalidación reactiva: tras `act(() => result.current.setSessionLimitType('time'))` y tras registrar historial, afirmar identidad nueva + valor fresco. Verificar con `npx vitest run src/renderer/src/hooks/useTrainerCore.test.ts` (Red esperado).
- [x] 3.3 Añadir caso de getters en vivo: tras `act(() => result.current.startCoreSession(...))`, afirmar que `isSessionActive === true`, `sessionId` no vacío y `questionToken` vigente se leen correctamente desde el retorno. Verificar con `npx vitest run src/renderer/src/hooks/useTrainerCore.test.ts` (debe pasar antes y después del cambio; pinar el contrato).

## 4. useTrainerCore — Implementación (TDD Green)

- [x] 4.1 En `src/renderer/src/hooks/useTrainerCore.ts`, envolver el objeto de retorno (líneas 531-576) en `useMemo` con deps explícitas según design D3 (estados reactivos expuestos + callbacks estables), conservando los getters en vivo tal cual. Verificar con `npx vitest run src/renderer/src/hooks/useTrainerCore.test.ts`: los casos de 3.1 y 3.2 pasan (Green), 3.3 sigue pasando y la suite completa del archivo queda en 0 fallos.

## 5. Cascada en plug-ins de entrenador

- [x] 5.1 Añadir en `src/renderer/src/hooks/useSingleNoteTrainer.test.ts` un caso de cascada: `renderHook` + `rerender()` sin cambios de estado → identidad `toBe` de `startSession`, `stopSession`, `handleUserNotePlayed` y del objeto retornado completo entre renders. Verificar con `npx vitest run src/renderer/src/hooks/useSingleNoteTrainer.test.ts` (Green tras 2.1 y 4.1; si falla, diagnosticar deps antes de continuar).

## 6. Verificación integral

- [x] 6.1 Ejecutar la suite completa `npm test` y confirmar 0 fallos y 0 regresiones respecto al estado previo al cambio.
- [x] 6.2 Ejecutar `npm run typecheck` y `npm run lint` y confirmar 0 errores (incluido `react-hooks/exhaustive-deps` sobre los nuevos `useMemo`).
- [x] 6.3 Remediar la sugerencia 1 del informe de verificación: ejercitar directamente cada valor reactivo restante en las pruebas de invalidación (useMidi: `selectedInputId`, `activeStimulusNotes`, `status`, `isDeviceDisconnected`, `inputs`, `outputs`; useTrainerCore: `sessionQuestionsCount`, `sessionDurationMinutes`, `timeRemainingSeconds`, `advanceMode`, `isWaitingAnswer`, `lastResult`, `currentQuestionIndex`, `sessionElapsedSeconds`, `isSessionFinished`, `isWaitingManualAdvance`, `saveError`). Verificar con `npx vitest run src/renderer/src/hooks/useMidi.test.ts src/renderer/src/hooks/useTrainerCore.test.ts` (25/25 y 27/27) y suite completa `npm test` (742/742).

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
