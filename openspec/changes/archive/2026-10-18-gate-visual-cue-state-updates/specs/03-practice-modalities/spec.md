# Spec Delta — 03-practice-modalities

## ADDED Requirements

### Requirement: Gating del Indicador Visual de Pulso (Modalidad 04)
La Modalidad 04 (Repertorio) MUST (DEBE) decidir en el origen si el pulso del metrónomo actualiza el indicador visual de beat, de modo que con el indicador desactivado no se produzcan actualizaciones de estado por pulso. El gate MUST NOT alterar la sincronización auditiva.

#### Scenario: Indicador desactivado elimina las actualizaciones por pulso
- **WHEN** el indicador visual de pulso está desactivado y el metrónomo continuo emite pulsos sostenidos
- **THEN** el callback visual permanece desregistrado del scheduler, `activeBeatIndex` no cambia y los ticks acústicos se emiten con normalidad

#### Scenario: Desactivación en curso limpia el estado visual
- **WHEN** el indicador visual se desactiva durante una sesión con el metrónomo corriendo
- **THEN** `activeBeatIndex` se limpia de inmediato y ningún pulso posterior lo reactiva mientras siga desactivado

#### Scenario: Indicador activado preserva la precisión del LED
- **WHEN** el indicador visual de pulso está activado y el metrónomo continuo emite pulsos
- **THEN** el LED se enciende en el beat correspondiente y se apaga temporizadamente, con la precisión vigente

#### Scenario: El gate no altera la sincronización auditiva
- **WHEN** se alterna el indicador visual durante una sesión con frases programadas y cambio de tempo
- **THEN** el reloj maestro, el tempo vigente y la programación de frases no se ven afectados por el alternar del indicador
