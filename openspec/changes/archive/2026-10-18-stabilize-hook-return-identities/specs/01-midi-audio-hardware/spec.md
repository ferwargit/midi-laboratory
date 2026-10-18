# Spec Delta — 01-midi-audio-hardware

## ADDED Requirements

### Requirement: Estabilidad Referencial del Retorno de useMidi
El hook `useMidi` MUST (DEBE) retornar un objeto `UseMidiReturn` con identidad referencial estable: dos renders consecutivos sin cambios en el estado reactivo expuesto MUST producir la misma referencia de objeto y de sus métodos, y un cambio en cualquier valor reactivo expuesto MUST producir identidad nueva con el valor fresco. La estabilización MUST NOT alterar los contratos funcionales vigentes del subsistema.

#### Scenario: Identidad preservada ante re-render sin cambios de estado
- **WHEN** el hook `useMidi` se monta y se fuerza un re-render sin que cambie ningún valor reactivo del retorno
- **THEN** la referencia del objeto retornado en el primer render y en el segundo es idéntica (`toBe`), y las referencias de `sendNote`, `sendAllNotesOff`, `changeProgram`, `clearAllPressedNotes` y `addLog` también son idénticas entre ambos renders

#### Scenario: Identidad invalidada por cambio de estado reactivo
- **WHEN** cambia un valor reactivo expuesto (`status`, `inputs`, `outputs`, `selectedInputId`, `selectedOutputId`, `isDeviceDisconnected`, `pressedNotes` o `activeStimulusNotes`, p. ej. `pressedNotes` tras un Note On)
- **THEN** el retorno expone una identidad de objeto nueva con el valor actualizado, observable por los consumidores del objeto

#### Scenario: Los métodos reaccionan al estado vigente pese a la identidad estable
- **WHEN** se invoca `sendNote` o `sendAllNotesOff` después de un cambio de puerto de salida o de estado de conexión
- **THEN** el método opera sobre el estado vigente (puerto actual, guard de desconexión) aunque su identidad referencial no haya cambiado
