## MODIFIED Requirements

### Requirement: Máquina de Estados del Kernel

El kernel DEBE exponer y mantener coherentemente el siguiente estado de sesión: `isSessionActive`, `isSessionFinished`, `isWaitingManualAdvance`, `isWaitingAnswer`, `currentQuestionIndex` y `sessionId`.

- `startCoreSession` MUST activar la sesión (`isSessionActive = true`), MUST poner `currentQuestionIndex = 1`, MUST resetear `isSessionFinished`, `isWaitingManualAdvance`, buffers y telemetría, y MUST invocar `onTriggerFirstStimulus` exactamente una vez.
- `recordAnswer` DEBE rechazarse silenciosamente si la sesión no está activa, si no existe un `questionToken` vigente, si el token recibido como argumento no coincide con el vigente, o si `isWaitingAnswer` ya es `false` (respuesta duplicada dentro de la misma pregunta).
- Toda transición que avanza de pregunta — el avance automático programado, el avance manual exitoso y el `else` de auto-avance de `recordAnswer` — MUST poner `isWaitingManualAdvance = false` antes o durante la transición.
- La finalización MUST poner `isSessionActive = false`, `isSessionFinished = true`, `isWaitingManualAdvance = false` e `isWaitingAnswer = false`.

#### Scenario: Inicio síncrono de sesión

- **GIVEN** un kernel en reposo
- **WHEN** se invoca `startCoreSession({ limitType: 'time', durationMinutes: 3, advanceMode: 'manual' }, onTrigger)`
- **THEN** `isSessionActive === true`, `sessionLimitType === 'time'`, `timeRemainingSeconds === 180`, `advanceMode === 'manual'`, `currentQuestionIndex === 1` y `onTrigger` se invocó una vez

#### Scenario: Respuesta rechazada sin sesión activa

- **GIVEN** un kernel en reposo
- **WHEN** una modalidad invoca `recordAnswer(...)`
- **THEN** la respuesta se descarta: `sessionHistory.length === 0` y `lastResult === null`

#### Scenario: Respuesta duplicada dentro de la misma pregunta es ignorada

- **GIVEN** un kernel con sesión activa, token `T` vigente e `isWaitingAnswer === true`
- **WHEN** una modalidad invoca `recordAnswer(...)` con el token `T` y luego vuelve a invocar `recordAnswer(...)` con el mismo token `T` sin que medie un nuevo `generateQuestionToken`
- **THEN** la segunda invocación se descarta: `sessionHistory.length === 1`, `answersBuffer.length === 1` y el auto-avance se programa una única vez

#### Scenario: Respuesta con token desfasado descartada

- **GIVEN** un kernel con sesión activa y token vigente `T2`
- **WHEN** una modalidad invoca `recordAnswer(...)` con un token `T1` de una pregunta anterior
- **THEN** la respuesta se descarta (`sessionHistory` sin cambios) y no se programa ningún auto-avance

#### Scenario: isWaitingManualAdvance se resetea tras un acierto en modo smart

- **GIVEN** un kernel en modo `'smart'` con una respuesta incorrecta previa que dejó `isWaitingManualAdvance === true`
- **WHEN** la modalidad avanza de pregunta y se registra una respuesta correcta
- **THEN** `isWaitingManualAdvance === false` al completarse la transición de avance

### Requirement: Limpieza Estricta de Temporizadores (cleanupTimers)

El kernel DEBE garantizar cero temporizadores residuales que puedan invocar `finalizeAndSaveSession` o `onAdvanceTrigger` después de una transición de estado.

- `cleanupTimers` MUST anular `autoAdvanceTimerRef` (`clearTimeout`) y `sessionCountdownTimerRef` (`clearInterval`), dejándolos en `null`.
- `cleanupTimers` DEBE invocarse obligatoriamente al: iniciar, detener, resetear y finalizar sesión.
- El hook MUST limpiar los temporizadores al desmontarse (cleanup de `useEffect`).
- Un doble avance manual NO DEBE disparar dos estímulos: el guard de reentrada (`isAdvancingRef`) es obligatorio.
- Antes de programar un nuevo auto-avance, `recordAnswer` MUST cancelar preventivamente el auto-avance pendiente anterior, de modo que nunca coexistan dos temporizadores de avance.
- El callback del temporizador de auto-avance MUST verificar tanto la identidad de la sesión como la vigencia del token de pregunta programado; si la pregunta ya no es la vigente, el avance MUST abortarse sin invocar `onAdvanceTrigger`.

#### Scenario: Reseteo invalida temporizadores pendientes

- **GIVEN** un kernel con sesión activa, token generado y un auto-avance programado
- **WHEN** se invoca `resetCoreToConfig()`
- **THEN** `isSessionActive === false`, `questionToken === null` y ningún temporizador residual puede disparar `finalizeAndSaveSession`

#### Scenario: Doble avance manual bloqueado

- **GIVEN** un kernel con sesión activa en modo manual y una respuesta ya registrada
- **WHEN** se invoca `advanceToNextQuestion()` dos veces en sucesión inmediata
- **THEN** `currentQuestionIndex === 2` (un solo avance) y el estímulo se disparó una única vez

#### Scenario: Auto-avance previo cancelado al registrar una nueva respuesta

- **GIVEN** un kernel con sesión activa y un auto-avance ya programado para la pregunta N
- **WHEN** se registra una segunda respuesta antes de que venza el temporizador
- **THEN** el temporizador previo se cancela y `onAdvanceTrigger` se invoca como máximo una vez en total

#### Scenario: Auto-avance desfasado abortado por token

- **GIVEN** un kernel con un auto-avance programado para el token `T1`
- **WHEN** se genera un nuevo token `T2` y transcurre el retardo del temporizador de `T1`
- **THEN** `onAdvanceTrigger` no se invoca y `currentQuestionIndex` no se incrementa por ese temporizador

### Requirement: Identidad de Sesión, Tokens y Protección Anti-Carrera

El kernel DEBE aislar sesiones consecutivas y descartar respuestas o avances desfasados.

- `startCoreSession` MUST generar un `sessionId` con el formato `` `session_${crypto.randomUUID()}` ``, donde el componente aleatorio es un UUIDv4 (RFC 4122) criptográficamente aleatorio.
- `generateQuestionToken(prefix = 'token')` MUST generar un token con el formato `` `${prefix}_${crypto.randomUUID()}` ``.
- La entropía de ambos identificadores MUST provenir exclusivamente de `crypto.randomUUID()`: NO MUST combinarse con `Date.now()` ni con `Math.random()`, y MUST ser única dentro de una misma ejecución del renderer con probabilidad despreciable de colisión.
- `recordAnswer` MUST recibir el token de la pregunta como argumento y validarlo contra el token vigente en `questionTokenRef`; si el argumento es nulo, vacío o distinto del vigente, la respuesta se descarta.
- `recordAnswer` MUST exigir que la sesión esté a la espera de una respuesta (`isWaiting === true`); una vez registrada una respuesta, el token vigente deja de aceptarla de nuevo hasta que se genere uno nuevo.
- `stopCoreSession` y `resetCoreToConfig` MUST invalidar el token (`questionTokenRef = null`).
- `finalizeAndSaveSession` MUST ser reentrante: el guard `finalizingSessionsRef` MUST impedir doble persistencia de la misma sesión.

#### Scenario: Nota MIDI recibida con sesión inactiva descartada

- **GIVEN** un trainer de notas montado sin sesión iniciada
- **WHEN** llega una nota del usuario (`handleUserNotePlayed(60)`)
- **THEN** `lastResult === null` y `sessionHistory.length === 0`

#### Scenario: Cambio de modalidad aísla sesiones

- **GIVEN** un trainer de notas detenido y un trainer de intervalos recién iniciado
- **WHEN** llega una nota perteneciente al ejercicio viejo de notas
- **THEN** la sesión de notas permanece inactiva y la de intervalos activa, sin contaminación de historial

#### Scenario: Identificadores de sesión y token con entropía UUIDv4

- **GIVEN** un kernel en reposo
- **WHEN** se invoca `startCoreSession()` y `generateQuestionToken('token')`
- **THEN** `sessionId` cumple `^session_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` y `questionToken` cumple `^token_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`
- **AND** dos invocaciones consecutivas producen identificadores distintos

#### Scenario: Respuesta aceptada solo con token coincidente

- **GIVEN** un kernel con sesión activa, token `T` vigente e `isWaitingAnswer === true`
- **WHEN** la modalidad invoca `recordAnswer(...)` pasando el token `T`
- **THEN** la respuesta se registra (`sessionHistory.length === 1`)
- **WHEN** la modalidad invoca `recordAnswer(...)` pasando `null` o un token distinto de `T`
- **THEN** la respuesta se descarta y `sessionHistory` no crece
