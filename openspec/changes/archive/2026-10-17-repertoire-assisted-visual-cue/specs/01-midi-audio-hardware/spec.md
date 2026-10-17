# Spec Delta

## MODIFIED Requirements

### Requirement: Aislamiento de Temporizadores por Clave Compuesta

La liberación programada de cada nota de estímulo MUST (DEBE) estar indexada por una clave compuesta `${channel}_${noteNumber}`.

- `sendNote(noteNumber, durationMs, velocity, channel)` MUST calcular la clave compuesta antes de buscar temporizadores previos.
- Si existe un temporizador vigente, el hook MUST cancelarlo y emitir inmediatamente el `Note Off` `[0x80 | chByte, noteNumber, 0]` antes de re-articular.
- El `Note Off` programado MUST dispararse tras `durationMs` y eliminar la nota de `activeStimulusNotes`.
- El registro en `activeStimulusNotes` MUST (DEBE) quedar reservado a las notas melódicas del Canal 1 (Piano Acústico): una nota emitida en el Canal 10 (Metrónomo GM) MUST articularse y silenciarse con normalidad, pero MUST NOT añadirse a `activeStimulusNotes` al articular ni persistir en él al liberar, de modo que los ticks del metrónomo (continuo, de pre-roll y libre) nunca constituyan pista visual de estímulo.

#### Scenario: Re-arteria en ráfaga reinicia el temporizador de liberación

- **GIVEN** el hook `useMidi` con un puerto de salida conectado
- **WHEN** se invoca `sendNote(60, 500)` y, 200 ms después, de nuevo `sendNote(60, 500)`
- **THEN** `activeStimulusNotes` contiene `60` a los 200 y a los 400 ms del primer envío
- **AND** el `Note Off` se recibe a los 500 ms del segundo envío (700 ms absolutos)

#### Scenario: Nota homónima en canal distinto es independiente

- **GIVEN** el hook `useMidi` con un puerto de salida conectado
- **WHEN** se invoca `sendNote(60, 400, 100, 1)` y `sendNote(60, 400, 100, 10)`
- **THEN** las claves `1_60` y `10_60` coexisten en el registro y se programan independientemente

#### Scenario: El tick del metrónomo no contamina la pista visual de estímulo

- **GIVEN** el hook `useMidi` con un puerto de salida conectado
- **WHEN** se invoca `sendNote(76, 120, 115, 10)` (tick de downbeat del metrónomo)
- **THEN** el puerto recibe el `Note On` y el `Note Off` programado del Canal 10 con normalidad
- **AND** `activeStimulusNotes` NO contiene `76` en ningún instante entre la articulación y la liberación

#### Scenario: La nota de piano sigue iluminando como estímulo

- **GIVEN** el hook `useMidi` con un puerto de salida conectado
- **WHEN** se invoca `sendNote(60, 400, 100, 1)` (nota melódica del Canal 1)
- **THEN** `activeStimulusNotes` contiene `60` durante los 400 ms de articulación
- **AND** `activeStimulusNotes` deja de contener `60` tras el `Note Off` programado
