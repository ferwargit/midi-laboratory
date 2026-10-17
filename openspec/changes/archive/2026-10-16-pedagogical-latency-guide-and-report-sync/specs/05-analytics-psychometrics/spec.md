# Spec Delta — 05-analytics-psychometrics

## MODIFIED Requirements

### Requirement: Diccionario Pedagógico Centralizado (pedagogicalDictionary)

El sistema MUST (DEBE) exponer un único diccionario de conceptos psicoacústicos, consultable por identificador, que alimente los tooltips educativos.

- `getConcept(id)` MUST devolver el `PedagogicalConcept` completo o `null` si el id no existe.
- Cada concepto MUST tener `id`, `title`, `subtitle`, `category`, `shortDefinition`, `formulaOrCalculation` y `practicalTakeaway`.
- El diccionario MUST cubrir: `irt_normalized_accuracy`, `shannon_entropy`, `cognitive_latency`, `responses_per_minute`, `directional_bias`, `test_retest_delta`, `leitner_system`, `inter_session_gap` y `cpi_score`.
- `cognitive_latency` MUST tomar sus umbrales textualmente de la SSOT por modalidad (`COGNITIVE_LATENCY_THRESHOLDS_BY_MODE`), interpolando dinámicamente las etiquetas `FAST_LABEL`, `MEDIUM_LABEL` y `SLOW_LABEL` de cada una de las 4 modalidades (`single_note`, `intervals`, `sequences`, `repertoire`) en `formulaOrCalculation` y `practicalTakeaway`. Queda prohibido escribir literales de tiempo fijos (como `< 1.4s`, `< 2.4s`, `1.4s - 2.8s`) como cadenas sueltas en el diccionario.
- `cognitive_latency` MUST citar en su explicación el fundamento psicométrico de la medición del tiempo de reacción (paradigma de Donders y Sternberg: descuento del tiempo de emisión acústica y de la ejecución motora secuencial), que justifica que los umbrales de velocidad refleja se calibren por modalidad.
- `cognitive_latency.practicalTakeaway` MUST explicar que una latencia en torno a los umbrales calibrados de la SSOT para cada modalidad (p. ej. `MEDIUM_MAX_MS` de `intervals` o de `sequences`) corresponde a velocidad de reflejo automático según la calibración vigente, sin fijar dichos valores como literales.

#### Scenario: Consulta de concepto con fórmula y takeaway

- **GIVEN** el id `irt_normalized_accuracy`
- **WHEN** se invoca `getConcept`
- **THEN** el título contiene `Oído Real` y la fórmula contiene `Acierto - c`

#### Scenario: Concepto inexistente devuelve null

- **GIVEN** un id no registrado
- **WHEN** se invoca `getConcept`
- **THEN** el resultado es `null`

#### Scenario: El concepto de latencia interpola las etiquetas de las 4 modalidades

- **GIVEN** el id `cognitive_latency`
- **WHEN** se invoca `getConcept`
- **THEN** `formulaOrCalculation` contiene exactamente las etiquetas `FAST_LABEL` y `MEDIUM_LABEL` de `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` para `single_note`, `intervals`, `sequences` y `repertoire`, y ninguna etiqueta aparece como literal suelto en el código fuente del diccionario

#### Scenario: El fundamento psicométrico está citado

- **GIVEN** el id `cognitive_latency`
- **WHEN** se inspecciona su explicación
- **THEN** menciona el descuento del tiempo de emisión acústica y de la ejecución motora secuencial (fundamento Donders/Sternberg) como justificación de los umbrales por modalidad

#### Scenario: Cambio en la SSOT se propaga al diccionario

- **GIVEN** un valor de `FAST_LABEL` alterado en la SSOT por modalidad
- **WHEN** se invoca `getConcept('cognitive_latency')`
- **THEN** el texto devuelto contiene la etiqueta alterada sin necesidad de editar el diccionario

### Requirement: Generación de Informes Diagnósticos (generateDiagnosticReport)

El motor MUST (DEBE) traducir las métricas en un informe clínico legible, con secciones estables y un plan de acción accionable.

- El informe MUST entregar `title`, `date`, `executiveSummary`, `perceptualDiagnosis`, `cognitiveLatencyAnalysis`, `directionalBiasAnalysis` y `concreteActionPlan`.
- Sin datos (`totalAnswers === 0`), MUST degradarse resumiendo ausencia de sesiones sin lanzar errores.
- El resumen ejecutivo MUST segmentar en `AVANZADO` (`>= 85`), `INTERMEDIO CONSOLIDADO` (`>= 65`) o `ENTRENAMIENTO FORMATIVO` (resto).
- El análisis de sesgo direccional del informe MUST aplicar exactamente el mismo criterio que el motor: declarar sesgo agudo solo si `sharpBiasCount > flatBiasCount * BIAS_DOMINANCE_RATIO` y sesgo grave solo si `flatBiasCount > sharpBiasCount * BIAS_DOMINANCE_RATIO`, prohibido cualquier factor divergente (ej. `1.5`). Alternativamente MUST derivarse directamente de los `dominantBias` ya computados en las métricas, de modo que informe y motor nunca se contradigan para los mismos datos.
- El análisis de latencia cognitiva (`cognitiveLatencyAnalysis`) MUST resolver la configuración de umbrales desde la SSOT por modalidad mediante `getLatencyThresholds(metrics.modeFilter)` y redactar el texto clínico interpolando exclusivamente las etiquetas dinámicas (`FAST_LABEL`, `MEDIUM_LABEL`, `SLOW_LABEL`) de la configuración resuelta. Queda prohibido cualquier literal de tiempo rígido (como `< 1.4s`) en el generador de informes.
- El informe y el motor de clasificación MUST coincidir en la escala de latencia para el mismo `modeFilter`: las etiquetas citadas en `cognitiveLatencyAnalysis` corresponden a la misma configuración que el motor usa para computar `fastResponsesCount`, `mediumResponsesCount` y `slowResponsesCount`.

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

#### Scenario: Informe interpola la etiqueta de la modalidad filtrada

- **GIVEN** métricas con `modeFilter: 'intervals'` y respuestas suficientes para activar la rama de reflejo inmediato
- **WHEN** se genera el informe
- **THEN** `cognitiveLatencyAnalysis` contiene exactamente `getLatencyThresholds('intervals').FAST_LABEL` y no contiene la etiqueta de `single_note`

#### Scenario: Cambio en la SSOT se propaga al informe

- **GIVEN** un valor de `FAST_LABEL` alterado en la SSOT para una modalidad
- **WHEN** se genera el informe con `modeFilter` de esa modalidad
- **THEN** `cognitiveLatencyAnalysis` contiene la etiqueta alterada sin necesidad de editar el generador
