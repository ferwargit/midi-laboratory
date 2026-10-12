# Spec Delta

## Purpose

Provee umbrales de latencia cognitiva calibrados por modalidad de entrenamiento (Single Note, Intervals, Sequences, Repertoire) fundamentados en cronometría mental (Donders, Sternberg) y psicofísica auditiva, permitiendo clasificación precisa de Reflejo Inmediato, Deducción Activa e Incertidumbre/Esfuerzo según la demanda fisiológica real de cada modalidad.

## ADDED Requirements

### Requirement: LatencyThresholdConfig typed configuration per modality

El sistema MUST (DEBE) definir un tipo `LatencyThresholdConfig` con los campos: `FAST_MAX_MS: number`, `MEDIUM_MAX_MS: number`, `FAST_LABEL: string`, `MEDIUM_LABEL: string`, `SLOW_LABEL: string`. Cada modalidad MUST tener su propia instancia tipada.

#### Scenario: LatencyThresholdConfig structure is complete

- **GIVEN** el tipo `LatencyThresholdConfig`
- **WHEN** se inspecciona su definición
- **THEN** tiene exactamente los 5 campos requeridos con tipos correctos

### Requirement: COGNITIVE_LATENCY_THRESHOLDS_BY_MODE exposes all four modalities

El objeto `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` MUST contener exactamente cuatro claves: `single_note`, `intervals`, `sequences`, `repertoire`, cada una mapeando a su `LatencyThresholdConfig` correspondiente con los valores fisiológicos calibrados.

#### Scenario: All four modalities present with correct values

- **GIVEN** `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE`
- **WHEN** se inspeccionan sus claves y valores
- **THEN** tiene claves `single_note`, `intervals`, `sequences`, `repertoire`
- **AND** `single_note.FAST_MAX_MS === 1400`, `intervals.FAST_MAX_MS === 2400`, `sequences.FAST_MAX_MS === 3500`, `repertoire.FAST_MAX_MS === 2500`

### Requirement: getLatencyThresholds helper resolves by modality

La función exportada `getLatencyThresholds(mode?: string): LatencyThresholdConfig` MUST:

- Aceptar `mode` opcional (string canónico: `single_note`, `intervals`, `sequences`, `repertoire`)
- Retornar la configuración correspondiente a ese modo
- Default a `single_note` cuando `mode` es `undefined`, `null`, o no reconocido
- Ser la única forma autorizada de obtener umbrales en código de analítica y UI

#### Scenario: Helper returns correct config for each known modality

- **GIVEN** `getLatencyThresholds('sequences')`
- **WHEN** se invoca
- **THEN** retorna config con `FAST_MAX_MS === 3500` y `FAST_LABEL === '< 3.5s'`

#### Scenario: Helper defaults to single_note for unknown mode

- **GIVEN** `getLatencyThresholds('invalid')`
- **WHEN** se invoca
- **THEN** retorna config de `single_note` (`FAST_MAX_MS === 1400`)

### Requirement: Cognitive latency classification uses modality-specific thresholds in analytics engine

Las funciones `analyzeSessionTimeline` y `computeAnalyticsMetrics` en `historyAnalytics.ts` MUST:

- Resolver el `targetMode` de la sesión (o inferirlo)
- Obtener los umbrales vía `getLatencyThresholds(targetMode)`
- Clasificar cada respuesta correcta como `fast` (reflejo), `medium` (deducción), o `slow` (incertidumbre) usando los umbrales de esa modalidad
- Calcular `fastReflexPercent`, `mediumReflexPercent`, `slowReflexPercent` basados en los umbrales resueltos

#### Scenario: analyzeSessionTimeline uses modality thresholds for fastReflexCount

- **GIVEN** una sesión `intervals` con respuestas correctas en `2100ms`, `2200ms`, `3000ms`
- **WHEN** se ejecuta `analyzeSessionTimeline`
- **THEN** `fastReflexCount === 2` (ambas bajo 2400ms) y `slowReflexCount === 1`

#### Scenario: computeAnalyticsMetrics computes percentages using modality thresholds

- **GIVEN** una sesión `sequences` con 10 respuestas correctas: 3 en `3000ms`, 4 en `4000ms`, 3 en `6000ms`
- **WHEN** se ejecuta `computeAnalyticsMetrics`
- **THEN** `fastReflexPercent === 30`, `mediumReflexPercent === 40`, `slowReflexPercent === 30`

### Requirement: UI renders modality-calibrated labels and chart positions

Los componentes de UI MUST consumir los umbrales por modalidad para:

- `SessionsTableTab`: Encabezado de columna de reflejo muestra `FAST_LABEL` del modo filtrado (ej: `REFLEJO (< 2.4s)` para intervals)
- `SessionDetailModal`: Línea punteada del gráfico SVG y etiqueta de eje Y se posicionan en `FAST_MAX_MS` de la sesión (ej: 2400ms para intervals)

#### Scenario: SessionsTableTab header reflects filtered mode threshold

- **GIVEN** `SessionsTableTab` con `modeFilter = 'sequences'`
- **WHEN** se renderiza el encabezado de la columna reflejo
- **THEN** el texto contiene `REFLEJO (< 3.5s)`

#### Scenario: SessionDetailModal chart line at modality FAST threshold

- **GIVEN** `SessionDetailModal` con sesión `targetMode: 'repertoire'`
- **WHEN** se renderiza el gráfico SVG de latencia
- **THEN** la línea punteada horizontal está en coordenada Y correspondiente a `2500ms`
