# Proposal

## Why

La explicación pedagógica de la Latencia Cognitiva está desincronizada entre las tres superficies que la comunican al usuario (Diccionario Pedagógico, Guía Psicoacústica y Generador de Informes Diagnósticos). El Diccionario y el Generador de Informes consumen la constante deprecada `COGNITIVE_LATENCY_THRESHOLDS` (equivalente a `single_note`), ignorando los umbrales calibrados por modalidad de `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE`; y el diagrama `LatencySpectrumDiagram.tsx` solo renderiza la escala de Nota Individual. El resultado son textos clínicos que citan `< 1.4s` aunque el usuario esté entrenando intervalos (`< 2.4s`), secuencias (`< 3.5s`) o repertorio (`< 2.5s`), contradiciendo la clasificación real que el motor ya aplica por sesión. Además, el concepto `cognitive_latency` carece de la explicación psicométrica del fundamento (Donders/Sternberg: descuento del tiempo de emisión acústica y ejecución motora secuencial) que justifica los umbrales por modalidad.

## What Changes

- **Diccionario Pedagógico (`pedagogicalDictionary.ts`)**: el concepto `cognitive_latency` pasa a importar `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` y construye `formulaOrCalculation` y `practicalTakeaway` interpolando dinámicamente las etiquetas `FAST_LABEL` / `MEDIUM_LABEL` / `SLOW_LABEL` de las 4 modalidades (`single_note`, `intervals`, `sequences`, `repertoire`), citando el fundamento psicométrico de Donders/Sternberg. CERO literales de tiempo hardcodeados.
- **Generador de Informes (`diagnosticReportGenerator.ts`)**: `generateDiagnosticReport(metrics)` resuelve `const thresholds = getLatencyThresholds(metrics.modeFilter)` y redacta `cognitiveLatencyAnalysis` interpolando exclusivamente `${thresholds.FAST_LABEL}` / `${thresholds.MEDIUM_LABEL}` / `${thresholds.SLOW_LABEL}`. Se elimina el consumo de la constante deprecada `COGNITIVE_LATENCY_THRESHOLDS`.
- **Guía Psicoacústica (`LatencySpectrumDiagram.tsx`)**: el diagrama deriva sus puntos de corte y etiquetas directamente de la SSOT por modalidad, con un selector interactivo de modalidad (o comparativa dinámica de las 4 modalidades en paralelo); las marcas de tiempo del SVG se calculan dinámicamente con `(thresholds.FAST_MAX_MS / 1000).toFixed(1) + 's'` y `(thresholds.MEDIUM_MAX_MS / 1000).toFixed(1) + 's'`.
- **Pruebas de consistencia SSOT (`thresholdsConsistency.test.tsx`)**: nuevos tests TDD que validan que el Diccionario contiene exactamente las etiquetas dinámicas de las 4 modalidades, que el informe con `modeFilter: 'intervals'` interpola `getLatencyThresholds('intervals').FAST_LABEL`, y que un cambio en `thresholds.ts` se propaga automáticamente a los textos generados.
- **Especificación (`05-analytics-psychometrics`)**: los requisitos "Diccionario Pedagógico Centralizado" y "Generación de Informes Diagnósticos" se actualizan para establecer contractualmente que los textos clínicos y conceptuales DEBEN interpolarse desde la SSOT de umbrales por modalidad.

## Capabilities

### New Capabilities

<!-- Ninguna: el cambio sincroniza capacidades existentes. -->

### Modified Capabilities

- `05-analytics-psychometrics`: se endurecen los requisitos "Diccionario Pedagógico Centralizado (pedagogicalDictionary)" y "Generación de Informes Diagnósticos (generateDiagnosticReport)" para exigir interpolación exclusiva desde `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` / `getLatencyThresholds()` por modalidad, prohibiendo literales de tiempo fijos fuera de la SSOT; se añaden escenarios de propagación automática y de sincronía informe-motor por modalidad.

## Impact

- **Código afectado**:
  - `src/renderer/src/domain/analytics/pedagogicalDictionary.ts` (concepto `cognitive_latency`)
  - `src/renderer/src/domain/analytics/diagnosticReportGenerator.ts` (sección `cognitiveLatencyAnalysis`)
  - `src/renderer/src/components/views/guide/LatencySpectrumDiagram.tsx` (escala visual por modalidad)
- **Pruebas afectadas**: `src/renderer/src/domain/analytics/thresholdsConsistency.test.tsx`, `pedagogicalDictionary.test.ts` (el test actual que aserta `< 1.4s` literal en `practicalTakeaway` debe actualizarse a la aserción dinámica), `knowledgeGuide.test.ts` (verificar que no dependa de textos fijos de latencia).
- **SSOT (sin cambios)**: `src/renderer/src/domain/analytics/thresholds.ts` es la única fuente; no se modifican sus valores ni su API.
- **Riesgos**: los tests existentes que asumen la escala de `single_note` en textos generados pueden romper; se mitigan actualizando las aserciones a interpolación dinámica. La suite completa (629+ tests) debe pasar con `npm run typecheck` y `npm run test`.
