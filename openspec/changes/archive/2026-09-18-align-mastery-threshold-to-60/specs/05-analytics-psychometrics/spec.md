## MODIFIED Requirements

### Requirement: Fuente Única de Verdad de Umbrales Psicoacústicos

Todo el sistema MUST (DEBE) leer sus umbrales psicométricos exclusivamente desde las constantes canónicas de `historyAnalytics.ts`, prohibiendo la codificación rígida de números umbral en cualquier otro archivo.

- `COGNITIVE_LATENCY_THRESHOLDS` MUST contener exactamente: `FAST_MAX_MS: 1400`, `MEDIUM_MAX_MS: 2800`, `FAST_LABEL: '< 1.4s'`, `MEDIUM_LABEL: '1.4s - 2.8s'`, `SLOW_LABEL: '> 2.8s'`.
- El espectro de latencia clasifica cada respuesta: **Reflejo Inmediato** `< 1400ms`, **Deducción Activa** entre `1400ms` y `2800ms`, e **Incertidumbre / Esfuerzo** `> 2800ms`.
- `MASTERY_THRESHOLDS` MUST contener exactamente `MASTERED_MIN: 85`, `LEARNING_MIN: 60` y `CRITICAL_MAX: 60`, definiendo: **Dominado** `>= 85%`, **En Aprendizaje** entre `60%` y `84%`, y **Crítico** `< 60%`. La frontera del 60% está fundamentada psicométricamente: es el primer umbral que se separa de forma robusta de la línea base de azar de un ejercicio 2AFC con `poolSize = 2` (`c = 50%`), evitando que la banda Crítico absorba el ruido de azar.
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
