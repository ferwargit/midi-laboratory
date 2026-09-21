## Why

The current atomic UI components (Button, Card, Badge, StatCard) use an inconsistent palette (sky, zinc, red, emerald) that does not align with the Pro-Audio Dark Studio DAW aesthetic defined in AGENTS.md. This visual refactor standardizes all four components to the canonical hardware-rack color system (Cyan Electric, Amber Neon, Emerald Studio, Rose Crimson) while preserving 100% API compatibility with 33+ consumer components.

## What Changes

- **Button.tsx**: Replace sky/zinc gradients with solid Cyan Electric (primary), matte rack surface (secondary), Emerald Studio (success), Rose Crimson (danger), and subtle ghost. Add WCAG AA focus-visible rings (cyan-500). Preserve `ButtonVariant` and `size` props exactly.
- **Card.tsx**: Switch to `bg-linear-to-b from-slate-900/95 to-slate-950/95` with `border-slate-800/80` and `rounded-xl`. Update glow variants to use cyan/purple halo shadows matching AGENTS.md spec (20px blur, -5px spread). Remove `backdrop-blur-xl` and `p-4.5` (consumer controls padding).
- **Badge.tsx**: Shift to translucent 950/60 backgrounds with 300-tone text and 500/30 borders for dark-theme legibility. Rename `red`→`rose`, `sky`→`cyan`. Preserve `BadgeVariant` type exactly.
- **StatCard.tsx**: Enforce `tabular-nums font-mono` on the numeric value to eliminate horizontal jitter during real-time updates. Sharpen typography contrast for WCAG AA on dark background.

All changes are visual-only; no prop signatures, event contracts, or behavioral semantics change.

## Capabilities

### New Capabilities

_None — this change introduces no new domain capabilities._

### Modified Capabilities

_None — this change modifies no spec-level requirements. The 7 existing specs (01-midi-audio-hardware through 07-persistence-storage) cover domain logic only; atomic UI styling is outside their scope._

## Impact

**Affected code**: 4 files in `src/renderer/src/components/ui/` (Button.tsx, Card.tsx, Badge.tsx, StatCard.tsx).

**Consumer surface**: 33+ import sites across views (SingleNoteView, SequencesView, DatabaseCard, RepertoireView, IntervalsView, KnowledgeGuideModal, analytics tabs, trainer panels, etc.). All consumers pass only the preserved props; no consumer edits required.

**Test scope**: 533 existing tests must pass without modification. Run `npm run typecheck && npm run test` to verify.

**Dependencies**: None added. Tailwind CSS classes only.
