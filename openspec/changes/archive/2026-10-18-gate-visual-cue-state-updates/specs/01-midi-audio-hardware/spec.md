# Spec Delta — 01-midi-audio-hardware

## ADDED Requirements

### Requirement: Gating en Origen de la Pista Visual de Estímulo
El subsistema MUST (DEBE) permitir que la articulación de notas melódicas conozca si las pistas visuales están habilitadas y decidir en el origen si `activeStimulusNotes` se actualiza. El gate MUST NOT alterar el comportamiento acústico vigente.

#### Scenario: Modo blind no muta activeStimulusNotes
- **WHEN** las pistas visuales están desactivadas y se articula una nota melódica en Canal 1
- **THEN** el mensaje MIDI se emite con normalidad, `activeStimulusNotes` permanece vacío y no se produce ninguna actualización de estado atribuible a la pista visual

#### Scenario: Modo assisted preserva la visualización
- **WHEN** las pistas visuales están activadas y se articula y libera una nota melódica
- **THEN** la nota se registra en `activeStimulusNotes` al articular y se retira al liberar, con la precisión y semántica vigentes

#### Scenario: Liberación sin residuos ni re-renders espurios
- **WHEN** una nota articulada con pistas activadas ve desactivarse las pistas antes de su liberación programada
- **THEN** la liberación retira la nota residual de `activeStimulusNotes`, y la liberación de una nota nunca registrada no provoca actualización de estado

#### Scenario: El gate no altera el comportamiento acústico
- **WHEN** se articulan notas con las pistas visuales desactivadas
- **THEN** los mensajes MIDI, la cancelación de temporizadores previos por clave compuesta y el pánico se comportan exactamente según sus contratos vigentes

#### Scenario: Compatibilidad con consumidores existentes
- **WHEN** un consumidor monta el hook sin pasar la opción de habilitación de pistas visuales
- **THEN** el comportamiento es idéntico al vigente (pistas activadas), preservando los contratos existentes sin migración
