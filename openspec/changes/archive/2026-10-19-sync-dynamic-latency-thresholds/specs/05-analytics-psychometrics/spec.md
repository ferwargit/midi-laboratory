# Spec Delta — 05-analytics-psychometrics

## MODIFIED Requirements

### Requirement: Fuente Única de Verdad de Umbrales Psicoacústicos

Todo el sistema MUST (DEBE) leer sus umbrales psicométricos exclusivamente desde las constantes canónicas de `historyAnalytics.ts`, prohibiendo la codificación rígida de números umbral en cualquier otro archivo.

- La SSOT de latencia cognitiva MUST ser `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` (con las cuatro modalidades `single_note`, `intervals`, `sequences`, `repertoire`) junto al resolvedor `getLatencyThresholds(mode)`, que hace fallback a `single_note` ante un modo ausente, vacío o no reconocido. El export deprecado `COGNITIVE_LATENCY_THRESHOLDS` MUST NOT existir en el código; todo consumidor previo MUST haber migrado a la resolución por modalidad.
- El espectro de latencia MUST clasificar cada respuesta según la configuración resuelta para su modalidad: **Reflejo Inmediato** `< FAST_MAX_MS`, **Deducción Activa** entre `FAST_MAX_MS` y `MEDIUM_MAX_MS`, e **Incertidumbre / Esfuerzo** `> MEDIUM_MAX_MS`. Para `single_note` esto corresponde a `< 1400ms`, `1400-2800ms` y `> 2800ms`; para `intervals` a `2400/3800ms`; para `sequences` a `3500/5000ms`; para `repertoire` a `2500/4000ms`.
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

#### Scenario: El alias deprecado desaparece sin referencias huérfanas

- **GIVEN** el árbol completo de `src/`
- **WHEN** se busca el identificador `COGNITIVE_LATENCY_THRESHOLDS` (coincidencia exacta, excluyendo `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE`)
- **THEN** no existe ninguna ocurrencia en código de producción ni en tests, salvo el string literal del propio test de regresión (`thresholdsConsistency.test.tsx`) que afirma y salvaguarda su ausencia (`'COGNITIVE_LATENCY_THRESHOLDS' in thresholdsModule === false`); en particular, ningún archivo importa, consume o referencia el alias como valor

#### Scenario: Resolución de umbrales por modalidad con fallback seguro

- **GIVEN** los modos `'intervals'`, `'sequences'`, `'repertoire'`, `'single_note'`, `undefined`, `''` y `'desconocido'`
- **WHEN** se invoca el resolvedor de umbrales de la SSOT con cada uno
- **THEN** devuelve la configuración de `intervals` (2400/3800), `sequences` (3500/5000), `repertoire` (2500/4000), `single_note` (1400/2800), y para `undefined`, `''` y `'desconocido'` la de `single_note`

### Requirement: Cronometría por Nota y por Octava (computePerNoteLatencyStats)

El motor MUST (DEBE) desglosar la latencia por nota individual y agregarla por octava, distinguiendo reconocimiento reflejo de deducción, resolviendo el umbral de reflejo rápido desde la SSOT según la modalidad indicada.

- Solo las respuestas correctas MUST alimentar las latencias y el conteo de reflejos rápidos.
- `fastReflexPercent` MUST ser la proporción de respuestas correctas por debajo de `FAST_MAX_MS` de la configuración resuelta mediante `getLatencyThresholds(mode)` sobre el total de correctas. Sin modo explícito MUST resolver `single_note` (1400 ms), preservando el comportamiento histórico.
- La octava MUST calcularse como `Math.floor(noteNumber / 12) - 1`.
- `fastestNote` y `slowestNote` solo MUST definirse sobre notas con al menos una correcta y latencia positiva.

#### Scenario: Nota fallada no contamina la latencia promedio

- **GIVEN** respuestas donde la nota `60` tiene un acierto de `1000ms` y un fallo de `4000ms`
- **WHEN** se calculan las estadísticas por nota
- **THEN** `avgLatencyMs` de la nota `60` es `1000` y su `accuracyPercentage` es `50`

#### Scenario: El conteo de reflejos rápidos varía con la modalidad

- **GIVEN** una nota con dos aciertos de `2000ms` y `3000ms`
- **WHEN** se calculan las estadísticas por nota con modo `single_note` y con modo `sequences`
- **THEN** con `single_note` `fastReflexPercent` es `0` (ambas superan 1400 ms), y con `sequences` es `100` (ambas quedan por debajo de 3500 ms)

#### Scenario: Frontera inclusiva del umbral resuelto por modalidad

- **GIVEN** un acierto con `responseTimeMs` exactamente igual a `FAST_MAX_MS` de la modalidad indicada
- **WHEN** se calculan las estadísticas por nota con ese modo
- **THEN** la respuesta NO cuenta como reflejo rápido (`fastReflexPercent === 0`), manteniendo la frontera estricta `< FAST_MAX_MS`

## ADDED Requirements

### Requirement: Resolución de Umbrales del Gráfico de Latencia por Modalidad

El gráfico de latencia por nota MUST (DEBE) resolver sus umbrales mediante `getLatencyThresholds` según el filtro de modalidad activo, sin consumir el alias deprecado `COGNITIVE_LATENCY_THRESHOLDS`.

- `AnalyticsView` MUST suministrar el `modeFilter` vigente al gráfico, de modo que cambiar el filtro actualice la configuración resuelta.
- Con filtro `'all'` (o sin filtro) MUST usarse la configuración de `single_note`, coincidiendo con el motor para el mismo filtro.

#### Scenario: El contenedor suministra el filtro de modalidad al gráfico

- **GIVEN** el componente `AnalyticsView` con un `modeFilter` vigente distinto de `'all'`
- **WHEN** se renderiza la pestaña de gráficos
- **THEN** `AnalyticsCharts` recibe ese `modeFilter` como prop y el gráfico de latencia usa la configuración de umbrales correspondiente

#### Scenario: Filtro global coincide con el motor

- **GIVEN** la vista de analítica con el filtro `'all'`
- **WHEN** se renderiza el gráfico de latencia por nota
- **THEN** usa la configuración de `single_note` (1400/2800 ms), la misma que el motor aplica para computar `fastResponsesCount`/`mediumResponsesCount`/`slowResponsesCount` con ese filtro

### Requirement: Renderizado Dinámico del Gráfico de Latencia

La línea de referencia de reflejo rápido, la etiqueta numérica del eje, el coloreado de barras (reflejo/deducción/duda) y la leyenda del gráfico de latencia MUST (DEBE) derivarse de la configuración de umbrales resuelta (`FAST_MAX_MS`, `MEDIUM_MAX_MS`, `FAST_LABEL`, `MEDIUM_LABEL`, `SLOW_LABEL`), prohibidos los literales de tiempo fijos (como `1.4s` o `2.8s`) en el componente.

#### Scenario: Línea de referencia y colores siguen la modalidad activa

- **GIVEN** la vista de analítica con el filtro de modalidad `sequences` y datos con latencias medias de `2000ms`, `4000ms` y `6000ms`
- **WHEN** se renderiza el gráfico de latencia por nota
- **THEN** la línea de referencia se dibuja en `3500ms` con su etiqueta `3.5s`, la barra de `2000ms` se pinta como reflejo, la de `4000ms` como deducción y la de `6000ms` como duda

#### Scenario: La leyenda refleja las etiquetas de la modalidad

- **GIVEN** la vista de analítica con el filtro de modalidad `intervals`
- **WHEN** se renderiza la leyenda del gráfico de latencia
- **THEN** muestra las bandas construidas desde las etiquetas SSOT de `intervals` (`< 2.4s`, `2.4s - 3.8s`, `> 3.8s`) y no contiene los literales `1.4s` ni `2.8s`
