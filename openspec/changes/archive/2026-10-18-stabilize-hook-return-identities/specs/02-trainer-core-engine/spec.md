# Spec Delta — 02-trainer-core-engine

## ADDED Requirements

### Requirement: Estabilidad Referencial del Retorno de useTrainerCore
El hook `useTrainerCore<TResult>` MUST (DEBE) retornar un objeto `UseTrainerCoreReturn<TResult>` con identidad referencial estable: dos renders consecutivos sin cambios en el estado reactivo de sesión/pregunta MUST producir la misma referencia de objeto y de sus métodos de acción, y un cambio en cualquier valor reactivo expuesto MUST producir identidad nueva con el valor fresco. Los accesos en vivo sobre referencias internas MUST seguir leyendo el valor vigente en el momento del acceso.

#### Scenario: Identidad preservada ante re-render sin cambios de estado
- **WHEN** el hook `useTrainerCore` se monta y se fuerza un re-render sin que cambie ningún valor reactivo del retorno
- **THEN** la referencia del objeto retornado en el primer render y en el segundo es idéntica (`toBe`), y las referencias de `startCoreSession`, `advanceToNextQuestion`, `recordAnswer`, `stopCoreSession` y `resetCoreToConfig` también son idénticas entre ambos renders

#### Scenario: Identidad invalidada por cambio de estado reactivo
- **WHEN** cambia un valor reactivo expuesto (límites de sesión, tiempo restante, modo de avance, banderas de sesión, índice de pregunta, último resultado, historial o `saveError`, p. ej. `currentQuestionIndex` tras un avance)
- **THEN** el retorno expone una identidad de objeto nueva con el valor actualizado

#### Scenario: Accesos en vivo sobre refs permanecen vigentes
- **WHEN** se inicia una sesión y se lee `isSessionActive`, `sessionId`, `answersBuffer` o `questionToken` desde el objeto retornado tras las transiciones correspondientes
- **THEN** los valores leídos reflejan el estado vigente de la sesión en el momento del acceso, con independencia de la identidad del objeto contenedor

#### Scenario: Los callbacks de los plug-ins dejan de invalidarse en cascada
- **WHEN** un plug-in de entrenador declara callbacks con el objeto del kernel en sus dependencias y ocurre un re-render sin cambios de estado reactivo
- **THEN** dichas callbacks conservan su identidad entre renders, y el objeto final expuesto por el plug-in no se recalcula innecesariamente
