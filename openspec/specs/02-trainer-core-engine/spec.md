# Capability: Trainer Core Engine & Evaluation Policy

## Propósito y Alcance

Esta capacidad define el **micro-kernel unificado** que gobierna el ciclo de vida de cualquier
sesión de práctica en `midi-laboratory`, desacoplando la máquina de estados genérica de la
modalidad musical concreta.

El patrón arquitectónico es el de un **kernel parametrizable por tipos**: `useTrainerCore<TResult>`
implementa la máquina de estados, los límites de sesión, los modos de avance, la telemetría
metacognitiva y la persistencia; cada modalidad musical actúa como **plug-in** que inyecta sus
reglas específicas mediante el contrato de opciones y callbacks:

| Frente | Unidad canónica | Responsabilidad |
| --- | --- | --- |
| Kernel | `hooks/useTrainerCore.ts` | Máquina de estados, límites, avance, telemetría, persistencia |
| Política musical | `domain/exercise/evalPolicy.ts` | Clamping, distancias, octavas y enarmonías |
| Contratos | `domain/exercise/types.ts` | `AdvanceMode`, `SessionLimitType`, `ExerciseResult`, `SessionStats` |
| Configuración | `domain/ai/appConfig.ts` | Retardos de auto-avance (SSOT) |
| UI de error | `components/trainer/DbSaveAlert.tsx` | Alerta visual de fallo de persistencia |

**Plug-ins verificados** (consumidores del kernel, instanciados como `useTrainerCore<T>`):
`useSingleNoteTrainer<ExerciseResult>`, `useIntervalTrainer<IntervalExerciseResult>`,
`useSequenceTrainer<SequenceExerciseResult>` y `useRepertoireTrainer<RepertoireExerciseResult>`.
El kernel NO conoce la semántica musical de `TResult`: solo la almacena, la cuenta y la delega.

**Configuración single-source-of-truth (SSOT):** los retardos de auto-avance DEBEN residir en
`DEFAULT_APP_CONFIG.midi` y no codificarse de forma rígida en los consumidores:

| Constante | Valor | Semántica |
| --- | --- | --- |
| `autoAdvanceFastDelayMs` | `1500` | Avance automático (modos `smart` y `auto_fast`) |
| `autoAdvanceSlowDelayMs` | `3500` | Avance automático relajado (modo `auto_slow`) |

**Alcance (in-scope):** máquina de estados y sus transiciones, los cuatro límites de sesión, la
limpieza estricta de temporizadores, la identidad/anti-carrera, los cuatro modos de avance, la
telemetría de escucha/reparación, la política de evaluación musical y la resiliencia de
persistencia.

**Fuera de alcance (out-of-scope):** generación y evaluación de estímulos específicos por
modalidad, infraestructura MIDI/audio (Módulo 01), agregados de analítica y prescripciones de IA.

> **Convención terminológica:** este documento usa términos RFC 2119. `MUST` (DEBE) y `MUST NOT`
> (NO DEBE) marcan requerimientos invariables del contrato. `SHOULD` (DEBERÍA) marca una práctica
> fuertemente recomendada con excepciones justificadas.

---

## Requirement: Contrato del Micro-Kernel Parametrizable

El kernel DEBE ser genérico sobre el tipo de resultado `TResult` y NO debe acoplarse a ninguna
modalidad musical concreta.

- El hook DEBE aceptar `TrainerCoreOptions<TResult>` con los puntos de extensión:
  - `onBuildSessionRecord`: obligatorio; construye el `DbSessionRecord` final desde
    `{ sessionId, totalSeconds, answers, history, limitType, durationMinutes }`.
  - `checkIsMasteryCompleted`: opcional; predicado de maestría sobre el historial.
  - `onTriggerFirstStimulus` / `onTriggerNextStimulus`: callbacks de estímulo inyectados en
    `startCoreSession` / `advanceToNextQuestion`.
  - `onAdvanceTrigger`: callback disparado por el temporizador de auto-avance en `recordAnswer`.
- El kernel MUST retener cero conocimiento musical: `TResult` se trata como opaco y solo se
  almacena en `sessionHistory` / `historyBufferRef`.
- Los defaults de configuración DEBEN ser: `defaultLimitType = 'questions'`,
  `defaultQuestionsCount = 10`, `defaultDurationMinutes = 5`, `defaultAdvanceMode = 'smart'`.
- Los retardos de auto-avance NO especificados DEBEN caer a `DEFAULT_APP_CONFIG.midi`.

#### Scenario: Inicialización en reposo con límites por defecto

- **GIVEN** un hook `useTrainerCore` recién montado con solo `onBuildSessionRecord`
- **WHEN** se lee su estado
- **THEN** `isSessionActive === false`, `isSessionFinished === false`,
  `currentQuestionIndex === 0`, `sessionLimitType === 'questions'` y
  `advanceMode === 'smart'`

#### Scenario: La modalidad inyecta su constructor de registro

- **GIVEN** un kernel configurado con un `onBuildSessionRecord` que devuelve un registro de
  sesión tipado
- **WHEN** la sesión finaliza con al menos una respuesta
- **THEN** `onBuildSessionRecord` se invoca con `{ sessionId, totalSeconds, answers, history,
  limitType, durationMinutes }` y su valor de retorno es lo que se persiste

---

## Requirement: Máquina de Estados del Kernel

El kernel DEBE exponer y mantener coherentemente el siguiente estado de sesión:
`isSessionActive`, `isSessionFinished`, `isWaitingManualAdvance`, `isWaitingAnswer`,
`currentQuestionIndex` y `sessionId`.

- `startCoreSession` MUST activar la sesión (`isSessionActive = true`), MUST poner
  `currentQuestionIndex = 1`, MUST resetear `isSessionFinished`, `isWaitingManualAdvance`,
  los buffers de respuestas/historial y la telemetría, y MUST invocar
  `onTriggerFirstStimulus` exactamente una vez.
- `startCoreSession` DEBE aceptar opciones que sobreescriban `limitType`, `questionsCount`,
  `durationMinutes` y `advanceMode`, persistiéndolas en estado y refs.
- `recordAnswer` DEBE rechazarse (`return` silencioso) si la sesión no está activa o si no existe
  un `questionToken` vigente.
- `recordAnswer` DEBE empujar el registro y el resultado a los buffers, exponerlos en
  `sessionHistory` y `lastResult`, y desactivar `isWaitingAnswer`.
- La finalización MUST poner `isSessionActive = false`, `isSessionFinished = true`,
  `isWaitingManualAdvance = false` e `isWaitingAnswer = false`, y MUST conservar el historial y
  las respuestas para la capa de analítica.
- El kernel MANTENDRÁ refs espejo (`isSessionActiveRef`, `currentQuestionIndexRef`,
  `isWaitingAnswerRef`, `advanceModeRef`, `sessionLimitTypeRef`, etc.) de forma que la lógica
  asíncrona lea siempre el valor fresco sin depender del cierre de React.

#### Scenario: Inicio síncrono de sesión

- **GIVEN** un kernel en reposo
- **WHEN** se invoca `startCoreSession({ limitType: 'time', durationMinutes: 3,
  advanceMode: 'manual' }, onTrigger)`
- **THEN** `isSessionActive === true`, `sessionLimitType === 'time'`,
  `timeRemainingSeconds === 180`, `advanceMode === 'manual'`, `currentQuestionIndex === 1` y
  `onTrigger` se invocó una vez

#### Scenario: Respuesta rechazada sin sesión activa

- **GIVEN** un kernel en reposo (sin sesión iniciada)
- **WHEN** una modalidad invoca `recordAnswer(...)`
- **THEN** la respuesta se descarta: `sessionHistory.length === 0` y `lastResult === null`

---

## Requirement: Límites de Sesión (SessionLimitType)

El kernel DEBE soportar cuatro estrategias de terminación, seleccionables en tiempo de
configuración y mutables en caliente: `'questions'`, `'time'`, `'mastery'` e `'infinite'`.

- **`'questions'`**: la sesión MUST finalizar cuando, al avanzar,
  `currentQuestionIndex >= sessionQuestionsCount`.
- **`'time'`**: la sesión MUST arrancar una cuenta regresiva de `durationMinutes * 60` segundos
  con `setInterval` de 1000 ms, decrementando `timeRemainingSeconds` (con piso en 0); al llegar a
  0, MUST cancelar el intervalo y finalizar la sesión.
- **`'time'`**: la cuenta regresiva DEBE exponer también `sessionElapsedSeconds`, consolidado al
  finalizar como `max(1, round((now - sessionStartTime) / 1000))`.
- **`'mastery'`**: la terminación MUST delegarse al predicado `checkIsMasteryCompleted(history)`
  o, si se aporta, al override `onCustomCompletionCheck(history)`; el kernel NO debe codificar el
  umbral de maestría.
- **`'infinite'`**: la sesión NO debe finalizar por sí sola; solo lo hace por parada explícita.
- El intervalo de cuenta regresiva DEBE ignorar sus propios ticks si el `sessionIdRef` vigente ya
  no coincide con el de arranque (sesión reemplazada).

#### Scenario: Límite por conteo de preguntas finaliza la sesión

- **GIVEN** un kernel con `limitType: 'questions'` y `questionsCount: 10`
- **WHEN** se alcanza el avance en la pregunta 10
- **THEN** la sesión finaliza y se persiste el registro

#### Scenario: Cuenta regresiva por tiempo finaliza y persiste al expirar

- **GIVEN** un kernel con `limitType: 'time'` y `durationMinutes: 1`
- **WHEN** se responde una pregunta y avanzan 60000 ms de reloj virtual
- **THEN** `isSessionActive === false`, `isSessionFinished === true` y `saveSession` del store
  se invocó exactamente una vez

#### Scenario: Maestría delegada al predicado de la modalidad

- **GIVEN** un kernel con `limitType: 'mastery'` y un `checkIsMasteryCompleted` que devuelve
  `true`
- **WHEN** se responde y se avanza
- **THEN** la sesión finaliza, el estímulo siguiente NO se dispara y `saveSession` se invoca una
  vez

---

## Requirement: Limpieza Estricta de Temporizadores (cleanupTimers)

El kernel DEBE garantizar cero temporizadores residuales que puedan invocar
`finalizeAndSaveSession` o `onAdvanceTrigger` después de una transición de estado.

- `cleanupTimers` MUST anular `autoAdvanceTimerRef` (`clearTimeout`) y
  `sessionCountdownTimerRef` (`clearInterval`), dejando ambos en `null`.
- `cleanupTimers` DEBE invocarse obligatoriamente al: **iniciar** (dentro de
  `startCoreSession`), **detener** (`stopCoreSession`), **resetear** (`resetCoreToConfig`) y
  **finalizar** (dentro de `finalizeAndSaveSession`).
- El hook MUST limpiar los temporizadores al **desmontarse** (cleanup de `useEffect`).
- Tras una finalización, el callback de auto-avance programado MUST autodescartarse si
  `sessionIdRef.current !== sessionId` en el momento de dispararse.
- Un doble avance manual NO DEBE disparar dos estímulos: el guard de reentrada
  (`isAdvancingRef`) y la cancelación del temporizador previo en `advanceToNextQuestion` son
  obligatorios.

#### Scenario: Reseteo invalida temporizadores pendientes

- **GIVEN** un kernel con sesión activa, token generado y un auto-avance programado
- **WHEN** se invoca `resetCoreToConfig()`
- **THEN** `isSessionActive === false`, `questionToken === null` y ningún temporizador residual
  puede disparar `finalizeAndSaveSession`

#### Scenario: Doble avance manual bloqueado

- **GIVEN** un kernel con sesión activa en modo manual, pregunta 1 de 10, y una respuesta ya
  registrada
- **WHEN** se invoca `advanceToNextQuestion()` dos veces en sucesión inmediata
- **THEN** `currentQuestionIndex === 2` (un solo avance) y el estímulo se disparó una única vez

---

## Requirement: Identidad de Sesión, Tokens y Protección Anti-Carrera

El kernel DEBE aislar sesiones consecutivas y descartar respuestas o avances desfasados
(*stale*).

- `startCoreSession` MUST generar un `sessionId` con el formato
  `` `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` ``, garantizando
  unicidad monotónica por sesión.
- `generateQuestionToken(prefix = 'token')` MUST generar un token con el formato
  `` `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` ``, almacenarlo en
  `questionTokenRef` y resetear la telemetría de escuchas.
- `recordAnswer` MUST exigir un `questionToken` no nulo; sin él, la respuesta se descarta.
- `stopCoreSession` y `resetCoreToConfig` MUST invalidar el token (`questionTokenRef = null`) y el
  `sessionId`, de modo que las notas MIDI rezagadas sean ignoradas por la modalidad.
- `finalizeAndSaveSession` MUST ser reentrante: el guard `finalizingSessionsRef` (conjunto de
  sessionIds en finalización) MUST impedir doble persistencia de la misma sesión.
- Los IDs de los registros de respuesta (`DbAnswerRecord.id`) los generan las modalidades con
  `crypto.randomUUID()`; el kernel NO debe asumir su formato.

> **Nota de arquitectura:** los identificadores del kernel (`sessionId`, `questionToken`) se
> construyen con `Date.now()` + entropía base-36, no con `crypto.randomUUID()`. Su función es
> unicidad + detección de desface, no seguridad criptográfica. La aleatoriedad criptográfica se
> reserva para los IDs de registro de las modalidades.

#### Scenario: Nota MIDI recibida con sesión inactiva descartada

- **GIVEN** un trainer de notas montado sin sesión iniciada
- **WHEN** llega una nota del usuario (`handleUserNotePlayed(60)`)
- **THEN** `lastResult === null` y `sessionHistory.length === 0`

#### Scenario: Respuestas rezagadas tras detener la sesión descartadas

- **GIVEN** un trainer con sesión previamente activa que fue detenida
- **WHEN** llega una nota MIDI desfasada
- **THEN** la nota NO se evalúa y `isWaitingAnswer === false`

#### Scenario: Cambio de modalidad aísla sesiones

- **GIVEN** un trainer de notas detenido y un trainer de intervalos recién iniciado
  (cambio de pestaña)
- **WHEN** llega una nota perteneciente al ejercicio viejo de notas
- **THEN** la sesión de notas permanece inactiva y la de intervalos activa, sin contaminación de
  historial entre modalidades

---

## Requirement: Modos de Avance (AdvanceMode)

El kernel DEBE implementar cuatro modos de avance, definidos en `AdvanceMode` y autoexplicativos
en `ADVANCE_MODE_OPTIONS`:

| Modo | Comportamiento | Retardo |
| --- | --- | --- |
| `'smart'` | Auto-avance solo en acierto; en error activa pausa manual | `autoAdvanceFastDelayMs` (1500) |
| `'manual'` | Avance siempre explícito | — |
| `'auto_fast'` | Auto-avance incondicional | `autoAdvanceFastDelayMs` (1500) |
| `'auto_slow'` | Auto-avance incondicional | `autoAdvanceSlowDelayMs` (3500) |

- `recordAnswer` MUST computar `shouldWaitManual = (mode === 'manual') || (mode === 'smart' &&
  !isCorrectForSmartAdvance)`; si es verdadero, activa `isWaitingManualAdvance` y NO programa
  temporizador.
- En pausa manual por error, el kernel MUST fijar `errorPauseStartTimeRef = Date.now()` y resetear
  los contadores de re-escucha post-error.
- En caso contrario, el kernel MUST programar `setTimeout(delay)` con
  `delay = (mode === 'auto_slow') ? autoAdvanceSlowDelayMs : autoAdvanceFastDelayMs`.
- La corrutina del temporizador MUST verificar la vigencia del `sessionId` antes de disparar
  `onAdvanceTrigger`.
- El avance manual (barra espaciadora / `advanceToNextQuestion`) MUST estar bloqueado mientras
  `isAdvancingRef` o `isWaitingAnswerRef` estén activos.

#### Scenario: Modo smart con error activa pausa pedagógica

- **GIVEN** un kernel en modo `'smart'` con sesión activa y token generado
- **WHEN** se registra una respuesta incorrecta
- **THEN** `isWaitingManualAdvance === true`, `sessionHistory.length === 1` y NO se programa
  auto-avance

#### Scenario: Modo auto_slow avanza a los 3500 ms

- **GIVEN** un kernel en modo `'auto_slow'` con `autoAdvanceSlowDelayMs = 3500`
- **WHEN** se registra una respuesta (correcta o no)
- **THEN** a los 2000 ms `onAdvanceTrigger` NO se ha disparado
- **AND** a los 3600 ms se ha disparado exactamente una vez

---

## Requirement: Telemetría Metacognitiva de Escucha y Reparación

El kernel DEBE recolectar, sin acoplarse a la semántica musical, tres métricas de
auto-regulación del aprendizaje, estampadas en cada `DbAnswerRecord`.

- **`preAnswerListens`**: conteo de re-escuchas del estímulo **antes** de responder. Inicia en
  `1` (la audición original); `recordPreAnswerRepeat` lo incrementa; se resetea a `1` en cada
  nueva pregunta.
- **`postErrorListens`**: conteo de re-escuchas **durante la pausa tras un fallo**. Inicia en
  `0`; `recordPostErrorRepeat` lo incrementa; se resetea al entrar en pausa manual por error.
- **`postErrorDwellTimeMs`**: tiempo de reflexión entre el error y el avance manual, calculado
  como `round(Date.now() - errorPauseStartTimeRef)`.
- `recordAnswer` MUST estampar `preAnswerListens` desde el contador vigente y MUST inicializar
  `postErrorListens = 0` y `postErrorDwellTimeMs = 0` en el registro.
- La consolidación de la telemetría post-error de la **última** respuesta MUST realizarse tanto en
  `advanceToNextQuestion` como en `finalizeAndSaveSession`, escribiéndola sobre el último
  `DbAnswerRecord` cuando `!lastAns.isCorrect && errorPauseStartTimeRef > 0`.
- Si la sesión se cierra sin respuestas, la telemetría NO debe generar registro de persistencia.

#### Scenario: Re-escucha pre-respuesta registrada

- **GIVEN** un kernel con sesión activa y token generado
- **WHEN** la modalidad invoca `recordPreAnswerRepeat()` dos veces y luego `recordAnswer(...)`
- **THEN** el registro persistido lleva `preAnswerListens === 3`

#### Scenario: Dwell time consolidada al finalizar tras un error

- **GIVEN** un kernel cuya última respuesta fue incorrecta y está en pausa manual
- **WHEN** se finaliza la sesión tras 2000 ms de reflexión
- **THEN** el último `DbAnswerRecord` lleva `postErrorDwellTimeMs` aproximado a 2000 y los
  contadores de re-escucha post-error consolidados

---

## Requirement: Política de Evaluación Musical (evalPolicy)

El dominio DEBE ofrecer una política determinista y configurable, con
`DEFAULT_EVALUATION_POLICY = { strictOctave: true, acceptEnharmonics: true,
clampResponseTime: { minMs: 50, maxMs: 30000 } }`.

### Sub-requirement: Clamping de tiempo de respuesta (`sanitizeResponseTime`)

- `NaN` MUST devolver `minMs` (50); `Infinity` o `>= maxMs` MUST devolver `maxMs` (30000).
- Cualquier otro valor MUST devolver `max(minMs, round(rawTimeMs))`.
- Los límites fisiológicos (50 ms / 30000 ms) NO deben rebasarse nunca.

### Sub-requirement: Distancia normalizada (`calculateNormalizedDistance`)

- `rawDistance` MUST ser `playedNote - expectedNote` (distancia lineal en semitonos).
- `pitchClassDistance` MUST calcularse como `(played % 12) - (expected % 12)` y normalizarse al
  intervalo `[-6, 6]` restando/sumando 12 al desbordarse.
- Una nota a la octava (p. ej. 60 → 72) MUST dar `rawDistance = 12` con
  `pitchClassDistance = 0`.

### Sub-requirement: Validez de nota (`checkNoteMatch`)

- Con `strictOctave: true` MUST exigir igualdad exacta de números MIDI.
- Con `strictOctave: false` MUST aceptar igualdad de pitch class (`expected % 12 === played % 12`).

### Sub-requirement: Equivalencia enarmónica textual (`checkEnharmonicTextMatch`)

- Con `acceptEnharmonics: false` MUST exigir igualdad textual exacta (tras `trim().toUpperCase()`).
- Con `acceptEnharmonics: true` MUST ignorar dígitos de octava, normalizar mayúsculas y aceptar la
  tabla enarmónica bidireccional: `C#↔DB`, `D#↔EB`, `F#↔GB`, `G#↔AB`, `A#↔BB`.
- La tabla NO debe contener equivalencias para notas naturales (sin alteración).

#### Scenario: Tiempos fisiológicamente inválidos acotados

- **GIVEN** la política por defecto
- **WHEN** se invoca `sanitizeResponseTime` con `-300`, `NaN`, `Infinity`, `45000` y `1250.4`
- **THEN** devuelve `50`, `50`, `30000`, `30000` y `1250` respectivamente

#### Scenario: Distancia lineal y de pitch class

- **GIVEN** la política por defecto
- **WHEN** se invoca `calculateNormalizedDistance(60, 62)`, `(60, 59)` y `(60, 72)`
- **THEN** devuelve `{rawDistance: 2, pitchClassDistance: 2}`,
  `{rawDistance: -1, pitchClassDistance: -1}` y `{rawDistance: 12, pitchClassDistance: 0}`

#### Scenario: Enarmonía aceptada por defecto y rechazada en modo estricto

- **GIVEN** la política por defecto
- **WHEN** se invoca `checkEnharmonicTextMatch('C#4', 'Db4')` y `checkEnharmonicTextMatch('F#',
  'Gb')`
- **THEN** ambas devuelven `true`
- **GIVEN** una política con `acceptEnharmonics: false`
- **WHEN** se invoca `checkEnharmonicTextMatch('C#4', 'Db4')` y `checkEnharmonicTextMatch('C#4',
  'C#4')`
- **THEN** devuelven `false` y `true` respectivamente

#### Scenario: Octava estricta vs. libre

- **GIVEN** la política por defecto (`strictOctave: true`)
- **WHEN** se invoca `checkNoteMatch(60, 72)`
- **THEN** devuelve `false`
- **GIVEN** una política con `strictOctave: false`
- **WHEN** se invoca `checkNoteMatch(60, 72)`
- **THEN** devuelve `true`

---

## Requirement: Resiliencia de Persistencia y Alerta Visual

El kernel DEBE degradarse con elegancia ante fallos de IndexedDB, sin quebrar la sesión ni la
máquina de estados.

- `finalizeAndSaveSession` MUST persistir vía `useDatabaseStore.saveSession(sessionRecord,
  allAnswers)`.
- Si la sesión no tiene respuestas, MUST abortar la persistencia sin error (sesión vacía no se
  guarda).
- En caso de rechazo o excepción, MUST capturar el error, registrar `saveError` con el mensaje
  original (`err.message` o `String(err)`) y NO relanzarlo.
- El mensaje MUST seguir el formato
  `` `No se pudo guardar la sesión en la base de datos local (${errMsg}). Verifique el espacio disponible.` ``
- `saveError` MUST exponerse en la API pública junto con `clearSaveError()`, que lo reinicia a
  `null`.
- `startCoreSession` MUST reiniciar `saveError` a `null` al comenzar una nueva sesión.
- El error de persistencia NO debe impedir que `isSessionFinished` se marque ni que el historial
  quede disponible en memoria.
- La UI `DbSaveAlert` DEBE renderizar `null` cuando no haya error y DEBE mostrar el mensaje con
  la etiqueta "Error de Persistencia Local (IndexedDB)", ofreciendo un botón "✕ Cerrar" opcional
  vinculado a `clearSaveError`.

#### Scenario: Fallo de cuota de IndexedDB expuesto sin quebrar el kernel

- **GIVEN** un kernel con sesión activa y respuestas registradas, y un `saveSession` que rechaza
  con `Error('QuotaExceededError: Disco lleno')`
- **WHEN** se finaliza la sesión
- **THEN** `saveError` contiene `QuotaExceededError`, `isSessionFinished === true` y la excepción
  no se propagó al llamador
- **AND** al invocar `clearSaveError()`, `saveError === null`

#### Scenario: Alerta visual oculta sin error

- **GIVEN** el componente `DbSaveAlert`
- **WHEN** se renderiza con `error = null`
- **THEN** devuelve `null` (sin ocupar layout)

#### Scenario: Alerta visual descartable

- **GIVEN** el componente `DbSaveAlert` con un error y un callback `onDismiss`
- **WHEN** el usuario pulsa "✕ Cerrar"
- **THEN** se invoca `onDismiss`, vinculado a `clearSaveError()`
