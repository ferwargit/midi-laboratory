# Spec Delta — 05-analytics-psychometrics

## ADDED Requirements

### Requirement: Resolución SSOT de Modalidad y Pool de Sesión

El sistema MUST (DEBE) resolver la modalidad y el tamaño nominal del pool de una sesión desde un único módulo SSOT, prohibiendo heurísticas duplicadas en los consumidores. La modalidad MUST priorizar el campo canónico `targetMode`, con fallback heredado de prioridad única (repertorio → intervalos → secuencias → notas sueltas) y `null` si nada clasifica. El pool MUST anclarse primero a los presets canónicos, con heurísticas históricas y conteo empírico solo como fallback y piso `2`.

#### Scenario: Modalidad desde targetMode canónico

- **GIVEN** una sesión con `targetMode: 'intervals'` y `presetName` que no menciona intervalos
- **WHEN** se resuelve su modalidad
- **THEN** el resultado es `intervals`, derivado exclusivamente del campo canónico

#### Scenario: Registro heredado sin targetMode cae a heurísticas con prioridad única

- **GIVEN** una sesión sin `targetMode` cuyo `strategyId` es `intervals_v1` y cuyo `presetName` menciona tanto intervalos como secuencias
- **WHEN** se resuelve su modalidad
- **THEN** el resultado es `intervals` (prioridad repertorio → intervalos → secuencias), y los predicados derivados son mutuamente excluyentes

#### Scenario: Sesión sin señales clasificables no es clasificada

- **GIVEN** una sesión sin `targetMode`, con `strategyId` e `instrumentId` genéricos y `presetName` sin palabras clave
- **WHEN** se resuelve su modalidad
- **THEN** el resultado es "no clasificable" y ningún predicado de modalidad la acepta

#### Scenario: Pool data-driven contra los tres catálogos canónicos

- **GIVEN** cada preset definido en `presets.ts`, `intervals.ts` y `sequences.ts`
- **WHEN** se resuelve el pool de una sesión cuyo `presetName` es el nombre canónico de ese preset
- **THEN** el pool coincide con la cantidad real de notas/elementos del preset (`notes.length`, `intervalSemitones.length` o `candidateNotes.length`)

#### Scenario: Pool por heurística histórica para registros heredados

- **GIVEN** sesiones heredadas con `presetName` `Intervalos (6 activos) • Bloque 10 preguntas` y `Nivel 1 (C, D, E) • Cronometrado 1m`
- **WHEN** se resuelve su pool sin coincidencia canónica exacta
- **THEN** los resultados son `6` y `3` respectivamente, idénticos al comportamiento histórico

#### Scenario: Pool empírico como último recurso con piso 2

- **GIVEN** una sesión con `presetName` no reconocible y respuestas sobre 4 notas esperadas únicas
- **WHEN** se resuelve su pool con esas respuestas y luego sin respuestas
- **THEN** el resultado es `4` con respuestas y `2` sin ellas (piso de azar 2AFC)

## MODIFIED Requirements

### Requirement: Corrección por Azar (Teoría de Respuesta al Ítem)

El motor MUST (DEBE) descontar la probabilidad de acertar por pura suerte antes de declarar una precisión, de forma que un pool chico no infle artificialmente el mérito.

- La línea base de azar MUST ser `c = 1 / poolSize`.
- La precisión normalizada MUST ser `NormAcc = ((RawAcc - c) / (1 - c)) * 100`, acotada estrictamente a `[0, 100]`.
- Si `RawAcc <= c`, la precisión normalizada MUST ser exactamente `0%`.
- El `poolSize` nominal MUST resolverse mediante el resolvedor SSOT de la capacidad (ver «Resolución SSOT de Modalidad y Pool de Sesión»): primero desde los presets canónicos del sistema, después mediante las heurísticas históricas sobre `presetName` (solo fallback defensivo para registros heredados) y en último término desde el conteo empírico de notas únicas, con un mínimo de `2` en toda rama derivada.
- La entropía contextual de Shannon MUST ser `H = log2(poolSize)` en bits, con 2 decimales.

#### Scenario: Precisión cruda vs. precisión real en pool pequeño

- **GIVEN** una sesión con `poolSize = 3` y `rawAccuracy = 80%`
- **WHEN** se calcula la precisión normalizada
- **THEN** la línea base de azar es `c = 0.333` y el resultado es `70%` real

#### Scenario: Desempeño igual o peor que el azar se normaliza a cero

- **GIVEN** una sesión con `poolSize = 2` (azar `c = 0.5`) y `rawAccuracy = 40%`
- **WHEN** se calcula la precisión normalizada
- **THEN** el resultado es `0%`, ya que `40% <= 50%`

#### Scenario: Pool canónico corrige presets antes mal resueltos

- **GIVEN** una sesión cuyo segmento de contenido es el preset canónico `Rango G4 a G5` (13 notas)
- **WHEN** se resuelve su pool
- **THEN** el resultado es `13`, derivado del catálogo canónico y no del conteo empírico

### Requirement: Reconstrucción de Prescripción de Re-testeo (reconstructSessionConfig)

El motor MUST (DEBE) poder regenerar un objeto `AiExercisePrescription` ejecutable que reproduzca la sesión histórica bajo las mismas condiciones.

- La modalidad MUST inferirse mediante el resolvedor SSOT de modalidad (priorizando `targetMode` canónico; registros heredados sin `targetMode` caen a los clasificadores históricos; default `single_note`). Las sesiones de repertorio MUST re-testearse como `single_note`.
- Para `single_note`, las notas recomendadas MUST reconstruirse desde los presets canónicos vía el resolvedor SSOT de pool/contenido (sin mapeo local duplicado en el módulo) o, en su defecto, desde notas esperadas únicas.
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

#### Scenario: Sesión heredada sin targetMode se reconstruye igual que antes

- **GIVEN** una sesión heredada sin `targetMode` cuyo `presetName` es `Nivel 2 (C a G)`
- **WHEN** se reconstruye su configuración
- **THEN** la modalidad resuelta es `single_note` y `recommendedNotes === [60, 62, 64, 65, 67]`, idéntico al comportamiento histórico

### Requirement: Store de Analítica y Segmentación por Modalidad (useAnalyticsStore)

El store MUST (DEBE) centralizar las métricas calculadas y recalcularlas de forma consistente al cambiar el filtro de modalidad.

- El estado MUST exponer `modeFilter` (default `'all'`), `metrics` y las acciones `setModeFilter` y `recomputeMetrics`.
- `setModeFilter(filter, sessions, answers)` MUST delegar a `computeAnalyticsMetrics`.
- `recomputeMetrics(sessions, answers)` MUST reutilizar el `modeFilter` vigente sin alterarlo.
- Las funciones `isSingleNoteSession`, `isIntervalSession`, `isSequenceSession` e `isRepertoireSession` MUST delegar en el resolvedor SSOT de modalidad, que prioriza `targetMode` canónico; su superficie pública vía el barrel `historyAnalytics.ts` MUST preservarse sin cambios para los consumidores.

#### Scenario: Recálculo al cambiar de modalidad

- **GIVEN** un store con una sesión de notas y una de intervalos
- **WHEN** se aplica `setModeFilter('all')`
- **THEN** `metrics.totalAnswers === 2`
- **WHEN** se aplica `setModeFilter('single_note')`
- **THEN** `metrics.totalAnswers === 1`

### Requirement: Filtros Avanzados de Sesión en el Dominio Puro

El motor MUST (DEBE) implementar en `filterSessionsAdvanced` la totalidad de las dimensiones declaradas en `AnalyticsFilterOptions`, de forma que el contrato de pipeline de dominio puro se cumpla sin lógica fugada en la capa de presentación.

- `inputSource` MUST filtrar por el método de entrada efectivo de la sesión: `'hardware'` (sin respuestas de interfaz virtual), `'virtual'` (sin respuestas de hardware) o `'mixed'` (ambas presentes). El valor `'all'` MUST no filtrar.
- `biasFilter` MUST comparar contra el `dominantBias` de la sesión, computado con `BIAS_DOMINANCE_RATIO` (`1.4`). El valor `'all'` MUST no filtrar.
- `isiFilter` MUST clasificar cada sesión según su intervalo respecto a la sesión cronológicamente anterior, usando `ISI_THRESHOLDS`: `'massed'` cuando `gap < MASSED_MAX_MS`, `'optimal'` cuando `OPTIMAL_MIN_MS <= gap <= OPTIMAL_MAX_MS`, y `'spaced'` cuando `gap > OPTIMAL_MAX_MS`. El valor `'all'` MUST no filtrar.
- **Exclusión de la sesión inicial:** la primera sesión de la cronología tiene `gap === null` y MUST NO pertenecer a ninguna banda de intervalo. Solo MUST coincidir cuando `isiFilter === 'all'`; con `'massed'`, `'optimal'` o `'spaced'` MUST quedar excluida. Está prohibido tratar `gap === null` como equivalente de `'spaced'`.
- El filtro de preset MUST resolver la coincidencia mediante el matching canónico-primero de la SSOT (segmento de contenido del `presetName` contra nombres canónicos de presets), con la matriz heurística histórica solo como fallback para registros heredados.
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

#### Scenario: Filtro de preset canónico coincide con sufijo de formato

- **GIVEN** una sesión con `presetName` `Nivel 1 (C, D, E) • Cronometrado 1m` y el filtro de preset `Nivel 1 (C, D, E)`
- **WHEN** se aplica `filterSessionsAdvanced` con ese `presetFilter`
- **THEN** la sesión coincide por matching canónico del segmento de contenido, sin depender de la matriz heurística

#### Scenario: Registro heredado de intervalos sigue coincidiendo con el filtro de preset

- **GIVEN** una sesión heredada con `presetName` `Nivel 1.1: Intervalos Clásicos • Bloque 10 preguntas` y el filtro de preset con el nombre canónico completo `Nivel 1.1: Intervalos Clásicos (2M, 3M, 4J, 5J, 8J)`
- **WHEN** se aplica `filterSessionsAdvanced` con ese `presetFilter`
- **THEN** la sesión coincide vía el fallback heurístico histórico, preservando el comportamiento de filtrado existente
