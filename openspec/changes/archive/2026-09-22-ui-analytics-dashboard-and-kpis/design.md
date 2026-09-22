## Context

La suite analítica actual usa estética zinc/gris con iconos emoji y estados de tab con purple/zinc. Las clases de filtro usan bg-zinc-950 border-zinc-800 focus:border-sky-500. Los KPIs usan bg-zinc-900/60 backdrop-blur y tipografía no tabular. El contenedor AnalyticsView hereda fondo oscuro pero sin paleta Dark Studio DAW definida.

## Goals / Non-Goals

**Goals:**
- Alinear AnalyticsTabNav, AnalyticsKpiCards, AnalyticsFilterBar y AnalyticsView con la paleta Dark Studio DAW: fondo #0d0f14, superficies #151821/#1a1e2b, bordes #232838, acentos cyan eléctrico #06b6d4/#22d3ee, ámbar #f59e0b/#fbbf24, esmeralda #10b981/#34d399, rosa carmesí #f43f5e.
- Introducir píldoras segmentadas tipo rack con iconos Lucide, estado activo cian con border y badges tabular-nums.
- Métricas con tipografía tabular-nums font-mono para valores dinámicos, sin jitter.
- Dropdowns unificados con clase canónica Fase 3: `bg-slate-900/90 border border-slate-700/60 rounded-lg text-slate-200 text-xs px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-colors`.
- Tooltips pedagógicos con foco visible y accesibilidad de teclado.
- Preservar 100% lógica de dominio, displayedMetrics y pipeline de filtros.

**Non-Goals:**
- Cambiar requisitos, cálculos o especificaciones de dominio de analítica.
- Añadir nuevas funcionalidades de filtrado o métricas.
- Modificar contratos de props de componentes.

## Decisions

**Paleta y estética**
- Adoptar Dark Studio DAW de AGENTS.md. Reemplazar zinc por slate/zinc oscuro y acentos definidos.
- Racional: consistencia con rack de estudio y reducción de fatiga visual.
- Tokens de superficie canónicos: `bg-slate-900/90` y `border-slate-800/80` son la implementación aceptada de los tokens Dark Studio DAW #151821 / #1a1e2b para superficies y #232838 para bordes. Esta elección garantiza coherencia con Card.tsx, StudioBottomDock.tsx y los componentes consolidados en Fases 2 y 3, evitando fragmentar CSS con propiedades personalizadas arbitrarias.

**Tab Nav**
- Píldoras segmentadas con iconos Lucide: Table, Sparkles, MessageSquare, TrendingUp, Grid3X3, LineChart, History.
- Estado activo: bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-medium.
- Badges conteo con tabular-nums font-mono text-[10px].
- Alternativa descartada: tabs tradicionales con underline; menos acorde a hardware rack.

**KPI Cards**
- Panel mate bg-slate-900/90 border border-slate-800/80 rounded-xl p-4.
- Valores numéricos tabular-nums font-mono text-2xl font-bold.
- Escala semántica IRT: esmeralda >=85%, ámbar 60-84%, rosa carmesí <60% usando MASTERY_THRESHOLDS existente.
- Tooltips con focus-visible:ring-2 focus-visible:ring-cyan-500.
- Alternativa descartada: mantener backdrop-blur; menos legible en paneles de hardware.

**Filter Bar**
- Fila 1 Modalidad en píldora segmentada conectada con micro-interacción suave.
- Dropdowns con clase canónica Fase 3 unificada.
- Búsqueda con icono Lucide Search y botón reset RotateCcw.
- Alternativa descartada: mantener selects zinc; rompe consistencia Fase 3.

**AnalyticsView**
- Fondo #0d0f14, espaciado consistente, banner aislamiento ámbar neón estilizado.
- No cambiar layout de contenedor, solo tokens visuales.

## Risks / Trade-offs

- Cambios de color pueden afectar contraste en monitores OLED antiguos → Mitigación: usar bordes 1px y sombras sutiles, validar focus-visible.
- Reemplazo de emoji por Lucide → Mitigación: mantener labels accesibles, aria-labels.
- Riesgo de regresión visual en tests → Mitigación: ejecutar npm run typecheck y npm run test, Prettier.

## Migration Plan

- Aplicar cambios visuales archivo por archivo.
- Ejecutar npx prettier --write en los 4 archivos objetivo.
- Validar typecheck y tests 573 pasando.
- Rollback mediante git revert si aparecen regresiones visuales.
