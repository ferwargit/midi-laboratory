# Tasks

## 1. useMidi — Pruebas de gating de pistas visuales (TDD Red)

- [x] 1.1 Añadir en `src/renderer/src/hooks/useMidi.test.ts` un bloque de gating: montar con `visualCuesEnabled: false`, contador de renders del consumidor, `sendNote` melódica (Canal 1) → mensaje MIDI emitido, `activeStimulusNotes` vacío y sin incremento de renders atribuible a la pista visual; con fake timers, la liberación programada tampoco provoca re-render espurio. Verificar con `npx vitest run src/renderer/src/hooks/useMidi.test.ts` confirmando que los casos nuevos FALLAN (Red) porque el gate no existe aún.
- [x] 1.2 Añadir caso de toggle a mitad de vuelo: nota articulada con `visualCuesEnabled: true` y desactivada antes de su liberación → la liberación retira la nota residual; nota articulada con pistas desactivadas → la liberación no muta `activeStimulusNotes`. Verificar con `npx vitest run src/renderer/src/hooks/useMidi.test.ts` (Red esperado).
- [x] 1.3 Añadir caso de comportamiento acústico preservado: con pistas desactivadas, la cancelación de temporizador previo por clave compuesta (re-articulación rápida) y el pánico `sendAllNotesOff` se comportan según sus contratos vigentes. Verificar con `npx vitest run src/renderer/src/hooks/useMidi.test.ts` (debe pasar ya o tras 2.1; documentar el estado observado).

## 2. useMidi — Implementación del gate (TDD Green)

- [x] 2.1 En `src/renderer/src/hooks/useMidi.ts`: añadir `visualCuesEnabled?: boolean` (default `true`) a `UseMidiOptions`, ref espejo sincronizada en cada render (patrón D2), gate en el alta de `sendNote` (`isMelodicStimulus && visualCuesEnabledRef.current`) y liberación con cortocircuito (`prev.includes(n) ? prev.filter(...) : prev`). Sin añadir el flag a las deps de `sendNote` ni del `useMemo` del retorno. Verificar con `npx vitest run src/renderer/src/hooks/useMidi.test.ts`: casos 1.1 y 1.2 en Green, suite completa del archivo en 0 fallos (incluida la de estabilidad referencial).

## 3. App — Conexión del modo visual

- [x] 3.1 En `src/renderer/src/App.tsx`, pasar `visualCuesEnabled: visualCueMode === 'assisted'` a la llamada de `useMidi`. Verificar con `npx vitest run src/renderer/src/App.test.tsx` (1/1, consola limpia) y `npm run typecheck`.

## 4. useRepertoireTrainer — Pruebas de gating del pulso (TDD Red)

- [x] 4.1 Añadir en `src/renderer/src/hooks/useRepertoireTrainer.test.ts` un bloque de gating: con `setVisualBeatEnabled(false)` → `stimulusScheduler.onBeatTick === undefined`, `activeBeatIndex === null`; con fake timers y metrónomo continuo activo, los pulsos emiten ticks acústicos (mock de `onPlayMetronomeTick`) sin mutar `activeBeatIndex`. Verificar con `npx vitest run src/renderer/src/hooks/useRepertoireTrainer.test.ts` (Red esperado).
- [x] 4.2 Añadir casos de indicador activado y toggle en curso: con `visualBeatEnabled: true` el callback está registrado y el LED sigue el pulso (encendido por beat, apagado a ~140 ms con fake timers); desactivar con el metrónomo corriendo limpia `activeBeatIndex` de inmediato y ningún pulso posterior lo reactiva. Verificar con `npx vitest run src/renderer/src/hooks/useRepertoireTrainer.test.ts` (Red esperado en la parte de desregistro; la parte de LED activado debe pasar ya — documentar el estado observado).

## 5. useRepertoireTrainer — Implementación del gate (TDD Green)

- [x] 5.1 En `src/renderer/src/hooks/useRepertoireTrainer.ts`: el efecto de `onBeatTick` pasa a deps `[visualBeatEnabled]`; con `true` registra el callback vigente (alta + apagado a 140 ms), con `false` desregistra (`stimulusScheduler.onBeatTick = undefined`) y limpia `setActiveBeatIndex(null)`; cleanup con desregistro simétrico. Verificar con `npx vitest run src/renderer/src/hooks/useRepertoireTrainer.test.ts`: casos 4.1 y 4.2 en Green y suite completa del archivo en 0 fallos.

## 6. Verificación integral

- [x] 6.1 Ejecutar la suite completa `npm test` y confirmar 0 fallos y 0 regresiones respecto al estado previo al cambio.
- [x] 6.2 Ejecutar `npm run typecheck` y `npm run lint` y confirmar 0 errores (incluido `react-hooks/exhaustive-deps` sobre el efecto modificado).

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
