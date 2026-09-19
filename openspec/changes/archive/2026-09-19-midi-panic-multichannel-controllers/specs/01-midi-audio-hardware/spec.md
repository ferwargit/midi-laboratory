## MODIFIED Requirements

### Requirement: Procedimiento de Pánico MIDI (sendAllNotesOff)

El Pánico MIDI MUST (DEBE) silenciar de forma determinista todo el hardware, tanto notas lógicas como estados de pedal y de controladores continuos, sin excepciones, cubriendo todos los canales activos de la aplicación.

Los canales activos canónicos de la aplicación son **1 (Piano Acústico) y 10 (Metrónomo GM)**; la constante nominal `ACTIVE_MIDI_CHANNELS` del hook `useMidi` DEBE contener exactamente `[1, 10]`.

La función `sendAllNotesOff(channel?: number)` MUST:

1. Cancelar y vaciar todos los temporizadores de estímulos (`stimulusTimersRef`).
2. Cancelar y vaciar todos los temporizadores watchdog de notas colgadas (`hungNotesTimersRef`).
3. Invocar `clearHistory()` del `MidiInputFilter` y vaciar `pressedNotes` y `activeStimulusNotes`. Estos pasos 1-3 MUST ejecutarse antes de cualquier envío al puerto y MUST ocurrir aunque no haya salida disponible.
4. Determinar el conjunto de canales a silenciar:
   - Si `channel` es `undefined` (pánico global: botón de Pánico, `clearAllPressedNotes`, desmonte del hook), MUST silenciar **todos los canales activos `[1, 10]`**.
   - Si `channel` es un número concreto, MUST silenciar **únicamente** ese canal.
5. Si la salida está disponible, emitir por cada canal a silenciar, en este orden canónico (con `chByte = (channel - 1) & 0x0f`):
   - `CC #120` (All Sound Off) — `[0xB0 | chByte, 120, 0]`
   - `CC #123` (All Notes Off) — `[0xB0 | chByte, 123, 0]`
   - `CC #64` (Sustain / Damper Off) — `[0xB0 | chByte, 64, 0]`
   - `CC #121` (Reset All Controllers) — `[0xB0 | chByte, 121, 0]`
   - `Pitch Bend` centrado — `[0xE0 | chByte, 0x00, 0x40]`
   - `Note Off` explícito para las 88 notas físicas del piano (21 a 108) — `[0x80 | chByte, note, 0]`
6. Si no hay salida, MUST retornar de forma segura tras limpiar el estado interno.
7. Cualquier excepción de `outputPort.send` MUST ser contenida y NO propagarse al llamador.

#### Scenario: Emisión del cuádruple silenciador en Canal 1

- **GIVEN** el hook `useMidi` con un puerto de salida conectado y seleccionado
- **WHEN** se invoca `sendAllNotesOff(1)`
- **THEN** el puerto de salida recibe `[0xB0, 120, 0]`, `[0xB0, 123, 0]`, `[0xB0, 64, 0]`, `[0xB0, 121, 0]` y `[0xE0, 0x00, 0x40]`
- **AND** recibe `Note Off` `[0x80, 21, 0]` … `[0x80, 108, 0]` (88 notas)
- **AND** NO recibe ningún mensaje con byte de estado del Canal 10 (`0xB9`, `0x89`, `0xE9`)

#### Scenario: Pánico global silencia los canales activos 1 y 10

- **GIVEN** el hook `useMidi` con un puerto de salida conectado y seleccionado
- **WHEN** se invoca `sendAllNotesOff()` sin argumento
- **THEN** el puerto de salida recibe la secuencia canónica completa sobre el Canal 1: `[0xB0, 120, 0]`, `[0xB0, 123, 0]`, `[0xB0, 64, 0]`, `[0xB0, 121, 0]`, `[0xE0, 0x00, 0x40]` y `Note Off` `[0x80, 21, 0]` … `[0x80, 108, 0]`
- **AND** recibe la misma secuencia canónica completa sobre el Canal 10: `[0xB9, 120, 0]`, `[0xB9, 123, 0]`, `[0xB9, 64, 0]`, `[0xB9, 121, 0]`, `[0xE9, 0x00, 0x40]` y `Note Off` `[0x89, 21, 0]` … `[0x89, 108, 0]`

#### Scenario: clearAllPressedNotes dispara el pánico multicanal

- **GIVEN** el hook `useMidi` con un puerto de salida conectado y seleccionado
- **WHEN** se invoca `clearAllPressedNotes()`
- **THEN** `pressedNotes === []`, `activeStimulusNotes === []`
- **AND** el puerto recibe los silenciadores del Canal 1 (`0xB0`, `0x80`, `0xE0`) y del Canal 10 (`0xB9`, `0x89`, `0xE9`)

#### Scenario: Pánico específico no afecta al Canal 10

- **GIVEN** el hook `useMidi` con un puerto de salida conectado y seleccionado
- **WHEN** se invoca `sendAllNotesOff(1)`
- **THEN** el puerto recibe `[0xB0, 121, 0]` y `[0xE0, 0x00, 0x40]`
- **AND** NO recibe `[0xB9, 121, 0]` ni `[0xE9, 0x00, 0x40]`

#### Scenario: Limpieza de estado interno aunque no haya hardware

- **GIVEN** el hook `useMidi` sin puerto de salida seleccionado
- **WHEN** se invoca `clearAllPressedNotes()`
- **THEN** `pressedNotes === []`, `activeStimulusNotes === []` y la invocación NO lanza

#### Scenario: Error de envío contenido

- **GIVEN** un puerto de salida cuyo método `send` lanza una excepción
- **WHEN** se invoca `sendAllNotesOff()`
- **THEN** el estado interno se limpia y la excepción NO se propaga al llamador
