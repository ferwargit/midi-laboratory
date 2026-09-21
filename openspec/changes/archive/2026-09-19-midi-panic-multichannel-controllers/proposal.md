## Why

La Auditoría V6 clasificó dos hallazgos P1 en el hook `useMidi`:

- **H-01 (Pánico MIDI Multicanal incompleto):** `sendAllNotesOff(channel = 1)` (src/renderer/src/hooks/useMidi.ts:98-130) solo emite silenciadores sobre el canal argumento, por defecto el Canal 1. La aplicación utiliza dos canales GM activos — Canal 1 (Piano Acústico) y Canal 10 (Metrónomo GM, ver `01-midi-audio-hardware/spec.md` requisito "Scheduler y Reloj Maestro Cuantizado") — de modo que al pulsar Pánico o al desmontar el hook (useMidi.ts:208-212) se cancelan los temporizadores de `Note Off` del Canal 10 pero **no se emite ningún `Note Off` ni CC 120/123 hacia el Canal 10**. El clic de metrónomo queda sonando indefinidamente en el sintetizador físico Korg NS5R.
- **H-02 (Reset de Controladores ausente):** la secuencia de pánico actual no emite `CC #121` (Reset All Controllers) ni `Pitch Bend` centrado. Estados de rueda de modulación (`CC #1`) o desafinaciones manuales previas sobreviven al pánico y alteran el timbre del siguiente ejercicio.

Ambos defectos rompen el contrato "silenciar de forma determinista todo el hardware" declarado por el requisito canónico "Procedimiento de Pánico MIDI (sendAllNotesOff)".

## What Changes

- **`sendAllNotesOff` multicanal:** cuando se invoca sin canal explícito (pánico global / desmonte / `clearAllPressedNotes`), DEBE iterar sobre los canales activos de la aplicación `[1, 10]` emitiendo la secuencia de silenciamiento por cada uno. Cuando se invoca con canal concreto (p. ej. `changeProgram(programNumber, channel)` en useMidi.ts:283-295), DEBE silenciar exclusivamente ese canal.
- **Secuencia canónica completa por canal:** para cada canal a silenciar se emite, en este orden:
  1. `CC #120` (All Sound Off) — `[0xB0 | chByte, 120, 0]`
  2. `CC #123` (All Notes Off) — `[0xB0 | chByte, 123, 0]`
  3. `CC #64` (Sustain / Damper Off) — `[0xB0 | chByte, 64, 0]`
  4. `CC #121` (Reset All Controllers) — `[0xB0 | chByte, 121, 0]`
  5. `Pitch Bend` centrado — `[0xE0 | chByte, 0x00, 0x40]`
  6. Barrido explícito de `Note Off` de las 88 notas (21 a 108) — `[0x80 | chByte, note, 0]`
- **Estado interno:** se mantiene la limpieza atómica existente (cancelación y vaciado de `stimulusTimersRef` y `hungNotesTimersRef`, `filterRef.current.clearHistory()`, `setPressedNotes([])`, `setActiveStimulusNotes([])`), que DEBE ejecutarse antes de cualquier envío y DEBE ocurrir aunque no haya puerto de salida.
- **Pruebas (TDD, primeras en escribirse):** `useMidi.test.ts` gana aserciones de CC 121 y Pitch Bend en el caso existente de Canal 1, más casos nuevos para pánico global multicanal (Canales 1 y 10: `0xB0`/`0x80`/`0xE0` y `0xB9`/`0x89`/`0xE9`), pánico específico de canal (exclusividad) y contención de excepciones del puerto de salida.
- **Spec canónica:** se actualiza por delta el requisito "Procedimiento de Pánico MIDI (sendAllNotesOff)" de `01-midi-audio-hardware`.

**Compatibilidad:** `changeProgram` y `sendNote` siguen pasando canal explícito, por lo que conservan su comportamiento previo (silenciamiento de un solo canal). La firma `sendAllNotesOff(channel?: number)` no cambia; solo su semántica cuando el argumento es `undefined`. No es un breaking change de API.

## Capabilities

### New Capabilities

<!-- Ninguna: se refina el comportamiento de un requisito de una capacidad existente. -->

### Modified Capabilities

- `01-midi-audio-hardware`: el requisito "Procedimiento de Pánico MIDI (sendAllNotesOff)" pasa de silenciar un único canal por defecto a silenciar los canales activos `[1, 10]` en la invocación global, y amplía la secuencia canónica con `CC #121` y `Pitch Bend` centrado. Es la única capacidad con archivo delta formal (`specs/01-midi-audio-hardware/spec.md`).

## Impact

- **Hook MIDI:** `src/renderer/src/hooks/useMidi.ts` (cuerpo de `sendAllNotesOff` y, potencialmente, su arreglo de dependencias si se extrae una constante `ACTIVE_MIDI_CHANNELS`). `clearAllNotesOff`, el cleanup de desmonte y `changeProgram` heredan el cambio sin edición propia.
- **Pruebas:** `src/renderer/src/hooks/useMidi.test.ts` (extensión del caso "CC 120/123/64" + tres casos nuevos).
- **Especificaciones:** delta `openspec/changes/midi-panic-multichannel-controllers/specs/01-midi-audio-hardware/spec.md`; tras validación, sincronizar a `openspec/specs/01-midi-audio-hardware/spec.md`.
- **Hardware objetivo:** Korg NS5R (sintetizador físico GM); Canal 10 expone parches de percusión GM 76/77 emitidos por `StimulusScheduler`.
- **Consumidores:** ningún plug-in trainer llama `sendAllNotesOff` directamente con canal fijo; el Pánico de UI y el desmonte usan la forma global, que es justo la que corrige H-01.
- **Verificación:** `npm run typecheck`, `npm run test` (vitest) y `openspec validate midi-panic-multichannel-controllers --strict`.
