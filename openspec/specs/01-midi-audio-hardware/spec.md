# Capability: MIDI & Audio Hardware Infrastructure

## Propósito y Alcance

Esta capacidad define el subsistema de **interfaz de hardware MIDI y sincronización de audio** de
`midi-laboratory`: el puente contractual entre el teclado físico del usuario, el motor Web MIDI del
navegador/Electron y los módulos superiores de entrenamiento auditivo.

El subsistema se compone de cuatro capas cooperantes:

| Capa | Unidad canónica | Responsabilidad |
| --- | --- | --- |
| Decodificación | `services/midi/midiParser.ts` | Traducción de bytes MIDI brutos a estructuras tipadas |
| Filtrado | `services/midi/midiInputFilter.ts` | Supresión de rebotes mecánicos espurios del teclado |
| Hardware I/O | `hooks/useMidi.ts` | Ciclo de vida de puertos, hotplugging, watchdog, Pánico MIDI, envío de estímulos |
| Sincronización | `services/audio/stimulusScheduler.ts` | Reloj maestro cuantizado, metrónomo y planificación de frases |

**Configuración single-source-of-truth (SSOT):** todas las constantes temporales del subsistema
DEBEN residir en `domain/ai/appConfig.ts` (`DEFAULT_APP_CONFIG.midi`) y no DEBEN
codificarse de forma rígida en los consumidores:

| Constante | Valor | Semántica |
| --- | --- | --- |
| `debounceWindowMs` | `35` | Ventana anti-rebote mecánico |
| `hungNoteWatchdogMs` | `6000` | Watchdog de nota colgada |
| `defaultVelocity` | `90` | Velocity por defecto del scheduler |
| `autoAdvanceFastDelayMs` | `1500` | Auto-avance rápido |
| `autoAdvanceSlowDelayMs` | `3500` | Auto-avance lento |

**Alcance (in-scope):** parseo binario, filtrado de entrada, gestión de puertos y reconexión,
Pánico MIDI, watchdog, canales GM (1 = Piano Acústico, 10 = Metrónomo), reloj maestro,
alineación al downbeat y metrónomo libre.

**Fuera de alcance (out-of-scope):** evaluación pedagógica de respuestas, persistencia en base de
datos, prescripciones de IA y reglas de generación de ejercicios — cubiertas por sus propias
especificaciones.

> **Convención terminológica:** este documento usa términos RFC 2119. `DEBE` (MUST) y `NO DEBE`
> (MUST NOT) marcan requerimientos invariables del contrato. `DEBERÍA` (SHOULD) marca una práctica
> fuertemente recomendada con excepciones justificadas. `PUEDE` (MAY) marca comportamiento
> opcional habilitable.

---

## Requirement: Decodificación de Mensajes MIDI Brutos

El parser `parseMidiData` DEBE traducir un paquete crudo `Uint8Array` del puerto de entrada a una
estructura `ParsedMidiMessage` tipada, exponiendo `command`, `channel`, `noteNumber`, `velocity`,
`isNoteOn` e `isNoteOff`.

- El parser DEBE rechazar cualquier paquete con menos de 3 bytes devolviendo `null`.
- El comando DEBE extraerse del nibble alto del byte de estado (`statusByte >> 4`).
- El canal DEBE extraerse del nibble bajo (`statusByte & 0x0f`) y normalizarse base 1, por lo que
  el rango resultante DEBE ser **1 a 16**.
- Un evento DEBE marcarse `isNoteOn` solo cuando `command === 9` **Y** `velocity > 0`.
- Un evento DEBE marcarse `isNoteOff` cuando `command === 8`, **O** cuando `command === 9` con
  `velocity === 0` (aliasación estándar Note-On-velocity-0).
- El parser NO DEBE emitir `isNoteOn` e `isNoteOff` mutuamente verdaderos.
- Los consumidores NO DEBÉN asumir exclusividad mutua estricta más allá de la regla anterior; la
  semántica de "nota sostenida" se delega al watchdog.

#### Scenario: Note On estándar en Canal 1

- **GIVEN** un paquete MIDI crudo `[0x90, 60, 100]`
- **WHEN** se invoca `parseMidiData(data)`
- **THEN** el resultado NO es `null`, `isNoteOn === true`, `isNoteOff === false`,
  `noteNumber === 60`, `velocity === 100` y `channel === 1`

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

---

## Requirement: Filtro Anti-Rebote Mecánico (MidiInputFilter)

`MidiInputFilter` DEBE suprimir duplicados mecánicos espurios generados por el rebote del contacto
físico de la tecla, sin sacrificar arpegios rápidos legítimos.

- El filtro DEBE mantener un registro de la última marca temporal **por número de nota**
  (`Map<noteNumber, timestamp>`), no global.
- El retardo anti-rebote DEBE instanciarse desde `DEFAULT_APP_CONFIG.midi.debounceWindowMs`
  (35 ms) por el hook `useMidi`; la clase NO DEBE acoplar su valor por defecto a constantes ajenas.
- Un evento DEBE marcarse `isDebouncedDuplicate === true` si y solo si
  `now - lastTimestamp < debounceWindowMs` para **esa misma nota**.
- El filtro NO DEBE actualizar la marca temporal de una nota cuando su evento sea descartado como
  duplicado (para evitar desplazamiento acumulativo de la ventana).
- El filtro NO DEBE descartar nunca un `Note On` de **nota distinta**, por rápida que sea su
  llegada: la clave de debounce es el número de nota, de modo que un arpegio de notas diferentes
  PUEDE pasar íntegro sin pérdida.
- `clearHistory()` DEBE vaciar el registro completo de marcas temporales.
- El hook `useMidi` DEBE aplicar el filtro **solo a eventos `isNoteOn`**; los `Note Off` NO DEBEN
  filtrarse.

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

---

## Requirement: Watchdog de Notas Colgadas (6000 ms)

El subsistema DEBE proteger contra notas que permanecen visual y lógicamente "pulsadas" porque el
`Note Off` físico se pierde o nunca llega.

- Por cada `Note On` aceptado por el filtro, el hook `useMidi` DEBE programar un temporizador
  watchdog con `DEFAULT_APP_CONFIG.midi.hungNoteWatchdogMs` (**6000 ms**).
- Si la nota no es liberada antes del vencimiento, el watchdog DEBE eliminar la nota del arreglo
  `pressedNotes` y DEBE descartar su propio temporizador del registro.
- Si llega un `Note Off` (o su alias Note-On-velocity-0) de esa nota, el hook DEBE cancelar el
  watchdog pendiente y DEBE eliminar la nota de `pressedNotes`.
- Si llega un nuevo `Note On` de una nota con watchdog vigente, el hook DEBE cancelar el watchdog
  previo antes de programar uno nuevo (un temporizador por nota, nunca duplicados).
- El watchdog NO DEBE sustituir al `Note Off` real: su función es saneamiento del estado de UI.
- El watchdog NO DEBE cancelar notas del canal de estímculo (`activeStimulusNotes`), cuya
  liberación es responsabilidad de `sendNote`.

#### Scenario: Nota no liberada se libera por watchdog

- **GIVEN** el hook `useMidi` con un dispositivo de entrada conectado y escuchando
- **WHEN** llega `[0x90, 60, 90]` y NO llega ningún `Note Off`
- **THEN** `pressedNotes` contiene `60` inmediatamente
- **AND** al avanzar el reloj **6001 ms**, `pressedNotes` NO contiene `60`

#### Scenario: Note Off cancela el watchdog

- **GIVEN** el hook `useMidi` con la nota 60 pulsada y su watchdog pendiente
- **WHEN** llega `[0x80, 60, 0]` antes de los 6000 ms
- **THEN** `pressedNotes` NO contiene `60` y el watchdog DEBE quedar cancelado (la nota no se
  re-liberará a los 6000 ms)

---

## Requirement: Procedimiento de Pánico MIDI (sendAllNotesOff)

El Pánico MIDI DEBE silenciar de forma determinista todo el hardware, tanto notas lógicas como
estados de pedal, sin excepciones.

La función `sendAllNotesOff(channel = 1)` DEBE:

1. Cancelar y vaciar **todos** los temporizadores de estímulos (`stimulusTimersRef`).
2. Cancelar y vaciar **todos** los temporizadores watchdog de notas colgadas (`hungNotesTimersRef`).
3. Invocar `clearHistory()` del `MidiInputFilter` y vaciar `pressedNotes` y `activeStimulusNotes`.
4. Si `midiAccess`, `selectedOutputId` están disponibles y el dispositivo NO está desconectado,
   emitir hacia el puerto de salida, en orden:
   - `CC #120` (All Sound Off) — `[0xB0 | (channel-1), 120, 0]`
   - `CC #123` (All Notes Off) — `[0xB0 | (channel-1), 123, 0]`
   - `CC #64` (Sustain / Damper Off) — `[0xB0 | (channel-1), 64, 0]`
   - `Note Off` explícito para **las 88 notas físicas del piano**, iterando `note` de **21 a 108**
     inclusive — `[0x80 | (channel-1), note, 0]`
5. Si la salida o el dispositivo no están disponibles, DEBE retornar de forma segura tras limpiar
   el estado interno (limpieza "en seco").

- El byte de canal DEBE calcularse como `(channel - 1) & 0x0f`, de modo que `channel = 1` produce
  `0x00` y `channel = 10` produce `0x09`.
- La emisión DEBE envolverse en un bloque a prueba de fallos: un error de envío NO DEBE propagar
  una excepción a la UI; DEBE registrarse como advertencia.
- `clearAllPressedNotes()` DEBE delegar en `sendAllNotesOff`.
- Al desmontar el hook, el limpiador DEBE invocar `sendAllNotesOff` para no dejar notas colgadas.

#### Scenario: Emisión del cuádruple silenciador en Canal 1

- **GIVEN** el hook `useMidi` con un puerto de salida conectado y seleccionado
- **WHEN** se invoca `sendAllNotesOff(1)`
- **THEN** el puerto de salida recibe `[0xB0, 120, 0]`, `[0xB0, 123, 0]` y `[0xB0, 64, 0]`
- **AND** recibe `Note Off` `[0x80, 21, 0]` … `[0x80, 108, 0]` (88 notas)

#### Scenario: Limpieza de estado interno aunque no haya hardware

- **GIVEN** el hook `useMidi` sin puerto de salida seleccionado
- **WHEN** se invoca `clearAllPressedNotes()`
- **THEN** `pressedNotes === []`, `activeStimulusNotes === []` y la invocación NO lanza

#### Scenario: Canal 10 direccionado correctamente

- **GIVEN** el hook `useMidi` con un puerto de salida conectado
- **WHEN** se invoca `sendAllNotesOff(10)`
- **THEN** los mensajes usan el byte de estado `0xB9` (CC canal 10) y `0x89` (Note Off canal 10)

#### Scenario: Error de envío contenido

- **GIVEN** un puerto de salida cuyo método `send` lanza una excepción
- **WHEN** se invoca `sendAllNotesOff()`
- **THEN** el estado interno se limpia y la excepción NO se propaga al llamador

---

## Requirement: Aislamiento de Temporizadores por Clave Compuesta

La liberación programada de cada nota de estímulo DEBE estar indexada por una **clave compuesta**
`${channel}_${noteNumber}`, de modo que la re-articulación de una misma nota física en canales
diferientes o la re-ejecución en ráfaga nunca acumule temporizadores huérfanos.

- `sendNote(noteNumber, durationMs = 600, velocity = 100, channel = 1)` DEBE calcular la clave
  compuesta antes de buscar temporizadores previos.
- Si existe un temporizador vigente para la clave, el hook DEBE cancelarlo **y** emitir de forma
  inmediata y silenciosa el `Note Off` `[0x80 | chByte, noteNumber, 0]` antes de re-articular.
- El hook DEBE emitir `Note On` `[0x90 | chByte, noteNumber, velocity]` y registrar la nota en
  `activeStimulusNotes` (sin duplicados).
- El `Note Off` programado DEBE dispararse tras `durationMs`, eliminar la nota de
  `activeStimulusNotes` y remover la clave del registro.
- Si el dispositivo está desconectado o no hay puerto de salida, la función DEBE retornar sin
  efecto y sin lanzar.
- La emisión de `Note Off` diferido DEBE ser tolerante a fallos (puerto desaparecido a mitad de
  reproducción).

#### Scenario: Re-arteria en ráfaga reinicia el temporizador de liberación

- **GIVEN** el hook `useMidi` con un puerto de salida conectado
- **WHEN** se invoca `sendNote(60, 500)` y, 200 ms después, de nuevo `sendNote(60, 500)`
- **THEN** `activeStimulusNotes` contiene `60` a los 200 y a los 400 ms del primer envío
- **AND** el `Note Off` se recibe a los **500 ms del segundo envío** (700 ms absolutos), no antes
- **AND** `activeStimulusNotes` deja de contener `60` y el puerto recibió `[0x80, 60, 0]`

#### Scenario: Nota homónima en canal distinto es independiente

- **GIVEN** el hook `useMidi` con un puerto de salida conectado
- **WHEN** se invoca `sendNote(60, 400, 100, 1)` y `sendNote(60, 400, 100, 10)`
- **THEN** las claves `1_60` y `10_60` coexisten en el registro y los `Note Off` de ambos canales
  se programan de forma independiente

---

## Requirement: Scheduler y Reloj Maestro Cuantizado (StimulusScheduler)

`StimulusScheduler` DEBE planificar la reproducción de estímulos acústicos sobre el reloj del
motor, separando estrictamente los canales de percusión y melódicos.

- `ScheduledNoteEvent` expone `note`, `durationMs`, `delayMs` y opcionales `velocity` y `channel`.
- Los canales DEBEN interpretarse como: **1 = Piano Acústico**, **10 = Metrónomo (GM)**.
- Al ausencia de `velocity`, el scheduler DEBE aplicar el valor por defecto `90`
  (`DEFAULT_APP_CONFIG.midi.defaultVelocity`); a la ausencia de `channel`, DEBE aplicar `1`.

### Sub-requirement: Planificación de secuencias (scheduleSequence)

- La invocación DEBE cancelar primero los temporizadores de secuencia previos (arranque atómico).
- Cada evento DEBE programar un `setTimeout(delayMs)` que dispare `playNoteFn(note, durationMs,
  velocity, channel)`.
- El callback `onComplete`, si existe, DEBE dispararse **una sola vez** al vencer
  `max(delayMs + durationMs)` de toda la secuencia.
- `hasPending()` DEBE reflejar con verdad si hay temporizadores vivos.

### Sub-requirement: Reloj maestro y metrónomo continuo (startContinuousMetronome)

- El metrónomo DEBE emitir en **Canal 10**.
- El clic 1 (downbeat) DEBE emitirse **inmediatamente** al arrancar, con nota GM **76**, velocity
  **115** y duración **120 ms**.
- Los clics subsiguientes DEBEN emitirse por `setInterval(beatDurationMs)`, alternando nota GM
  **76** con velocity **115** en los downbeats y nota GM **77** con velocity **90** en los tiempos
  débiles.
- El acento del downbeat DEBE calcularse como `beatIndex % beatsPerMeasure === 0`.
- El arrancar con el mismo `beatDurationMs` ya activo DEBE ser idempotente (no reiniciar el reloj
  ni reinsertar clic inicial); cambiar el tempo DEBE reiniciar el reloj.
- El reloj DEBE fijar `clockStartTime = Date.now()` en el arranque como origen de la cuadrícula.
- El scheduler PUEDE exponer `onBeatTick(beatIndex, isDownbeat)` para sincronizar un indicador
  visual de compás externo.
- `stopContinuousMetronome()` DEBE cancelar el `setInterval` y marcar el reloj inactivo.

### Sub-requirement: Articulación acústica 88 % / 12 %

- La capa consumidora (p. ej. `App.tsx`) DEBE calcular la duración sonora de cada nota del piano
  como `Math.max(80, Math.round(noteIntervalMs * 0.88))`: un **88 % de sonido** dejando un **12 %
  de despegue** (release) entre notas, con un **piso absoluto de 80 ms** para evitar chasquidos.
- El intervalo base DEBE derivar de `beatDurationMs = Math.round(60000 / bpm)`.
- Esta articulación DEBE aplicarse solo a eventos de piano (Canal 1); los clics del metrónomo
  DEBE mantener su duración fija de 120 ms.

#### Scenario: Eventos programados con retardo, duración y canal exactos

- **GIVEN** un `StimulusScheduler` con relojes virtuales
- **WHEN** se invoca `scheduleSequence` con eventos `[{60, 400, 0, 85, 1}, {76, 120, 500, 105, 10}]`
- **THEN** a los 10 ms `playNoteFn` recibe `(60, 400, 85, 1)`
- **AND** a los 500 ms `playNoteFn` recibe `(76, 120, 105, 10)`

#### Scenario: Defaults de velocity y canal aplicados

- **GIVEN** un `StimulusScheduler` con relojes virtuales
- **WHEN** se invoca `scheduleSequence([{note: 60, durationMs: 300, delayMs: 0}], fn)`
- **THEN** `playNoteFn` recibe velocity **90** y channel **1**

#### Scenario: onComplete se dispara al fin de la duración total

- **GIVEN** un `StimulusScheduler` con relojes virtuales y una secuencia de duración total 300 ms
- **WHEN** avanzan 310 ms
- **THEN** `onComplete` se invocó exactamente **una vez**

#### Scenario: Idempotencia del metrónomo al mismo tempo

- **GIVEN** un `StimulusScheduler` con metrónomo continuo activo a 750 ms por tiempo
- **WHEN** se invoca `startContinuousMetronome(750, 2, fn)` de nuevo
- **THEN** el reloj NO se reinicia y NO se emite un segundo clic inicial

#### Scenario: Acentuación 2/4 del downbeat

- **GIVEN** un `StimulusScheduler` arrancado con `beatDurationMs = 750` y `beatsPerMeasure = 2`
- **WHEN** avanza el reloj
- **THEN** el clic inicial es `(76, 120, 115, 10)`, el segundo `(77, 120, 90, 10)`, el tercero
  (downbeat) `(76, 120, 115, 10)`

#### Scenario: cancelAll detiene todo

- **GIVEN** un `StimulusScheduler` con secuencia y metrónomo continuo activos
- **WHEN** se invoca `cancelAll()`
- **THEN** `hasPending() === false` y `isContinuousMetronomeActive() === false`

---

## Requirement: Alineación al Downbeat con Compases de Reposo

La entrada de la frase de piano DEBE alinearse a la cuadrícula del reloj maestro, respetando una
cantidad exacta de compases de respiración para que el usuario escuche el compás completo antes
de tocar.

- `schedulePhraseOnContinuousGrid(pianoEvents, restingMeasures = 1, playNoteFn)` DEBE calcular
  `measureDurationMs = beatsPerMeasure * beatDurationMs` a partir del estado del reloj.
- El índice del compás en curso DEBE ser `floor(elapsedSinceClockStart / measureDurationMs)`.
- El compás objetivo DEBE ser `currentMeasureIndex + restingMeasures` y el retardo hasta su
  downbeat, `targetMeasureStartMs - elapsedSinceClockStart`.
- Si el retardo calculado es **menor a 250 ms** (la frase caería al final del compás en curso),
  el scheduler DEBE desplazar la entrada al **siguiente compás completo**.
- Todos los `delayMs` de los eventos de la frase DEBEN desplazarse por el retardo al downbeat
  objetivo, preservando sus desfases internos.
- La invocación DEBE cancelar primero los temporizadores de secuencia previos.
- `restingMeasures` DEBE aceptar 1 o 2 compases de descanso según el modo de estudio.

#### Scenario: 1 compás de descanso en 2/4 equivale a 2 clics de espera

- **GIVEN** un `StimulusScheduler` arrancado en `t = 0` con `beatDurationMs = 750`,
  `beatsPerMeasure = 2` (1 compás = 1500 ms)
- **WHEN** se invoca `schedulePhraseOnContinuousGrid([{note: 67, durationMs: 500, delayMs: 0,
  velocity: 100, channel: 1}], 1, fn)` y avanzan 750 ms
- **THEN** `playNoteFn` recibe `(67, 500, 100, 1)` exactamente en `t = 1500 ms` (Tiempo 1 fuerte
  del segundo compás)

#### Scenario: Compás de respiración doble

- **GIVEN** un `StimulusScheduler` arrancado con `beatDurationMs = 500`, `beatsPerMeasure = 4`
- **WHEN** se invoca `schedulePhraseOnContinuousGrid(pianoEvents, 2, fn)`
- **THEN** la frase entra en el downbeat situado `2 * (4 * 500) = 4000 ms` después del origen del
  reloj

#### Scenario: Salvaguarda de los 250 ms

- **GIVEN** un reloj cuyo retardo calculado al downbeat objetivo es de 150 ms
- **WHEN** se invoca `schedulePhraseOnContinuousGrid(pianoEvents, 1, fn)`
- **THEN** la frase se desplaza al downbeat del compás siguiente, nunca al actual

---

## Requirement: Metrónomo Libre en Reposo

El subsistema DEBE permitir ensayar con metrónomo **sin iniciar una sesión de ejercicio
evaluable**, para práctica libre sobre el piano.

- `toggleFreeMetronome` DEBE iniciar el reloj maestro continuo (Canal 10) tomando el BPM de
  estudio y los tiempos del compás de la partitura actual, con valor por defecto de 2 tiempos si
  no hay partitura.
- Si el metrónomo libre o el continuo ya están activos, `toggleFreeMetronome` DEBE detener el
  reloj, desactivar la bandera y anular el acento visual activo.
- Mientras el metrónomo libre está activo, un cambio de BPM de estudio DEBE reiniciar el reloj
  con el nuevo tempo sin detener la práctica.
- El metrónomo libre NO DEBE disparar evaluación ni registrar sesiones; PUEDE emitir entradas de
  telemetría de tipo `EVAL` para auditoría del usuario.
- La activación del metrónomo libre NO DEBE requerir selección previa de un fragmento ni inicio de
  sesión.

#### Scenario: Arranque y parada de la práctica libre

- **GIVEN** el hook de repertorio con metrónomo libre inactivo y BPM de estudio 90
- **WHEN** se invoca `toggleFreeMetronome()`
- **THEN** el reloj maestro se activa en Canal 10 con `beatDurationMs ≈ 667 ms` y el acento visual
  comienza a avanzar
- **WHEN** se invoca `toggleFreeMetronome()` de nuevo
- **THEN** el reloj se detiene y el acento visual se anula

#### Scenario: Cambio de tempo en plena práctica libre

- **GIVEN** el metrónomo libre activo a 90 BPM
- **WHEN** el BPM de estudio cambia a 120
- **THEN** el reloj se reinicia con `beatDurationMs = 500 ms` sin interrumpir la reproducción

---

## Requirement: Resiliencia de Hardware (Hotplugging)

El subsistema DEBE tolerar la conexión y desconexión física del adaptador MIDI (p. ej. Roland
UM-ONE) en caliente, sin bloquear la aplicación ni requerir recarga.

- El hook DEBE solicitar acceso con `navigator.requestMIDIAccess({ sysex: false })`; sysex NO
  DEBE habilitarse.
- Si la API no existe, el estado DEBE ser informativo y el hook DEBE degradar a listas vacías sin
  lanzar.
- Si la promesa de acceso se rechaza, el estado DEBE contener el mensaje de error del sistema.
- El hook DEBE suscribirse a `access.onstatechange` y recalcular los puertos en cada evento.
- Cuando no quede ningún puerto de entrada, el hook DEBE marcar
  `isDeviceDisconnected = true`, mostrar estado de advertencia e invocar `onDeviceDisconnected`.
- Las callbacks `onDeviceDisconnected` / `onDeviceReconnected` DEBEN dispararse **solo en
  transiciones de estado** (flanco), no en cada refresco de puertos, para evitar duplicaciones.
- Al reconectar, el hook DEBE re-seleccionar preferentemente el último nombre de dispositivo
  conocido (memoria `lastKnownInputNameRef`, valor inicial `'UM-ONE'`); en su defecto, el primer
  puerto disponible.
- Tras una reconexión, el hook DEBE restaurar `isDeviceDisconnected = false` e invocar
  `onDeviceReconnected`.
- Mientras el dispositivo esté desconectado, `sendNote`, `changeProgram` y `sendAllNotesOff`
  DEBEN ser no-ops seguros y NO DEBEN lanzar excepciones.
- El nombre del dispositivo preferido DEBE actualizarse al detectar uno nuevo, mejorando la
  reconexión futura.

#### Scenario: Auto-detección y selección del UM-ONE

- **GIVEN** un `requestMIDIAccess` simulado que resuelve con puertos de entrada/salida llamados
  "Roland UM-ONE"
- **WHEN** se monta el hook `useMidi`
- **THEN** el estado contiene "conectado", `selectedInputId` y `selectedOutputId` apuntan a los
  puertos de "Roland UM-ONE" y hay exactamente 1 entrada y 1 salida

#### Scenario: Desconexión física detectada por flanco

- **GIVEN** el hook `useMidi` conectado con `onDeviceDisconnected` suscrito
- **WHEN** se vacían los puertos de entrada y se dispara `onstatechange`
- **THEN** `isDeviceDisconnected === true`, el estado contiene "desconectado" y
  `onDeviceDisconnected` se invocó **exactamente una vez** (no por cada refresco)

#### Scenario: Reconexión auto-seleccionada

- **GIVEN** el hook `useMidi` en estado desconectado con `onDeviceReconnected` suscrito
- **WHEN** el dispositivo previamente conocido vuelve a aparecer y se dispara `onstatechange`
- **THEN** `isDeviceDisconnected === false`, se re-selecciona el mismo puerto y
  `onDeviceReconnected` se invoca **exactamente una vez**

#### Scenario: Envíos sin dispositivo no bloquean la UI

- **GIVEN** el hook `useMidi` recién montado sin API ni dispositivo disponible
- **WHEN** se invocan `sendNote(60, 500)` y `changeProgram(0)`
- **THEN** ninguna invocación lanza una excepción

---

## Requirement: Redirección de Entrada (Software THRU) y Cambio de Programa

El subsistema DEBE ofrecer reenvío en software del teclado hacia la salida, y cambio de programa
GM controlado.

- El hook `useMidi` DEBE aceptar `enableSoftwareThru` con valor por defecto `true`.
- Cuando esté habilitado y exista salida seleccionada, cada mensaje crudo de entrada DEBE
  reenviarse **antes** de su parseo, byte a byte, al puerto de salida.
- El reenvío NO DEBE filtrarse por el `MidiInputFilter`: el THRU es una copia bit-exacta del
  mensaje entrante.
- `changeProgram(programNumber, channel = 1)` DEBE emitir primero `sendAllNotesOff(channel)` para
  evitar notas colgadas en el programa anterior y luego `Program Change`
  `[0xC0 | (channel - 1), programNumber]`.
- El cambio de programa NO DEBE enviar `Note On` residual.

#### Scenario: THRU bit-exacto y registro de nota pulsada

- **GIVEN** el hook `useMidi` con `enableSoftwareThru: true` y salida seleccionada
- **WHEN** el puerto de entrada recibe `[0x90, 64, 100]`
- **THEN** la salida recibió exactamente el mismo `Uint8Array` crudo **y** `pressedNotes` contiene
  64 (el filtrado se aplica a la rama de negocio, no a la copia)

#### Scenario: Program Change precedido de silenciamiento

- **GIVEN** el hook `useMidi` con salida conectada y seleccionada
- **WHEN** se invoca `changeProgram(73, 1)`
- **THEN** el puerto recibió el Pánico MIDI y luego `[0xC0, 73]`

---

## Requirement: Registro de Actividad del Bus MIDI (Logs)

El subsistema DEBE mantener un registro observable del tráfico MIDI para depuración y feedback.

- `addLog` DEBE aceptar entradas tipadas `IN | OUT | AI | EVAL` con sello temporal
  `HH:MM:SS.mmm`.
- El historial DEBE recortarse a los **últimos 35 eventos** ( política de ventana deslizante).
- El identificador DEBE ser único por evento.
- Los logs NO DEBEN crecer sin límite en memoria.

#### Scenario: Ventana deslizante de 35 entradas

- **GIVEN** el hook `useMidi` montado
- **WHEN** se añaden 40 entradas de log consecutivas
- **THEN** `logs.length === 35` y el último elemento es la entrada 40 (la más reciente)
