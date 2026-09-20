# Capability: MIDI & Audio Hardware Infrastructure

## Purpose

Esta capacidad define el subsistema de **interfaz de hardware MIDI y sincronización de audio** de `midi-laboratory`: el puente contractual entre el teclado físico del usuario, el motor Web MIDI del navegador/Electron y los módulos superiores de entrenamiento auditivo.

El subsistema se compone de cuatro capas cooperantes:

| Capa           | Unidad canónica                       | Responsabilidad                                                                  |
| -------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| Decodificación | `services/midi/midiParser.ts`         | Traducción de bytes MIDI brutos a estructuras tipadas                            |
| Filtrado       | `services/midi/midiInputFilter.ts`    | Supresión de rebotes mecánicos espurios del teclado                              |
| Hardware I/O   | `hooks/useMidi.ts`                    | Ciclo de vida de puertos, hotplugging, watchdog, Pánico MIDI, envío de estímulos |
| Sincronización | `services/audio/stimulusScheduler.ts` | Reloj maestro cuantizado, metrónomo y planificación de frases                    |

**Configuración single-source-of-truth (SSOT):** todas las constantes temporales del subsistema DEBEN residir en `domain/ai/appConfig.ts` (`DEFAULT_APP_CONFIG.midi`) y no DEBEN codificarse de forma rígida en los consumidores:

| Constante                 | Valor  | Semántica                          |
| ------------------------- | ------ | ---------------------------------- |
| `debounceWindowMs`        | `35`   | Ventana anti-rebote mecánico       |
| `hungNoteWatchdogMs`      | `6000` | Watchdog de nota colgada           |
| `defaultVelocity`         | `90`   | Velocity por defecto del scheduler |
| `autoAdvanceFastDelayMs`  | `1500` | Auto-avance rápido                 |
| `autoAdvanceSlowDelayMs`  | `3500` | Auto-avance lento                  |
| `autoAdvanceSmartDelayMs` | `1500` | Auto-avance del modo smart         |

**Alcance (in-scope):** parseo binario, filtrado de entrada, gestión de puertos y reconexión, Pánico MIDI, watchdog, canales GM (1 = Piano Acústico, 10 = Metrónomo), reloj maestro, alineación al downbeat y metrónomo libre.

**Fuera de alcance (out-of-scope):** evaluación pedagógica de respuestas, persistencia en base de datos, prescripciones de IA y reglas de generación de ejercicios — cubiertas por sus propias especificaciones.

## Requirements

### Requirement: Decodificación de Mensajes MIDI Brutos

El parser `parseMidiData` MUST (DEBE) traducir un paquete crudo `Uint8Array` del puerto de entrada a una estructura `ParsedMidiMessage` tipada, exponiendo `command`, `channel`, `noteNumber`, `velocity`, `isNoteOn` e `isNoteOff`.

- El parser MUST rechazar cualquier paquete con menos de 3 bytes devolviendo `null`.
- El comando MUST extraerse del nibble alto del byte de estado (`statusByte >> 4`).
- El canal MUST extraerse del nibble bajo (`statusByte & 0x0f`) y normalizarse base 1 (rango 1 a 16).
- Un evento MUST marcarse `isNoteOn` solo cuando `command === 9` **Y** `velocity > 0`.
- Un evento MUST marcarse `isNoteOff` cuando `command === 8`, **O** cuando `command === 9` con `velocity === 0`.
- El parser MUST NOT emitir `isNoteOn` e `isNoteOff` mutuamente verdaderos.

#### Scenario: Note On estándar en Canal 1

- **GIVEN** un paquete MIDI crudo `[0x90, 60, 100]`
- **WHEN** se invoca `parseMidiData(data)`
- **THEN** el resultado NO es `null`, `isNoteOn === true`, `isNoteOff === false`, `noteNumber === 60`, `velocity === 100` y `channel === 1`

#### Scenario: Note On con velocity 0 interpretado como Note Off

- **GIVEN** un paquete MIDI crudo `[0x90, 60, 0]`
- **WHEN** se invoca `parseMidiData(data)`
- **THEN** `isNoteOn === false` y `isNoteOff === true`

#### Scenario: Paquete incompleto rechazado

- **GIVEN** un paquete MIDI crudo de un solo byte `[0x90]`
- **WHEN** se invoca `parseMidiData(data)`
- **THEN** el resultado DEBE ser `null`

#### Scenario: Multiplexación de canales 1-16

- **GIVEN** un byte de estado `0x9F` (comando 9, nibble bajo `0xF`)
- **WHEN** se invoca `parseMidiData([0x9F, 60, 80])`
- **THEN** `channel === 16` e `isNoteOn === true`

### Requirement: Filtro Anti-Rebote Mecánico (MidiInputFilter)

`MidiInputFilter` MUST (DEBE) suprimir duplicados mecánicos espurios generados por el rebote del contacto físico de la tecla, sin sacrificar arpegios rápidos legítimos.

- El filtro MUST mantener un registro de la última marca temporal por número de nota (`Map<noteNumber, timestamp>`).
- El retardo anti-rebote MUST instanciarse desde `DEFAULT_APP_CONFIG.midi.debounceWindowMs` (35 ms).
- Un evento MUST marcarse `isDebouncedDuplicate === true` si y solo si `now - lastTimestamp < debounceWindowMs` para esa misma nota.
- El filtro MUST NOT actualizar la marca temporal de una nota cuando su evento sea descartado como duplicado.
- El filtro MUST NOT descartar nunca un `Note On` de nota distinta.
- `clearHistory()` MUST vaciar el registro completo de marcas temporales.

#### Scenario: Duplicado mecánico dentro de la ventana descartado

- **GIVEN** un `MidiInputFilter` con ventana de 35 ms y una nota base 60 registrada en `t = 1000`
- **WHEN** llega un segundo `Note On` de la nota 60 en `t = 1015` (15 ms después)
- **THEN** el evento DEBE devolverse con `isDebouncedDuplicate === true`

#### Scenario: Re-pulsación legítima tras la ventana aceptada

- **GIVEN** un `MidiInputFilter` con ventana de 35 ms y una nota base 60 registrada en `t = 1000`
- **WHEN** llega un `Note On` de la nota 60 en `t = 1050` (50 ms después)
- **THEN** el evento DEBE devolverse con `isDebouncedDuplicate === false`

#### Scenario: Arpegio rápido en notas distintas preservado

- **GIVEN** un `MidiInputFilter` con ventana de 35 ms
- **WHEN** llegan `Note On` de las notas 60, 64 y 67 en `t = 1000`, `t = 1010` y `t = 1020`
- **THEN** los tres eventos DEBEN devolverse con `isDebouncedDuplicate === false`

#### Scenario: clearHistory rehabilita la nota inmediatamente

- **GIVEN** un `MidiInputFilter` con ventana de 35 ms y la nota 60 registrada en `t = 1000`
- **WHEN** se invoca `clearHistory()` y llega un `Note On` de la nota 60 en `t = 1005`
- **THEN** el evento DEBE devolverse con `isDebouncedDuplicate === false`

### Requirement: Watchdog de Notas Colgadas (6000 ms)

El subsistema MUST (DEBE) proteger contra notas que permanecen visual y lógicamente "pulsadas" porque el `Note Off` físico se pierde o nunca llega.

- Por cada `Note On` aceptado, el hook `useMidi` MUST programar un temporizador watchdog con `DEFAULT_APP_CONFIG.midi.hungNoteWatchdogMs` (6000 ms).
- Si la nota no es liberada antes del vencimiento, el watchdog MUST eliminar la nota de `pressedNotes`.
- Si llega un `Note Off`, el hook MUST cancelar el watchdog pendiente y eliminar la nota de `pressedNotes`.
- El watchdog MUST NOT sustituir al `Note Off` real: su función es saneamiento del estado de UI.

#### Scenario: Nota no liberada se libera por watchdog

- **GIVEN** el hook `useMidi` con un dispositivo de entrada conectado y escuchando
- **WHEN** llega `[0x90, 60, 90]` y NO llega ningún `Note Off`
- **THEN** `pressedNotes` contiene `60` inmediatamente
- **AND** al avanzar el reloj 6001 ms, `pressedNotes` NO contiene `60`

#### Scenario: Note Off cancela el watchdog

- **GIVEN** el hook `useMidi` con la nota 60 pulsada y su watchdog pendiente
- **WHEN** llega `[0x80, 60, 0]` antes de los 6000 ms
- **THEN** `pressedNotes` NO contiene `60` y el watchdog DEBE quedar cancelado

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

### Requirement: Aislamiento de Temporizadores por Clave Compuesta

La liberación programada de cada nota de estímulo MUST (DEBE) estar indexada por una clave compuesta `${channel}_${noteNumber}`.

- `sendNote(noteNumber, durationMs, velocity, channel)` MUST calcular la clave compuesta antes de buscar temporizadores previos.
- Si existe un temporizador vigente, el hook MUST cancelarlo y emitir inmediatamente el `Note Off` `[0x80 | chByte, noteNumber, 0]` antes de re-articular.
- El `Note Off` programado MUST dispararse tras `durationMs` y eliminar la nota de `activeStimulusNotes`.

#### Scenario: Re-arteria en ráfaga reinicia el temporizador de liberación

- **GIVEN** el hook `useMidi` con un puerto de salida conectado
- **WHEN** se invoca `sendNote(60, 500)` y, 200 ms después, de nuevo `sendNote(60, 500)`
- **THEN** `activeStimulusNotes` contiene `60` a los 200 y a los 400 ms del primer envío
- **AND** el `Note Off` se recibe a los 500 ms del segundo envío (700 ms absolutos)

#### Scenario: Nota homónima en canal distinto es independiente

- **GIVEN** el hook `useMidi` con un puerto de salida conectado
- **WHEN** se invoca `sendNote(60, 400, 100, 1)` y `sendNote(60, 400, 100, 10)`
- **THEN** las claves `1_60` y `10_60` coexisten en el registro y se programan independientemente

### Requirement: Scheduler y Reloj Maestro Cuantizado (StimulusScheduler)

`StimulusScheduler` MUST (DEBE) planificar la reproducción de estímulos acústicos sobre el reloj del motor, separando estrictamente los canales de percusión y melódicos.

- Los canales MUST interpretarse como: 1 = Piano Acústico, 10 = Metrónomo (GM).
- Al planificar secuencias (`scheduleSequence`), MUST cancelarse primero los temporizadores previos.
- El metrónomo continuo MUST emitir en Canal 10, alternando GM 76 (velocity 115) en downbeat y GM 77 (velocity 90) en tiempos débiles.
- La duración acústica de las notas de piano MUST articularse al 88% de sonido y 12% de despegue con piso de 80 ms.

**Actualización dinámica del tempo del metrónomo continuo:**

- `startContinuousMetronome(beatDurationMs, beatsPerMeasure, playNoteFn)` MUST (DEBE) detectar un **cambio de tempo** cuando el metrónomo ya está corriendo y el `beatDurationMs` entrante difiere del vigente.
- Ante un cambio de tempo, el scheduler MUST reiniciar el reloj limpiamente, en este orden:
  1. Cancelar y anular el `setInterval` activo.
  2. Cancelar y vaciar las **frases pendientes** programadas sobre la cuadrícula del tempo anterior, pues sus `delayMs` ya no corresponden a la cuadrícula vigente.
  3. Actualizar `currentBeatDurationMs` y `currentBeatsPerMeasure`.
  4. Reasignar `clockStartTime` al instante del reinicio, de modo que `schedulePhraseOnContinuousGrid` vuelva a calcular el downbeat objetivo contra el reloj nuevo.
  5. Reiniciar la fase de beat desde el **downbeat** (GM 76, velocity 115).
- Si el metrónomo está corriendo y el `beatDurationMs` entrante es **igual** al vigente, la invocación MUST ser idempotente (no reiniciar el reloj ni reasignar `clockStartTime`), preservando la fase del beat en curso.
- Si el metrónomo no está corriendo, MUST arrancar con el tempo solicitado.
- El cambio de tempo MUST poder realizarse de forma **no interactiva** (sin intervención del usuario) para soportar `autoSpeedRamp`, que sube +5 BPM de forma automática tras cada streak alcanzado.
- El scheduler MUST exponer un medio de inspección del tempo vigente (p. ej. `getCurrentBeatDurationMs()`), verificable en pruebas con relojes virtuales sin depender de efectos de audio.

#### Scenario: Eventos programados con retardo, duración y canal exactos

- **GIVEN** un `StimulusScheduler` con relojes virtuales
- **WHEN** se invoca `scheduleSequence` con eventos `[{60, 400, 0, 85, 1}, {76, 120, 500, 105, 10}]`
- **THEN** a los 10 ms `playNoteFn` recibe `(60, 400, 85, 1)`
- **AND** a los 500 ms `playNoteFn` recibe `(76, 120, 105, 10)`

#### Scenario: cancelAll detiene todo

- **GIVEN** un `StimulusScheduler` con secuencia y metrónomo continuo activos
- **WHEN** se invoca `cancelAll()`
- **THEN** `hasPending() === false` y `isContinuousMetronomeActive() === false`

#### Scenario: Cambio de tempo con el metrónomo continuo activo actualiza el intervalo y descarta el reloj anterior

- **GIVEN** un `StimulusScheduler` con relojes virtuales y un metrónomo continuo corriendo a `beatDurationMs = 750` (80 BPM)
- **WHEN** se invoca `startContinuousMetronome(500, 2, fn)` (120 BPM) estando el metrónomo ya activo
- **THEN** el metrónomo continúa activo (`isContinuousMetronomeActive() === true`)
- **AND** el tempo vigente pasa a ser 500 ms por beat
- **AND** los clics siguientes se emiten cada 500 ms (no cada 750 ms)
- **AND** la fase de beat se reinicia desde el downbeat (GM 76, velocity 115)

#### Scenario: Cambio de tempo cancela las frases pendientes de la cuadrícula anterior

- **GIVEN** un `StimulusScheduler` con un metrónomo continuo a 750 ms/beat y una frase de piano ya programada sobre esa cuadrícula
- **WHEN** se invoca `startContinuousMetronome(500, 2, fn)` cambiando el tempo
- **THEN** `hasPending() === false`, de modo que ninguna nota de la frase vieja se emite sobre la cuadrícula nueva

#### Scenario: Mismo tempo es idempotente y no reinicia el reloj

- **GIVEN** un `StimulusScheduler` con un metrónomo continuo a 750 ms/beat ya en fase de beat avanzada
- **WHEN** se invoca `startContinuousMetronome(750, 2, fn)` con el mismo tempo
- **THEN** el reloj no se reinicia y la fase del beat continúa sin interrupción

### Requirement: Alineación al Downbeat con Compases de Reposo

La entrada de la frase de piano MUST (DEBE) alinearse a la cuadrícula del reloj maestro, respetando una cantidad exacta de compases de respiración.

- `schedulePhraseOnContinuousGrid(pianoEvents, restingMeasures, playNoteFn)` MUST calcular el downbeat objetivo del compás `currentMeasureIndex + restingMeasures`.
- Si el retardo calculado es menor a 250 ms, el scheduler MUST desplazar la entrada al siguiente compás completo.
- Todos los `delayMs` de la frase MUST desplazarse por el retardo al downbeat objetivo.

#### Scenario: 1 compás de descanso en 2/4 equivale a 2 clics de espera

- **GIVEN** un `StimulusScheduler` arrancado en `t = 0` con `beatDurationMs = 750`, `beatsPerMeasure = 2` (1 compás = 1500 ms)
- **WHEN** se invoca `schedulePhraseOnContinuousGrid([{note: 67, durationMs: 500, delayMs: 0, velocity: 100, channel: 1}], 1, fn)`
- **THEN** `playNoteFn` recibe `(67, 500, 100, 1)` exactamente en `t = 1500 ms`

#### Scenario: Salvaguarda de los 250 ms

- **GIVEN** un reloj cuyo retardo calculado al downbeat objetivo es de 150 ms
- **WHEN** se invoca `schedulePhraseOnContinuousGrid(pianoEvents, 1, fn)`
- **THEN** la frase se desplaza al downbeat del compás siguiente

### Requirement: Metrónomo Libre en Reposo

El subsistema MUST (DEBE) permitir ensayar con metrónomo sin iniciar una sesión de ejercicio evaluable, para práctica libre sobre el piano.

- `toggleFreeMetronome` MUST iniciar el reloj maestro continuo (Canal 10) con el BPM de estudio actual.
- Si ya está activo, MUST detener el reloj y anular el acento visual.
- El metrónomo libre MUST NOT disparar evaluación ni registrar sesiones.

#### Scenario: Arranque y parada de la práctica libre

- **GIVEN** el hook de repertorio con metrónomo libre inactivo y BPM de estudio 90
- **WHEN** se invoca `toggleFreeMetronome()`
- **THEN** el reloj maestro se activa en Canal 10 con `beatDurationMs ≈ 667 ms`
- **WHEN** se invoca `toggleFreeMetronome()` de nuevo
- **THEN** el reloj se detiene y el acento visual se anula

### Requirement: Resiliencia de Hardware (Hotplugging)

El subsistema MUST (DEBE) tolerar la conexión y desconexión física del adaptador MIDI en caliente, sin bloquear la aplicación ni requerir recarga.

- El hook MUST solicitar acceso con `navigator.requestMIDIAccess({ sysex: false })`.
- Cuando no quede ningún puerto de entrada, el hook MUST marcar `isDeviceDisconnected = true` e invocar `onDeviceDisconnected`.
- Las callbacks `onDeviceDisconnected` / `onDeviceReconnected` MUST dispararse solo en transiciones de estado (flanco).
- Al reconectar, el hook MUST re-seleccionar preferentemente el último nombre de dispositivo conocido (`lastKnownInputNameRef`).
- Mientras esté desconectado, `sendNote`, `changeProgram` y `sendAllNotesOff` MUST ser no-ops seguros.

#### Scenario: Auto-detección y selección del UM-ONE

- **GIVEN** un `requestMIDIAccess` que resuelve con puertos "Roland UM-ONE"
- **WHEN** se monta el hook `useMidi`
- **THEN** `selectedInputId` y `selectedOutputId` apuntan a "Roland UM-ONE"

#### Scenario: Desconexión física detectada por flanco

- **GIVEN** el hook `useMidi` conectado con `onDeviceDisconnected` suscrito
- **WHEN** se vacían los puertos de entrada y se dispara `onstatechange`
- **THEN** `isDeviceDisconnected === true` y `onDeviceDisconnected` se invocó exactamente una vez

### Requirement: Redirección de Entrada (Software THRU) y Cambio de Programa

El subsistema MUST (DEBE) ofrecer reenvío en software del teclado hacia la salida, y cambio de programa GM controlado.

- Cuando `enableSoftwareThru: true` y exista salida seleccionada, cada mensaje crudo MUST reenviarse antes de su parseo al puerto de salida.
- El reenvío MUST NOT filtrarse por el `MidiInputFilter`.
- `changeProgram(programNumber, channel = 1)` MUST emitir primero `sendAllNotesOff(channel)` y luego `Program Change` `[0xC0 | (channel - 1), programNumber]`.

#### Scenario: THRU bit-exacto y registro de nota pulsada

- **GIVEN** el hook `useMidi` con `enableSoftwareThru: true` y salida seleccionada
- **WHEN** el puerto de entrada recibe `[0x90, 64, 100]`
- **THEN** la salida recibió exactamente el mismo paquete crudo y `pressedNotes` contiene 64

#### Scenario: Program Change precedido de silenciamiento

- **GIVEN** el hook `useMidi` con salida conectada y seleccionada
- **WHEN** se invoca `changeProgram(73, 1)`
- **THEN** el puerto recibió el Pánico MIDI y luego `[0xC0, 73]`

### Requirement: Registro de Actividad del Bus MIDI (Logs)

El subsistema MUST (DEBE) mantener un registro observable del tráfico MIDI para depuración y feedback.

- `addLog` MUST aceptar entradas tipadas `IN | OUT | AI | EVAL` con sello temporal `HH:MM:SS.mmm`.
- El historial MUST recortarse a los últimos 35 eventos.
- El identificador MUST ser único por evento.

#### Scenario: Ventana deslizante de 35 entradas

- **GIVEN** el hook `useMidi` montado
- **WHEN** se añaden 40 entradas de log consecutivas
- **THEN** `logs.length === 35` y el último elemento es la entrada 40
