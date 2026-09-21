## Why

La Auditoría V6 (`AUDIT_REPORT_V6.md`) clasificó los hallazgos **F01, F02, F03 y F07** dentro del **OLA 1** (Integridad Crítica, Pánico Acústico y Anti-Carrera, P0 + P1 críticos). Hoy el micro-kernel y los trainers de modalidad permiten cuatro clases de corrupción de sesión constatadas en el código de producción:

1. **F01** — Una segunda pulsación MIDI rápida dentro de la misma pregunta registra una respuesta duplicada con el mismo `questionIndex`, y los temporizadores de auto-avance de preguntas anteriores no se cancelan antes de reprogramarse, produciendo avances fantasma.
2. **F07** — `isWaitingManualAdvance` nunca vuelve a `false` en las ramas de auto-avance, de modo que tras el primer error en modo `smart` el botón de avance manual queda **permanentemente habilitado** en las cuatro modalidades.
3. **F02** — En `useSequenceTrainer`, la evaluación musical y la persistencia se ejecutan **dentro** del updater de `setCapturedNotes`; bajo `<StrictMode>` de React 19 los updaters se ejecutan dos veces deliberadamente, por lo que la última nota de una secuencia se evalúa y persiste **dos veces**.
4. **F03** — Un pre-roll de contexto tonal huérfano puede disparar un estímulo sobre una sesión ya finalizada por agotamiento del tiempo.

Este cambio formaliza la remediación del OLA 1.3 endureciendo los guards de concurrencia del micro-kernel, eliminando los side-effects de los updaters de React 19 y cerrando el ciclo de vida de los temporizadores de modalidad.

## What Changes

**Micro-kernel (`hooks/useTrainerCore.ts`) — F01 y F07:**

- `recordAnswer` **exige** ahora un `questionToken` vigente pasado como argumento y validado contra `questionTokenRef.current`: una llamada con token nulo, vacío o desfasado se descarta. **BREAKING** (contrato interno del kernel).
- `recordAnswer` se rechaza silenciosamente si `isWaitingAnswerRef.current === false`, cerrando la ventana de doble respuesta dentro de la misma pregunta.
- Antes de programar `autoAdvanceTimerRef`, se ejecuta un `clearTimeout` preventivo del temporizador previo.
- El callback de `setTimeout` de auto-avance verifica además que `questionTokenRef.current` coincida con el token programado; en caso contrario el avance se aborta.
- La rama de auto-avance (`else`) de `recordAnswer` invoca explícitamente `setIsWaitingManualAdvanceState(false)`.
- `advanceToNextQuestion` invoca `setIsWaitingManualAdvanceState(false)` al avanzar de pregunta.

**Secuencias (`hooks/useSequenceTrainer.ts`) — F02:**

- Se introduce `playedNotesBufferRef = useRef<number[]>([])`, acumulador síncrono fuera del render (patrón canónico ya aplicado en `useRepertoireTrainer`).
- `setCapturedNotes` queda como un updater de estado **puro** de UI; `evaluateSequenceAnswer` y `core.recordAnswer` se ejecutan fuera de él, exactamente una vez por frase completada.

**Notas individuales (`hooks/useSingleNoteTrainer.ts`) — F03:**

- `triggerNextQuestion` arranca con el guard defensivo `if (!core.isSessionActive) return`.
- Se garantiza la cancelación de `preRollTimerRef` en `stopSession` y `resetToConfig` (defense in depth, hoy dispersa).

**Pruebas (Protocolo TDD de `AGENTS.md`):**

- `useTrainerCore.test.ts`: token duplicado/desfasado ignorado, limpieza de timers previos y reseteo de `isWaitingManualAdvance` en modo `smart`.
- `useSequenceTrainer.test.ts`: la evaluación se dispara exactamente una vez por frase completada.
- `useSingleNoteTrainer.test.ts`: un pre-roll pendiente no emite notas si la sesión se detiene antes de su vencimiento.

## Capabilities

### New Capabilities

<!-- Ninguna: no se introduce una nueva capacidad, se endurece la existente. -->

### Modified Capabilities

- `02-trainer-core-engine`: los requisitos **Máquina de Estados del Kernel**, **Limpieza Estricta de Temporizadores** e **Identidad de Sesión, Tokens y Protección Anti-Carrera** se endurecen para exigir el guard de `isWaitingAnswer` y la validación del token de pregunta en `recordAnswer`, la cancelación preventiva del auto-avance pendido y el reseteo explícito de `isWaitingManualAdvance` en toda transición de avance.

## Impact

- **Contratos internos del kernel**: la firma de `recordAnswer` gana un parámetro `questionToken` obligatorio. Deben actualizarse los 4 plug-ins (`useSingleNoteTrainer`, `useIntervalTrainer`, `useSequenceTrainer`, `useRepertoireTrainer`) y las 8 llamadas existentes en `useTrainerCore.test.ts`. No es una API pública de paquete: el impacto se contiene dentro del renderer.
- **Componentes de UI**: `FeedbackPanel`, `IntervalFeedbackPanel`, `SequenceFeedbackPanel` y `RepertoireFeedbackPanel` reciben `isWaitingManualAdvance` sin cambios de props; el cambio es de **comportamiento** (el flag deja de quedar trabado en `true`), no de interfaz.
- **Persistencia**: desaparece el duplicado de `DbAnswerRecord` en secuencias bajo `<StrictMode>`, afectando a `useDatabaseStore.saveSession` y a las métricas derivadas (`totalQuestions`, `avgResponseTimeMs`).
- **Sin dependencias nuevas ni cambios en build/electron**; todo se resuelve con `useRef`, `clearTimeout` y reordenamiento de código existente.
- **No se incluye** (fuera del alcance del OLA 1.3): `F-05` (crecimiento O(n²) en sesiones `infinite`), `F-06` (cambio de pestaña sin detener trainers) y los hallazgos de los frentes 2, 4 y 5.
