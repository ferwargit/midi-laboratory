## 1. Pruebas TDD del micro-kernel (F01 y F07)

- [x] 1.1 Escribir en `src/renderer/src/hooks/useTrainerCore.test.ts` el test "respuesta duplicada con el mismo token es ignorada": session + token + `setIsWaitingAnswer(true)`, dos `recordAnswer(...)` con el mismo token → `sessionHistory.length === 1`, `answersBuffer.length === 1` y `onAdvanceTrigger` programado una sola vez. Verifica: el test falla en rojo antes de tocar la implementación.
- [x] 1.2 Escribir el test "respuesta con token desfasado es descartada": `recordAnswer(...)` con un token distinto al vigente → `sessionHistory` sin cambios. Verifica: falla en rojo.
- [x] 1.3 Escribir el test "autoAdvanceTimerRef limpia el temporizador previo": dos `recordAnswer` consecutivos en modo `auto_slow` con fake timers → `onAdvanceTrigger` invocado exactamente una vez en total. Verifica: falla en rojo.
- [x] 1.4 Escribir el test "isWaitingManualAdvance se resetea a false tras un acierto en modo smart": error previo deja el flag en `true`, luego avance + respuesta correcta → `isWaitingManualAdvance === false`. Verifica: falla en rojo.
- [x] 1.5 Actualizar las 8 llamadas existentes a `recordAnswer` en `useTrainerCore.test.ts` para pasar el token y dejar `isWaitingAnswer` en `true` (setup `setIsWaitingAnswer(true)` o flujo equivalente). Verifica: `npm run test -- useTrainerCore` compila la suite.

## 2. Guards del micro-kernel (F01 y F07) — `src/renderer/src/hooks/useTrainerCore.ts`

- [x] 2.1 Añadir el parámetro `questionToken: string` a la firma de `recordAnswer` (tipo `UseTrainerCoreReturn` e implementación) y rechazar si es nulo/vacío o distinto de `questionTokenRef.current`. Verifica: `npm run typecheck` sin errores.
- [x] 2.2 Añadir el guard `if (!isWaitingAnswerRef.current) return` al inicio de `recordAnswer`. Verifica: tests 1.1 y 1.3 en verde.
- [x] 2.3 Antes de programar `autoAdvanceTimerRef`, ejecutar `clearTimeout` preventivo del temporizador previo. Verifica: test 1.3 en verde.
- [x] 2.4 Capturar el token programado y, dentro del callback del `setTimeout`, abortar si `questionTokenRef.current !== tokenProgramado` (además del check de `sessionId` existente). Verifica: test 1.2 en verde.
- [x] 2.5 En la rama `else` de `recordAnswer` (auto-avance o smart con acierto), invocar `setIsWaitingManualAdvanceState(false)`. Verifica: test 1.4 en verde.
- [x] 2.6 En `advanceToNextQuestion`, invocar `setIsWaitingManualAdvanceState(false)` al incrementar `currentQuestionIndex`. Verifica: `npm run test -- useTrainerCore` completa sin regresiones.

## 3. Actualización de los plug-ins al nuevo contrato

- [x] 3.1 `useSingleNoteTrainer.ts`: pasar `core.questionToken` en la llamada a `core.recordAnswer` (línea ~379). Verifica: `npm run typecheck`.
- [x] 3.2 `useIntervalTrainer.ts`: pasar `core.questionToken` en la llamada a `core.recordAnswer` (línea ~359). Verifica: `npm run typecheck`.
- [x] 3.3 `useRepertoireTrainer.ts`: pasar `core.questionToken` en las dos llamadas a `core.recordAnswer` (líneas ~704 y ~736). Verifica: `npm run typecheck`. Nota: se añadió `!core.questionToken` al guard de `handleUserNotePlayed` para satisfacer el tipado y endurecer la entrada.
- [x] 3.4 Confirmar que no queda ninguna llamada a `recordAnswer` sin el token en `src/renderer/src/hooks/`. Verifica: `Select-String -Pattern "\.recordAnswer\(" -Include *.ts` muestra 5 llamadas, todas con token.

## 4. Pruebas TDD de Secuencias (F02)

- [x] 4.1 Escribir en `src/renderer/src/hooks/useSequenceTrainer.test.ts` el test "la evaluación se dispara exactamente una vez por frase completada": sesión con longitud 3, tres `handleUserNotePlayed`, contabilizar invocaciones de evaluación/persistencia → exactamente 1 resultado en `sessionHistory`. Verifica: falla en rojo.
- [x] 4.2 Escribir el test bajo doble invocación del updater (simulando `<StrictMode>`): el `sessionHistory` y los registros persistidos siguen siendo 1. Verifica: se verificó rojo real restaurando temporalmente el updater impuro (2 evaluaciones vs 1 esperada) y luego verde con el refactor.

## 5. Extracción de side-effects en Secuencias (F02) — `src/renderer/src/hooks/useSequenceTrainer.ts`

- [x] 5.1 Añadir `const playedNotesBufferRef = useRef<number[]>([])` junto a `capturedNotes`. Verifica: `npm run typecheck`.
- [x] 5.2 Vaciar `playedNotesBufferRef.current = []` en `triggerNextSequence`, `startSession`, `stopSession` y `resetToConfig`. Verifica: `npm run typecheck`.
- [x] 5.3 En `handleUserNotePlayed`, empujar la nota al buffer, llamar a `setCapturedNotes((prev) => [...prev, playedNoteNumber])` (updater puro sin telemetría, sin evaluación, sin `recordAnswer`) y, al alcanzar la longitud esperada, ejecutar `evaluateSequenceAnswer` + `core.recordAnswer` **fuera** del updater. Verifica: tests 4.1 y 4.2 en verde.

## 6. Pruebas TDD de Nota Individual (F03)

- [x] 6.1 Escribir en `src/renderer/src/hooks/useSingleNoteTrainer.test.ts` el test "un pre-roll pendiente no emite notas si la sesión se detiene antes de su vencimiento": sesión con `tonalContextMode: 'cadence'`, `stopSession()`, avanzar fake timers 2840 ms → `onPlayStimulus` sin nuevas invocaciones y `currentExpectedNote === null`. Verifica: falla en rojo.
- [x] 6.2 Escribir el test "un pre-roll pendiente no emite notas si la sesión expira por tiempo": `limitType: 'time'`, expirar la cuenta regresiva durante el pre-roll, avanzar fake timers → `onPlayStimulus` sin nuevas invocaciones. Verifica: falla en rojo (1 invocación fantasma antes del guard).

## 7. Cancelación de pre-roll huérfano (F03) — `src/renderer/src/hooks/useSingleNoteTrainer.ts`

- [x] 7.1 Añadir `if (!core.isSessionActive) return` al inicio de `triggerNextQuestion`. Verifica: tests 6.1 y 6.2 en verde.
- [x] 7.2 Confirmar que `stopSession` y `resetToConfig` cancelan `preRollTimerRef` (código existente) y añadir un test de regresión si la cobertura lo reclama. Verifica: `npm run test -- useSingleNoteTrainer` en verde.
- [x] 7.3 **Extra (Opción 1 adoptada)**: `isSessionActive` en el objeto de retorno del kernel pasa a ser un getter sobre `isSessionActiveRef.current` (el `useState` se conserva como disparador de re-render), porque el guard 7.1 lee el estado a través de un closure stale al invocarse `onTriggerFirstStimulus` de forma síncrona. Verifica: `npm run test -- useTrainerCore useSingleNoteTrainer` en verde.
- [x] 7.4 **Extra (bug latente de divergencia ref/state descubierto por 7.3)**: `stopCoreSession` (rama sin respuestas) y `resetCoreToConfig` actualizaban solo `setIsSessionActiveState(false)` y no `isSessionActiveRef.current = false`; ahora ambas writan la ref. Verifica: tests "stopCoreSession y resetCoreToConfig invalidan el token" y 6.1 en verde.
- [x] 7.5 **Extra (WARNING 1 de verificación)**: test "auto-avance desfasado abortado por rotación de token en vuelo" — sesión en modo `auto_fast`, respuesta registrada con timer pendiente, `generateQuestionToken()` rota el token, avanzan 2000 ms → `onAdvance` no invocado y `currentQuestionIndex === 1`. Verifica: cubre el escenario "Auto-avance desfasado abortado por token" del delta spec, discriminando el check de token del callback (`useTrainerCore.ts:490`).
- [x] 7.6 **Extra (SUGGESTION 1 de verificación)**: test "token nulo o inválido rechazado silenciosamente" — `recordAnswer(..., null as unknown as string)` → `sessionHistory.length === 0`, `answersBuffer.length === 0`, `lastResult === null`, token inalterado e `isWaiting === true`. Verifica: rama nula del escenario "Respuesta aceptada solo con token coincidente".
- [x] 7.7 **Extra (WARNING 2 de verificación)**: añadida la sección D7 a `design.md` documentando `isSessionActive` como getter sobre la ref y la corrección de la divergencia ref/state; `Open Questions` actualizado. Verifica: `openspec validate --strict` pasa.

## 8. Verificación final y sincronización de specs

- [x] 8.1 Ejecutar `npm run typecheck` completo. Verifica: salida sin errores.
- [x] 8.2 Ejecutar `npm run lint` completo. Verifica: salida sin errores nuevos.
- [x] 8.3 Ejecutar `npm run test` (vitest run, no interactivo). Verifica: toda la suite en verde, incluidos `useTrainerCore.test.ts`, `useSequenceTrainer.test.ts`, `useSingleNoteTrainer.test.ts`, `useIntervalTrainer.test.ts`, `useRepertoireTrainer.test.ts` y `s4-ux-feedback.test.tsx`.
- [x] 8.4 Confirmar que `openspec/specs/02-trainer-core-engine/spec.md` sigue idéntico (la sincronización del delta a la spec canónica se hace al archivar el cambio, no durante la implementación). Verifica: `openspec validate kernel-concurrency-and-lifecycle-guards --strict` pasa sin errores.
- [x] 8.5 Comprobar que el botón de avance manual ya no permanece habilitado tras un acierto en modo `smart` en las cuatro modalidades. Verifica: tests existentes de `FeedbackPanel`/`s4-ux-feedback` en verde sin cambios en sus props.
