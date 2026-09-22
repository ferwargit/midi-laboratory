## Why

Modernizar FASE 3.3 el Deck de Configuración de Parámetros, Fader de Tempo Dual y LEDs de Metrónomo de las vistas de práctica para alinearse con las directrices Dark Studio DAW. Mejorar ergonomía visual, legibilidad en tiempo real y consistencia de controles sin alterar contratos de dominio.

## What Changes

- Rediseño visual del control de Tempo en RepertoireView: fader con estética de consola, micro-ajuste -1/+1 BPM y lectura dual tabular `BPM (~ms/negra)`.
- Indicador visual de beat/LEDs de metrónomo estilo hardware con pulso luminoso y contenedor de altura fija para CLS = 0.
- Conmutadores segmentados de hardware para Mano a Estudiar y Estrategia de Encadenamiento con micro-interacción.
- Unificación de estilo de decks de configuración en SingleNoteView, IntervalsView, SequencesView y RepertoireView:
  * Dropdowns con `bg-slate-900/90 border-slate-700/60 rounded-lg text-slate-200 text-xs px-3 py-2 focus:ring-2 focus:ring-cyan-500`.
  * Etiquetas de sección `text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2`.
  * Tarjetas de presets/rangos consistentes con Card.tsx.
- Preservar 100% funcionalidad, callbacks onChange y handlers existentes.
- Formateo Prettier y paso de typecheck y tests.

## Capabilities

### New Capabilities

- Ninguna. Modernización visual sin cambio de comportamiento de dominio.

### Modified Capabilities

- Ninguna. No se modifican requisitos funcionales.

## Impact

Archivos objetivo:
- src/renderer/src/components/views/RepertoireView.tsx
- src/renderer/src/components/views/SingleNoteView.tsx
- src/renderer/src/components/views/IntervalsView.tsx
- src/renderer/src/components/views/SequencesView.tsx

Sistemas afectados: UI de práctica, controles de tempo, LEDs de metrónomo, selectores segmentados. Sin cambios en lógica de trainers, store o API.
