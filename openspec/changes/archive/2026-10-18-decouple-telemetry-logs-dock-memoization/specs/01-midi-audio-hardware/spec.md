# Spec Delta — 01-midi-audio-hardware

## ADDED Requirements

### Requirement: Desacople del Stream de Telemetría del Render Raíz

Un evento de log de telemetría MUST (DEBE) estar aislado del ciclo de render del componente raíz: un evento de log MUST NOT provocar por sí mismo el re-render de `App` ni la reconciliación del árbol completo.

- Los consumidores del buffer de telemetría (`StudioBottomDock`, el badge de conteo de la barra permanente y `MidiMonitor`) MUST suscribirse directamente al store de telemetría, sin recibir el buffer ni el conteo como props del componente raíz.

#### Scenario: Un evento de log no re-renderiza el consumidor del hook useMidi

- **GIVEN** un componente que consume el hook `useMidi` ya montado
- **WHEN** se invoca `addLog` con una entrada válida
- **THEN** el componente consumidor NO se re-renderiza como consecuencia del evento de log

### Requirement: Memoización del Dock ante el Stream de Telemetría

`StudioBottomDock` MUST (DEBE) preservar su memoización (`React.memo`) ante eventos de log y pulsaciones de tecla cuando sus props sean de identidad estable, y los consumidores hoja del buffer (badge de conteo y `MidiMonitor`) MUST actualizarse mediante sus propias suscripciones al store de telemetría, sin re-renderizar el cuerpo del dock.

#### Scenario: El dock preserva su memoización ante eventos de log con el drawer cerrado

- **GIVEN** `StudioBottomDock` montado con props de identidad estable y drawer de telemetría cerrado
- **WHEN** se añaden entradas de log consecutivas en el store de telemetría
- **THEN** el cuerpo de `StudioBottomDock` NO se re-renderiza
- **AND** el badge de conteo `Telemetría (N)` refleja el número vigente de eventos mediante su propia suscripción

#### Scenario: El monitor se actualiza por suscripción propia sin re-renderizar el dock

- **GIVEN** `StudioBottomDock` con el drawer de telemetría abierto y `MidiMonitor` montado
- **WHEN** se añade una entrada de log en el store de telemetría
- **THEN** `MidiMonitor` muestra la nueva entrada
- **AND** el cuerpo de `StudioBottomDock` NO se re-renderiza como consecuencia del evento de log

#### Scenario: La apertura del modal de reset usa un callback estable

- **GIVEN** el componente raíz `App` renderizado
- **WHEN** `App` re-renderiza por motivos ajenos al dock
- **THEN** la prop `onOpenResetModal` del dock conserva la misma referencia entre renders
- **AND** el dock no se re-renderiza por cambio de identidad de esa prop

## MODIFIED Requirements

### Requirement: Registro de Actividad del Bus MIDI (Logs)

El subsistema MUST (DEBE) mantener un registro observable del tráfico MIDI para depuración y feedback.

- El buffer de logs MUST residir en un store de telemetría dedicado (fuente única de verdad fuera del ciclo de render del componente raíz), y MUST NOT mantenerse como estado de React del hook `useMidi` ni del componente `App`.
- `addLog` MUST aceptar entradas tipadas `IN | OUT | AI | EVAL` con sello temporal `HH:MM:SS.mmm`.
- El historial MUST recortarse a los últimos 35 eventos.
- El identificador MUST ser único por evento.
- Los consumidores del historial MUST leerlo mediante suscripción directa al store de telemetría; el hook `useMidi` MUST NOT exponer el buffer como parte de su valor de retorno.

#### Scenario: Ventana deslizante de 35 entradas

- **GIVEN** el store de telemetría en su estado inicial
- **WHEN** se añaden 40 entradas de log consecutivas mediante `addLog`
- **THEN** el buffer del store contiene exactamente 35 entradas y el último elemento es la entrada 40

#### Scenario: addLog preserva el contrato de formato y tipado

- **GIVEN** el store de telemetría en su estado inicial
- **WHEN** se invoca `addLog` con una entrada tipada `IN | OUT | AI | EVAL`
- **THEN** la entrada registrada conserva `type` y `message` intactos, añade un sello temporal con formato `HH:MM:SS.mmm` y un identificador único
- **AND** dos entradas consecutivas nunca comparten identificador
