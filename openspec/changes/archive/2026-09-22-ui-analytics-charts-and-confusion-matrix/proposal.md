## Why

Las visualizaciones gráficas SVG y la matriz de confusión 2D actuales usan estética zinc/gris con emojis y sin coherencia Dark Studio DAW, afectando legibilidad y percepción profesional de analítica. Se requiere modernizar AnalyticsCharts y ConfusionMatrixTab para alinear con rack de estudio, tipografía tabular y accesibilidad sin alterar cálculos de dominio.

## What Changes

- Modernizar AnalyticsCharts.tsx: rejilla SVG de estudio, trazado spline cian eléctrico con micro-glow, tooltip hardware, barras analizador de frecuencias, histograma sesgo direccional ámbar/cian, reemplazo de emojis por iconos Lucide.
- Modernizar ConfusionMatrixTab.tsx: cuadrícula 12x12 con bordes afilados, diagonal esmeralda de maestría, escala térmica de confusión, panel OLED de explicación psicoacústica sin layout shift, paneles laterales con aspecto rack y tabular-nums.
- Preservar 100% cálculos matemáticos, estructuras de datos y props públicas.
- Formatear con Prettier y validar typecheck y tests.

## Capabilities

### New Capabilities
- Ninguna

### Modified Capabilities
- Ninguna

## Impact

- Código afectado:
  - src/renderer/src/components/trainer/AnalyticsCharts.tsx
  - src/renderer/src/components/views/analytics/ConfusionMatrixTab.tsx
- Sin cambios en APIs, dominio ni especificaciones canónicas; solo modernización visual y accesibilidad.
- Dependencias UI: Tailwind, Lucide React, SVG.
