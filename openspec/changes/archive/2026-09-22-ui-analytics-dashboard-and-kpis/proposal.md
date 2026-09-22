## Why

Modernizar el dashboard principal de analítica, barra de filtros de rack y KPIs superiores para alinear la UI con las directrices Dark Studio DAW de AGENTS.md. La interfaz actual no refleja la estética de hardware de estudio, la tipografía tabular, ni la semántica de color canónica para métricas de oído real, afectando legibilidad y consistencia visual.

## What Changes

- Rediseño visual de AnalyticsTabNav.tsx con píldoras segmentadas tipo rack, iconos Lucide y estado activo cian eléctrico con badges numéricos tabular-nums.
- Reestilo de AnalyticsKpiCards.tsx como displays de hardware de medición de audio con panel mate, valores monoespaciados tabular-nums y escala semántica esmeralda/ámbar/rosa carmesí para IRT, más tooltips accesibles.
- Modernización de AnalyticsFilterBar.tsx: selector de Modalidad en píldora segmentada, dropdowns con clase canónica de Fase 3, búsqueda con icono lupa y reset RotateCcw.
- Ajuste del contenedor AnalyticsView.tsx con fondo #0d0f14, espaciado consistente y banner de aislamiento ámbar neón estilizado.
- Preservar 100% contratos funcionales, cálculo de displayedMetrics y pipeline de dominio puro; formateo con Prettier; typecheck y tests sin regresión.

## Capabilities

### New Capabilities
- Ninguna

### Modified Capabilities
- Ninguna

## Impact

- Código afectado:
  - src/renderer/src/components/views/AnalyticsView.tsx
  - src/renderer/src/components/views/analytics/AnalyticsFilterBar.tsx
  - src/renderer/src/components/views/analytics/AnalyticsKpiCards.tsx
  - src/renderer/src/components/views/analytics/AnalyticsTabNav.tsx
- Sin cambios en APIs, dominio ni especificaciones canónicas; solo modernización visual y accesibilidad.
- Dependencias UI: Tailwind, Lucide React, componentes existentes.
