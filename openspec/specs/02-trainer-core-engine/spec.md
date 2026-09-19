# Capability: Trainer Core Engine & Evaluation Policy

## Purpose

Esta capacidad define el **micro-kernel unificado** que gobierna el ciclo de vida de cualquier sesión de práctica en `midi-laboratory`, desacoplando la máquina de estados genérica de la modalidad musical concreta.

El patrón arquitectónico es el de un **kernel parametrizable por tipos**: `useTrainerCore<TResult>` implementa la máquina de estados, los límites de sesión, los modos de avance, la telemetría metacognitiva y la persistencia; cada modalidad musical actúa como **plug-in** que inyecta sus reglas específicas mediante el contrato de opciones y callbacks:

| Frente           | Unidad canónica                      | Responsabilidad                                                     |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------- |
| Kernel           | `hooks/useTrainerCore.ts`            | Máquina de estados, límites, avance, telemetría, persistencia       |
| Política musical | `domain/exercise/evalPolicy.ts`      | Clamping, distancias, octavas y enarmonías                          |
| Contratos        | `domain/exercise/types.ts`           | `AdvanceMode`, `SessionLimitType`, `ExerciseResult`, `SessionStats` |
| Configuración    | `domain/ai/appConfig.ts`             | Retardos de auto-avance (SSOT)                                      |
| UI de error      | `components/trainer/DbSaveAlert.tsx` | Alerta visual de fallo de persistencia                              |

**Plug-ins verificados:** `useSingleNoteTrainer<ExerciseResult>`, `useIntervalTrainer<IntervalExerciseResult>`, `useSequenceTrainer<SequenceExerciseResult>` y `useRepertoireTrainer<RepertoireExerciseResult>`. El kernel NO conoce la semántica musical de `TResult`: solo la almacena, la cuenta y la delega.

**Configuración single-source-of-truth (SSOT):** los retardos de auto-avance DEBEN residir en `DEFAULT_APP_CONFIG.midi`:

- `autoAdvanceFastDelayMs = 1500` (modos `smart` y `auto_fast`)
- `autoAdvanceSlowDelayMs = 3500` (modo `auto_slow`)

**Alcance (in-scope):** máquina de estados, límites de sesión, limpieza de temporizadores, tokens de anti-carrera, modos de avance, telemetría metacognitiva, política de evaluación musical y resiliencia de persistencia.

## Requirements

### Requirement: Contrato del Micro-Kernel Parametrizable

El kernel DEBE ser genérico sobre el tipo de resultado `TResult` y NO debe acoplarse a ninguna modalidad musical concreta.

- El hook DEBE aceptar `TrainerCoreOptions<TResult>` con los puntos de extensión:
  - `onBuildSessionRecord`: construye el `DbSessionRecord` final desde `{ sessionId, totalSeconds, answers, history, limitType, durationMinutes }`.
  - `checkIsMasteryCompleted`: predicado opcional de maestría sobre el historial.
- El kernel MUST retener cero conocimiento musical: `TResult` se trata como opaco.
- Los defaults de configuración DEBEN ser: `defaultLimitType = 'questions'`, `defaultQuestionsCount = 10`, `defaultDurationMinutes = 5`, `defaultAdvanceMode = 'smart'`.

#### Scenario: Inicialización en reposo con límites por defecto

- **GIVEN** un hook `useTrainerCore` recién montado con solo `onBuildSessionRecord`
- **WHEN** se lee su estado
- **THEN** `isSessionActive === false`, `isSessionFinished === false`, `currentQuestionIndex === 0`, `sessionLimitType === 'questions'` y `advanceMode === 'smart'`

#### Scenario: La modalidad inyecta su constructor de registro

- **GIVEN** un kernel configurado con un `onBuildSessionRecord` tipado
- **WHEN** la sesión finaliza con al menos una respuesta
- **THEN** `onBuildSessionRecord` se invoca con `{ sessionId, totalSeconds, answers, history, limitType, durationMinutes }` y su valor es lo que se persiste

### Requirement: Máquina de Estados del Kernel

El kernel DEBE exponer y mantener coherentemente el siguiente estado de sesión: `isSessionActive`, `isSessionFinished`, `isWaitingManualAdvance`, `isWaitingAnswer`, `currentQuestionIndex` y `sessionId`.

- `startCoreSession` MUST activar la sesión (`isSessionActive = true`), MUST poner `currentQuestionIndex = 1`, MUST resetear `isSessionFinished`, `isWaitingManualAdvance`, buffers y telemetría, y MUST invocar `onTriggerFirstStimulus` exactamente una vez.
- `recordAnswer` DEBE rechazarse silenciosamente si la sesión no está activa o si no existe un `questionToken` vigente.
- La finalización MUST poner `isSessionActive = false`, `isSessionFinished = true`, `isWaitingManualAdvance = false` e `isWaitingAnswer = false`.

#### Scenario: Inicio síncrono de sesión

- **GIVEN** un kernel en reposo
- **WHEN** se invoca `startCoreSession({ limitType: 'time', durationMinutes: 3, advanceMode: 'manual' }, onTrigger)`
- **THEN** `isSessionActive === true`, `sessionLimitType === 'time'`, `timeRemainingSeconds === 180`, `advanceMode === 'manual'`, `currentQuestionIndex === 1` y `onTrigger` se invocó una vez

#### Scenario: Respuesta rechazada sin sesión activa

- **GIVEN** un kernel en reposo
- **WHEN** una modalidad invoca `recordAnswer(...)`
- **THEN** la respuesta se descarta: `sessionHistory.length === 0` y `lastResult === null`

### Requirement: Límites de Sesión (SessionLimitType)

El kernel DEBE soportar cuatro estrategias de terminación: `'questions'`, `'time'`, `'mastery'` e `'infinite'`.

- **`'questions'`**: la sesión MUST finalizar cuando `currentQuestionIndex >= sessionQuestionsCount`.
- **`'time'`**: la sesión MUST arrancar una cuenta regresiva de `durationMinutes * 60` segundos con `setInterval(1000)`. Al llegar a 0, MUST cancelar el intervalo y finalizar la sesión.
- **`'mastery'`**: la terminación MUST delegarse al predicado `checkIsMasteryCompleted(history)`.
- **`'infinite'`**: la sesión NO debe finalizar por sí sola; solo lo hace por parada explícita.

#### Scenario: Límite por conteo de preguntas finaliza la sesión

- **GIVEN** un kernel con `limitType: 'questions'` y `questionsCount: 10`
- **WHEN** se alcanza el avance en la pregunta 10
- **THEN** la sesión finaliza y se persiste el registro

#### Scenario: Cuenta regresiva por tiempo finaliza y persiste al expirar

- **GIVEN** un kernel con `limitType: 'time'` y `durationMinutes: 1`
- **WHEN** se responde una pregunta y avanzan 60000 ms de reloj virtual
- **THEN** `isSessionActive === false`, `isSessionFinished === true` y `saveSession` del store se invocó exactamente una vez

#### Scenario: Maestría delegada al predicado de la modalidad

- **GIVEN** un kernel con `limitType: 'mastery'` y un `checkIsMasteryCompleted` que devuelve `true`
- **WHEN** se responde y se avanza
- **THEN** la sesión finaliza, el estímulo siguiente NO se dispara y `saveSession` se invoca una vez

### Requirement: Limpieza Estricta de Temporizadores (cleanupTimers)

El kernel DEBE garantizar cero temporizadores residuales que puedan invocar `finalizeAndSaveSession` o `onAdvanceTrigger` después de una transición de estado.

- `cleanupTimers` MUST anular `autoAdvanceTimerRef` (`clearTimeout`) y `sessionCountdownTimerRef` (`clearInterval`), dejándolos en `null`.
- `cleanupTimers` DEBE invocarse obligatoriamente al: iniciar, detener, resetear y finalizar sesión.
- El hook MUST limpiar los temporizadores al desmontarse (cleanup de `useEffect`).
- Un doble avance manual NO DEBE disparar dos estímulos: el guard de reentrada (`isAdvancingRef`) es obligatorio.

#### Scenario: Reseteo invalida temporizadores pendientes

- **GIVEN** un kernel con sesión activa, token generado y un auto-avance programado
- **WHEN** se invoca `resetCoreToConfig()`
- **THEN** `isSessionActive === false`, `questionToken === null` y ningún temporizador residual puede disparar `finalizeAndSaveSession`

#### Scenario: Doble avance manual bloqueado

- **GIVEN** un kernel con sesión activa en modo manual y una respuesta ya registrada
- **WHEN** se invoca `advanceToNextQuestion()` dos veces en sucesión inmediata
- **THEN** `currentQuestionIndex === 2` (un solo avance) y el estímulo se disparó una única vez

### Requirement: Identidad de Sesión, Tokens y Protección Anti-Carrera

El kernel DEBE aislar sesiones consecutivas y descartar respuestas o avances desfasados.

- `startCoreSession` MUST generar un `sessionId` con el formato `` `session_${crypto.randomUUID()}` ``, donde el componente aleatorio es un UUIDv4 (RFC 4122) criptográficamente aleatorio.
- `generateQuestionToken(prefix = 'token')` MUST generar un token con el formato `` `${prefix}_${crypto.randomUUID()}` ``.
- La entropía de ambos identificadores MUST provenir exclusivamente de `crypto.randomUUID()`: NO MUST combinarse con `Date.now()` ni con `Math.random()`, y MUST ser única dentro de una misma ejecución del renderer con probabilidad despreciable de colisión.
- `recordAnswer` MUST exigir un `questionToken` no nulo; sin él, la respuesta se descarta.
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

### Requirement: Modos de Avance (AdvanceMode)

El kernel DEBE implementar cuatro modos de avance definidos en `AdvanceMode`:

| Modo          | Comportamiento                                            | Retardo                         |
| ------------- | --------------------------------------------------------- | ------------------------------- |
| `'smart'`     | Auto-avance solo en acierto; en error activa pausa manual | `autoAdvanceFastDelayMs` (1500) |
| `'manual'`    | Avance siempre explícito                                  | —                               |
| `'auto_fast'` | Auto-avance incondicional                                 | `autoAdvanceFastDelayMs` (1500) |
| `'auto_slow'` | Auto-avance incondicional                                 | `autoAdvanceSlowDelayMs` (3500) |

- `recordAnswer` MUST computar `shouldWaitManual = (mode === 'manual') || (mode === 'smart' && !isCorrectForSmartAdvance)`; si es verdadero, activa `isWaitingManualAdvance` y NO programa temporizador.
- En pausa manual por error, el kernel MUST fijar `errorPauseStartTimeRef = Date.now()`.
- En caso contrario, el kernel MUST programar `setTimeout(delay)` con `delay = (mode === 'auto_slow') ? autoAdvanceSlowDelayMs : autoAdvanceFastDelayMs`.

#### Scenario: Modo smart con error activa pausa pedagógica

- **GIVEN** un kernel en modo `'smart'` con sesión activa y token generado
- **WHEN** se registra una respuesta incorrecta
- **THEN** `isWaitingManualAdvance === true`, `sessionHistory.length === 1` y NO se programa auto-avance

#### Scenario: Modo auto_slow avanza a los 3500 ms

- **GIVEN** un kernel en modo `'auto_slow'` con `autoAdvanceSlowDelayMs = 3500`
- **WHEN** se registra una respuesta
- **THEN** a los 2000 ms `onAdvanceTrigger` NO se ha disparado
- **AND** a los 3600 ms se ha disparado exactamente una vez

### Requirement: Telemetría Metacognitiva de Escucha y Reparación

El kernel DEBE recolectar tres métricas de auto-regulación del aprendizaje, estampadas en cada `DbAnswerRecord`.

- **`preAnswerListens`**: conteo de re-escuchas del estímulo antes de responder (inicia en 1).
- **`postErrorListens`**: conteo de re-escuchas durante la pausa tras un fallo (inicia en 0).
- **`postErrorDwellTimeMs`**: tiempo de reflexión entre el error y el avance manual.
- La consolidación de la telemetría post-error de la última respuesta MUST realizarse tanto en `advanceToNextQuestion` como en `finalizeAndSaveSession`.

#### Scenario: Re-escucha pre-respuesta registrada

- **GIVEN** un kernel con sesión activa y token generado
- **WHEN** la modalidad invoca `recordPreAnswerRepeat()` dos veces y luego `recordAnswer(...)`
- **THEN** el registro persistido lleva `preAnswerListens === 3`

#### Scenario: Dwell time consolidada al finalizar tras un error

- **GIVEN** un kernel cuya última respuesta fue incorrecta y está en pausa manual
- **WHEN** se finaliza la sesión tras 2000 ms de reflexión
- **THEN** el último `DbAnswerRecord` lleva `postErrorDwellTimeMs` aproximado a 2000

### Requirement: Política de Evaluación Musical (evalPolicy)

El dominio DEBE ofrecer una política determinista y configurable, con `DEFAULT_EVALUATION_POLICY = { strictOctave: true, acceptEnharmonics: true, clampResponseTime: { minMs: 50, maxMs: 30000 } }`.

**Clamping de tiempo de respuesta (sanitizeResponseTime):**

- `NaN` MUST devolver `minMs` (50); `Infinity` o `>= maxMs` MUST devolver `maxMs` (30000).
- Cualquier otro valor MUST devolver `max(minMs, round(rawTimeMs))`.

**Distancia normalizada (calculateNormalizedDistance):**

- `rawDistance` MUST ser `playedNote - expectedNote`.
- `pitchClassDistance` MUST normalizarse al intervalo `[-6, 6]`.

**Validez de nota (checkNoteMatch):**

- Con `strictOctave: true` MUST exigir igualdad exacta de números MIDI.
- Con `strictOctave: false` MUST aceptar igualdad de pitch class (`expected % 12 === played % 12`).

**Equivalencia enarmónica textual (checkEnharmonicTextMatch):**

- Con `acceptEnharmonics: true` MUST aceptar la tabla: `C#↔DB`, `D#↔EB`, `F#↔GB`, `G#↔AB`, `A#↔BB`.

#### Scenario: Tiempos fisiológicamente inválidos acotados

- **GIVEN** la política por defecto
- **WHEN** se invoca `sanitizeResponseTime` con `-300`, `NaN`, `Infinity`, `45000` y `1250.4`
- **THEN** devuelve `50`, `50`, `30000`, `30000` y `1250` respectivamente

#### Scenario: Distancia lineal y de pitch class

- **GIVEN** la política por defecto
- **WHEN** se invoca `calculateNormalizedDistance(60, 62)` y `(60, 72)`
- **THEN** devuelve `{rawDistance: 2, pitchClassDistance: 2}` y `{rawDistance: 12, pitchClassDistance: 0}`

#### Scenario: Enarmonía aceptada por defecto

- **GIVEN** la política por defecto
- **WHEN** se invoca `checkEnharmonicTextMatch('C#4', 'Db4')`
- **THEN** devuelve `true`

#### Scenario: Octava estricta vs. libre

- **GIVEN** la política por defecto (`strictOctave: true`)
- **WHEN** se invoca `checkNoteMatch(60, 72)`
- **THEN** devuelve `false`
- **GIVEN** una política con `strictOctave: false`
- **WHEN** se invoca `checkNoteMatch(60, 72)`
- **THEN** devuelve `true`

### Requirement: Resiliencia de Persistencia y Alerta Visual

El kernel DEBE degradarse con elegancia ante fallos de IndexedDB, sin quebrar la sesión ni la máquina de estados.

- `finalizeAndSaveSession` MUST persistir vía `useDatabaseStore.saveSession(sessionRecord, allAnswers)`.
- Si la sesión no tiene respuestas, MUST abortar la persistencia sin error.
- En caso de rechazo o excepción, MUST capturar el error, registrar `saveError` y NO relanzarlo.
- `saveError` MUST exponerse en la API pública junto con `clearSaveError()`.
- La UI `DbSaveAlert` DEBE renderizar `null` cuando no haya error y DEBE mostrar el mensaje con la etiqueta "Error de Persistencia Local (IndexedDB)".

#### Scenario: Fallo de cuota de IndexedDB expuesto sin quebrar el kernel

- **GIVEN** un kernel con respuestas registradas y un `saveSession` que rechaza con `Error('QuotaExceededError')`
- **WHEN** se finaliza la sesión
- **THEN** `saveError` contiene `QuotaExceededError`, `isSessionFinished === true` y la excepción no se propagó al llamador
- **AND** al invocar `clearSaveError()`, `saveError === null`

#### Scenario: Alerta visual oculta sin error

- **GIVEN** el componente `DbSaveAlert`
- **WHEN** se renderiza con `error = null`
- **THEN** devuelve `null`
