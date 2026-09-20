## MODIFIED Requirements

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
