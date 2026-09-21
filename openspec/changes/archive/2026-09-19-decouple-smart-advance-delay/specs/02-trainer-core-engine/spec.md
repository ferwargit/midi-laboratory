## MODIFIED Requirements

### Requirement: Modos de Avance (AdvanceMode)

El kernel DEBE implementar cuatro modos de avance definidos en `AdvanceMode`:

| Modo          | Comportamiento                                            | Retardo                          |
| ------------- | --------------------------------------------------------- | -------------------------------- |
| `'smart'`     | Auto-avance solo en acierto; en error activa pausa manual | `autoAdvanceSmartDelayMs` (1500) |
| `'manual'`    | Avance siempre explícito                                  | —                                |
| `'auto_fast'` | Auto-avance incondicional                                 | `autoAdvanceFastDelayMs` (1500)  |
| `'auto_slow'` | Auto-avance incondicional                                 | `autoAdvanceSlowDelayMs` (3500)  |

Cada modo DEBE leer su propia constante dedicada desde `DEFAULT_APP_CONFIG.midi`; en particular, el modo `'smart'` DEBE usar `autoAdvanceSmartDelayMs` y NO DEBE compartir `autoAdvanceFastDelayMs` con el modo `'auto_fast'`.

- `TrainerCoreOptions` DEBE aceptar `autoAdvanceSmartDelayMs?: number`, con valor por defecto tomado de `DEFAULT_APP_CONFIG.midi.autoAdvanceSmartDelayMs` (1500).
- `recordAnswer` MUST computar `shouldWaitManual = (mode === 'manual') || (mode === 'smart' && !isCorrectForSmartAdvance)`; si es verdadero, activa `isWaitingManualAdvance` y NO programa temporizador.
- En pausa manual por error, el kernel MUST fijar `errorPauseStartTimeRef = Date.now()`.
- En caso contrario, el kernel MUST programar `setTimeout(delay)` donde `delay` se selecciona por modo: `autoAdvanceSlowDelayMs` para `'auto_slow'`, `autoAdvanceFastDelayMs` para `'auto_fast'` y `autoAdvanceSmartDelayMs` para `'smart'`.
- Sobreescribir `autoAdvanceSmartDelayMs` NO DEBE alterar el retardo efectivo del modo `'auto_fast'`, y viceversa.

#### Scenario: Modo smart con error activa pausa pedagógica

- **GIVEN** un kernel en modo `'smart'` con sesión activa y token generado
- **WHEN** se registra una respuesta incorrecta
- **THEN** `isWaitingManualAdvance === true`, `sessionHistory.length === 1` y NO se programa auto-avance

#### Scenario: Modo auto_slow avanza a los 3500 ms

- **GIVEN** un kernel en modo `'auto_slow'` con `autoAdvanceSlowDelayMs = 3500`
- **WHEN** se registra una respuesta
- **THEN** a los 2000 ms `onAdvanceTrigger` NO se ha disparado
- **AND** a los 3600 ms se ha disparado exactamente una vez

#### Scenario: Modo smart usa su retardo dedicado, desacoplado de auto_fast

- **GIVEN** un kernel en modo `'smart'` con `autoAdvanceSmartDelayMs = 1200` y `autoAdvanceFastDelayMs` en su valor por defecto (1500)
- **WHEN** se registra una respuesta correcta
- **THEN** a los 1100 ms `onAdvanceTrigger` NO se ha disparado
- **AND** a los 1300 ms se ha disparado exactamente una vez
- **AND** el retardo efectivo del modo `'auto_fast'` permanece en 1500 ms, sin verse afectado por el override de `autoAdvanceSmartDelayMs`
