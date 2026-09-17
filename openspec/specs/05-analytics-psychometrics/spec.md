# Capability: Psychoacoustic Analytics & Psychometrics Engine

## Propósito y Alcance

Esta capacidad define el **motor de modelado psicométrico científico** del desempeño auditivo del
alumno en `midi-laboratory`. No se limita a contar aciertos: aplica teoría psicométrica formal
(Teoría de Respuesta al Ítem, entropía de Shannon, cronometría cognitiva) y telemetría
metacognitiva para construir una representación rigurosa y comparable de la habilidad del oído,
independiente del tamaño del pool, el instrumento o la modalidad practicada.

La capacidad es un **pipeline de dominio puro**: las funciones de `historyAnalytics.ts` reciben
registros de base de datos inmutables (`DbSessionRecord` / `DbAnswerRecord`) y devuelven modelos
analíticos derivados, sin acoplarse a React. La capa de presentación (pestañas y modales de
analítica) consume estos modelos; el store Zustand `useAnalyticsStore` cachea y recalcula los
agregados al cambiar el filtro de modalidad.

| Frente | Unidad canónica | Responsabilidad |
| --- | --- | --- |
| Umbrales SSOT | `domain/analytics/historyAnalytics.ts` (constantes) | Latencia cognitiva y maestría; fuente única de toda la app |
| Psicometría | `historyAnalytics.ts` → `computeAnalyticsMetrics`, `calculateSessionCPI` | Azar (IRT), entropía, normalización, CPI compuesto |
| Telemetría | `historyAnalytics.ts` → `analyzeSessionTimeline` | Warm-up, fatiga, PES, ERI, media móvil |
| Matriz 2D | `historyAnalytics.ts` → `computePitchClassConfusionMatrix` | Matriz 12×12 de clases de tono y sesgo direccional |
| Longitudinal | `historyAnalytics.ts` → `computeLongitudinalComparisons`, `reconstructSessionConfig` | Deltas Baseline↔Retest y clonación ejecutable |
| Reportes | `domain/analytics/diagnosticReportGenerator.ts` | Informe clínico en lenguaje natural |
| Diccionario | `domain/analytics/pedagogicalDictionary.ts` | Conceptos pedagógicos para tooltips |
| Estado | `stores/useAnalyticsStore.ts` | Cache Zustand + segmentación por modalidad |
| UI | `components/views/analytics/*` | KPIs, matriz, longitudinal, inspector de sesión |

**Alcance (in-scope):** constantes umbral y su SSOT, corrección por azar, entropía, CPI, latencia
por nota y octava, telemetría temporal (4 factores), matriz de confusión, comparaciones
longitudinales y reconstrucción de prescripciones, generación de informes, diccionario pedagógico,
filtros de sesión y el store de analítica.

**Fuera de alcance (out-of-scope):** persistencia en IndexedDB (Módulo 02), generación y evaluación
de estímulos (Módulo 03), estrategias adaptativas (Módulo 04), inferencia local de IA y construcción
de prompts (Módulo 06), y la síntesis/audio MIDI (Módulo 01).

> **Convención terminológica:** este documento usa términos RFC 2119. `MUST` (DEBE) y `MUST NOT`
> (NO DEBE) marcan requerimientos invariables del contrato. `SHOULD` (DEBERÍA) marca una práctica
> fuertemente recomendada con excepciones justificadas.

---

## Umbrales y Psicometría

### Requirement: Fuente Única de Verdad de Umbrales Psicoacústicos

Todo el sistema DEBE leer sus umbrales psicométricos exclusivamente desde las constantes
canónicas de `historyAnalytics.ts`, prohibiendo la codificación rígida de números umbral en
cualquier otro archivo.

- `COGNITIVE_LATENCY_THRESHOLDS` MUST contener exactamente:
  `FAST_MAX_MS: 1400`, `MEDIUM_MAX_MS: 2800`, y las etiquetas textuales `FAST_LABEL: '< 1.4s'`,
  `MEDIUM_LABEL: '1.4s - 2.8s'`, `SLOW_LABEL: '> 2.8s'`.
- El espectro de latencia clasifica cada respuesta: **Reflejo Inmediato** `< 1400ms`, **Deducción
  Activa** entre `1400ms` y `2800ms` inclusive, e **Incertidumbre / Esfuerzo** `> 2800ms`.
- `MASTERY_THRESHOLDS` MUST contener exactamente `MASTERED_MIN: 85`, `LEARNING_MIN: 50` y
  `CRITICAL_MAX: 50`, definiendo los niveles de dominio: **Dominado** `>= 85%`, **En Aprendizaje**
  entre `50%` y `84%`, y **Crítico** `< 50%`.

> **Nota de precisión técnica:** el umbral Learning/Critical implementado es **50%**, no 60% como
> aparece en algunas descripciones; la especificación se atiene al código y a su suite de tests
> (`MASTERY_THRESHOLDS.MASTERED_MIN === 85` es la única asertada explícitamente, y los filtros
> `filterSessionsAdvanced` aplican 50 como frontera learning/critical).

- Los componentes de UI (p. ej. `ConfusionMatrixTab`, `LatencySpectrumDiagram`) DEBEN renderizar las
  etiquetas calibradas desde la SSOT, no literales propias; NO DEBE aparecer ningún umbral suelto
  (como `< 1.2s`) en la interfaz.
- `generateDiagnosticReport` y `buildUserPrompt` DEBEN derivar sus textos de las mismas constantes.

#### Scenario: Clasificación exacta de una respuesta por latencia

- **GIVEN** tres respuestas con `responseTimeMs` de `1350`, `2100` y `3200`
- **WHEN** se ejecuta `computeAnalyticsMetrics` sobre ellas
- **THEN** `fastResponsesCount === 1`, `mediumResponsesCount === 1` y
  `slowResponsesCount === 1`

#### Scenario: UI renderiza estrictamente las etiquetas SSOT

- **GIVEN** el componente `ConfusionMatrixTab` montado con métricas válidas
- **WHEN** se renderiza
- **THEN** contiene `Reflejo Inmediato (< 1.4s)` y `Deducción Activa (1.4s - 2.8s)`
- **AND** no contiene ninguna referencia a un umbral descalibrado como `< 1.2s`

---

### Requirement: Corrección por Azar (Teoría de Respuesta al Ítem)

El motor DEBE descontar la probabilidad de acertar por pura suerte antes de declarar una precisión,
de forma que un pool chico no infle artificialmente el mérito.

- La línea base de azar MUST ser `c = 1 / poolSize`.
- La precisión normalizada MUST ser
  `NormAcc = ((RawAcc - c) / (1 - c)) * 100`, acotada estrictamente a `[0, 100]`.
- Si `RawAcc <= c`, la precisión normalizada DEBE ser exactamente `0%` (el desempeño no supera al
  azar).
- El `poolSize` nominal MUST resolverse por prioridad desde el `presetName` (Nivel 1→3, Nivel 2→5,
  Nivel 3/octava diatónica→8, Nivel 4/cromático→13, pentatónica→6, o el entero de
  `Notas Personalizadas (N)`), y en último término desde el conteo empírico de notas únicas con un
  mínimo de `2`.
- La entropía contextual de Shannon MUST ser `H = log2(poolSize)` en bits, con 2 decimales.

#### Scenario: Precisión cruda vs. precisión real en pool pequeño

- **GIVEN** una sesión con `poolSize = 3` y `rawAccuracy = 80%`
- **WHEN** se calcula la precisión normalizada
- **THEN** la línea base de azar es `c = 0.333` y el resultado es `70%` real (acorde al ejemplo del
  diccionario pedagógico `irt_normalized_accuracy`)

#### Scenario: Desempeño igual o peor que el azar se normaliza a cero

- **GIVEN** una sesión con `poolSize = 2` (azar `c = 0.5`) y `rawAccuracy = 40%`
- **WHEN** se calcula la precisión normalizada
- **THEN** el resultado es `0%`, ya que `40% <= 50%`

---

### Requirement: Índice de Rendimiento Cognitivo (CPI)

El motor DEBE ofrecer un score compuesto que permita comparar sesiones de dificultad y entrada
distintas en una misma escala.

- `calculateSessionCPI(NormAcc, H, RPM, avgResponseTimeMs, inputMethod)` MUST devolver `0` de forma
  inmediata si `NormAcc <= 0`.
- El cálculo MUST combinar, sin pasar de cero por debajo:
  - `entropyFactor = max(0.5, H / 3.0)`
  - `latencySec = max(0.6, avgResponseTimeMs / 1000)`
  - `speedFactor = clamp((RPM / 15.0) * (1.5 / latencySec), 0.3, 2.5)`
  - `inputFactor`: `1.0` hardware, `0.92` mixto, `0.85` virtual
- El score bruto es `NormAcc * entropyFactor * speedFactor * inputFactor * 10`, redondeado al entero
  más cercano y con piso en `0`.
- Una misma destreza con hardware MUST puntuar más alto que con entrada virtual.

#### Scenario: CPI nulo sin precisión normalizada

- **GIVEN** `NormAcc = 0`, `H = 2.0`, `RPM = 15`, latencia `1000ms` y entrada `hardware`
- **WHEN** se calcula el CPI
- **THEN** el resultado es `0`

#### Scenario: La entrada hardware supera a la virtual a destreza igual

- **GIVEN** `NormAcc = 90`, `H = 2.0`, `RPM = 20` y latencia `1000ms`
- **WHEN** se calcula el CPI con `hardware` y con `virtual`
- **THEN** el CPI hardware es estrictamente mayor que el virtual

---

## Telemetría Temporal y Metacognición

### Requirement: Análisis de Línea de Tiempo y los 4 Factores (analyzeSessionTimeline)

El motor DEBE reconstruir la cronología completa de una sesión con sus cuatro factores
psicofisiológicos, ordenando las respuestas por `questionIndex`.

- **Factor 1 — Calentamiento (Zona 1):** MUST contar los errores estrictamente en las **3 primeras
  preguntas** (`warmUpErrorsCount`).
- **Factor 2 — Fatiga (Zona 2):** MUST dividir la sesión en mitades por `Math.floor(total / 2)` y
  marcar `fatigueDetected` únicamente cuando `total >= 10` **y** además la latencia de la segunda
  mitad supere a la de la primera en `+180ms` o la precisión caiga más de `12` puntos.
- **Factor 3 — Post-Error Slowing (PES):** MUST medir, para cada fallo con pregunta siguiente, la
  diferencia entre la latencia de la pregunta inmediatamente posterior y la latencia promedio de la
  sesión, promediando dichas diferencias en `postErrorSlowingAvgDeltaMs`; sin fallos debe ser
  `null`.
- **Factor 4 — Conducta Metacognitiva de Reparación (ERI):** MUST consolidar
  `totalPreAnswerListens` (con default `1`), `totalPostErrorListens`, la certeza de primera
  escucha `firstListenConfidencePercent`, la tasa de reparación `errorRepairRatePercent` (fallos
  seguidos de re-escucha) y `avgPostErrorDwellTimeMs`.
- La función MUST exponer el arreglo `questions` con puntos de telemetría por pregunta, incluyendo
  una `movingAvgLatencyMs` de ventana deslizante de las últimas 3 respuestas.
- El campo `repairEffectivenessPercent` MUST medir cuántas veces la nota fallada fue acertada en su
  siguiente aparición; si la nota fallada no reaparece, debe ser `null`.

#### Scenario: Sesión limpia sin fatiga ni PES

- **GIVEN** 6 respuestas correctas de `1000ms` cada una
- **WHEN** se ejecuta `analyzeSessionTimeline`
- **THEN** `warmUpErrorsCount === 0`, `postErrorSlowingAvgDeltaMs === null` y
  `fatigueDetected === false`

#### Scenario: Fatiga detectada por latencia y PES positivo

- **GIVEN** 6 respuestas rápidas (`800ms`) en la primera mitad y 6 respuestas lentas
  (`1700`–`1900ms`) con un error en la segunda mitad
- **WHEN** se ejecuta `analyzeSessionTimeline`
- **THEN** `totalQuestions === 12`, `fatigueDetected === true` y
  `postErrorSlowingAvgDeltaMs > 0`

---

### Requirement: Cronometría por Nota y por Octava (computePerNoteLatencyStats)

El motor DEBE desglosar la latencia por nota individual y agregarla por octava, distinguiendo
reconocimiento reflejo de deducción.

- Solo las respuestas **correctas** MUST alimentar las latencias (`item.latencies`) y el conteo de
  reflejos rápidos; los fallos se cuentan en el total de intentos pero no aportan latencia.
- `fastReflexPercent` MUST ser la proporción de respuestas correctas por debajo de
  `FAST_MAX_MS` (1400) sobre el total de correctas.
- La octava MUST calcularse como `Math.floor(noteNumber / 12) - 1`, con etiquetas legibles para las
  octavas 3 (Grave), 4 (Central) y el resto (Aguda).
- `fastestNote` / `slowestNote` solo MUST definirse sobre notas con al menos una correcta y latencia
  positiva; `fastestOctave` sobre octavas con latencia positiva; en caso contrario `null`.
- El arreglo `notes` MUST entregarse ordenado por número de nota ascendente.

#### Scenario: Nota fallada no contamina la latencia promedio

- **GIVEN** respuestas donde la nota `60` tiene un acierto de `1000ms` y un fallo de `4000ms`
- **WHEN** se calculan las estadísticas por nota
- **THEN** `avgLatencyMs` de la nota `60` es `1000` (solo el acierto aporta) y su
  `accuracyPercentage` es `50`

---

## Matriz de Confusión y Sesgo Direccional

### Requirement: Matriz 2D de Clases de Tono (computePitchClassConfusionMatrix)

El motor DEBE construir una matriz 12×12 que registre la atracción tonal entre las 12 clases de
tono (C a Si, módulo 12), independiente de la octava.

- Las filas MUST representar la clase esperada y las columnas la clase tocada; cada celda lleva
  `expectedPc`, `playedPc`, `expectedName`, `playedName`, `count`, `percentageOfExpected` e
  `isDiagonal`.
- `percentageOfExpected` MUST ser el porcentaje de esa celda sobre el total de ensayos de la clase
  esperada, redondeado, y `0` si esa fila no tiene ensayos.
- `totalTestsPerPitchClass` MUST contar los ensayos por cada clase esperada.
- `maxOffDiagonalCount` MUST ser el conteo máximo fuera de la diagonal, con piso en `1`.
- Las respuestas con `expectedNote < 0` o `playedNote < 0` DEBEN ignorarse.
- La diagonal principal (`expectedPc === playedPc`) MUST marcarse `isDiagonal: true`.

#### Scenario: Aciertos en la diagonal y confusión fuera de ella

- **GIVEN** dos respuestas: `60→60` (correcta) y `64→65` (error de un semitono)
- **WHEN** se computa la matriz
- **THEN** hay 12 clases de tono, `grid[0][0].count === 1` con `isDiagonal === true`,
  `grid[4][5].count === 1` con `isDiagonal === false` y `maxOffDiagonalCount === 1`

---

### Requirement: Sesgo Direccional y Pares de Confusión

El motor DEBE detectar si los errores se desvían sistemáticamente hacia lo agudo o lo grave, y
agregar los pares de confusión más frecuentes.

- Un error con `semitoneDistance > 0` MUST sumar a `sharpBiasCount` (tocó más agudo); con
  `semitoneDistance < 0` MUST sumar a `flatBiasCount` (tocó más grave); la distancia `0` no suma
  nunca (es acierto).
- El sesgo dominante por sesión MUST ser `'sharp'` si `sharp > flat * 1.4`, `'flat'` si
  `flat > sharp * 1.4`, y `'balanced'` en caso contrario.
- `topConfusions` MUST ordenar los pares `esperada ➔ tocada` por frecuencia descendente y
  limitarse a los **5** primeros.
- `mostDifficultNotes` MUST requerir `attempts >= 2` y `accuracy < 80`, ordenado ascendente por
  precisión, límite 5; `strongestNotes` requiere `attempts >= 2` y `accuracy >= 80`, límite 5.
- La interfaz de la matriz DEBE poder explicar cada celda con su distancia direccional firmada,
  normalizando la diferencia cromática al rango `[-6, +6]`.

#### Scenario: Detección de sesgo agudo dominante

- **GIVEN** una sesión con 7 errores `+semitono` y 2 errores `-semitono`
- **WHEN** se computan las métricas
- **THEN** `sharpBiasCount === 7`, `flatBiasCount === 2` y `dominantBias === 'sharp'` (ya que
  `7 > 2 * 1.4`)

---

## Análisis Longitudinal y Re-testeo

### Requirement: Comparaciones Longitudinales Test-Retest (computeLongitudinalComparisons)

El motor DEBE contrastar la primera y la última sesión de un mismo contenido musical para medir
plasticidad real, no variación aleatoria.

- Las sesiones MUST agruparse por clave `${instrumentId}_${contenido}`, donde el contenido es la
  porción del `presetName` anterior al separador `•` (o el nombre completo si no lo hay).
- Un grupo DEBE generar comparación únicamente si contiene **2 o más** sesiones.
- Dentro del grupo, las sesiones MUST ordenarse por `createdAt` ascendente; la **primera** es
  `baselineSession` y la **última** es `latestSession`.
- Los deltas MUST calcularse como: `rawAccuracyDelta` (precisión), `normalizedAccuracyDelta`
  (IRT), `responseTimeDeltaMs` (latencia promedio) y `rpmDelta` (cadencia, con 1 decimal).
- `isImproved` MUST ser `true` cuando `rawAccuracyDelta > 0`, **o** cuando la precisión se mantiene
  (`=== 0`) y la latencia baja más de `100ms`.
- `totalAttempts` MUST reflejar la cantidad de sesiones del grupo, y `contentName` el nombre del
  contenido recortado.

#### Scenario: Consolidación con precisión y velocidad

- **GIVEN** un grupo de 2 sesiones del mismo contenido donde el baseline tiene `60%` / `1500ms` y el
  retest `90%` / `1000ms`
- **WHEN** se computan las comparaciones
- **THEN** hay 1 comparativa con `rawAccuracyDelta === 30`, `responseTimeDeltaMs === -500` e
  `isImproved === true`

#### Scenario: Grupo único no genera comparativa

- **GIVEN** un grupo con una sola sesión
- **WHEN** se computan las comparaciones
- **THEN** no se emite ninguna comparativa (se requieren mínimo 2)

---

### Requirement: Reconstrucción de Prescripción de Re-testeo (reconstructSessionConfig)

El motor DEBE poder regenerar un objeto `AiExercisePrescription` ejecutable que reproduzca la sesión
histórica bajo las mismas condiciones, en un solo clic.

- La modalidad MUST inferirse por prioridad: `session.targetMode` (si existe y no es `repertoire`),
  luego los clasificadores `isIntervalSession` / `isSequenceSession`, con `single_note` por defecto.
- Para `single_note`, las notas recomendadas MUST reconstruirse desde `EXERCISE_PRESETS` según el
  nivel indicado en `presetName`; si no calza ningún nivel conocido, MUST usar las notas esperadas
  únicas de las respuestas (mínimo 2, fallback `[60, 62, 64]`).
- Para `intervals`, los semitonos MUST extraerse de la telemetría `reasonTelemetry` buscando el
  patrón `/(\d+)\s*st/i`, deduplicados y ordenados, con fallback `[2, 4, 5, 7, 12]`.
- Para `sequences`, las notas y la longitud MUST reconstruirse del patrón
  `/Secuencia:\s*\[([^\]]+)\]/i` en la telemetría, usando `expectedNote` como respaldo y longitud
  mínima `3`.
- El formato MUST inferirse del `presetName`: `'time'` si menciona tiempo/cronometrado, `'mastery'`
  si menciona maestría, si no `'questions'`; `durationMinutes` se deriva de la duración real
  (mínimo 1) y `questionsCount` de `totalQuestions` (fallback 10).
- `instrumentId` MUST validarse contra el catálogo conocido, cayendo a `acoustic_grand_piano`;
  `advanceMode` MUST ser `'smart'` y `noteDurationMs` `500`.
- El `title` resultante MUST prefijarse con `Re-testeo:` y el `rationale` citar la fecha de la
  sesión original.

#### Scenario: Reconstrucción de una sesión de notas

- **GIVEN** una sesión `Nivel 1 (C, D, E) • Cronometrado 1m` de 60 segundos
- **WHEN** se reconstruye su configuración
- **THEN** `targetMode === 'single_note'`, `recommendedNotes === [60, 62, 64]` y
  `durationMinutes === 1`

#### Scenario: Reconstrucción de intervalos y secuencias desde telemetría

- **GIVEN** respuestas con telemetría `'4 st (ascending)'` y otra con
  `'Secuencia: [60, 64, 67]'`
- **WHEN** se reconstruyen ambas sesiones
- **THEN** la de intervalos devuelve `recommendedIntervals === [4]` y la de secuencias devuelve
  `sequenceLength === 3` con `recommendedNotes === [60, 64, 67]`

---

## Diccionario Pedagógico e Informes

### Requirement: Diccionario Pedagógico Centralizado (pedagogicalDictionary)

El sistema DEBE exponer un único diccionario de conceptos psicoacústicos, consultable por
identificador, que alimente los tooltips educativos.

- `getConcept(id)` MUST devolver el `PedagogicalConcept` completo o `null` si el id no existe.
- Cada concepto MUST tener `id`, `title`, `subtitle`, `category`
  (`'psychometrics' | 'cognition' | 'algorithm' | 'melody'`), `shortDefinition`,
  `formulaOrCalculation` y `practicalTakeaway`, todos no vacíos.
- El diccionario MUST cubrir, como mínimo, los conceptos: `irt_normalized_accuracy`,
  `shannon_entropy`, `cognitive_latency`, `responses_per_minute`, `directional_bias`,
  `test_retest_delta`, `leitner_system`, `inter_session_gap` y `cpi_score`.
- El concepto `cognitive_latency` MUST tomar sus umbrales textualmente de la SSOT
  (`COGNITIVE_LATENCY_THRESHOLDS`), de modo que una recalibración global se propague sola.

#### Scenario: Consulta de concepto con fórmula y takeaway

- **GIVEN** el id `irt_normalized_accuracy`
- **WHEN** se invoca `getConcept`
- **THEN** el título contiene `Oído Real`, la fórmula contiene `Acierto - c` y el takeaway explica
  la dilución del azar en pools pequeños

#### Scenario: Concepto inexistente devuelve null

- **GIVEN** un id no registrado como `concepto_inexistente`
- **WHEN** se invoca `getConcept`
- **THEN** el resultado es `null`

---

### Requirement: Generación de Informes Diagnósticos (generateDiagnosticReport)

El motor DEBE traducir las métricas en un informe clínico legible, con secciones estables y un plan
de acción accionable.

- El informe MUST entregar `title`, `date`, `executiveSummary`, `perceptualDiagnosis`,
  `cognitiveLatencyAnalysis`, `directionalBiasAnalysis` y `concreteActionPlan`.
- Sin datos (`totalAnswers === 0`), el informe MUST degradarse elegantemente: resume ausencia de
  sesiones y propone iniciar una sesión inicial, sin lanzar errores.
- El resumen ejecutivo MUST segmentar en `AVANZADO` (precisión `>= 85`), `INTERMEDIO CONSOLIDADO`
  (`>= 65`) o `ENTRENAMIENTO FORMATIVO` (resto).
- El análisis de latencia MUST consumir las etiquetas de la SSOT y distinguir `reflejo inmediato`
  (si `fastPercent >= 60`) de `esfuerzo lento` (si `slowPercent >= 35`).
- El sesgo direccional solo MUST declararse cuando un sentido supere al otro en `1.5x`; si hay
  errores pero no hay asimetría, MUST declarar distribución simétrica.
- El plan de acción MUST incluir al menos una acción permanente (la sesión cronometrada de
  reflejo) y agregar acciones específicas según notas débiles, par conflictivo y precisión `>= 80`.

#### Scenario: Informe con datos genera plan accionable

- **GIVEN** métricas con respuestas, notas difíciles y un par de confusión dominante
- **WHEN** se genera el informe
- **THEN** `concreteActionPlan.length > 0`, menciona las notas débiles y trabaja el par conflictivo

#### Scenario: Informe sin datos no se rompe

- **GIVEN** métricas con `totalAnswers === 0`
- **WHEN** se genera el informe
- **THEN** el resumen explica que no hay sesiones y el plan sugiere realizar una sesión inicial

---

## Estado y Segmentación

### Requirement: Store de Analítica y Segmentación por Modalidad (useAnalyticsStore)

El store DEBE centralizar las métricas calculadas y recalcularlas de forma consistente al cambiar
el filtro de modalidad, sin duplicar lógica de cómputo.

- El estado MUST exponer `modeFilter` (por defecto `'all'`), `metrics` (inicialmente un objeto
  `emptyMetrics` con todos sus contadores en cero y arreglos vacíos) y las acciones
  `setModeFilter` y `recomputeMetrics`.
- `setModeFilter(filter, sessions, answers)` MUST delegar a `computeAnalyticsMetrics` y persistir
  simultáneamente el filtro y las métricas resultantes.
- `recomputeMetrics(sessions, answers)` MUST reutilizar el `modeFilter` vigente (sin cambiarlo),
  de forma que una persistencia externa nueva no altere la vista activa.
- Las métricas NO MUST contener referencias a sessions/answers crudas: son un snapshot derivado.
- Las funciones de dominio `isSingleNoteSession`, `isIntervalSession`, `isSequenceSession` e
  `isRepertoireSession` DEBEN priorizar el `targetMode` canónico y, en su ausencia, inferir por
  `strategyId`, `instrumentId` y palabras clave del `presetName`, sin que las modalidades se
  solapen (repertorio tiene prelación sobre secuencias/intervalos al inferir).

#### Scenario: Recálculo al cambiar de modalidad

- **GIVEN** un store con una sesión de notas y una de intervalos (una respuesta cada una)
- **WHEN** se aplica `setModeFilter('all')`
- **THEN** `metrics.totalAnswers === 2`
- **WHEN** se aplica `setModeFilter('single_note')`
- **THEN** `metrics.totalAnswers === 1` y `overallAccuracy === 100`
- **WHEN** se aplica `setModeFilter('intervals')`
- **THEN** `metrics.totalAnswers === 1` y `overallAccuracy === 0`

---

## Capa de Presentación Analítica

### Requirement: Componentes de Analítica (KPIs, Matriz, Longitudinal, Detalle)

La UI de analítica DEBE consumir exclusivamente los modelos de dominio, sin recalcular psicometría
propia ni conocer la base de datos directamente.

- `AnalyticsKpiCards` MUST renderizar cuatro KPIs —sesiones analizadas, Oído Real (IRT), entropía y
  latencia— y DEBE colorear el KPI de IRT con la misma escala umbral (`>= 85` esmeralda,
  `>= 50` ámbar, resto rosa); los tres KPIs conceptuales DEBEN envolver su etiqueta en un
  `PedagogicalTooltip` referenciando un id del diccionario.
- `ConfusionMatrixTab` MUST construir la matriz 12×12 solo cuando haya respuestas, mostrar un
  estado vacío instructivo en caso contrario, y colorear la diagonal (aciertos) y las celdas de
  confusión por intensidad relativa a `maxOffDiagonalCount`.
- `LongitudinalTab` MUST mostrar un estado vacío que dirija a la pestaña de Registro Clínico cuando
  no haya comparativas, y su botón `Volver a Re-testar` DEBE invocar
  `reconstructSessionConfig` sobre la sesión más reciente y delegar la carga al callback
  `onLoadPrescription`.
- `LongitudinalTab` SHOULD clasificar cada comparativa en un badge psicoacústico (consolidación
  óptima, mayor precisión con deducción, precisión estable con fatiga, mayor velocidad de flujo, o
  necesidad de anclaje tonal) a partir de los deltas.
- `SessionDetailModal` MUST retornar `null` cuando esté cerrado o no haya sesión, degradar a un
  inspector vacío cuando la sesión no tenga respuestas, y mostrar la línea de tiempo con las
  bandas de los 4 factores (calentamiento Q1-Q3, segunda mitad, PES y marcadores de re-escucha
  `👂xN`), el heatmap del teclado, la auditoría evento a evento y el botón `Re-testar esta Sesión`.

#### Scenario: KPI de IRT coloreado según precisión normalizada

- **GIVEN** métricas con `normalizedOverallAccuracy === 90`
- **WHEN** se renderiza `AnalyticsKpiCards`
- **THEN** el valor del KPI Oído Real se muestra en esmeralda por superar el umbral 85

#### Scenario: Matriz con estado vacío instructivo

- **GIVEN** `ConfusionMatrixTab` con `answers` vacío
- **WHEN** se renderiza
- **THEN** se muestra un mensaje indicando que no hay respuestas para los filtros aplicados, en
  lugar de una matriz vacía

#### Scenario: Re-testeo delega al dominio y cierra el modal

- **GIVEN** `SessionDetailModal` abierto con una sesión y respuestas válidas
- **WHEN** se pulsa `Re-testar esta Sesión`
- **THEN** se invoca `reconstructSessionConfig` y `onReTest` recibe la prescripción, tras lo cual el
  modal se cierra
