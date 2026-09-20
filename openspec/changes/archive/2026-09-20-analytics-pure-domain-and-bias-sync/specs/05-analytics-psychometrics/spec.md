## MODIFIED Requirements

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

## ADDED Requirements

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
