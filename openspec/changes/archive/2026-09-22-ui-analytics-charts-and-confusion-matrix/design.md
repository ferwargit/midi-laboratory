## Context

AnalyticsCharts.tsx y ConfusionMatrixTab.tsx usan estética zinc/gris con emojis, rejillas genéricas y tooltips sin coherencia Dark Studio DAW. Los cálculos y estructuras de datos están estabilizados en Fases 2-3; solo se requiere modernización visual manteniendo memoización Fase 3.1.

## Goals / Non-Goals

**Goals:**
- Alinear gráficos y matriz con paleta Dark Studio DAW: fondo #0d0f14, superficies slate-900/90, acentos cian/ámbar/esmeralda/rosa.
- SVG con rejilla estudio, trazados spline cian, tooltips hardware con tabular-nums font-mono.
- Matriz 12x12 con diagonal esmeralda, escala térmica de confusión, panel OLED sin CLS.
- Reemplazar emojis por iconos Lucide: TrendingUp, BarChart3, Clock, Layers, Sparkles.
- Preservar cálculos, props y memoización.

**Non-Goals:**
- Cambiar algoritmos de psicometría o lógica de confusión.
- Añadir nuevas métricas o filtros.
- Modificar contratos de props.

## Decisions

**Gráficos SVG**
- Rejilla `stroke-slate-800/60`, trazado `stroke-cyan-400` con micro-glow, puntos interactivos con color según acierto.
- Tooltip tarjeta hardware oscura con sombra nítida y valores tabular-nums.
- Barras analizador de frecuencias con micro-bordes y gradientes sutiles, etiquetas SSOT COGNITIVE_LATENCY_THRESHOLDS.
- Histograma sesgo direccional +st ámbar vs -st cian.

**Matriz de Confusión**
- Celdas `border-slate-800/80`, fondo estudio, diagonal `bg-emerald-950/40 text-emerald-300 border-emerald-500/30 font-semibold`.
- Escala térmica calculada vs maxOffDiagonalCount, gradientes slate → ámbar/rose.
- Panel OLED de explicación con altura reservada para CLS=0.
- Paneles laterales con aspecto rack y tabular-nums.

**Rendimiento**
- Mantener memoización Fase 3.1, sin re-renders en hot-path MIDI.

## Risks / Trade-offs

- Cambios SVG pueden afectar performance en datasets grandes → Mitigación: usar paths optimizados y memoización.
- Reemplazo de emojis → Mitigación: mantener accesibilidad aria-labels.
- Regresión visual → Mitigación: Prettier, typecheck, tests 573.
