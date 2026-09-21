# Capability: Practice Modalities & Musical Evaluators

## Purpose

Esta capacidad define las **cuatro modalidades de entrenamiento auditivo y motor** que se montan sobre el micro-kernel genérico definido en `02-trainer-core-engine`. Cada modalidad es un _plug-in_ que inyecta su propia semántica de estímulo, captura y evaluación, manteniendo el kernel libre de conocimiento musical.

El patrón es el de **cuatro modelos de dominio desacoplados sobre un mismo kernel**: la generación del estímulo y la evaluación viven en `domain/music/*` y `domain/exercise/*Evaluator.ts` (funciones puras, deterministas, testeables sin React), mientras que el _hook_ orquestador solo cablea estado, temporizadores y callbacks.

| Modalidad            | Hook orquestador                | Evaluador                                | Dominio musical                                         | `TResult` / `targetMode`                  |
| -------------------- | ------------------------------- | ---------------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| 01 · Nota Individual | `hooks/useSingleNoteTrainer.ts` | `domain/exercise/evaluator.ts`           | `music/{presets,tonalContext,instruments,noteUtils}.ts` | `ExerciseResult` / `single_note`          |
| 02 · Intervalos      | `hooks/useIntervalTrainer.ts`   | `domain/exercise/intervalEvaluator.ts`   | `music/intervals.ts`                                    | `IntervalExerciseResult` / `intervals`    |
| 03 · Secuencias      | `hooks/useSequenceTrainer.ts`   | `domain/exercise/sequenceEvaluator.ts`   | `music/sequences.ts`                                    | `SequenceExerciseResult` / `sequences`    |
| 04 · Repertorio      | `hooks/useRepertoireTrainer.ts` | `domain/exercise/repertoireEvaluator.ts` | `music/{scoreParser,scoreTypes}.ts`                     | `RepertoireExerciseResult` / `repertoire` |

**Documentación fundacional de la Modalidad 04:** `REPERTOIRE_LEARNING_V2_SPEC.md` (_Audiomotor Repertoire Chaining Engine_ v2.0).

**Alcance (in-scope):** generación y evaluación específica de cada modalidad; presets y rangos; anclaje tonal; modos de evaluación rítmica; encadenamiento; _streaks_ de retención; fusión polifónica; _clustering_ de acordes; resolución gestáltica; y metadatos de persistencia propios.

**Fuera de alcance (out-of-scope):** máquina de estados genérica (Módulo 02); infraestructura MIDI/audio (Módulo 01); analítica y prescripciones de IA.

## Requirements

### Requirement: Contrato Común de las Cuatro Modalidades

Cada modalidad MUST (DEBE) instanciarse como `useTrainerCore<TPropio>` e inyectar su constructor de registro de sesión; el kernel trata `TPropio` como opaco.

- El identificador de cada respuesta (`DbAnswerRecord.id`) MUST generarse con `crypto.randomUUID()` y prefijarse por modalidad: `ans_`, `ans_int_`, `ans_seq_`, `ans_rep_`.
- Toda pulsación del usuario MUST etiquetarse con `inputSource: 'midi_hardware' | 'virtual_ui'` y estamparse en el registro de respuesta.
- El `DbSessionRecord` resultante MUST llevar el `targetMode` canónico (`'single_note' | 'intervals' | 'sequences' | 'repertoire'`) y los identificadores fijos:
  - 01: `strategyId = adaptive_v1` (o seleccionada) / `instrumentId` elegido.
  - 02: `strategyId = intervals_v1` / `instrumentId = piano_intervals`.
  - 03: `strategyId = sequences_v1` / `instrumentId = piano_sequences`.
  - 04: `strategyId = repertoire_audiomotor_v1` / `instrumentId = piano_repertoire`.
- La noción de "acierto" difiere por modalidad y MUST reflejarse en el registro: en 01 es `result.correct`; en 02 `isIntervalCorrect`; en 03 `isExactMatch`; en 04 `isCompleteSuccess`.
- Las cuatro modalidades DEBEN exponer `trainWeak*Only()` y `repeatCurrent*()`.

#### Scenario: Persistencia con metadatos de modalidad

- **GIVEN** un trainer de repertorio con una sesión activa y al menos una respuesta evaluada
- **WHEN** la sesión finaliza
- **THEN** el `DbSessionRecord` persistido lleva `targetMode === 'repertoire'`, `strategyId === 'repertoire_audiomotor_v1'` e `instrumentId === 'piano_repertoire'`

#### Scenario: Entrada virtual de UI tratada como ciudadana de primera clase

- **GIVEN** cualquier modalidad con sesión activa y estímulo vigente
- **WHEN** el usuario pulsa una tecla del teclado virtual (`source = 'virtual_ui'`)
- **THEN** la nota se evalúa idénticamente a una nota de hardware MIDI y el registro lleva `inputSource === 'virtual_ui'`

### Requirement: Reconocimiento de Altura Absoluta y Rango Instrumental (Modalidad 01)

La modalidad MUST (DEBE) entrenar el reconocimiento de altura absoluta sobre el rango físico del piano de 3 octavas, acotado por `DEFAULT_PIANO_BOUNDS = { minMidiNote: 48 (C3), maxMidiNote: 84 (C6) }`.

- La generación MUST usar `generateValidSingleNote(activeNotes, lastNote)`, que aplica anti-repetición del estímulo anterior solo cuando el pool tiene `length >= 3`.
- Con un pool de una sola nota, la generación MUST devolver siempre esa nota; con un pool vacío MUST lanzar error.
- La evaluación MUST delegar a `evaluateSingleNoteAnswer`, que aplica `checkNoteMatch`, `calculateNormalizedDistance` y `sanitizeResponseTime`.
- El pool activo por defecto MUST ser `[60, 62, 64, 65, 67, 69, 71, 72]` y `startSession` MUST NOT iniciar si el pool resultante tiene menos de 2 notas.
- La selección de la siguiente nota MUST delegarse a la estrategia adaptativa (`strategy.selectNextNote`).

#### Scenario: Estímulo siempre dentro del pool activo

- **GIVEN** un trainer con sesión iniciada sobre el pool `[62, 64, 65]`
- **WHEN** se lee el estímulo emitido por `onPlayStimulus`
- **THEN** la nota pertenece exactamente a `[62, 64, 65]`, `currentQuestionIndex === 1` e `isWaitingAnswer === true`

#### Scenario: Respuesta correcta registrada con semitonos y tiempo

- **GIVEN** un trainer con estímulo vigente igual a `60`
- **WHEN** llega `handleUserNotePlayed(60)`
- **THEN** `lastResult.correct === true`, `lastResult.semitoneDistance === 0`, `sessionHistory.length === 1` e `isWaitingAnswer === false`

#### Scenario: Anti-repetición en pools grandes

- **GIVEN** un trainer con pool `[60, 62, 64]` y último estímulo `60`
- **WHEN** se genera el siguiente estímulo
- **THEN** la nota seleccionada es distinta de `60`

### Requirement: Presets Armónicos y Resolución de Nombre Canónico (Modalidad 01)

El dominio MUST (DEBE) ofrecer `EXERCISE_PRESETS` y resolución automática del nombre canónico del pool activo, usado como metadato de la sesión persistida.

- `resolveNotePresetName(notes)` MUST ordenar el pool y compararlo contra cada preset formal (`level_1_c_d_e`, `level_2_c_to_g`, `level_3_octave_diatonic`, `level_4_octave_chromatic`, `pentatonic_c_major`, `range_g4_g5`), devolviendo el `name` canónico correspondiente.
- Un pool que no coincida con ningún preset MUST devolver `Notas Personalizadas (N)`; un pool vacío MUST devolver `Notas Personalizadas (0)`.
- El `presetName` del registro MUST componerse como `` `${contentName} • ${formatTag}` ``.

#### Scenario: Resolución canónica de un preset formal

- **GIVEN** un pool activo `[60, 62, 64]`
- **WHEN** la sesión finaliza y se construye el registro
- **THEN** `presetName` contiene `Nivel 1 (C, D, E)` y la etiqueta `Bloque N preguntas`

#### Scenario: Pool personalizado sin preset

- **GIVEN** un pool activo `[61, 63, 66]`
- **WHEN** se resuelve el nombre canónico
- **THEN** devuelve `Notas Personalizadas (3)`

### Requirement: Anclaje Tonal y Pre-roll (Modalidad 01)

La modalidad MUST (DEBE) soportar cuatro modos de anclaje tonal (`'none' | 'tonic' | 'drone' | 'cadence'`) que emiten una referencia acústica antes del primer estímulo.

- Con `mode !== 'none'`, `startSession` MUST invocar `onPlayTonalContext(mode, rootNote)` y MUST desplazar el primer estímulo mediante un pre-roll de duración `getTotalContextDurationMs(mode, rootNote)`.
- Con `mode === 'none'`, el primer estímulo MUST dispararse inmediatamente.
- El pre-roll MUST poder cancelarse limpiamente en `stopSession`, `resetToConfig` y al desmontar.
- Las duraciones totales de pre-roll MUST ser: `cadence` = 2840 ms, `tonic` = 1800 ms, `drone` = 2200 ms.
- La cadencia MUST garantizar ≥ 1000 ms de asentamiento acústico antes del primer estímulo.

#### Scenario: Cadencia retarda el primer estímulo

- **GIVEN** un trainer con `tonalContextMode = 'cadence'` y pool `[62, 64, 66]`
- **WHEN** se invoca `startSession`
- **THEN** `onPlayTonalContext` se invoca exactamente una vez con `('cadence', 62)` y `onPlayStimulus` aún no se ha invocado
- **WHEN** avanzan 3500 ms de reloj virtual
- **THEN** `onPlayStimulus` se ha invocado exactamente una vez

#### Scenario: Detener la sesión anula el pre-roll pendiente

- **GIVEN** un trainer con cadencia programada y sesión recién iniciada
- **WHEN** se invoca `stopSession` y avanzan 5000 ms
- **THEN** `onPlayStimulus` nunca se invoca y `isSessionFinished === true`

### Requirement: Modo Maestría y Entrenamiento de Debilidades (Modalidad 01)

La modalidad 01 MUST (DEBE) proveer un predicado de maestría (`checkIsMasteryCompleted`) y reentrenamiento selectivo de notas débiles.

- `checkIsMasteryCompleted(history)` MUST considerar completa la maestría cuando todas las notas del pool activo cumplan `perf.attempts >= 2` y `perf.accuracyPercentage >= 85`.
- `trainWeakNotesOnly()` MUST aislar las notas con `attempts > 0` y `accuracyPercentage < 85`.
- Si solo existe una nota débil, MUST compensarse con un compañero a ±2 semitonos para preservar el mínimo de 2 notas.
- La re-escucha del estímulo (`repeatCurrentNote`) MUST contabilizarse en la telemetría de escuchas.

#### Scenario: Maestría no completada con intentos insuficientes

- **GIVEN** un pool `[60, 62]` donde la nota `60` acumula 2 intentos al 100% y la `62` solo 1
- **WHEN** se evalúa `checkIsMasteryCompleted`
- **THEN** devuelve `false`

#### Scenario: Reentrenamiento aísla notas falladas

- **GIVEN** un trainer cuyo historial registra fallos sobre la nota `60`
- **WHEN** se invoca `trainWeakNotesOnly()`
- **THEN** la nueva sesión se inicia con un pool que contiene la nota débil y `isSessionActive === true`

### Requirement: Cambio de Timbres General MIDI (Modalidad 01)

La modalidad MUST (DEBE) permitir cambiar el timbre de síntesis mediante Program Change de General MIDI.

- El catálogo `INSTRUMENT_CATALOG` MUST contener: `acoustic_grand_piano` (GM 0), `flute` (GM 73), `violin` (GM 40), `clarinet` (GM 71) y `acoustic_bass` (GM 32).
- `setSelectedInstrumentId(id)` MUST notificar el program number al sintetizador mediante `onInstrumentChanged(programNumber)`.
- El instrumento seleccionado MUST estamparse en el registro de sesión (`instrumentId`).

#### Scenario: Cambio de instrumento notifica el program change correcto

- **GIVEN** un trainer con instrumento por defecto (piano, program 0)
- **WHEN** se invoca `setSelectedInstrumentId('flute')`
- **THEN** `selectedInstrument.id === 'flute'` y `onInstrumentChanged` se invocó con 73

### Requirement: Catálogo de 13 Clases de Intervalos y Direcciones (Modalidad 02)

El dominio MUST (DEBE) definir exactamente 13 clases de intervalos (semitonos 0 a 12) con dirección de estímulo configurable.

- `INTERVAL_DEFINITIONS` MUST cubrir los semitonos 0..12 con `shortName`, `fullName`, `anchorSong` e `inversionName`.
- La dirección del estímulo (`DirectionSelection`) MUST ser `'ascending' | 'descending' | 'both'`.
- La generación MUST usar `generateValidInterval`, que garantiza que ninguna nota se salga de `DEFAULT_PIANO_BOUNDS` (48–84) mediante autocorrección de dirección y clamping.
- La generación MUST aplicar anti-repetición del intervalo anterior solo cuando `allowedSemitones.length >= 3`.

#### Scenario: Intervalo acotado dentro del rango físico

- **GIVEN** un trainer configurado con intervalo de 4 semitonos y raíz fija 60
- **WHEN** se inicia la sesión
- **THEN** `onPlayInterval` se invoca con `root === 60` y `target === 64`

#### Scenario: Corrección automática de dirección por desborde

- **GIVEN** `generateValidInterval` con semitono 12, raíz 84 y dirección `ascending`
- **WHEN** se genera el intervalo
- **THEN** la dirección se invierte a `descending` y el target permanece dentro de `[48, 84]`

### Requirement: Flujo de Respuesta en 2 Pasos (Modalidad 02)

La captura de la respuesta MUST (DEBE) seguir un protocolo de dos pasos, expuesto en `waitingNoteStep: 1 | 2` y `firstNotePlayed: number | null`.

- En el paso 1, la primera nota del usuario MUST registrarse en `firstNotePlayed` y pasar a `waitingNoteStep = 2`, sin evaluar respuesta.
- En el paso 2, el par `[first, second]` MUST evaluarse con `evaluateIntervalAnswer`, reseteando el paso a 1 y `firstNotePlayed = null`.
- Una nota recibida sin sesión activa MUST descartarse silenciosamente.

#### Scenario: Primera nota fijada sin evaluación

- **GIVEN** un trainer con estímulo vigente y `waitingNoteStep === 1`
- **WHEN** llega `handleUserNotePlayed(60)`
- **THEN** `waitingNoteStep === 2`, `firstNotePlayed === 60` y `lastResult === null`

#### Scenario: Segunda nota dispara la evaluación

- **GIVEN** el mismo estímulo con `waitingNoteStep === 2` y `firstNotePlayed === 60`
- **WHEN** llega `handleUserNotePlayed(64)`
- **THEN** `waitingNoteStep === 1`, `firstNotePlayed === null`, `lastResult !== null` y `sessionHistory.length === 1`

### Requirement: Evaluador Desacoplado de Intervalos (Modalidad 02)

`evaluateIntervalAnswer` MUST (DEBE) separar la corrección del intervalo (oído) de la corrección del transporte (ejecución motora).

- `isIntervalCorrect` MUST exigir `playedSemitones === stimulus.semitones` y `playedDirection === stimulus.direction`.
- `isRootCorrect` MUST exigir `playedRoot === stimulus.rootNote` (coincidencia motora exacta).
- `isExactMatch = isIntervalCorrect && isRootCorrect`; `isTransposedCorrect = isIntervalCorrect && !isRootCorrect`.
- `semitoneDistanceError` MUST ser `playedSemitones - stimulus.semitones`.

#### Scenario: Coincidencia exacta

- **GIVEN** el estímulo `{ rootNote: 60, targetNote: 64, semitones: 4, direction: 'ascending' }`
- **WHEN** se evalúa el par `[60, 64]`
- **THEN** `isExactMatch === true`, `isIntervalCorrect === true`, `isRootCorrect === true` y `isTransposedCorrect === false`

#### Scenario: Intervalo correcto transportado

- **GIVEN** el mismo estímulo de tercera mayor
- **WHEN** se evalúa el par `[62, 66]` (D4 → F#4)
- **THEN** `isIntervalCorrect === true`, `isRootCorrect === false`, `isExactMatch === false` y `isTransposedCorrect === true`

### Requirement: Mnemotecnia Pedagógica con Canciones Ancla (Modalidad 02)

Cada clase de intervalo MUST (DEBE) llevar una canción-ancla pedagógica (`anchorSong`) utilizada en el feedback de error.

- El feedback de error MUST citar el `anchorSong` del intervalo esperado.
- El acierto exacto MUST felicitar citando el `fullName` y `shortName` esperados.
- El transporte correcto MUST distinguirse verbalmente del acierto exacto.

#### Scenario: Feedback de error incluye la canción ancla

- **GIVEN** un estímulo de quinta justa (7 semitonos, ancla "Star Wars / Estrellita Dónde Estás")
- **WHEN** el usuario responde con un intervalo de clase distinta
- **THEN** `feedbackMessage` contiene el `shortName` tocado, el `fullName` esperado y el `anchorSong` esperado

### Requirement: Generación de Secuencias y Control de Saltos (Modalidad 03)

La modalidad MUST (DEBE) generar dictados melódicos de longitud configurable, respetando saltos máximos y repetición consecutiva.

- La longitud MUST acotarse al rango [3, 6] notas mediante `generateValidSequence`.
- `generateMelodicSequence` MUST filtrar los candidatos por `|note - currentNote| <= maxJumpSemitones` y por `allowRepeatedConsecutive`.
- La captura MUST acumular `capturedNotes` y evaluar solo cuando se alcanza la longitud de la secuencia esperada.

#### Scenario: Secuencia generada con salto controlado

- **GIVEN** el preset `level_2_0_diatonic_stepwise` (pool C4–G4, `maxJumpSemitones = 2`, `allowRepeatedConsecutive = false`)
- **WHEN** se genera una secuencia de 3 notas
- **THEN** cada salto entre notas consecutivas es `<= 2` semitonos y no hay notas repetidas consecutivas

#### Scenario: Captura progresiva hasta completar la longitud

- **GIVEN** un trainer con secuencia esperada de longitud 3
- **WHEN** se reciben 2 notas del usuario
- **THEN** `capturedNotes.length === 2` y `lastResult === null`
- **WHEN** llega la tercera nota
- **THEN** `lastResult !== null` y `sessionHistory.length === 1`

### Requirement: Evaluación en 3 Capas de Secuencias (Modalidad 03)

`evaluateSequenceAnswer` MUST (DEBE) producir tres capas de diagnóstico complementarias.

- **Capa 1 (Nota a nota):** `noteByNoteEvaluation` usa `checkNoteMatch` por índice; expone `exactMatchesCount` e `isExactMatch`.
- **Capa 2 (Contorno melódico):** `expectedContour` vs `playedContour` como arrays de `'up' | 'down' | 'same'`; expone `isContourCorrect`.
- **Capa 3 (Distancia de edición):** `levenshteinDistance` y `similarityScorePercentage = max(0, round(((maxLen - distance) / maxLen) * 100))`.
- La persistencia MUST usar `isExactMatch` como acierto y el promedio de `similarityScorePercentage` como `accuracyPercentage`.

#### Scenario: Coincidencia exacta al 100%

- **GIVEN** la secuencia esperada `[60, 64, 67, 72]`
- **WHEN** se juega `[60, 64, 67, 72]`
- **THEN** `isExactMatch === true`, `exactMatchesCount === 4`, `isContourCorrect === true` y `similarityScorePercentage === 100`

#### Scenario: Contorno correcto pese a transporte

- **GIVEN** la secuencia esperada `[60, 64, 67]` (contorno `['up', 'up']`)
- **WHEN** se juega `[62, 65, 69]`
- **THEN** `isExactMatch === false`, `isContourCorrect === true` y el feedback menciona "contorno"

### Requirement: Parser Nativo de MusicXML 4.0 (Modalidad 04)

`parseMusicXml` MUST (DEBE) producir el modelo canónico `ScoreDataModel` desde MusicXML exportado por MuseScore Studio 4.

- El parser MUST rechazar contenido vacío y detectar errores de sintaxis XML lanzando una excepción con "Error de sintaxis".
- `pitchToMidiNote(step, alter, octave)` MUST computar `(octave + 1) * 12 + offset + alter` clampeado a `[0, 127]`.
- El parser MUST soportar: `<divisions>`, `<backup>` / `<forward>`, `<chord/>` (sin avanzar cursor), `<harmony>` (cifrado armónico), `<fingering>` y `<rest/>`.
- La mano MUST derivarse del `staff` (`1 → 'RH'`, `2 → 'LH'`).
- La duración acústica MUST precomputarse como `durationMs = round(durationBeats * (60000 / baseBpm))`.
- El parser MUST reconocer las **ligaduras de prolongación** declaradas como `<tie type="start|stop"/>` (hijo directo de `<note>`, forma canónica de MuseScore Studio 4) y, por compatibilidad con exportadores alternativos, `<tied type="start|stop"/>` bajo `<notations>`.
- Una nota con `<tie type="stop"/>` (o `<tied type="stop"/>`) MUST consolidarse con el evento que abrió la ligadura **solo si** coincide con él en pitch (número MIDI, `alter` y `octava`), `staff` y `voice`; en ese caso MUST acumular sus `durationDivisions`, `durationBeats` y `durationMs` sobre ese evento preexistente y MUST **no** crear un nuevo `ScorePlaybackEvent`, avanzando el cursor temporal como si la nota se hubiera emitido.
- El evento resultante de una consolidación MUST llevar `isTied === true` como bandera de trazabilidad visual; `isTied` es opcional y, cuando está ausente o es `false`, no altera la evaluación.
- El evento ancla de cada voz MUST persistir a través de la frontera entre compases (es lo que permite consolidar ligaduras entre compases contiguos) y MUST nulificarse únicamente ante `<backup>` o `<forward>`, que son los cortes reales de continuidad temporal.
- Si la nota de continuación **no** cumple la condición de coincidencia (pitch, `staff` o `voice` distintos), o si no existe un evento ancla memorable en la misma voz (`stop` huérfano, o uno tras un `<backup>`/`<forward>`), la nota MUST emitirse como evento independiente con su propia duración, sin descartarse.
- Un `<tie type="start"/>` MUST simplemente marcar el evento en curso como el origen de una ligadura pendiente; no MUST por sí mismo fusionar nada ni alterar la duración.

#### Scenario: Conversión de altura y duración

- **GIVEN** un `<note>` con `<pitch><step>C</step><octave>4</octave></pitch>`, `<duration>2</duration>` y `divisions = 4`
- **WHEN** se parsea el fragmento
- **THEN** el evento resultante tiene `midiNotes = [60]`, `durationBeats = 0.5` y `beatPosition = 1.0`

#### Scenario: `<backup>` alinea ambas manos en el mismo tiempo

- **GIVEN** un compás cuya voz aguda avanza 2 divisiones y luego aparece `<backup><duration>2</duration></backup>`
- **WHEN** se parsea
- **THEN** el evento grave resultante comparte `beatPosition` con el evento agudo inicial

#### Scenario: Ligadura entre compases consolida la duración en un único evento

- **GIVEN** un score a `divisions = 4` y `baseBpm = 120` donde el compás 1 termina con `<note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><staff>1</staff><tie type="start"/></note>` y el compás 2 empieza con `<note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><staff>1</staff><tie type="stop"/></note>`
- **WHEN** se parsea el score
- **THEN** `model.events` contiene exactamente **un** evento para esa altura con `durationDivisions === 3`, `durationBeats === 0.75`, `durationMs === 375` e `isTied === true`
- **AND** no existe ningún segundo evento con `midiNotes === [67]` en el compás 2
- **AND** la nota siguiente del compás 2 conserva su `beatPosition` desplazada por la duración acumulada, demostrando que el cursor temporal sí avanzó

#### Scenario: La consolidación exige coincidencia de pitch, staff y voice

- **GIVEN** un score cuyo `<tie type="stop"/>` recae sobre una altura, `staff` o `voice` distinta a la del evento que abrió la ligadura
- **WHEN** se parsea
- **THEN** se emiten dos `ScorePlaybackEvent` independientes, cada uno con su propia duración original
- **AND** ninguno de los dos eventos lleva `isTied === true`

#### Scenario: `stop` huérfano no consolida nada

- **GIVEN** un score cuyo primer elemento `<note>` lleva `<tie type="stop"/>` sin ningún `<tie type="start"/>` previo en su voz
- **WHEN** se parsea
- **THEN** esa nota se emite como un evento independiente con su duración original y `isTied` ausente o `false`

#### Scenario: `<tied>` bajo `<notations>` consolida igual que `<tie>`

- **GIVEN** un score exportado por un exportador alternativo que declara la ligadura como `<notations><tied type="start"/></notations>` y `<notations><tied type="stop"/></notations>` sobre dos notas de igual pitch, `staff` y `voice`
- **WHEN** se parsea
- **THEN** el resultado es un único evento consolidado con `isTied === true` y la duración sumada de ambas notas

### Requirement: Selección de Manos y Fusión Polifónica (Modalidad 04)

La modalidad MUST (DEBE) soportar `HandSelection = 'RH' | 'LH' | 'both'`, fusionando los eventos simultáneos de ambas manos cuando se seleccionan ambas.

- El filtrado de eventos MUST excluir silencios (`isRest`) y eventos sin `midiNotes`.
- Con `hand === 'both'`, `fuseConcurrentEvents` MUST agrupar por clave `${measureNumber}_${beatPosition}`, fusionando `midiNotes` sin duplicar pitch, ordenando ascendentemente, marcando `isChord = true` si `midiNotes.length > 1` y `hand = 'both'`.
- Con `hand === 'RH'` o `'LH'`, los eventos MUST permanecer sin fusionar.

#### Scenario: Fusión polifónica de manos en un acorde vertical

- **GIVEN** un score con un evento RH (`midiNotes [67]`) y un evento LH (`midiNotes [48]`) en el mismo compás y beatPosition 1.0
- **WHEN** se computa la rebanada con `hand = 'both'`
- **THEN** resulta exactamente un evento, `isChord === true` y `midiNotes === [48, 67]`

### Requirement: Resolución Gestáltica Universal +1 Res (Modalidad 04)

La modalidad MUST (DEBE) incluir estrictamente el primer evento jugable del compás siguiente a la rebanada en estudio, completando el gesto motor hacia el reposo.

- La inclusión MUST condicionarse a `includeResolution === true` y `endM < score.totalMeasures`.
- MUST tomarse exactamente el primer evento jugable (`fusedNext[0]`) del compás `endM + 1` y agregarse al final de la rebanada si no está presente.
- El usuario MUST poder desactivar la resolución (`includeResolutionNote: false`).

#### Scenario: Nota de resolución añadida desde el compás siguiente

- **GIVEN** un score de 8 compases con la rebanada en compases 1 a 4 y el primer evento jugable del compás 5 en `midiNotes [69]`
- **WHEN** se computa la rebanada con `includeResolutionNote = true`
- **THEN** el último evento de la rebanada es el evento `[69]` del compás 5

### Requirement: Encadenamiento Progresivo y Streaks (Modalidad 04)

La modalidad MUST (DEBE) implementar encadenamiento incremental con streaks de retención que desbloquean nuevos eventos.

- La dirección MUST ser `'forward' | 'backward'`; `activeSliceLength` arranca en 1.
- Al alcanzar el streak fijado (`streakTarget`, 1x a 10x), la longitud MUST expandirse en +1 evento y el contador resetearse a 0.
- Ante cualquier fallo, el streak MUST resetearse a 0 inmediatamente.
- Cuando la rebanada dominada cubra `totalScopeLength` y se cumpla el streak, la sesión MUST finalizar automáticamente y persistirse con `targetMode: 'repertoire'`.
- Con `autoSpeedRamp: true`, cada expansión MUST incrementar el BPM en +5, topando en `baseBpm`.

#### Scenario: Streak alcanzado expande la rebanada

- **GIVEN** un trainer con `streakTarget = 1`, `activeSliceLength = 1` y `totalScopeLength > 1`
- **WHEN** el usuario acierta la rebanada de un evento
- **THEN** `currentStreak === 0` y `activeSliceLength === 2`

#### Scenario: Fragmento completo dominado finaliza y persiste

- **GIVEN** un trainer cuya rebanada dominada ya cubre `totalScopeLength` con `streakTarget = 1`
- **WHEN** el usuario completa la rebanada con éxito
- **THEN** `isSessionFinished === true` y `saveSession` se invoca con `targetMode === 'repertoire'`

### Requirement: Agrupamiento de Clúster de Acordes a 45 ms (Modalidad 04)

El evaluador MUST (DEBE) distinguir pulsaciones simultáneas (acordes) de notas melódicas repetidas.

- `clusterPlayedMidiNotes` MUST ordenar las notas por `timestampMs` y agrupar en un mismo clúster las que disten `<= chordClusterWindowMs` (45 ms) y sean teclas distintas.
- La misma tecla repetida (ej. G4 y luego G4) NUNCA MUST fusionarse como acorde: se trata siempre como notas melódicas secuenciales.
- La evaluación de la rebanada MUST dispararse cuando el número de notas crudas alcance la suma de `midiNotes` esperadas.

#### Scenario: Acorde polifónico agrupado

- **GIVEN** las notas crudas `{48, t=1000}` y `{52, t=1012}`
- **WHEN** se agrupan con ventana 45 ms
- **THEN** resulta un clúster con `notes === [48, 52]` y `timestampMs === 1000`

#### Scenario: Tecla repetida nunca se fusiona

- **GIVEN** las notas crudas `{67, t=1000}` y `{67, t=1015}` (misma tecla, dentro de la ventana)
- **WHEN** se agrupan con ventana 45 ms
- **THEN** resultan dos clústeres, cada uno con una sola nota `67`

### Requirement: Modos de Evaluación Rítmica y Tolerancia (Modalidad 04)

El evaluador MUST (DEBE) soportar `RhythmEvaluationMode = 'free_rubato' | 'relative_proportional' | 'strict_metronome'`, adaptando los tiempos esperados al BPM de estudio activo.

- **`free_rubato`**: evalúa solo altura; `isRhythmCorrect` siempre es `true`.
- **`relative_proportional`**: compara el IOI real contra el esperado; la desviación es correcta si `<= rhythmTolerancePercent`.
- **`strict_metronome`**: compara el offset absoluto contra la cuadrícula acumulada.
- En ambos modos rítmicos, el primer evento MUST considerarse rítmicamente correcto.
- `overallScorePercent = round(pitchAccuracyPercent * 0.7 + rhythmAccuracyPercent * 0.3)`.
- `isCompleteSuccess = (pitchAccuracyPercent === 100) && (rhythmMode === 'free_rubato' || rhythmAccuracyPercent === 100)`.

**Distancia métrica como fuente de los tiempos esperados:** en `relative_proportional` y `strict_metronome`, los tiempos esperados MUST (DEBEN) derivarse de la **distancia métrica real entre eventos sonoros sucesivos en la línea temporal de la partitura**, y NO de la duración del evento previo aislado:

- `RepertoireEvaluationConfig` MUST aceptar `beatsPerMeasure` (con piso `2` y default `2`), leído de `score.timeSignature.beats` por el hook orquestador.
- La distancia métrica en tiempos entre dos eventos sonorios consecutivos `a` (previo) y `b` (actual) MUST calcularse como `(b.measureNumber - a.measureNumber) * beatsPerMeasure + (b.beatPosition - a.beatPosition)`, soportando explícitamente el cruce de fronteras de compás (p. ej. la nota de resolución del compás siguiente).
- El IOI esperado en `relative_proportional` MUST ser `round(distanciaMétrica * beatDurationMs)`; el offset absoluto esperado en `strict_metronome` MUST ser la suma acumulada de los IOI esperados de los eventos precedentes.
- Como consecuencia, los silencios existentes entre dos notas MUST quedar implícitamente incluidos en el tiempo esperado, pues la distancia métrica refleja la posición real de cada evento en la partitura.

**Salvaguardas aritméticas y motor humano:**

- Un evento cuyo IOI esperado sea `<= 0` (eventos que comparten posición métrica, p. ej. notas de adorno/gracia fusionadas con su nota principal, o `durationBeats <= 0`) MUST (DEBE) tratarse como **evento de altura pura**: `isRhythmCorrect = true`, `timeDeviationMs = 0` y `timeDeviationPercent = 0`, sin penalización rítmica. En ningún caso el resultado MAY contener `NaN` ni `Infinity`.
- El IOI esperado efectivo MUST tener un **piso de 60 ms** (`MIN_EXPECTED_IOI_MS`): cuando la distancia métrica sea positiva pero produzca un valor menor, MUST usarse 60 ms, de modo que las notas hiper‑cortas no exijan tolerancias de jitter inalcanzables para la motricidad humana.
- Los eventos exentos (IOI `<= 0`) MUST seguir contabilizándose en el total de eventos y MUST evaluarse en altura; la exención es únicamente rítmica.

#### Scenario: free_rubato ignora el tiempo y premia la afinación

- **GIVEN** una melodía esperada de 3 eventos y las notas correctas tocadas con tiempos libres
- **WHEN** se evalúa en `free_rubato`
- **THEN** `isCompleteSuccess === true`, `pitchAccuracyPercent === 100` y `rhythmAccuracyPercent === 100`

#### Scenario: relative_proportional valida los ratios IOI

- **GIVEN** una melodía con duraciones 0.5, 0.25, 0.25 tiempos y notas tocadas a 1000, 1350 y 1525 ms
- **WHEN** se evalúa en `relative_proportional` con tolerancia 20%
- **THEN** `isCompleteSuccess === true` y `rhythmAccuracyPercent === 100`
- **AND** los IOI esperados coinciden con los que produce la distancia métrica entre eventos consecutivos del mismo compás

#### Scenario: Los silencios intermedios se incorporan al IOI esperado

- **GIVEN** una secuencia en 2/4 de tres eventos sonoros en `beatPosition` 1.0, 1.5 y 1.0 (del compás siguiente), separados por un silencio de negra entre el segundo y el tercero, a 86 BPM (`beatDurationMs ≈ 698 ms`)
- **AND** el evento del compás siguiente es la nota de resolución incluida por la regla +1 Res
- **WHEN** se evalúa en `relative_proportional` con los eventos tocados exactamente a tiempo
- **THEN** `rhythmAccuracyPercent === 100` e `isCompleteSuccess === true`
- **AND** el IOI esperado entre el segundo y el tercer evento refleja la distancia métrica completa (frontera de compás incluida), no la duración aislada del segundo evento

#### Scenario: Nota de adorno con duración 0 no genera NaN ni Infinity

- **GIVEN** una secuencia con dos eventos que comparten `measureNumber` y `beatPosition` (nota de adorno/gracia con `durationBeats === 0`)
- **WHEN** se evalúa en `relative_proportional`
- **THEN** ningún `timeDeviationPercent` del resultado es `NaN` ni `Infinity`
- **AND** el evento de adorno tiene `isRhythmCorrect === true` y `timeDeviationMs === 0`
- **AND** el evento sigue contabilizándose en el total de eventos y evaluándose en altura

#### Scenario: Piso de 60 ms para IOI esperados hiper‑cortos

- **GIVEN** una secuencia en la que dos eventos sonoros consecutivos distan 0.1 tiempos (semicorchea en división rápida) a un BPM alto
- **WHEN** se evalúa en `relative_proportional`
- **THEN** el IOI esperado usado en el cálculo de tolerancia es `>= 60 ms`, aunque la distancia métrica cruda produzca un valor menor

### Requirement: Control Maestro de Tempo y Metrónomo Libre (Modalidad 04)

La modalidad MUST (DEBE) gobernar el tempo desde un único punto (BPM de estudio) y exponerlo también como duración de negra en milisegundos.

- `setStudyBpm(bpm)` MUST propagarse al scheduler y a la interfaz (`N BPM (~Xms/negra)`).
- El trainer MUST mantener un metrónomo libre en reposo (`toggleFreeMetronome`) activable antes de iniciar la sesión.
- Al iniciar una sesión, el metrónomo libre MUST detenerse.
- Los beats por compás MUST leerse de `score.timeSignature.beats` (con piso 2).

#### Scenario: Metrónomo libre activable en reposo y BPM en vivo

- **GIVEN** un trainer en reposo con `onPlayMetronomeTick`
- **WHEN** se invoca `toggleFreeMetronome()`
- **THEN** `isFreeMetronomeActive === true` y `onPlayMetronomeTick` se invoca
- **WHEN** se invoca `toggleFreeMetronome()` de nuevo
- **THEN** `isFreeMetronomeActive === false`

### Requirement: Captura Robusta de Entrada y Monotonía Temporal (Modalidad 04)

El trainer MUST (DEBE) proteger la línea temporal de las pulsaciones del usuario frente a falsos simultáneos por resolución del reloj.

- Si una nota llega con `timestampMs <=` el de la última nota registrada, el timestamp MUST reemplazarse por `ultima + 50` ms, garantizando una secuencia estrictamente creciente.
- El buffer de notas jugadas MUST vaciarse al evaluar, al iniciar, al detener y al resetear.
- Las notas recibidas sin sesión activa MUST registrarse en telemetría pero MUST NOT evaluarse.

#### Scenario: Timestamps no monótonos corregidos

- **GIVEN** una rebanada activa y una nota previa registrada en `t = 5000`
- **WHEN** llega una nueva nota con `Date.now()` que resulta `<= 5000`
- **THEN** se estampa con `timestampMs = 5050`, preservando el orden temporal

#### Scenario: Nota fuera de sesión registrada en telemetría pero no evaluada

- **GIVEN** un trainer sin sesión activa
- **WHEN** llega `handleUserNotePlayed(67)`
- **THEN** se registra el evento de telemetría de pulsación, pero `sessionHistory.length === 0`
