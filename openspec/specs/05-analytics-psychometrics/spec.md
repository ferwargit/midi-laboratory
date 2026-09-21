# Capability: Psychoacoustic Analytics & Psychometrics Engine

## Purpose

Esta capacidad define el **motor de modelado psicométrico científico** del desempeño auditivo del alumno en `midi-laboratory`. No se limita a contar aciertos: aplica teoría psicométrica formal (Teoría de Respuesta al Ítem, entropía de Shannon, cronometría cognitiva) y telemetría metacognitiva para construir una representación rigurosa y comparable de la habilidad del oído, independiente del tamaño del pool, el instrumento o la modalidad practicada.

La capacidad es un **pipeline de dominio puro**: las funciones de `historyAnalytics.ts` reciben registros de base de datos inmutables (`DbSessionRecord` / `DbAnswerRecord`) y devuelven modelos analíticos derivados, sin acoplarse a React. La capa de presentación consume estos modelos; el store Zustand `useAnalyticsStore` cachea y recalcula los agregados al cambiar el filtro de modalidad.

| Frente        | Unidad canónica                                                                      | Responsabilidad                                            |
| ------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Umbrales SSOT | `domain/analytics/historyAnalytics.ts`                                               | Latencia cognitiva y maestría; fuente única de toda la app |
| Psicometría   | `historyAnalytics.ts` → `computeAnalyticsMetrics`, `calculateSessionCPI`             | Azar (IRT), entropía, normalización, CPI compuesto         |
| Telemetría    | `historyAnalytics.ts` → `analyzeSessionTimeline`                                     | Warm-up, fatiga, PES, ERI, media móvil                     |
| Matriz 2D     | `historyAnalytics.ts` → `computePitchClassConfusionMatrix`                           | Matriz 12×12 de clases de tono y sesgo direccional         |
| Longitudinal  | `historyAnalytics.ts` → `computeLongitudinalComparisons`, `reconstructSessionConfig` | Deltas Baseline↔Retest y clonación ejecutable              |
| Reportes      | `domain/analytics/diagnosticReportGenerator.ts`                                      | Informe clínico en lenguaje natural                        |
| Diccionario   | `domain/analytics/pedagogicalDictionary.ts`                                          | Conceptos pedagógicos para tooltips                        |
| Estado        | `stores/useAnalyticsStore.ts`                                                        | Cache Zustand + segmentación por modalidad                 |
| UI            | `components/views/analytics/*`                                                       | KPIs, matriz, longitudinal, inspector de sesión            |

**Alcance (in-scope):** constantes umbral y su SSOT, corrección por azar, entropía, CPI, latencia por nota y octava, telemetría temporal (4 factores), matriz de confusión, comparaciones longitudinales, informes diagnósticos, diccionario pedagógico, filtros de sesión y store de analítica.

**Fuera de alcance (out-of-scope):** persistencia en IndexedDB (Módulo 02), evaluación de estímulos (Módulo 03), estrategias adaptativas (Módulo 04), IA local (Módulo 06) y audio MIDI (Módulo 01).

## Requirements

### Requirement: Fuente Única de Verdad de Umbrales Psicoacústicos

Todo el sistema MUST (DEBE) leer sus umbrales psicométricos exclusivamente desde las constantes canónicas de `historyAnalytics.ts`, prohibiendo la codificación rígida de números umbral en cualquier otro archivo.

- `COGNITIVE_LATENCY_THRESHOLDS` MUST contener exactamente: `FAST_MAX_MS: 1400`, `MEDIUM_MAX_MS: 2800`, `FAST_LABEL: '< 1.4s'`, `MEDIUM_LABEL: '1.4s - 2.8s'`, `SLOW_LABEL: '> 2.8s'`.
- El espectro de latencia clasifica cada respuesta: **Reflejo Inmediato** `< 1400ms`, **Deducción Activa** entre `1400ms` y `2800ms`, e **Incertidumbre / Esfuerzo** `> 2800ms`.
- `MASTERY_THRESHOLDS` MUST contener exactamente `MASTERED_MIN: 85`, `LEARNING_MIN: 60` y `CRITICAL_MAX: 60`, definiendo: **Dominado** `>= 85%`, **En Aprendizaje** entre `60%` y `84%`, y **Crítico** `< 60%`. La frontera del 60% está fundamentada psicométricamente: es el primer umbral que se separa de forma robusta de la línea base de azar de un ejercicio 2AFC con `poolSize = 2` (`c = 50%`), evitando que la banda Crítico absorba el ruido de azar.
- `ISI_THRESHOLDS` MUST contener exactamente `MASSED_MAX_MS: 900000`, `OPTIMAL_MIN_MS: 43200000` y `OPTIMAL_MAX_MS: 172800000`, definiendo las bandas de intervalo entre sesiones (ISI): **Acumulada** `< 15 min`, **Óptima** entre `12 h` y `48 h`, y **Espaciada** `> 48 h`. Estos tres literales solo MUST existir en la SSOT; la capa de presentación y los informes están prohibidos de hardcodearlos. La prohibición se acota al cómputo de descanso entre sesiones (ISI) y a la analítica: timeouts no psicométricos de dominios independientes (p. ej. `chatTimeoutMs: 900000` en la configuración de IA local) no violan esta regla, al no ser umbrales de descanso.
- `BIAS_DOMINANCE_RATIO` MUST ser exactamente `1.4`, y MUST ser el único factor utilizado por el motor y por el generador de informes para declarar un sesgo direccional dominante, prohibiendo los literales `1.4` y `1.5` en cualquier otro archivo.
- Los componentes de UI y el motor adaptativo MUST consumir `MASTERY_THRESHOLDS` para clasificar notas y sesiones (colores de precisión, listas de notas débiles, compuertas de maestría, leyendas y ponderación adaptativa), prohibiendo los literales `85`/`60` en cualquier archivo que no sea la SSOT.
- Los componentes de UI MUST renderizar las etiquetas calibradas desde la SSOT, no literales propias.

#### Scenario: Clasificación exacta de una respuesta por latencia

- **GIVEN** tres respuestas con `responseTimeMs` de `1350`, `2100` y `3200`
- **WHEN** se ejecuta `computeAnalyticsMetrics` sobre ellas
- **THEN** `fastResponsesCount === 1`, `mediumResponsesCount === 1` y `slowResponsesCount === 1`

#### Scenario: Frontera learning/critical fijada en 60%

- **GIVEN** dos sesiones con `accuracyPercentage` de `59` y `60`
- **WHEN** se aplica `filterSessionsAdvanced` con `mastery: 'critical'` y con `mastery: 'learning'`
- **THEN** la sesión del `59%` es la única devuelta por `critical`, y la sesión del `60%` es la única devuelta por `learning`

#### Scenario: Sesión justo por debajo del umbral de dominio sigue en aprendizaje

- **GIVEN** una sesión con `accuracyPercentage` de `84`
- **WHEN** se aplica `filterSessionsAdvanced` con `mastery: 'learning'` y con `mastery: 'mastered'`
- **THEN** la sesión es devuelta por `learning` y excluida de `mastered`

#### Scenario: UI renderiza estrictamente las etiquetas SSOT

- **GIVEN** el componente `ConfusionMatrixTab` montado con métricas válidas
- **WHEN** se renderiza
- **THEN** contiene `Reflejo Inmediato (< 1.4s)` y `Deducción Activa (1.4s - 2.8s)`

#### Scenario: Colores de maestría derivados de la SSOT

- **GIVEN** `AnalyticsKpiCards` con `normalizedOverallAccuracy === 60`
- **WHEN** se renderiza
- **THEN** el KPI de Oído Real se muestra en ámbar, y la paleta de colores está derivada de `MASTERY_THRESHOLDS` y no de literales propios

#### Scenario: Umbrales ISI concentrados en la SSOT

- **GIVEN** el módulo `historyAnalytics.ts`
- **WHEN** se inspeccionan sus exportaciones
- **THEN** `ISI_THRESHOLDS` expone `MASSED_MAX_MS === 900000`, `OPTIMAL_MIN_MS === 43200000` y `OPTIMAL_MAX_MS === 172800000`, y ningún archivo de analítica ni componente de UI contiene los literales `900000`, `43200000` ni `172800000` para cómputo de descanso entre sesiones (ISI); timeouts no psicométricos de dominios independientes, como `chatTimeoutMs` de la IA local, no cuentan como violación

#### Scenario: Ratio de sesgo unificado en la SSOT

- **GIVEN** el módulo `historyAnalytics.ts`
- **WHEN** se inspeccionan sus exportaciones
- **THEN** `BIAS_DOMINANCE_RATIO === 1.4`, y ni `diagnosticReportGenerator.ts` ni `AnalyticsView.tsx` contienen los literales `1.4` ni `1.5` como factor de sesgo

### Requirement: Corrección por Azar (Teoría de Respuesta al Ítem)

El motor MUST (DEBE) descontar la probabilidad de acertar por pura suerte antes de declarar una precisión, de forma que un pool chico no infle artificialmente el mérito.

- La línea base de azar MUST ser `c = 1 / poolSize`.
- La precisión normalizada MUST ser `NormAcc = ((RawAcc - c) / (1 - c)) * 100`, acotada estrictamente a `[0, 100]`.
- Si `RawAcc <= c`, la precisión normalizada MUST ser exactamente `0%`.
- El `poolSize` nominal MUST resolverse por prioridad desde el `presetName` y en último término desde el conteo empírico de notas únicas con un mínimo de `2`.
- La entropía contextual de Shannon MUST ser `H = log2(poolSize)` en bits, con 2 decimales.

#### Scenario: Precisión cruda vs. precisión real en pool pequeño

- **GIVEN** una sesión con `poolSize = 3` y `rawAccuracy = 80%`
- **WHEN** se calcula la precisión normalizada
- **THEN** la línea base de azar es `c = 0.333` y el resultado es `70%` real

#### Scenario: Desempeño igual o peor que el azar se normaliza a cero

- **GIVEN** una sesión con `poolSize = 2` (azar `c = 0.5`) y `rawAccuracy = 40%`
- **WHEN** se calcula la precisión normalizada
- **THEN** el resultado es `0%`, ya que `40% <= 50%`

### Requirement: Índice de Rendimiento Cognitivo (CPI)

El motor MUST (DEBE) ofrecer un score compuesto que permita comparar sesiones de dificultad y entrada distintas en una misma escala.

- `calculateSessionCPI(NormAcc, H, RPM, avgResponseTimeMs, inputMethod)` MUST devolver `0` de forma inmediata si `NormAcc <= 0`.
- El cálculo MUST combinar: `entropyFactor = max(0.5, H / 3.0)`, `latencySec = max(0.6, avgResponseTimeMs / 1000)`, `speedFactor = clamp((RPM / 15.0) * (1.5 / latencySec), 0.3, 2.5)` e `inputFactor` (`1.0` hardware, `0.92` mixto, `0.85` virtual).
- El score bruto es `NormAcc * entropyFactor * speedFactor * inputFactor * 10`, redondeado con piso en `0`.

#### Scenario: CPI nulo sin precisión normalizada

- **GIVEN** `NormAcc = 0`, `H = 2.0`, `RPM = 15`, latencia `1000ms` y entrada `hardware`
- **WHEN** se calcula el CPI
- **THEN** el resultado es `0`

#### Scenario: La entrada hardware supera a la virtual a destreza igual

- **GIVEN** `NormAcc = 90`, `H = 2.0`, `RPM = 20` y latencia `1000ms`
- **WHEN** se calcula el CPI con `hardware` y con `virtual`
- **THEN** el CPI hardware es estrictamente mayor que el virtual

### Requirement: Análisis de Línea de Tiempo y los 4 Factores (analyzeSessionTimeline)

El motor MUST (DEBE) reconstruir la cronología completa de una sesión con sus cuatro factores psicofisiológicos, ordenando las respuestas por `questionIndex`.

- **Factor 1 (Calentamiento):** MUST contar los errores estrictamente en las 3 primeras preguntas (`warmUpErrorsCount`).
- **Factor 2 (Fatiga):** MUST marcar `fatigueDetected` únicamente cuando `total >= 10` y además la latencia de la segunda mitad supere a la de la primera en `+180ms` o la precisión caiga más de `12` puntos.
- **Factor 3 (PES):** MUST medir la diferencia de latencia tras un error en `postErrorSlowingAvgDeltaMs` (o `null` sin fallos).
- **Factor 4 (ERI):** MUST consolidar `totalPreAnswerListens`, `totalPostErrorListens`, `firstListenConfidencePercent`, `errorRepairRatePercent` y `avgPostErrorDwellTimeMs`.
- MUST calcular `movingAvgLatencyMs` de ventana deslizante de las últimas 3 respuestas.

#### Scenario: Sesión limpia sin fatiga ni PES

- **GIVEN** 6 respuestas correctas de `1000ms` cada una
- **WHEN** se ejecuta `analyzeSessionTimeline`
- **THEN** `warmUpErrorsCount === 0`, `postErrorSlowingAvgDeltaMs === null` y `fatigueDetected === false`

#### Scenario: Fatiga detectada por latencia y PES positivo

- **GIVEN** 6 respuestas rápidas (`800ms`) en la primera mitad y 6 respuestas lentas (`1700`–`1900ms`) con un error en la segunda mitad
- **WHEN** se ejecuta `analyzeSessionTimeline`
- **THEN** `totalQuestions === 12`, `fatigueDetected === true` y `postErrorSlowingAvgDeltaMs > 0`

### Requirement: Cronometría por Nota y por Octava (computePerNoteLatencyStats)

El motor MUST (DEBE) desglosar la latencia por nota individual y agregarla por octava, distinguiendo reconocimiento reflejo de deducción.

- Solo las respuestas correctas MUST alimentar las latencias y el conteo de reflejos rápidos.
- `fastReflexPercent` MUST ser la proporción de respuestas correctas por debajo de `FAST_MAX_MS` (1400) sobre el total de correctas.
- La octava MUST calcularse como `Math.floor(noteNumber / 12) - 1`.
- `fastestNote` y `slowestNote` solo MUST definirse sobre notas con al menos una correcta y latencia positiva.

#### Scenario: Nota fallada no contamina la latencia promedio

- **GIVEN** respuestas donde la nota `60` tiene un acierto de `1000ms` y un fallo de `4000ms`
- **WHEN** se calculan las estadísticas por nota
- **THEN** `avgLatencyMs` de la nota `60` es `1000` y su `accuracyPercentage` es `50`

### Requirement: Matriz 2D de Clases de Tono (computePitchClassConfusionMatrix)

El motor MUST (DEBE) construir una matriz 12×12 que registre la atracción tonal entre las 12 clases de tono (C a Si, módulo 12), independiente de la octava.

- Las filas MUST representar la clase esperada y las columnas la clase tocada; cada celda lleva `expectedPc`, `playedPc`, `count`, `percentageOfExpected` e `isDiagonal`.
- `maxOffDiagonalCount` MUST ser el conteo máximo fuera de la diagonal, con piso en `1`.
- La diagonal principal (`expectedPc === playedPc`) MUST marcarse `isDiagonal: true`.

#### Scenario: Aciertos en la diagonal y confusión fuera de ella

- **GIVEN** dos respuestas: `60→60` (correcta) y `64→65` (error de un semitono)
- **WHEN** se computa la matriz
- **THEN** hay 12 clases de tono, `grid[0][0].count === 1` con `isDiagonal === true` y `grid[4][5].count === 1` con `isDiagonal === false`

### Requirement: Sesgo Direccional y Pares de Confusión

El motor MUST (DEBE) detectar si los errores se desvían sistemáticamente hacia lo agudo o lo grave, y agregar los pares de confusión más frecuentes.

- Un error con `semitoneDistance > 0` MUST sumar a `sharpBiasCount`; con `semitoneDistance < 0` MUST sumar a `flatBiasCount`.
- El sesgo dominante MUST ser `'sharp'` si `sharp > flat * BIAS_DOMINANCE_RATIO`, `'flat'` si `flat > sharp * BIAS_DOMINANCE_RATIO`, y `'balanced'` en caso contrario. El factor MUST leerse desde la SSOT (`1.4`), prohibido el literal suelto.
- `topConfusions` MUST ordenar los pares por frecuencia descendente y limitarse a los 5 primeros.
- `mostDifficultNotes` MUST requerir `attempts >= 2` y `accuracy < 80`, límite 5.

#### Scenario: Detección de sesgo agudo dominante

- **GIVEN** una sesión con 7 errores `+semitono` y 2 errores `-semitono`
- **WHEN** se computan las métricas
- **THEN** `sharpBiasCount === 7`, `flatBiasCount === 2` y `dominantBias === 'sharp'` (ya que `7 > 2 * 1.4`)

### Requirement: Comparaciones Longitudinales Test-Retest (computeLongitudinalComparisons)

El motor MUST (DEBE) contrastar la primera y la última sesión de un mismo contenido musical para medir plasticidad real.

- Las sesiones MUST agruparse por clave `${instrumentId}_${contenido}` y generar comparación únicamente con 2 o más sesiones.
- La primera es `baselineSession` y la última es `latestSession`.
- Los deltas MUST calcularse como: `rawAccuracyDelta`, `normalizedAccuracyDelta`, `responseTimeDeltaMs` y `rpmDelta`.
- `isImproved` MUST ser `true` cuando `rawAccuracyDelta > 0`, o cuando la precisión se mantiene y la latencia baja más de `100ms`.

#### Scenario: Consolidación con precisión y velocidad

- **GIVEN** un grupo de 2 sesiones del mismo contenido donde el baseline tiene `60%` / `1500ms` y el retest `90%` / `1000ms`
- **WHEN** se computan las comparaciones
- **THEN** hay 1 comparativa con `rawAccuracyDelta === 30`, `responseTimeDeltaMs === -500` e `isImproved === true`

#### Scenario: Grupo único no genera comparativa

- **GIVEN** un grupo con una sola sesión
- **WHEN** se computan las comparaciones
- **THEN** no se emite ninguna comparativa

### Requirement: Reconstrucción de Prescripción de Re-testeo (reconstructSessionConfig)

El motor MUST (DEBE) poder regenerar un objeto `AiExercisePrescription` ejecutable que reproduzca la sesión histórica bajo las mismas condiciones.

- La modalidad MUST inferirse de `targetMode` (o clasificadores, default `single_note`).
- Para `single_note`, las notas recomendadas MUST reconstruirse desde `EXERCISE_PRESETS` o notas esperadas únicas.
- Para `intervals`, los semitonos MUST extraerse de `reasonTelemetry` buscando `/(\d+)\s*st/i`.
- Para `sequences`, las notas y longitud MUST reconstruirse del patrón `/Secuencia:\s*\[([^\]]+)\]/i`.
- El `title` MUST prefijarse con `Re-testeo:` y el `rationale` citar la fecha original.

#### Scenario: Reconstrucción de una sesión de notas

- **GIVEN** una sesión `Nivel 1 (C, D, E) • Cronometrado 1m` de 60 segundos
- **WHEN** se reconstruye su configuración
- **THEN** `targetMode === 'single_note'`, `recommendedNotes === [60, 62, 64]` y `durationMinutes === 1`

#### Scenario: Reconstrucción de intervalos y secuencias desde telemetría

- **GIVEN** respuestas con telemetría `'4 st (ascending)'` y otra con `'Secuencia: [60, 64, 67]'`
- **WHEN** se reconstruyen ambas sesiones
- **THEN** la de intervalos devuelve `recommendedIntervals === [4]` y la de secuencias devuelve `sequenceLength === 3`

### Requirement: Diccionario Pedagógico Centralizado (pedagogicalDictionary)

El sistema MUST (DEBE) exponer un único diccionario de conceptos psicoacústicos, consultable por identificador, que alimente los tooltips educativos.

- `getConcept(id)` MUST devolver el `PedagogicalConcept` completo o `null` si el id no existe.
- Cada concepto MUST tener `id`, `title`, `subtitle`, `category`, `shortDefinition`, `formulaOrCalculation` y `practicalTakeaway`.
- El diccionario MUST cubrir: `irt_normalized_accuracy`, `shannon_entropy`, `cognitive_latency`, `responses_per_minute`, `directional_bias`, `test_retest_delta`, `leitner_system`, `inter_session_gap` y `cpi_score`.
- `cognitive_latency` MUST tomar sus umbrales textualmente de `COGNITIVE_LATENCY_THRESHOLDS`.

#### Scenario: Consulta de concepto con fórmula y takeaway

- **GIVEN** el id `irt_normalized_accuracy`
- **WHEN** se invoca `getConcept`
- **THEN** el título contiene `Oído Real` y la fórmula contiene `Acierto - c`

#### Scenario: Concepto inexistente devuelve null

- **GIVEN** un id no registrado
- **WHEN** se invoca `getConcept`
- **THEN** el resultado es `null`

### Requirement: Generación de Informes Diagnósticos (generateDiagnosticReport)

El motor MUST (DEBE) traducir las métricas en un informe clínico legible, con secciones estables y un plan de acción accionable.

- El informe MUST entregar `title`, `date`, `executiveSummary`, `perceptualDiagnosis`, `cognitiveLatencyAnalysis`, `directionalBiasAnalysis` y `concreteActionPlan`.
- Sin datos (`totalAnswers === 0`), MUST degradarse resumiendo ausencia de sesiones sin lanzar errores.
- El resumen ejecutivo MUST segmentar en `AVANZADO` (`>= 85`), `INTERMEDIO CONSOLIDADO` (`>= 65`) o `ENTRENAMIENTO FORMATIVO` (resto).
- El análisis de sesgo direccional del informe MUST aplicar exactamente el mismo criterio que el motor: declarar sesgo agudo solo si `sharpBiasCount > flatBiasCount * BIAS_DOMINANCE_RATIO` y sesgo grave solo si `flatBiasCount > sharpBiasCount * BIAS_DOMINANCE_RATIO`, prohibido cualquier factor divergente (ej. `1.5`). Alternativamente MUST derivarse directamente de los `dominantBias` ya computados en las métricas, de modo que informe y motor nunca se contradigan para los mismos datos.

#### Scenario: Informe con datos genera plan accionable

- **GIVEN** métricas con respuestas, notas difíciles y un par de confusión dominante
- **WHEN** se genera el informe
- **THEN** `concreteActionPlan.length > 0`, menciona las notas débiles y trabaja el par conflictivo

#### Scenario: Informe sin datos no se rompe

- **GIVEN** métricas con `totalAnswers === 0`
- **WHEN** se genera el informe
- **THEN** el resumen explica que no hay sesiones

#### Scenario: Informe y motor coinciden en el sesgo

- **GIVEN** métricas con `sharpBiasCount === 7` y `flatBiasCount === 2` (sesgo agudo dominante bajo `1.4`)
- **WHEN** se genera el informe
- **THEN** `directionalBiasAnalysis` declara el SESGO HACIA LO AGUDO, coincidiendo con el `dominantBias` del motor y sin aplicar un factor `1.5` divergente

### Requirement: Store de Analítica y Segmentación por Modalidad (useAnalyticsStore)

El store MUST (DEBE) centralizar las métricas calculadas y recalcularlas de forma consistente al cambiar el filtro de modalidad.

- El estado MUST exponer `modeFilter` (default `'all'`), `metrics` y las acciones `setModeFilter` y `recomputeMetrics`.
- `setModeFilter(filter, sessions, answers)` MUST delegar a `computeAnalyticsMetrics`.
- `recomputeMetrics(sessions, answers)` MUST reutilizar el `modeFilter` vigente sin alterarlo.
- Las funciones `isSingleNoteSession`, `isIntervalSession`, `isSequenceSession` e `isRepertoireSession` MUST priorizar `targetMode` canónico.

#### Scenario: Recálculo al cambiar de modalidad

- **GIVEN** un store con una sesión de notas y una de intervalos
- **WHEN** se aplica `setModeFilter('all')`
- **THEN** `metrics.totalAnswers === 2`
- **WHEN** se aplica `setModeFilter('single_note')`
- **THEN** `metrics.totalAnswers === 1`

### Requirement: Componentes de Analítica (KPIs, Matriz, Longitudinal, Detalle)

La UI de analítica MUST (DEBE) consumir exclusivamente los modelos de dominio, sin recalcular psicometría propia ni conocer la base de datos directamente.

- `AnalyticsKpiCards` MUST renderizar cuatro KPIs: sesiones, Oído Real (IRT), entropía y latencia; coloreando el KPI de IRT con la misma escala umbral (`>= MASTERED_MIN` esmeralda, `>= CRITICAL_MAX` ámbar, resto rosa).
- `ConfusionMatrixTab` MUST construir la matriz 12×12 solo cuando haya respuestas, mostrando estado vacío instructivo en caso contrario.
- `SessionDetailModal` MUST retornar `null` cuando esté cerrado o no haya sesión, mostrando la línea de tiempo con las bandas de los 4 factores, el heatmap y el botón `Re-testar esta Sesión`.
- La vista contenedora (`AnalyticsView`) MUST delegar la totalidad del filtrado de sesiones a `filterSessionsAdvanced`, incluyendo `inputSource`, `biasFilter` e `isiFilter`. Está prohibido encadenar `.filter()` propios sobre la lista de sesiones o de análisis psicométrico para reproducir un filtro declarado en `AnalyticsFilterOptions`; la función de dominio es el único lugar donde vive ese conocimiento.

#### Scenario: KPI de IRT coloreado según precisión normalizada

- **GIVEN** métricas con `normalizedOverallAccuracy === 90`
- **WHEN** se renderiza `AnalyticsKpiCards`
- **THEN** el valor de Oído Real se muestra en esmeralda

#### Scenario: Matriz con estado vacío instructivo

- **GIVEN** `ConfusionMatrixTab` con `answers` vacío
- **WHEN** se renderiza
- **THEN** se muestra un mensaje indicando que no hay respuestas

#### Scenario: Re-testeo delega al dominio y cierra el modal

- **GIVEN** `SessionDetailModal` abierto con una sesión válida
- **WHEN** se pulsa `Re-testar esta Sesión`
- **THEN** se invoca `reconstructSessionConfig` y el modal se cierra

#### Scenario: La vista no reimplementa filtros del dominio

- **GIVEN** el componente `AnalyticsView` con `selectedInputSource`, `selectedBias` y `selectedIsi` activos
- **WHEN** se inspecciona su código
- **THEN** no contiene `.filter(` propios sobre la lista de análisis para `inputMethod`, `dominantBias` ni bandas ISI, y pasa los tres valores a `filterSessionsAdvanced`

### Requirement: Filtros Avanzados de Sesión en el Dominio Puro

El motor MUST (DEBE) implementar en `filterSessionsAdvanced` la totalidad de las dimensiones declaradas en `AnalyticsFilterOptions`, de forma que el contrato de pipeline de dominio puro se cumpla sin lógica fugada en la capa de presentación.

- `inputSource` MUST filtrar por el método de entrada efectivo de la sesión: `'hardware'` (sin respuestas de interfaz virtual), `'virtual'` (sin respuestas de hardware) o `'mixed'` (ambas presentes). El valor `'all'` MUST no filtrar.
- `biasFilter` MUST comparar contra el `dominantBias` de la sesión, computado con `BIAS_DOMINANCE_RATIO` (`1.4`). El valor `'all'` MUST no filtrar.
- `isiFilter` MUST clasificar cada sesión según su intervalo respecto a la sesión cronológicamente anterior, usando `ISI_THRESHOLDS`: `'massed'` cuando `gap < MASSED_MAX_MS`, `'optimal'` cuando `OPTIMAL_MIN_MS <= gap <= OPTIMAL_MAX_MS`, y `'spaced'` cuando `gap > OPTIMAL_MAX_MS`. El valor `'all'` MUST no filtrar.
- **Exclusión de la sesión inicial:** la primera sesión de la cronología tiene `gap === null` y MUST NO pertenecer a ninguna banda de intervalo. Solo MUST coincidir cuando `isiFilter === 'all'`; con `'massed'`, `'optimal'` o `'spaced'` MUST quedar excluida. Está prohibido tratar `gap === null` como equivalente de `'spaced'`.
- Los tres filtros nuevos MUST combinarse de forma conjuntiva con los ya existentes (modo, instrumento, estrategia, preset, formato, pool, maestría y búsqueda).

#### Scenario: Filtrado por fuente de entrada

- **GIVEN** tres sesiones con `inputMethod` `'hardware'`, `'virtual'` y `'mixed'`
- **WHEN** se aplica `filterSessionsAdvanced` con `inputSource: 'virtual'`
- **THEN** solo se devuelve la sesión `'virtual'`
- **WHEN** se aplica `inputSource: 'all'`
- **THEN** se devuelven las tres sesiones

#### Scenario: Filtrado por sesgo dominante

- **GIVEN** una sesión con `dominantBias === 'sharp'` y otra con `dominantBias === 'balanced'`
- **WHEN** se aplica `filterSessionsAdvanced` con `biasFilter: 'sharp'`
- **THEN** solo se devuelve la sesión con sesgo `'sharp'`

#### Scenario: Bandas ISI clasificadas desde la SSOT

- **GIVEN** tres sesiones consecutivas con gaps de `600000` ms, `50000000` ms y `200000000` ms respecto a su sesión anterior
- **WHEN** se aplica `filterSessionsAdvanced` con `isiFilter: 'massed'`, luego `'optimal'` y luego `'spaced'`
- **THEN** la sesión de `600000` ms es la única devuelta por `'massed'`, la de `50000000` ms la única por `'optimal'`, y la de `200000000` ms la única por `'spaced'`

#### Scenario: La primera sesión no es espaciada

- **GIVEN** una única sesión en el historial (o la primera de la cronología), cuyo `interSessionGapMs === null`
- **WHEN** se aplica `filterSessionsAdvanced` con `isiFilter: 'spaced'`
- **THEN** la sesión NO es devuelta (no pertenece a ninguna banda de intervalo)
- **WHEN** se aplica `filterSessionsAdvanced` con `isiFilter: 'all'`
- **THEN** la sesión sí es devuelta

#### Scenario: Filtros nuevos se combinan conjuntamente con los existentes

- **GIVEN** sesiones que satisfacen `mode: 'single_note'` y, entre ellas, solo una con `inputSource: 'hardware'` y `biasFilter: 'flat'`
- **WHEN** se aplica `filterSessionsAdvanced` con `mode: 'single_note'`, `inputSource: 'hardware'` y `biasFilter: 'flat'`
- **THEN** únicamente se devuelve esa sesión, verificando la conjunción de dimensiones
