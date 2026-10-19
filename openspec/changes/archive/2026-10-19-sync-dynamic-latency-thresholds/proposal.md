# Proposal

## Why

La auditoría V9 (hallazgo **F22**, severidad Media) detectó que el export deprecado `COGNITIVE_LATENCY_THRESHOLDS` (fijado a los umbrales de `single_note`: 1400/2800 ms) sigue consumido en producción por la analítica de latencia y los gráficos, mientras el motor psicométrico ya resuelve umbrales por modalidad mediante `getLatencyThresholds(sessionMode)` (intervals: 2400/3800; sequences: 3500/5000). El resultado es una incoherencia motor/gráfico: una respuesta de 3 s en secuencias es "deducción" para el motor pero se pinta como lenta en el gráfico, y `fastReflexPercent` se calcula con el umbral de otra modalidad. La deuda de deprecación además impide eliminar el alias sin romper consumidores activos.

## What Changes

- **`latencyStats.ts`**: `computePerNoteLatencyStats(answers)` acepta un parámetro opcional `mode` y resuelve el umbral de reflejo rápido dinámicamente vía `getLatencyThresholds(mode)` (fallback `single_note` cuando no se indica modo, preservando el comportamiento actual).
- **`AnalyticsCharts.tsx`**: reemplaza el consumo de `COGNITIVE_LATENCY_THRESHOLDS` por `getLatencyThresholds(modeFilter)`; las líneas de referencia, el coloreado de barras, la etiqueta del eje y la leyenda del gráfico de latencia pasan a reflejar los umbrales de la modalidad activa.
- **`AnalyticsView.tsx`**: pasa `modeFilter` a `AnalyticsCharts` (hoy el prop existe pero el contenedor no lo suministra; el resto de pestañas sí lo reciben).
- **`promptBuilder.ts`** (consumidor no listado en F22, detectado por grep): migra sus 7 usos del alias deprecado a `getLatencyThresholds(...)` resolviendo por `mode`/`metrics.modeFilter`, de modo que los prompts de IA citen las etiquetas de la modalidad analizada.
- **`thresholds.ts`**: elimina el export `@deprecated COGNITIVE_LATENCY_THRESHOLDS`; la SSOT queda en `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` + `getLatencyThresholds(mode)`.
- **Tests**: `latencyStats.test.ts`, `thresholdsConsistency.test.tsx` y `promptBuilder.test.ts` se actualizan para verificar clasificación y visualización coherentes por modalidad (`single_note`, `intervals`, `sequences`), y se verifica por grep que no quedan referencias huérfanas al alias eliminado.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `05-analytics-psychometrics`: la SSOT de umbrales deja de mandar la existencia del alias deprecado `COGNITIVE_LATENCY_THRESHOLDS` y pasa a exigir resolución por modalidad (`getLatencyThresholds`) en toda la app; la cronometría por nota (`fastReflexPercent`) se vuelve mode-aware; y los gráficos de latencia de la UI de analítica deben reflejar los umbrales de la modalidad activa (líneas de referencia, colores de barra y leyenda), sin literales de tiempo fijos.

## Impact

- **Código afectado** (renderer, dominio puro + UI):
  - `src/renderer/src/domain/analytics/thresholds.ts` — eliminación del export deprecado.
  - `src/renderer/src/domain/analytics/latencyStats.ts` — firma extendida con `mode?` (cambio retrocompatible: el parámetro es opcional).
  - `src/renderer/src/components/trainer/AnalyticsCharts.tsx` — consumo dinámico de umbrales + leyenda/etiquetas dinámicas.
  - `src/renderer/src/components/views/AnalyticsView.tsx` — paso del prop `modeFilter`.
  - `src/renderer/src/domain/ai/promptBuilder.ts` — migración de 7 usos del alias.
- **Tests afectados**: `latencyStats.test.ts`, `thresholdsConsistency.test.tsx`, `promptBuilder.test.ts`; sin cambios en suites de rendimiento (`s3-render-performance.test.tsx` no depende del alias).
- **API pública**: eliminación de un export marcado `@deprecated` — **BREAKING** para cualquier consumidor externo del alias; dentro del repo todos los consumidores se migran en este cambio (verificación por grep: 0 referencias restantes).
- **Sin cambios de datos**: no se toca el esquema de IndexedDB ni los registros persistidos; el cambio es de cómputo y presentación.
- **Especificaciones**: delta sobre `openspec/specs/05-analytics-psychometrics` (3 requisitos modificados/añadidos). `06-local-ai-integration` no requiere delta: su requisito de prompts ya exige "etiquetas SSOT" y la migración mantiene ese contrato.
