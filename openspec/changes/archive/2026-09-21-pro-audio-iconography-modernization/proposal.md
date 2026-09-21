## Why

La iconografía actual de midi-laboratory utiliza emojis Unicode heterogéneos (🎹, 🎵, 📊, etc.) que presentan inconsistencia visual, problemas de renderizado cross-platform (Windows vs macOS vs Linux), y no se alinean con la estética "Dark Studio DAW / Hardware Rack" definida en AGENTS.md. La modernización a vectores SVG de `lucide-react` garantiza nitidez a cualquier escala, coherencia con la paleta Pro Audio (Cyan/Amber/Emerald/Rose), y tree-shaking selectivo para bundle size óptimo.

## What Changes

- **StudioTopBar.tsx**: Reemplazar emojis en píldoras de modo (single_note, intervals, sequences, repertoire, analytics) y toggle audiovisual (blind/assisted) por iconos Lucide semánticos (`Music`, `ArrowLeftRight`, `AudioLines`, `BookOpen`, `Activity`, `Ear`, `Eye`). Actualizar Popover de Puertos MIDI con `SlidersHorizontal` y `Cable`.
- **StudioBottomDock.tsx** y **DatabaseCard.tsx**: Sustituir emojis en acciones de backup/import/reset/monitor por `Download`, `Upload`, `RotateCcw`, `Terminal`.
- **4 Paneles de feedback + SingleNoteView**: Modernizar botones de transporte (Play, Square, RotateCcw, SkipForward) con iconos Lucide consistentes, `fill-current` para herencia de color, y tamaños `w-4 h-4` / `w-3.5 h-3.5` con márgenes `mr-1` / `mr-1.5`.
- **Accesibilidad preservada**: Mantener `tabIndex`, `role`, `aria-*`, handlers `onClick`, y lógica de estado intactos.
- **Dependencia**: Añadir `lucide-react` como dependencia de producción (tree-shakeable, solo iconos importados se incluyen en bundle).

## Capabilities

### New Capabilities

- (ninguna - refactorización estética pura)

### Modified Capabilities

- (ninguna - no hay cambios en requisitos de dominio ni comportamiento observable)

## Impact

- **Archivos modificados** (7 componentes React):
  - `src/renderer/src/components/trainer/StudioTopBar.tsx`
  - `src/renderer/src/components/trainer/StudioBottomDock.tsx`
  - `src/renderer/src/components/trainer/DatabaseCard.tsx`
  - `src/renderer/src/components/trainer/FeedbackPanel.tsx`
  - `src/renderer/src/components/trainer/IntervalFeedbackPanel.tsx`
  - `src/renderer/src/components/trainer/SequenceFeedbackPanel.tsx`
  - `src/renderer/src/components/trainer/RepertoireFeedbackPanel.tsx`
  - `src/renderer/src/components/trainer/SingleNoteView.tsx`
- **Dependencias**: `lucide-react` (nueva, ^0.4.x)
- **Validación**: `npm run typecheck` (0 errores), `npm run test` (533 tests pasan sin regresión)
- **Sin breaking changes**: API pública, stores, tipos, y contratos de dominio inmutados
