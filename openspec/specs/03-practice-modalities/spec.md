# Capability: Practice Modalities & Musical Evaluators

## Propósito y Alcance

Esta capacidad define las **cuatro modalidades de entrenamiento auditivo y motor** que se montan
sobre el micro-kernel genérico definido en `02-trainer-core-engine`. Cada modalidad es un *plug-in*
que inyecta su propia semántica de estímulo, captura y evaluación, manteniendo el kernel libre de
conocimiento musical.

El patrón es el de **cuatro modelos de dominio desacoplados sobre un mismo kernel**: la generación
del estímulo y la evaluación viven en `domain/music/*` y `domain/exercise/*Evaluator.ts` (funciones
puras, deterministas, testeables sin React), mientras que el *hook* orquestador solo cablea estado,
temporizadores y callbacks.

| Modalidad | Hook orquestador | Evaluador | Dominio musical | `TResult` / `targetMode` |
| --- | --- | --- | --- | --- |
| 01 · Nota Individual | `hooks/useSingleNoteTrainer.ts` | `domain/exercise/evaluator.ts` | `music/{presets,tonalContext,instruments,noteUtils}.ts` | `ExerciseResult` / `single_note` |
| 02 · Intervalos | `hooks/useIntervalTrainer.ts` | `domain/exercise/intervalEvaluator.ts` | `music/intervals.ts` | `IntervalExerciseResult` / `intervals` |
| 03 · Secuencias | `hooks/useSequenceTrainer.ts` | `domain/exercise/sequenceEvaluator.ts` | `music/sequences.ts` | `SequenceExerciseResult` / `sequences` |
| 04 · Repertorio | `hooks/useRepertoireTrainer.ts` | `domain/exercise/repertoireEvaluator.ts` | `music/{scoreParser,scoreTypes}.ts` | `RepertoireExerciseResult` / `repertoire` |

**Documentación fundacional de la Modalidad 04:** `REPERTOIRE_LEARNING_V2_SPEC.md`
(*Audiomotor Repertoire Chaining Engine* v2.0), cuya fundamentación psicoacústica (bucle
auditivo-motor, audiación, isocronía, percepción IOI y cierre gestáltico) se refleja directamente en
los requisitos de la Modalidad 04.

**Alcance (in-scope):** generación y evaluación específica de cada modalidad; presets y rangos;
anclaje tonal; modos de evaluación rítmica; encadenamiento; *streaks* de retención; fusión
polifónica; *clustering* de acordes; resolución gestáltica; y los metadatos de persistencia propios
de cada modalidad.

**Fuera de alcance (out-of-scope):** máquina de estados genérica, límites de sesión, modos de
avance, telemetría metacognitiva y resiliencia de IndexedDB (Módulo `02-trainer-core-engine`);
infraestructura MIDI/audio y *scheduler* cuantizado (Módulo `01-midi-audio-hardware`); agregados de
analítica y prescripciones de IA.

> **Convención terminológica:** este documento usa términos RFC 2119. `MUST` (DEBE) y `MUST NOT`
> (NO DEBE) marcan requerimientos invariables del contrato. `SHOULD` (DEBERÍA) marca una práctica
> fuertemente recomendada con excepciones justificadas.

---

## Requirement: Contrato Común de las Cuatro Modalidades

Cada modalidad DEBE instanciarse como `useTrainerCore<TPropio>` e inyectar su constructor de
registro de sesión; el kernel trata `TPropio` como opaco.

- El identificador de cada respuesta (`DbAnswerRecord.id`) MUST generarse con `crypto.randomUUID()`
  y prefijarse por modalidad: `ans_`, `ans_int_`, `ans_seq_`, `ans_rep_`.
- Toda pulsación del usuario MUST etiquetarse con `inputSource: 'midi_hardware' | 'virtual_ui'` y
  estamparse en el registro de respuesta.
- El `DbSessionRecord` resultante MUST llevar el `targetMode` canónico
  (`'single_note' | 'intervals' | 'sequences' | 'repertoire'`) y los identificadores fijos:

| Modalidad | `strategyId` | `instrumentId` |
| --- | --- | --- |
| 01 | el `StrategyId` adaptativo seleccionado (por defecto `adaptive_v1`) | el `InstrumentProfile.id` seleccionado |
| 02 | `intervals_v1` | `piano_intervals` |
| 03 | `sequences_v1` | `piano_sequences` |
| 04 | `repertoire_audiomotor_v1` | `piano_repertoire` |

- La noción de "acierto" difiere por modalidad y MUST reflejarse en el registro: en 01 es
  `result.correct`; en 02 `isIntervalCorrect`; en 03 `isExactMatch`; en 04 `isCompleteSuccess`.
- Las cuatro modalidades DEBEN exponer `trainWeak*Only()` (relanzar sesión aislada sobre
  debilidades) y `repeatCurrent*()` (reemitir el estímulo vigente).
- La modalidad 04 es la única que puede sobreescribir los retardos de auto-avance del kernel
  (`autoAdvanceFastDelayMs: 1700`, `autoAdvanceSlowDelayMs: 3200`); las tres restantes DEBEN caer a
  `DEFAULT_APP_CONFIG.midi` (1500 / 3500 ms).

#### Scenario: Persistencia con metadatos de modalidad

- **GIVEN** un trainer de repertorio con una sesión activa y al menos una respuesta evaluada
- **WHEN** la sesión finaliza
- **THEN** el `DbSessionRecord` persistido lleva `targetMode === 'repertoire'`,
  `strategyId === 'repertoire_audiomotor_v1'` e `instrumentId === 'piano_repertoire'`

#### Scenario: Entrada virtual de UI tratada como ciudadana de primera clase

- **GIVEN** cualquier modalidad con sesión activa y estímulo vigente
- **WHEN** el usuario pulsa una tecla del teclado virtual (`source = 'virtual_ui'`)
- **THEN** la nota se evalúa idénticamente a una nota de hardware MIDI y el registro lleva
  `inputSource === 'virtual_ui'`

---

## Modalidad 01 — Reconocimiento de Nota Individual (Single Note)

### Requirement: Reconocimiento de Altura Absoluta y Rango Instrumental

La modalidad DEBE entrenar el reconocimiento de altura absoluta sobre el rango físico del piano de
3 octavas, acotado por `DEFAULT_PIANO_BOUNDS = { minMidiNote: 48 (C3), maxMidiNote: 84 (C6) }`.

- La generación MUST usar `generateValidSingleNote(activeNotes, lastNote)`, que aplica
  **anti-repetición** del estímulo inmediatamente anterior **solo** cuando el pool tiene
  `length >= 3` y existe `lastNote`.
- Con un pool de una sola nota, la generación MUST devolver siempre esa nota; con un pool vacío
  MUST lanzar error.
- La evaluación MUST delegar a `evaluateSingleNoteAnswer`, que aplica la política central:
  `checkNoteMatch` (octava estricta por defecto), `calculateNormalizedDistance` (distancia lineal
  en semitonos) y `sanitizeResponseTime`.
- El pool activo por defecto MUST ser `[60, 62, 64, 65, 67, 69, 71, 72]` y `startSession` NO DEBE
  iniciar si el pool resultante tiene menos de 2 notas.
- El entrenador DEBE tolerar que `startSession` reciba un objeto ajeno (p. ej. un evento de React)
  sin lanzar error, conservando el pool vigente.
- La selección de la siguiente nota MUST delegarse a la estrategia adaptativa
  (`strategy.selectNextNote`), que recibe `activeNotes`, `history` y `lastPlayedNote`.

#### Scenario: Estímulo siempre dentro del pool activo

- **GIVEN** un trainer con sesión iniciada sobre el pool `[62, 64, 65]`
- **WHEN** se lee el estímulo emitido por `onPlayStimulus`
- **THEN** la nota pertenece exactamente a `[62, 64, 65]`, `currentQuestionIndex === 1` e
  `isWaitingAnswer === true`

#### Scenario: Respuesta correcta registrada con semitonos y tiempo

- **GIVEN** un trainer con estímulo vigente igual a `60`
- **WHEN** llega `handleUserNotePlayed(60)`
- **THEN** `lastResult.correct === true`, `lastResult.semitoneDistance === 0`,
  `sessionHistory.length === 1` e `isWaitingAnswer === false`

#### Scenario: Anti-repetición en pools grandes

- **GIVEN** un trainer con pool `[60, 62, 64]` y último estímulo `60`
- **WHEN** se genera el siguiente estímulo
- **THEN** la nota seleccionada es distinta de `60`

#### Scenario: startSession tolera un evento de React

- **GIVEN** un trainer en reposo
- **WHEN** se invoca `startSession` con un objeto que no es un arreglo de notas
- **THEN** la sesión se activa con el pool por defecto, `isWaitingAnswer === true` y no se lanza
  ningún error

---

### Requirement: Presets Armónicos y Resolución de Nombre Canónico

El dominio DEBE ofrecer `EXERCISE_PRESETS` y resolución automática del nombre canónico del pool
activo, usado como metadato de la sesión persistida.

| Preset | Notas | Semántica |
| --- | --- | --- |
| `level_1_c_d_e` | `[60, 62, 64]` | 3 notas naturales básicas en registro central |
| `level_2_c_to_g` | `[60, 62, 64, 65, 67]` | 5 naturales consecutivas (Do a Sol) |
| `level_3_octave_diatonic` | `[60, 62, 64, 65, 67, 69, 71, 72]` | octava diatónica C4–C5 |
| `level_4_octave_chromatic` | `generateMidiRange(60, 72)` | 12 notas cromáticas de la 4ª octava |
| `pentatonic_c_major` | `[60, 62, 64, 67, 69, 72]` | pentatónica de Do Mayor |
| `range_g4_g5` | `generateMidiRange(67, 79)` | rango extendido G4–G5 |

- `resolveNotePresetName(notes)` MUST ordenar el pool y compararlo contra cada preset (misma
  longitud y valores estrictamente iguales), devolviendo el `name` canónico correspondiente.
- Un pool que no coincida con ningún preset MUST devolver `Notas Personalizadas (N)`; un pool vacío
  o que no sea un arreglo MUST devolver `Notas Personalizadas (0)`.
- El `presetName` del registro MUST componerse como `` `${contentName} • ${formatTag}` ``, donde
  `formatTag` es `Cronometrado Nm` (límite por tiempo), `Modo Maestría` (límite por maestría) o
  `Bloque N preguntas` (resto).

#### Scenario: Resolución canónica de un preset formal

- **GIVEN** un pool activo `[60, 62, 64]`
- **WHEN** la sesión finaliza y se construye el registro
- **THEN** `presetName` contiene `Nivel 1 (C, D, E)` y la etiqueta `Bloque N preguntas`

#### Scenario: Pool personalizado sin preset

- **GIVEN** un pool activo `[61, 63, 66]`
- **WHEN** se resuelve el nombre canónico
- **THEN** devuelve `Notas Personalizadas (3)`

---

### Requirement: Anclaje Tonal (Tonal Context)

La modalidad DEBE soportar cuatro modos de anclaje tonal (`'none' | 'tonic' | 'drone' | 'cadence'`)
que emiten una referencia acústica **antes** del primer estímulo.

- Con `mode !== 'none'`, `startSession` MUST invocar `onPlayTonalContext(mode, rootNote)` —donde
  `rootNote` es la primera nota del pool con piso en `60`— y MUST desplazar el primer estímulo
  mediante un *pre-roll* de duración `getTotalContextDurationMs(mode, rootNote)`.
- Con `mode === 'none'`, el primer estímulo MUST dispararse inmediatamente vía el callback de
  `startCoreSession`, sin pre-roll.
- El *pre-roll* MUST poder cancelarse limpiamente en `stopSession`, `resetToConfig` y al desmontar
  (limpieza de `preRollTimerRef`), de forma que una sesión detenida no emita un estímulo diferido.
- Las duraciones de anclaje MUST ser:

| Modo | Contenido | Duraciones (sonoro + silencio) | Pre-roll total |
| --- | --- | --- | --- |
| `cadence` | Cadencia I–IV–V7–I transportada a la raíz | `350+380`, `350+380`, `400+430`, `650+1650` ms | `2840` ms |
| `tonic` | Tónica sola | `800` ms + `1800` ms | `1800` ms |
| `drone` | Bordón grave (una octava abajo si `root >= 60`) | `1200` ms + `2200` ms | `2200` ms |

- La cadencia MUST garantizar **≥ 1000 ms de asentamiento acústico** antes del primer estímulo
  (acorde final de resolución con `650` ms de sonido seguidos de `1650` ms de silencio).
- La raíz de la cadencia DEBE clampearse una octava cuando esté fuera del rango `[55, 72]`.
- Los acordes de la cadencia sobre la raíz `r` MUST ser: I `[r, r+4, r+7]`, IV `[r-3, r, r+5]`,
  V7 `[r-1, r+2, r+5, r+7]` e I `[r, r+4, r+7]`.

#### Scenario: Cadencia retarda el primer estímulo

- **GIVEN** un trainer con `tonalContextMode = 'cadence'` y pool `[62, 64, 66]`
- **WHEN** se invoca `startSession`
- **THEN** `onPlayTonalContext` se invoca exactamente una vez con `('cadence', 62)` y
  `onPlayStimulus` aún no se ha invocado
- **WHEN** avanzan `3500` ms de reloj virtual
- **THEN** `onPlayStimulus` se ha invocado exactamente una vez

#### Scenario: Detener la sesión anula el pre-roll pendiente

- **GIVEN** un trainer con cadencia programada y sesión recién iniciada (estímulo aún no emitido)
- **WHEN** se invoca `stopSession` y avanzan `5000` ms
- **THEN** `onPlayStimulus` nunca se invoca y `isSessionFinished === true`

---

### Requirement: Modo Maestría y Entrenamiento Focalizado en Debilidades

La modalidad 01 es la única que DEBE proveer un predicado de maestría (`checkIsMasteryCompleted`) y
reentrenamiento selectivo de notas débiles.

- `checkIsMasteryCompleted(history)` MUST considerar completa la maestría cuando **todas** las
  notas del pool activo cumplan `perf.attempts >= 2` **y** `perf.accuracyPercentage >= 85`.
- `trainWeakNotesOnly()` MUST aislar las notas con `attempts > 0` y `accuracyPercentage < 85`.
- Si solo existe **una** nota débil, MUST compensarse con un compañero a ±2 semitonos (hacia abajo
  si la débil es `>= 60`, hacia arriba en caso contrario) para preservar el mínimo de 2 notas.
- Si no hay notas débiles, la función MUST NO relanzar la sesión.
- La re-escucha del estímulo (`repeatCurrentNote`) MUST contabilizarse como `preAnswerRepeat`
  mientras haya respuesta pendiente, o como `postErrorRepeat` si se está en pausa por error.

#### Scenario: Maestría no completada con intentos insuficientes

- **GIVEN** un pool `[60, 62]` donde la nota `60` acumula 2 intentos al 100 % y la `62` solo 1
- **WHEN** se evalúa `checkIsMasteryCompleted`
- **THEN** devuelve `false` (la nota `62` no alcanza `attempts >= 2`)

#### Scenario: Reentrenamiento aísla notas falladas

- **GIVEN** un trainer cuyo historial registra fallos sobre la nota `60`
- **WHEN** se invoca `trainWeakNotesOnly()`
- **THEN** la nueva sesión se inicia con un pool que contiene la nota débil y
  `isSessionActive === true`

---

### Requirement: Cambio de Timbres General MIDI

La modalidad DEBE permitir cambiar el timbre de síntesis mediante *Program Change* de General MIDI.

- El catálogo `INSTRUMENT_CATALOG` MUST contener al menos: `acoustic_grand_piano` (GM 0),
  `flute` (GM 73), `violin` (GM 40), `clarinet` (GM 71) y `acoustic_bass` (GM 32).
- Cada `InstrumentProfile` DEBE declarar `minOptimalNote` / `maxOptimalNote` como rango tímbrico
  recomendado y su `category` dentro de `'Keyboards' | 'Winds' | 'Strings' | 'Bass' | 'Brass'`.
- `setSelectedInstrumentId(id)` MUST notificar el *program number* al sintetizador mediante
  `onInstrumentChanged(programNumber)`, y `getInstrumentById` MUST caer al piano acústico ante un id
  desconocido.
- El instrumento seleccionado MUST estamparse en el registro de sesión (`instrumentId`) y el cambio
  DEBE aplicarse al (re)iniciar la sesión.

#### Scenario: Cambio de instrumento notifica el program change correcto

- **GIVEN** un trainer con instrumento por defecto (piano, program `0`)
- **WHEN** se invoca `setSelectedInstrumentId('flute')`
- **THEN** `selectedInstrument.id === 'flute'` y `onInstrumentChanged` se invocó con `73`

---

## Modalidad 02 — Reconocimiento de Intervalos (2 Notas)

### Requirement: Catálogo de 13 Clases de Intervalos y Direcciones

El dominio DEBE definir exactamente **13 clases de intervalos** (semitonos `0` a `12`, desde
Unísono Perfecto / segunda menor hasta Octava Justa) con dirección de estímulo configurable.

- `INTERVAL_DEFINITIONS` MUST cubrir los semitonos `0..12` con `shortName`, `fullName`,
  `anchorSong` e `inversionName` (tabla de inversiones complementaria: `1P↔8J`, `2m↔7M`,
  `2M↔7m`, `3m↔6M`, `3M↔6m`, `4J↔5J`, `TT↔TT`).
- La dirección del estímulo (`DirectionSelection`) MUST ser `'ascending' | 'descending' | 'both'`;
  en `'both'` la dirección se sortea por evento (`Math.random() > 0.5`).
- La generación MUST usar `generateValidInterval`, que garantiza que ninguna nota se salga de
  `DEFAULT_PIANO_BOUNDS` (48–84): si el *target* desborda, la dirección **se autocorrige** y, de
  seguir desbordando, se aplica *clamp* seguro a los límites.
- La generación MUST aplicar anti-repetición del intervalo inmediatamente anterior solo cuando
  `allowedSemitones.length >= 3`.
- Los presets MUST incluir: `level_1_0_contrast` (`[1, 12]`), `level_1_1_reference`
  (`[2, 4, 5, 7, 12]`), `level_1_2_bidirectional` (mismos, dirección `both`),
  `level_1_3_full_chromatic` (los 12 semitonos) y `level_1_4_random_root` (base libre, dirección
  `both`).
- Al seleccionar un preset con `fixedRootNote === null`, el rango de raíces MUST expandirse a las
  25 notas `48..72` (C3–C5); con raíz fija, MUST reducirse a esa única nota.

#### Scenario: Intervalo acotado dentro del rango físico

- **GIVEN** un trainer configurado con intervalo de `4` semitonos y raíz fija `60`
- **WHEN** se inicia la sesión
- **THEN** `onPlayInterval` se invoca con `root === 60` y `target === 64`

#### Scenario: Corrección automática de dirección por desborde

- **GIVEN** `generateValidInterval` con semitono `12`, raíz `84` (límite agudo) y dirección
  `ascending`
- **WHEN** se genera el intervalo
- **THEN** la dirección se invierte a `descending` y el *target* permanece dentro de `[48, 84]`

---

### Requirement: Flujo de Respuesta en 2 Pasos (Two-Note Capture)

La captura de la respuesta DEBE seguir un protocolo de dos pasos, expuesto en
`waitingNoteStep: 1 | 2` y `firstNotePlayed: number | null`.

- En el **paso 1**, la primera nota del usuario MUST registrarse en `firstNotePlayed` y pasar a
  `waitingNoteStep = 2`, **sin** evaluar ni registrar respuesta.
- En el **paso 2**, con `firstNotePlayed !== null`, el par `[first, second]` MUST evaluarse con
  `evaluateIntervalAnswer`, y ambos estados MUST resetearse (`waitingNoteStep = 1`,
  `firstNotePlayed = null`).
- Una nota recibida sin sesión activa, sin estímulo o sin token vigente MUST descartarse
  silenciosamente.
- El estímulo de cada pregunta MUST resetear el paso a `1` y `firstNotePlayed` a `null`.

#### Scenario: Primera nota fijada sin evaluación

- **GIVEN** un trainer con estímulo vigente (root `60`, target `64`) y `waitingNoteStep === 1`
- **WHEN** llega `handleUserNotePlayed(60)`
- **THEN** `waitingNoteStep === 2`, `firstNotePlayed === 60` y `lastResult === null`

#### Scenario: Segunda nota dispara la evaluación

- **GIVEN** el mismo estímulo con `waitingNoteStep === 2` y `firstNotePlayed === 60`
- **WHEN** llega `handleUserNotePlayed(64)`
- **THEN** `waitingNoteStep === 1`, `firstNotePlayed === null`, `lastResult !== null` y
  `sessionHistory.length === 1`

---

### Requirement: Evaluador Desacoplado: Error Auditivo vs. Error Motor

`evaluateIntervalAnswer` DEBE separar la corrección del intervalo (oído) de la corrección del
transporte (ejecución motora).

- `isIntervalCorrect` MUST exigir `playedSemitones === stimulus.semitones` **y**
  `playedDirection === stimulus.direction`; la dirección se infiere del signo de la diferencia
  entre las dos notas tocadas, y un unísono se etiqueta `'harmonic'`.
- `isRootCorrect` MUST exigir `playedRoot === stimulus.rootNote` (coincidencia motora exacta).
- `isExactMatch = isIntervalCorrect && isRootCorrect`;
  `isTransposedCorrect = isIntervalCorrect && !isRootCorrect`.
- `semitoneDistanceError` MUST ser `playedSemitones - stimulus.semitones`.
- La cardinalidad de intervalos MUST normalizarse con `getIntervalDefinition` vía
  `Math.abs(semitones) % 13`, cayendo al unísono ante un valor fuera de catálogo.
- La evaluación NO DEBE requerir el tempo de la política; solo sanitiza el tiempo de respuesta.

#### Scenario: Coincidencia exacta

- **GIVEN** el estímulo `{ rootNote: 60, targetNote: 64, semitones: 4, direction: 'ascending' }`
- **WHEN** se evalúa el par `[60, 64]`
- **THEN** `isExactMatch === true`, `isIntervalCorrect === true`, `isRootCorrect === true`,
  `isTransposedCorrect === false` y `semitoneDistanceError === 0`

#### Scenario: Intervalo correcto transportado (oído bien, motor mal)

- **GIVEN** el mismo estímulo de tercera mayor
- **WHEN** se evalúa el par `[62, 66]` (D4 → F#4)
- **THEN** `isIntervalCorrect === true`, `isRootCorrect === false`, `isExactMatch === false`,
  `isTransposedCorrect === true` y el feedback contiene "transportada"

#### Scenario: Error de clase de intervalo

- **GIVEN** el estímulo de tercera mayor (4 semitonos)
- **WHEN** se evalúa el par `[60, 63]` (tercera menor)
- **THEN** `isIntervalCorrect === false`, `semitoneDistanceError === -1` y el feedback contiene
  "Tercera Menor"

---

### Requirement: Mnemotecnia Pedagógica (Canciones Ancla)

Cada clase de intervalo DEBE llevar una canción-ancla pedagógica (`anchorSong`) utilizada en el
feedback de error.

- El feedback de error MUST citar el `anchorSong` del intervalo esperado, p. ej. el error en una
  tercera mayor referencia `"Himno a la Alegría / Primavera (Vivaldi)"`.
- El acierto exacto MUST felicitar citando el `fullName` y `shortName` esperados.
- El transporte correcto MUST distinguirse verbalmente del acierto exacto, reforzando que el oído
  acertó pero falló la nota base.
- El catálogo SHOULD mantener anclajes culturalmente reconocibles (Cumpleaños Feliz, Star Wars,
  Somewhere Over the Rainbow, Take On Me, etc.).

#### Scenario: Feedback de error incluye la canción ancla

- **GIVEN** un estímulo de quinta justa (7 semitonos, ancla `"Star Wars / Estrellita Dónde Estás"`)
- **WHEN** el usuario responde con un intervalo de clase distinta
- **THEN** `feedbackMessage` contiene el `shortName` tocado, el `fullName` esperado y el
  `anchorSong` esperado

---

## Modalidad 03 — Memoria Melódica / Secuencias (3 a 6 Notas)

### Requirement: Generación de Secuencias, Longitud y Control de Saltos

La modalidad DEBE generar dictados melódicos de longitud configurable, respetando saltos máximos y
repetición consecutiva.

- La longitud MUST acotarse al rango **[3, 6]** notas mediante `generateValidSequence`
  (`Math.min(6, Math.max(3, length))`); `startSession` MUST rechazar longitudes menores que 3.
- `generateMelodicSequence` MUST partir de una nota aleatoria del pool y, en cada paso, filtrar los
  candidatos por `|note - currentNote| <= maxJumpSemitones` y por `allowRepeatedConsecutive`.
- Si ningún candidato cumple el salto, MUST caer al pool completo de candidatos para no trabar la
  generación.
- Con un pool de una sola nota, la secuencia MUST ser esa nota repetida `length` veces; con un pool
  vacío MUST lanzar error.
- Los presets MUST combinar longitud y dificultad: `level_2_0` (3 notas, salto 2, sin repetición
  consecutiva), `level_2_1` (3 notas, salto 5), `level_2_2` (4 notas, salto 7), `level_2_3`
  (5 notas, salto 8) y `level_2_4` (4 notas cromáticas, salto 12).
- La captura MUST acumular `capturedNotes` y evaluar **solo** cuando se alcanza la longitud de la
  secuencia esperada.
- Los parámetros de salto y repetición MUST tomarse del preset seleccionado cuando exista, o caer
  a `maxJumpSemitones = 12` y `allowRepeatedConsecutive = true`.

#### Scenario: Secuencia generada con salto controlado

- **GIVEN** el preset `level_2_0_diatonic_stepwise` (pool C4–G4, `maxJumpSemitones = 2`,
  `allowRepeatedConsecutive = false`)
- **WHEN** se genera una secuencia de 3 notas
- **THEN** cada salto entre notas consecutivas es `<= 2` semitonos y no hay notas repetidas
  consecutivas

#### Scenario: Captura progresiva hasta completar la longitud

- **GIVEN** un trainer con secuencia esperada de longitud 3
- **WHEN** se reciben 2 notas del usuario
- **THEN** `capturedNotes.length === 2` y `lastResult === null`
- **WHEN** llega la tercera nota
- **THEN** `lastResult !== null` y `sessionHistory.length === 1`

---

### Requirement: Evaluación en 3 Capas (Nota, Contorno y Edición)

`evaluateSequenceAnswer` DEBE producir tres capas de diagnóstico complementarias.

1. **Capa de coincidencia nota a nota:** `noteByNoteEvaluation` usa `checkNoteMatch` por índice
   (respeta la política de octava y enarmonía); expone `exactMatchesCount` e
   `isExactMatch = (exactMatchesCount === length && playedNotes.length === length)`.
2. **Capa de contorno melódico direccional:** `expectedContour` / `playedContour` como arrays de
   `'up' | 'down' | 'same'` (un elemento menos que la secuencia); `isContourCorrect` exige misma
   longitud y todos los elementos iguales.
3. **Capa de distancia de edición:** `levenshteinDistance` entre las dos secuencias y
   `similarityScorePercentage = max(0, round(((maxLen - distance) / maxLen) * 100))`.

- El feedback MUST priorizar: coincidencia exacta > contorno correcto (con o sin notas exactas) >
  acierto parcial (citando conteo y porcentaje de similitud) > fallo total.
- La persistencia de esta modalidad MUST usar `isExactMatch` como acierto y el promedio de
  `similarityScorePercentage` como `accuracyPercentage` de la sesión.
- Los eventos faltantes (jugadas más cortas que la esperada) MUST marcarse con
  `played === null` y `isCorrect === false`.

#### Scenario: Coincidencia exacta al 100 %

- **GIVEN** la secuencia esperada `[60, 64, 67, 72]`
- **WHEN** se juega `[60, 64, 67, 72]`
- **THEN** `isExactMatch === true`, `exactMatchesCount === 4`, `isContourCorrect === true` y
  `similarityScorePercentage === 100`

#### Scenario: Contorno correcto pese a transporte

- **GIVEN** la secuencia esperada `[60, 64, 67]` (contorno `['up', 'up']`)
- **WHEN** se juega `[62, 65, 69]`
- **THEN** `isExactMatch === false`, `isContourCorrect === true` y el feedback menciona "contorno"

#### Scenario: Distancia de edición y similitud

- **GIVEN** las secuencias `[60, 62, 64]` y `[60, 63, 64]`
- **WHEN** se calcula la distancia de Levenshtein
- **THEN** devuelve `1` (un error de una nota)

#### Scenario: Secuencia incompleta no es coincidencia exacta

- **GIVEN** una secuencia esperada de 4 notas
- **WHEN** el usuario juega 3 notas correctas
- **THEN** `isExactMatch === false` y `exactMatchesCount === 3`

---

## Modalidad 04 — Repertorio Audiomotor (MusicXML 4.0)

### Requirement: Parser Nativo de MusicXML 4.0 (MuseScore 4)

`parseMusicXml` DEBE producir el modelo canónico `ScoreDataModel` desde MusicXML exportado por
MuseScore Studio 4.

- El parser MUST rechazar contenido vacío o no textual y MUST detectar errores de sintaxis XML
  (`parsererror`) lanzando una excepción cuyo mensaje contenga "Error de sintaxis".
- `pitchToMidiNote(step, alter, octave)` MUST computar `(octave + 1) * 12 + offset + alter`
  (ej. `C4 → 60`) y clampear el resultado a `[0, 127]`.
- El parser MUST soportar obligatoriamente:
  - **`<divisions>`**: conversión de duraciones a `durationBeats = duration / divisions` y posición
    métrica `beatPosition = 1.0 + cursorDivisions / divisions`.
  - **`<backup>` / `<forward>`**: retroceso/avance del cursor temporal (el *backup* no baja de `0`);
    ambos MUST reiniciar `lastEventInVoice` para no fusionar notas no simultáneas.
  - **`<chord/>`**: las notas simultáneas dentro del mismo pentagrama se agregan al último evento
    sin avanzar el cursor y marcan `isChord = true`.
  - **`<harmony>`**: extracción de `root-step`, `root-alter`, `kind`, `bass-step`/`bass-alter` y su
    asociación a eventos por compás con `|Δ beatPosition| < 0.05`.
  - **`<fingering>`** (1 a 5, vía `technical`) y **`<rest/>`** (silencios sin `midiNotes`).
- La mano MUST derivarse del `staff` (`1 → 'RH'`, `2 → 'LH'`); el ordenamiento cronológico final
  MUST ser por `measureNumber`, `beatPosition` y `staff`.
- Los metadatos MUST extraer `work-title` / `credit-words`, `creator[type="composer"]`, `<time>`,
  `<key>` y el tempo desde `<sound tempo>` o `<metronome><per-minute>`; los valores globales por
  defecto MUST ser `divisions = 4`, `4/4`, do mayor y `baseBpm = 120`.
- La duración acústica de cada evento MUST precomputarse como
  `durationMs = round(durationBeats * (60000 / baseBpm))`.

#### Scenario: Conversión de altura y duración

- **GIVEN** un `<note>` con `<pitch><step>C</step><octave>4</octave></pitch>`, `<duration>2</duration>`
  y `divisions = 4`
- **WHEN** se parsea el fragmento
- **THEN** el evento resultante tiene `midiNotes = [60]`, `durationBeats = 0.5` y
  `beatPosition = 1.0`

#### Scenario: `<backup>` alinea ambas manos en el mismo tiempo

- **GIVEN** un compás cuya voz aguda (`staff 1`) avanza 2 divisiones y luego aparece
  `<backup><duration>2</duration></backup>` seguido de notas graves (`staff 2`)
- **WHEN** se parsea
- **THEN** el evento grave resultante comparte `beatPosition` con el evento agudo inicial

#### Scenario: `<chord/>` no avanza el cursor

- **GIVEN** un evento melódico seguido de una nota con `<chord/>`
- **WHEN** se parsea
- **THEN** el evento anterior pasa a `isChord = true` con ambas notas y el cursor temporal no se
  incrementa

#### Scenario: MusicXML malformado es rechazado

- **GIVEN** una cadena con XML sintácticamente inválido
- **WHEN** se invoca `parseMusicXml`
- **THEN** se lanza un error que contiene "Error de sintaxis"

---

### Requirement: Selección de Manos y Fusión Polifónica

La modalidad DEBE soportar `HandSelection = 'RH' | 'LH' | 'both'`, fusionando los eventos
simultáneos de ambas manos cuando se seleccionan ambas.

- El filtrado de eventos MUST excluir silencios (`isRest`) y eventos sin `midiNotes` (no jugables).
- Con `hand === 'both'`, `fuseConcurrentEvents` MUST agrupar por la clave
  `` `${measureNumber}_${beatPosition.toFixed(3)}` ``, fusionando `notes` / `midiNotes` sin
  duplicar *pitch*, ordenando de forma ascendente, marcando `isChord = midiNotes.length > 1` y
  `hand = 'both'`.
- Las duraciones del evento fusionado MUST tomar el **mínimo** de `durationDivisions`,
  `durationBeats` y `durationMs` entre los eventos origen.
- Con `hand === 'RH'` o `'LH'`, los eventos MUST permanecer sin fusionar (una sola voz).
- El resultado MUST ordenarse por `measureNumber` y, dentro del compás, por `beatPosition`.

#### Scenario: Fusión polifónica de manos en un acorde vertical

- **GIVEN** un *score* con un evento `RH` (`midiNotes [67]`) y un evento `LH` (`midiNotes [48]`) en
  el mismo compás y `beatPosition 1.0`
- **WHEN** se computa la rebanada con `hand = 'both'`
- **THEN** resulta exactamente **un** evento, `isChord === true` y `midiNotes === [48, 67]`

---

### Requirement: Resolución Gestáltica Universal (+1 Resolución)

La modalidad DEBE incluir estrictamente el **primer evento jugable del compás siguiente** a la
rebanada en estudio, completando el gesto motor hacia el punto de reposo.

- La inclusión MUST condicionarse a `includeResolution === true` **y** `endM < score.totalMeasures`.
- Los eventos candidatos del compás `endM + 1` MUST filtrarse por mano y jugabilidad, y fusionarse
  cuando `hand === 'both'`.
- MUST tomarse **exactamente** el primer evento (`fusedNext[0]`), y solo agregarse si no está ya
  presente en la rebanada (comparación por `id`).
- Esta resolución DEBE aplicarse a cualquier selección de compases (p. ej. `1→1`, `2→3`, `4→6`) y
  en ambas direcciones de encadenamiento.
- El usuario MUST poder desactivar la resolución (`includeResolutionNote: false`).

#### Scenario: Nota de resolución añadida desde el compás siguiente

- **GIVEN** un *score* de 8 compases con la rebanada actual en compases `1` a `4` y el primer
  evento jugable del compás `5` en `midiNotes [69]`
- **WHEN** se computa la rebanada con `includeResolutionNote = true`
- **THEN** el último evento de la rebanada es el evento `[69]` del compás `5`

#### Scenario: Resolución desactivada

- **GIVEN** la misma rebanada con `includeResolutionNote = false`
- **WHEN** se computa la rebanada
- **THEN** ningún evento del compás `5` está presente

---

### Requirement: Encadenamiento (Forward / Backward Chaining) y Streaks de Retención

La modalidad DEBE implementar encadenamiento incremental con *streaks* de retención que desbloquean
nuevos eventos.

- La dirección MUST ser `'forward' | 'backward'`: *forward* toma los primeros `N` eventos de la
  rebanada; *backward* toma los últimos `N`.
- La granularidad se expresa en **eventos jugables** (vocabulario `ChainingStepGranularity`:
  `'1_event' | '2_events' | '1_measure'`); `activeSliceLength` arranca en `1`.
- Al alcanzar el *streak* fijado (`streakTarget`, catálogo de UI **1x a 10x**, por defecto `3`), la
  longitud MUST expandirse en **+1 evento** y el contador MUST resetearse a `0`.
- Ante cualquier fallo, el *streak* MUST resetearse a `0` inmediatamente.
- La expansión MUST estar acotada a `totalScopeLength` (longitud de la rebanada completa del rango
  seleccionado, calculada con resolución incluida).
- Cuando la rebanada dominada alcance `totalScopeLength` y se cumpla el *streak*, la sesión MUST
  **finalizar automáticamente** y persistirse con `targetMode: 'repertoire'`, emitiendo el mensaje
  "¡Fragmento de Repertorio 100% Dominado!".
- Con `autoSpeedRamp` activo, cada expansión MUST incrementar el BPM en **+5**, **topando** en el
  `baseBpm` nominal de la partitura.

#### Scenario: Acierto acumula streak; fallo lo resetea

- **GIVEN** un trainer con `streakTarget = 3` y rebanada vigente
- **WHEN** el usuario acierta dos veces
- **THEN** `currentStreak === 2` y `activeSliceLength` no cambia
- **WHEN** el usuario falla la siguiente
- **THEN** `currentStreak === 0`

#### Scenario: Streak alcanzado expande la rebanada

- **GIVEN** un trainer con `streakTarget = 1`, `activeSliceLength = 1` y `totalScopeLength > 1`
- **WHEN** el usuario acierta la rebanada de un evento
- **THEN** `currentStreak === 0` y `activeSliceLength === 2`

#### Scenario: Fragmento completo dominado finaliza y persiste

- **GIVEN** un trainer cuya rebanada dominada ya cubre `totalScopeLength` con `streakTarget = 1`
- **WHEN** el usuario completa la rebanada con éxito
- **THEN** `isSessionFinished === true` y `saveSession` se invoca una vez con un registro cuyo
  `targetMode === 'repertoire'`

#### Scenario: Auto Speed Ramp topa en el tempo nominal

- **GIVEN** un *score* con `baseBpm = 86`, `studyBpm = 84` y `autoSpeedRamp = true`
- **WHEN** se completa una frase exitosamente
- **THEN** `studyBpm === 86` (no supera el tempo nominal de la partitura)

---

### Requirement: Agrupamiento de Clúster de Acordes (45 ms)

El evaluador DEBE distinguir pulsaciones simultáneas (acordes) de notas melódicas repetidas.

- `clusterPlayedMidiNotes` MUST ordenar las notas por `timestampMs` y agrupar en un mismo clúster
  las que disten `<= chordClusterWindowMs` (por defecto **45 ms**) **y** sean teclas distintas.
- La **misma tecla repetida** (p. ej. `G4` seguido de `G4`) NUNCA MUST fusionarse como acorde: se
  trata siempre como notas melódicas secuenciales, sin importar la ventana temporal.
- Cada clúster MUST llevar sus `notes` ordenadas ascendentemente y el `timestampMs` de la primera
  nota del clúster.
- Una entrada vacía MUST devolver un arreglo vacío.
- La evaluación de la rebanada MUST dispararse cuando el número de notas crudas recibidas alcance la
  suma de `midiNotes` de todos los eventos esperados.

#### Scenario: Acorde polifónico agrupado

- **GIVEN** las notas crudas `{48, t=1000}` y `{52, t=1012}`
- **WHEN** se agrupan con ventana `45` ms
- **THEN** resulta **un** clúster con `notes === [48, 52]` y `timestampMs === 1000`

#### Scenario: Notas melódicas separadas en el tiempo

- **GIVEN** las notas crudas `{48, t=1000}` y `{55, t=1350}`
- **WHEN** se agrupan con ventana `45` ms
- **THEN** resultan **dos** clústeres `[[48], [55]]`

#### Scenario: Tecla repetida nunca se fusiona

- **GIVEN** las notas crudas `{67, t=1000}` y `{67, t=1015}` (misma tecla, dentro de la ventana)
- **WHEN** se agrupan con ventana `45` ms
- **THEN** resultan **dos** clústeres, cada uno con una sola nota `67`

---

### Requirement: Modos de Evaluación Rítmica (3 Modos)

El evaluador DEBE soportar `RhythmEvaluationMode = 'free_rubato' | 'relative_proportional' |
'strict_metronome'`, adaptando los tiempos esperados al BPM de estudio activo.

- `beatDurationMs = round(60000 / baseBpm)`; los tiempos esperados MUST recalcularse con el BPM de
  estudio, eliminando desvíos artificiales a tempos lentos.
- **`free_rubato`**: evalúa **solo altura**; el ritmo siempre se considera correcto
  (`isRhythmCorrect = true`), con desviaciones `0`.
- **`relative_proportional`**: compara el IOI (*inter-onset interval*) real contra el esperado
  (`durationBeats` del evento anterior por `beatDurationMs`); la desviación porcentual es
  `round(|actualIoi - expectedIoi| / expectedIoi * 100)` y es correcta si `<= rhythmTolerancePercent`.
- **`strict_metronome`**: compara el offset absoluto del evento respecto a la primera nota tocada
  contra la suma acumulada de duraciones esperadas; la desviación se normaliza contra la duración
  del evento actual (con piso de `500` ms) y aplica la misma tolerancia porcentual.
- En ambos modos rítmicos, el **primer evento** (`i === 0`) MUST considerarse rítmicamente correcto
  (ancla temporal libre).
- La tolerancia es configurable (rango de UI **±10 % a ±90 %**; por defecto `20` en el *trainer*,
  `35` en `DEFAULT_REPERTOIRE_CONFIG`), con `chordClusterWindowMs = 45` y `baseBpm = 86`.
- El *pitch* de cada evento es correcto solo si no faltan ni sobran notas respecto a las
  `midiNotes` esperadas (`missingNotes` / `extraNotes`).
- `overallScorePercent = round(pitchAccuracyPercent * 0.7 + rhythmAccuracyPercent * 0.3)`.
- `isCompleteSuccess = (pitchAccuracyPercent === 100) && (rhythmMode === 'free_rubato' ||
  rhythmAccuracyPercent === 100)`.

#### Scenario: free_rubato ignora el tiempo y premia la afinación

- **GIVEN** una melodía esperada de 3 eventos y las notas correctas tocadas a `1000`, `2500` y
  `4000` ms (tiempos libres)
- **WHEN** se evalúa en `free_rubato`
- **THEN** `isCompleteSuccess === true`, `pitchAccuracyPercent === 100`,
  `rhythmAccuracyPercent === 100` y el feedback contiene "¡Afinación perfecta!"

#### Scenario: relative_proportional valida los ratios IOI

- **GIVEN** una melodía con duraciones `0.5`, `0.25`, `0.25` tiempos y notas tocadas a `1000`,
  `1350` y `1525` ms
- **WHEN** se evalúa en `relative_proportional` con tolerancia `20 %`
- **THEN** `isCompleteSuccess === true` y `rhythmAccuracyPercent === 100`

#### Scenario: Eventos faltantes penalizan la afinación

- **GIVEN** una melodía esperada de 3 eventos y una sola nota tocada correctamente
- **WHEN** se evalúa
- **THEN** `isCompleteSuccess === false`, `pitchAccuracyPercent === 33` y los eventos faltantes
  reportan sus `missingNotes`

#### Scenario: Acorde tríada incompleto detectado

- **GIVEN** un evento acórdico esperado `midiNotes [48, 52, 55]` y el usuario que toca solo `[48, 52]`
- **WHEN** se evalúa
- **THEN** `isPitchCorrect === false` y `missingNotes === [55]`

---

### Requirement: Control Maestro de Tempo Unificado y Metrónomo Libre

La modalidad DEBE gobernar el tempo desde un único punto (BPM de estudio) y exponerlo también como
duración de negra en milisegundos.

- `setStudyBpm(bpm)` MUST propagarse al *scheduler* (reevaluando `beatMs = round(60000 / bpm)`) y a
  la interfaz, que lo muestra como `N BPM (~Xms/negra)`.
- El *trainer* DEBE mantener un **metrónomo libre en reposo** (`toggleFreeMetronome`) que pueda
  activarse **antes** de iniciar la sesión (calentamiento/práctica libre) y detenerse de forma
  limpia, anulando el `activeBeatIndex`.
- Al iniciar una sesión, el metrónomo libre MUST detenerse (la sesión trae su propia cuadrícula) y
  al detener/resetear la sesión MUST cancelarse todos los schedulers.
- El *tick* visual (`activeBeatIndex`) MUST exponerse en la API junto a `visualBeatEnabled`, y el
  realce del pulso MUST autoextinguirse (~140 ms).
- Los *beats* por compás MUST leerse de `score.timeSignature.beats` (con piso `2`).

#### Scenario: Metrónomo libre activable en reposo y BPM en vivo

- **GIVEN** un trainer en reposo con `onPlayMetronomeTick`
- **WHEN** se invoca `toggleFreeMetronome()`
- **THEN** `isFreeMetronomeActive === true` y `onPlayMetronomeTick` se invoca
- **WHEN** se invoca `setStudyBpm(100)`
- **THEN** `studyBpm === 100` y la cuadrícula del metrónomo se actualiza
- **WHEN** se invoca `toggleFreeMetronome()`
- **THEN** `isFreeMetronomeActive === false`

#### Scenario: Iniciar la sesión detiene el metrónomo libre

- **GIVEN** un trainer con el metrónomo libre activo
- **WHEN** se invoca `startSession`
- **THEN** `isFreeMetronomeActive === false`

---

### Requirement: Captura Robusta de Entrada y Monotonía Temporal

El *trainer* DEBE proteger la línea temporal de las pulsaciones del usuario frente a falsos
simultaneos por resolución del reloj.

- Si una nota llega con `timestampMs <= ` el de la última nota registrada, el *timestamp* MUST
  reemplazarse por `ultima + 50` ms, garantizando una secuencia estrictamente creciente.
- El *buffer* de notas jugadas MUST vaciarse al evaluar, al iniciar, al detener y al resetear.
- Las notas recibidas sin sesión activa o con la rebanada vacía MUST registrarse en telemetría pero
  NO DEBEN evaluarse.
- Cada respuesta MUST generar un `DbAnswerRecord` con `reasonTelemetry` resumiendo rebanada,
  afinación y ritmo, y `semitoneDistance` derivado de la perfección de afinación.

#### Scenario: Timestamps no monótonos corregidos

- **GIVEN** una rebanada activa y una nota previa registrada en `t = 5000`
- **WHEN** llega una nueva nota con `Date.now()` que resulta `<= 5000`
- **THEN** se estampa con `timestampMs = 5050`, preservando el orden temporal

#### Scenario: Nota fuera de sesión registrada en telemetría pero no evaluada

- **GIVEN** un trainer sin sesión activa
- **WHEN** llega `handleUserNotePlayed(67)`
- **THEN** se registra el evento de telemetría de pulsación, pero `sessionHistory.length === 0`

