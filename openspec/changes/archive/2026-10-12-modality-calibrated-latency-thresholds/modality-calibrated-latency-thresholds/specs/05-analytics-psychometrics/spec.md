# Spec Delta

## MODIFIED Requirements

### Requirement: Fuente Única de Verdad de Umbrales Psicoacústicos

Todo el sistema MUST (DEBE) leer sus umbrales psicométricos exclusivamente desde las constantes canónicas de `historyAnalytics.ts`, prohibiendo la codificación rígida de números umbral en cualquier otro archivo.

- `COGNITIVE_LATENCY_THRESHOLDS` MUST contener exactamente: `FAST_MAX_MS: 1400`, `MEDIUM_MAX_MS: 2800`, `FAST_LABEL: '< 1.4s'`, `MEDIUM_LABEL: '1.4s - 2.8s'`, `SLOW_LABEL: '> 2.8s'`. Esta configuración corresponde a la modalidad **Single Note** y se mantiene para retrocompatibilidad total.
- `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` MUST ser un objeto tipado `Record<ModalityKey, LatencyThresholdConfig>` que exponga la configuración por modalidad:
  - `single_note`: `FAST_MAX_MS: 1400`, `MEDIUM_MAX_MS: 2800`, `FAST_LABEL: '< 1.4s'`, `MEDIUM_LABEL: '1.4s - 2.8s'`, `SLOW_LABEL: '> 2.8s'`
  - `intervals`: `FAST_MAX_MS: 2400`, `MEDIUM_MAX_MS: 3800`, `FAST_LABEL: '< 2.4s'`, `MEDIUM_LABEL: '2.4s - 3.8s'`, `SLOW_LABEL: '> 3.8s'`
  - `sequences`: `FAST_MAX_MS: 3500`, `MEDIUM_MAX_MS: 5000`, `FAST_LABEL: '< 3.5s'`, `MEDIUM_LABEL: '3.5s - 5.0s'`, `SLOW_LABEL: '> 5.0s'`
  - `repertoire`: `FAST_MAX_MS: 2500`, `MEDIUM_MAX_MS: 4000`, `FAST_LABEL: '< 2.5s'`, `MEDIUM_LABEL: '2.5s - 4.0s'`, `SLOW_LABEL: '> 4.0s'`
- El espectro de latencia clasifica cada respuesta según la modalidad de la sesión:
  - **Single Note**: Reflejo Inmediato `< 1400ms`, Deducción Activa `1400–2800ms`, Incertidumbre/Esfuerzo `> 2800ms`
  - **Intervals**: Reflejo Inmediato `< 2400ms`, Deducción Activa `2400–3800ms`, Incertidumbre/Esfuerzo `> 3800ms`
  - **Sequences**: Reflejo Inmediato `< 3500ms`, Deducción Activa `3500–5000ms`, Incertidumbre/Esfuerzo `> 5000ms`
  - **Repertoire**: Reflejo Inmediato `< 2500ms`, Deducción Activa `2500–4000ms`, Incertidumbre/Esfuerzo `> 4000ms`
- La función helper `getLatencyThresholds(mode?: string): LatencyThresholdConfig` MUST resolver la configuración correcta dado un `targetMode` canónico (o inferido), defaulting a `single_note` cuando el modo no sea reconocido.
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

#### Scenario: Single Note - Reflejo classification at boundary

- **GIVEN** tres respuestas con `responseTimeMs` de `1350`, `2100` y `3200` en una sesión `targetMode: 'single_note'`
- **WHEN** se ejecuta `computeAnalyticsMetrics` sobre ellas
- **THEN** `fastResponsesCount === 1`, `mediumResponsesCount === 1` y `slowResponsesCount === 1`

#### Scenario: Intervals - Reflejo classification uses modality-specific threshold

- **GIVEN** tres respuestas con `responseTimeMs` de `2350`, `3100` y `4200` en una sesión `targetMode: 'intervals'`
- **WHEN** se ejecuta `computeAnalyticsMetrics` sobre ellas
- **THEN** `fastResponsesCount === 1`, `mediumResponsesCount === 1` y `slowResponsesCount === 1`

#### Scenario: Sequences - Reflejo classification uses modality-specific threshold

- **GIVEN** tres respuestas con `responseTimeMs` de `3400`, `4200` y `5500` en una sesión `targetMode: 'sequences'`
- **WHEN** se ejecuta `computeAnalyticsMetrics` sobre ellas
- **THEN** `fastResponsesCount === 1`, `mediumResponsesCount === 1` y `slowResponsesCount === 1`

#### Scenario: Repertoire - Reflejo classification uses modality-specific threshold

- **GIVEN** tres respuestas con `responseTimeMs` de `2400`, `3300` y `4500` en una sesión `targetMode: 'repertoire'`
- **WHEN** se ejecuta `computeAnalyticsMetrics` sobre ellas
- **THEN** `fastResponsesCount === 1`, `mediumResponsesCount === 1` y `slowResponsesCount === 1`

#### Scenario: getLatencyThresholds helper resolves correct config

- **GIVEN** `getLatencyThresholds('intervals')`
- **WHEN** se invoca la función
- **THEN** retorna configuración con `FAST_MAX_MS === 2400` y `FAST_LABEL === '< 2.4s'`

#### Scenario: getLatencyThresholds defaults to single_note for unknown mode

- **GIVEN** `getLatencyThresholds('unknown_mode')`
- **WHEN** se invoca la función
- **THEN** retorna configuración con `FAST_MAX_MS === 1400` y `FAST_LABEL === '< 1.4s'`

#### Scenario: ConfusionMatrixTab renders modality-specific labels

- **GIVEN** el componente `ConfusionMatrixTab` montado con métricas válidas de una sesión `intervals`
- **WHEN** se renderiza
- **THEN** contiene `Reflejo Inmediato (< 2.4s)` y `Deducción Activa (2.4s - 3.8s)`

#### Scenario: SessionsTableTab column header shows modality-specific label

- **GIVEN** `SessionsTableTab` con `modeFilter === 'intervals'`
- **WHEN** se renderiza el encabezado de la columna de reflejo
- **THEN** el texto es `REFLEJO (< 2.4s)`

#### Scenario: SessionDetailModal SVG chart line positioned at modality FAST threshold

- **GIVEN** `SessionDetailModal` abierto con una sesión `targetMode: 'intervals'`
- **WHEN** se renderiza el gráfico de línea de tiempo
- **THEN** la línea punteada de umbral reflejo está posicionada en `2400ms` (2.4s) en el eje Y

#### Scenario: Backward compatibility - COGNITIVE_LATENCY_THRESHOLDS still points to single_note

- **GIVEN** código existente que importa `COGNITIVE_LATENCY_THRESHOLDS` desde `historyAnalytics.ts`
- **WHEN** se inspecciona el valor
- **THEN** `FAST_MAX_MS === 1400` y `FAST_LABEL === '< 1.4s'`
