# Tasks

## 1. Pruebas de regresión (TDD — Rojo)

- [x] 1.1 Añadir en `src/renderer/src/hooks/useMidi.test.ts` el escenario "El tick del metrónomo no contamina la pista visual de estímulo": con `vi.useFakeTimers()`, invocar `sendNote(76, 120, 115, 10)` y verificar que `activeStimulusNotes` NO contiene `76` ni inmediatamente tras el envío ni antes de los 120 ms, y que el puerto sí recibe el `Note On`/`Note Off` del Canal 10. Verificar ejecutando `npx vitest run src/renderer/src/hooks/useMidi.test.ts` y confirmando que el nuevo test FALLA (Rojo).
- [x] 1.2 Añadir el escenario "La nota de piano sigue iluminando como estímulo": `sendNote(60, 400, 100, 1)` registra `60` en `activeStimulusNotes` durante la articulación y lo retira tras el `Note Off` programado. Verificar que este test PASA ya (guarda de comportamiento existente) antes de tocar implementación.

## 2. Implementación (TDD — Verde)

- [x] 2.1 En `src/renderer/src/hooks/useMidi.ts`: extraer la constante `MELODIC_CHANNEL = 1` junto a `ACTIVE_MIDI_CHANNELS` y condicionar el alta en `activeStimulusNotes` (y su retirada en el `Note Off` programado) a `channel === MELODIC_CHANNEL`, sin alterar la lógica de temporizadores por clave compuesta `${channel}_${noteNumber}`. Verificar con `npx vitest run src/renderer/src/hooks/useMidi.test.ts` (Verde, incluidos los escenarios 1.1 y 1.2).

## 3. Verificación de calidad

- [x] 3.1 Formatear los archivos tocados con Prettier (`npx prettier --write src/renderer/src/hooks/useMidi.ts src/renderer/src/hooks/useMidi.test.ts`) y confirmar que `npm run typecheck` termina sin errores.
- [x] 3.2 Ejecutar `npm run test` (suite completa, single-run no interactivo) y confirmar el 100% de tests en verde, incluidos los escenarios preexistentes de `activeStimulusNotes` y los de independencia de temporizadores por canal.
