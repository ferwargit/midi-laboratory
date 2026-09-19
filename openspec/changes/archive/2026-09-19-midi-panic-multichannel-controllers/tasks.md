## 1. Pruebas primero (TDD — Red)

- [x] 1.1 En `src/renderer/src/hooks/useMidi.test.ts`, extender el caso "sendAllNotesOff debe emitir CC 120 (Sound Off), CC 123 (Notes Off) y CC 64 (Sustain Off)": renombrarlo a la secuencia canónica completa en Canal 1 y añadir `expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 121, 0])` y `expect(mockOutput.send).toHaveBeenCalledWith([0xe0, 0x00, 0x40])` — verificar con `npm run test` que pasa (green) o documenta el fallo previo a la implementación.
- [x] 1.2 Añadir caso "sendAllNotesOff global debe silenciar los canales activos 1 y 10": invocar `sendAllNotesOff()` sin argumento y afirmar `[0xb0, 120, 0]`, `[0xb0, 123, 0]`, `[0xb0, 64, 0]`, `[0xb0, 121, 0]`, `[0xe0, 0x00, 0x40]` y el barrido `[0x80, 21, 0]`…`[0x80, 108, 0]` en Canal 1, más `[0xb9, 120, 0]`, `[0xb9, 123, 0]`, `[0xb9, 64, 0]`, `[0xb9, 121, 0]`, `[0xe9, 0x00, 0x40]` y `[0x89, 21, 0]`…`[0x89, 108, 0]` en Canal 10 — debe fallar (Red) antes de la tarea 2.x.
- [x] 1.3 Añadir caso "sendAllNotesOff(1) no debe tocar el Canal 10": afirmar `expect(mockOutput.send).not.toHaveBeenCalledWith([0xb9, 121, 0])` y `expect(mockOutput.send).not.toHaveBeenCalledWith([0xe9, 0x00, 0x40])`, además de que `clearAllPressedNotes()` sí emite ambos.
- [x] 1.4 Añadir caso de contención: un `mockOutput.send` que lance en la primera invocación; afirmar que `result.current.pressedNotes === []` y que la llamada a `sendAllNotesOff()` no propaga la excepción.

## 2. Implementación (useMidi.ts)

- [x] 2.1 Añadir `const ACTIVE_MIDI_CHANNELS = [1, 10] as const` en el ámbito de módulo de `src/renderer/src/hooks/useMidi.ts` (junto a los refs/constantes del hook).
- [x] 2.2 Cambiar la firma `(channel = 1)` por `(channel?: number)` y computar los canales objetivo: `channel === undefined ? ACTIVE_MIDI_CHANNELS : [channel]`.
- [x] 2.3 Extraer la limpieza de estado (timers, `clearHistory`, `setPressedNotes([])`, `setActiveStimulusNotes([])`) para que siga ejecutándose una sola vez, antes de cualquier envío y aunque no haya puerto — verificar que el scenario "Limpieza de estado interno aunque no haya hardware" sigue pasando.
- [x] 2.4 Sustituir el bloque `try` por un bucle sobre los canales objetivo que emita, por canal y en orden: `CC #120`, `CC #123`, `CC #64`, `CC #121`, `Pitch Bend [0xE0 | chByte, 0x00, 0x40]` y el barrido 21→108 de `Note Off`.
- [x] 2.5 Confirmar que el `catch` envuelve el bucle completo y mantiene el `console.warn('[useMidi] Error al emitir MIDI Panic:')` — verificar con `npm run typecheck`.

## 3. Deltas y especificaciones canónicas

- [x] 3.1 Verificar que la delta `openspec/changes/midi-panic-multichannel-controllers/specs/01-midi-audio-hardware/spec.md` contiene el `## MODIFIED Requirements` del requisito "Procedimiento de Pánico MIDI (sendAllNotesOff)" con la constante `ACTIVE_MIDI_CHANNELS`, la regla `undefined` → `[1, 10]` y los cinco scenarios — ejecutar `openspec validate midi-panic-multichannel-controllers --strict`.
- [x] 3.2 Tras la validación, sincronizar la delta a `openspec/specs/01-midi-audio-hardware/spec.md` reemplazando el bloque del requisito "Procedimiento de Pánico MIDI (sendAllNotesOff)" por el de la delta (conservando los scenarios previos que se mantienen y añadiendo los nuevos).
- [x] 3.3 Releer `openspec/specs/01-midi-audio-hardware/spec.md` y confirmar que la sección `## Purpose` sigue declarando los canales GM (1 = Piano, 10 = Metrónomo) de forma coherente con `ACTIVE_MIDI_CHANNELS` — buscar "Canal 10" y "sendAllNotesOff" en `openspec/specs/`.

## 4. Verificación final

- [x] 4.1 Ejecutar `npm run typecheck` y confirmar salida sin errores.
- [x] 4.2 Ejecutar `npm run lint` y confirmar salida sin errores.
- [x] 4.3 Ejecutar `npm run test` (vitest) y confirmar que todos los casos, incluidos los nuevos, pasan.
- [x] 4.4 Ejecutar `openspec validate midi-panic-multichannel-controllers --strict` y confirmar "Change 'midi-panic-multichannel-controllers' is valid".
