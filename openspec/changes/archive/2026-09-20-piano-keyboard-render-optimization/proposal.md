## Why

The Audit V6 remediation backlog (OLA 3.1, findings F5-01 and F5-02) identified that the 3D piano keyboard and its training hooks defeat React's memoization guarantees on every render. Under default (blind) mode, `liveStimulusNotes` is assigned a fresh `[]` array literal each render, so `React.memo(PianoKeyboard)` never short-circuits; the 37 keys are re-rendered on 100% of renders even when no prop changed. Combined with unpromoted trainer return objects and O(n) `Array.includes` lookups per key, the keyboard performs roughly 4,000 redundant comparisons per render under live MIDI traffic, causing visible frame drops during practice sessions. This must be fixed now because the keyboard is on the hot path of every interaction (physical MIDI input, virtual clicks, stimulus playback) and the degradation scales with MIDI event rate.

## What Changes

- **Stable empty-array constant in `App.tsx`**: introduce a module-level `EMPTY_STIMULUS_NOTES: number[]` used for `liveStimulusNotes` in blind mode, eliminating the per-render array identity churn that invalidates `PianoKeyboard`'s memo.
- **Stable `handleVirtualKeyPress`**: the callback's dependency array currently lists four whole trainer objects whose identity changes every render. The callback will be re-derived so its dependencies are stable (trainers memoized at the source), so the handler stops being recreated each render.
- **Memoized trainer hook returns**: wrap the returned object of `useSingleNoteTrainer`, `useIntervalTrainer`, `useSequenceTrainer`, and `useRepertoireTrainer` in `useMemo` so the object identity is preserved across renders while none of its constituent state/values change.
- **Precomputed key partitions in `PianoKeyboard`**: replace the per-render `keys.filter(isWhite)` / `keys.filter(isBlackKey)` passes with `useMemo`-backed `whiteKeys` and `blackKeys` arrays keyed on `keys`.
- **Extracted memoized `PianoKey` subcomponent**: each of the 37 keys becomes an individually memoized `React.memo` component with stable props (`note`, `isPressed`, `isStimulus`, `isActive`, `dotColor`, `disabled`, `onClick`), so a state change affecting one key no longer re-renders the other 36.
- **Set-based membership lookups in `getKeyStyle`**: replace repeated `Array.includes` scans with precomputed `Set` instances (or precalculated boolean flags) for `pressedNotes`, `stimulusNotes`, and `activeNotes`, collapsing the per-key lookup cost from O(n) to O(1).
- **Strengthened performance regression tests** in `s3-render-performance.test.tsx`: contract-level assertions that irrelevant UI events and identical props do not re-render `PianoKeyboard` or its keys, plus equivalence assertions that virtual and physical keyboard interaction behavior is unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change is a render-performance and memoization optimization of existing React components and hooks. It alters no externally observable behavior, no spec-level requirement, and no user-facing contract; therefore it declares `skip_specs: true`.

## Impact

- **Affected code**:
  - `src/renderer/src/App.tsx` (module-level constant, `handleVirtualKeyPress` stabilization, `liveStimulusNotes` assignment).
  - `src/renderer/src/hooks/useSingleNoteTrainer.ts`, `useIntervalTrainer.ts`, `useSequenceTrainer.ts`, `useRepertoireTrainer.ts` (memoized return objects).
  - `src/renderer/src/components/trainer/PianoKeyboard.tsx` (key partition memoization, `PianoKey` extraction, Set-based lookups).
  - `src/renderer/src/components/trainer/s3-render-performance.test.tsx` (strengthened tests).
- **APIs / dependencies**: No public API change. No dependency additions — everything is implemented with React's built-in `memo`/`useMemo`. The `PianoKey` subcomponent is a new internal (non-exported) module-private component; the exported `PianoKeyboard` surface is unchanged.
- **Systems**: Electron renderer process only. No main-process, preload, persistence, or MIDI-hardware changes. No changes to the 7 canonical specs.
- **Risk**: Behavioral equivalence must be preserved — visual styling priority order (pressed > stimulus > heatmap > active > default), black-key offset positioning, and click/disabled semantics are all unchanged and covered by the strengthened tests.
