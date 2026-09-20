## Context

`PianoKeyboard` is a `React.memo`-wrapped component rendering 37 keys (white and black) from a `keys: number[]` prop, with visual state derived from `pressedNotes`, `stimulusNotes`, `activeNotes`, and a `performances` map. It is mounted by the trainer views (`SingleNoteView`, etc.) which receive `liveStimulusNotes` and `handleVirtualKeyPress` computed in `App.tsx`.

The memoization contract is currently defeated at three layers:

1. **Prop identity churn (App.tsx:626)** — `const liveStimulusNotes = visualCueMode === 'assisted' ? midi.activeStimulusNotes : []`. In the default `blind` mode, the `[]` literal is a fresh array every render, so `PianoKeyboard`'s shallow prop comparison always fails and the full 37-key tree re-renders on 100% of renders.
2. **Callback identity churn (App.tsx:525-546)** — `handleVirtualKeyPress` is a `useCallback` whose dependency array lists four whole trainer objects (`singleNoteTrainer`, `intervalTrainer`, `sequenceTrainer`, `repertoireTrainer`). Each hook returns a fresh object literal (no `useMemo`), so the callback is recreated every render and propagates a new `onVirtualKeyPress` prop into the keyboard tree.
3. **O(n) work per key (PianoKeyboard.tsx)** — `getKeyStyle` runs `pressedNotes.includes(note)`, `stimulusNotes.includes(note)`, and `activeNotes.includes(note)` per key, and `whiteKeys`/`blackKeys` are recomputed via `.filter()` on every render (including the black-key `.map()` inline at render time).

Constraints: the component is on the hot path of live MIDI input; no external dependencies may be added; the exported `PianoKeyboard` props interface and all visual styling priority behavior must remain byte-for-byte equivalent. See `proposal.md` for motivation and the audit findings (F5-01, F5-02).

## Goals / Non-Goals

**Goals:**

- Make `PianoKeyboard`'s `React.memo` effective: when no input-relevant prop changes, the component (and its individual keys) must not re-render.
- Reduce per-render work from O(keys × note-lists) to O(note-lists) for membership tests, by constructing `Set`s once per prop change.
- Preserve exact behavioral and visual equivalence: styling priority order, black-key offset math, click/disabled semantics, and virtual/physical interaction parity.
- Provide a contract-level regression test that fails if memoization is broken again.

**Non-Goals:**

- No change to the `PianoKeyboardProps` public interface (prop names, types, defaults).
- No change to the visual output or Tailwind class strings produced for any key state.
- No restructuring of the trainer hooks' internal logic or state shape — only the return-object identity is stabilized.
- No changes to the 7 canonical specs; this change declares `skip_specs: true`.
- No main-process, preload, persistence, or MIDI-hardware-bridge changes.
- No virtualization/windowing of the key list (37 keys is a fixed, small set).

## Decisions

### D1: Module-level `EMPTY_STIMULUS_NOTES` constant (App.tsx)

Declare `const EMPTY_STIMULUS_NOTES: number[] = []` at module scope (outside the component) and use it in the `liveStimulusNotes` ternary.

**Rationale**: a stable reference makes the `blind`-mode branch of the ternary return the same array identity across renders, so `React.memo`'s shallow comparison on `stimulusNotes` succeeds. This is the minimal, zero-cost fix — no `useMemo`, no allocation.

**Alternative considered**: `useMemo(() => [], [])` — rejected as needlessly heavyweight for a value that is provably constant for the process lifetime.

### D2: Memoize trainer hook return objects with `useMemo`

Wrap the returned object literal of each of the four trainer hooks in `useMemo`, with a dependency array enumerating every returned field (state values, `useCallback` handlers, `useMemo` results).

**Rationale**: the hooks already stabilize their internals — handlers are `useCallback`, derived values like `stats`/`performances` are `useMemo`, and the shared `core` object is stable. Only the final object literal breaks identity. Memoizing the return is the root-cause fix: it stabilizes `handleVirtualKeyPress`'s dependency list at the source, so the callback, and in turn the `onVirtualKeyPress` prop into the keyboard, becomes stable too. The dependency list is mechanical to derive and exhaustive by construction (one entry per returned field).

**Alternative considered**: (a) Splitting `handleVirtualKeyPress` into per-mode callbacks each depending on a single trainer — rejected: multiplies handlers and still depends on whole trainer objects. (b) Selecting only `handleUserNotePlayed` instead of the whole trainer object in the `useCallback` deps — partially effective but fragile; the root cause is the hook return identity, so D2 fixes it for all consumers, not just this callback.

### D3: Extract a memoized `PianoKey` subcomponent

Extract each key into a module-private `PianoKey = React.memo(function PianoKey(props) {...})` receiving flat, comparable props: `note`, `isPressed`, `isStimulus`, `isActive`, `dotColor` (or a precomputed style object), `disabled`, `onClick`, plus the layout-oriented props needed for black keys (`leftPercent`, `widthPercent`, `isBlack`).

**Rationale**: pushing the style computation down into the leaf means each key is compared by value on flat props; when one key's state flips (e.g. a single note pressed), React re-renders only that key and reuses the other 36 without running their `getKeyStyle` at all. This is where the real win under live MIDI traffic comes from, since every note-on/note-off currently re-renders all 37 keys.

**Alternative considered**: keeping one component and memoizing only the key arrays — rejected: a single pressed note still invalidates the whole list because the style function closes over the full note sets.

**Note on `clickedNote` state**: the local `clickedNote` state (virtual click feedback) currently lives in `PianoKeyboardComponent` and triggers a parent re-render on set/reset. It stays in the parent; the memoized `PianoKey` receives `isVirtualClicked` as a derived prop, so only the affected key re-renders. The `setTimeout` reset pattern is preserved as-is.

### D4: Precompute `whiteKeys` / `blackKeys` with `useMemo`

Replace the inline `keys.filter(...)` calls (one at line 34, one inline in the black-key `.map()`) with `useMemo(() => keys.filter((k) => !isBlackKey(k)), [keys])` and the symmetric black-key memo.

**Rationale**: the partition depends solely on `keys`, which is a stable prop (module-level `PIANO_KEYS` constant passed from `App.tsx`). Memoizing makes the partition identity-stable, which matters because `getBlackKeyOffsetPercent` and the render loops consume it. The inline in-map filter is removed so the black loop consumes the memoized array.

### D5: Set-based membership in `getKeyStyle`

Build `Set<number>` instances — `pressedSet`, `stimulusSet`, `activeSet` — via `useMemo` keyed on the respective props, and have `getKeyStyle` (moved into `PianoKey` or kept as a helper receiving the sets) test `.has(note)` instead of `.includes(note)`.

**Rationale**: turns the per-key scan (37 keys × up to 3 lists) into a one-time O(n) build per prop change plus O(1) lookups. Removes the ~4,000 comparisons per render cited in the audit finding.

**Alternative considered**: precalculating a single boolean-flag map per key (`Map<number, {pressed, stimulus, active}>`) — marginally faster but complicates the code and obscures the existing priority ladder; Sets keep the diff small and readable while delivering the asymptotic win.

### D6: Test strategy — render-count contracts

Tests assert render counts directly: wrap `PianoKeyboard` (and individual `PianoKey`) with a render-counting spy, render with identical prop references, and assert the count does not grow. Then exercise an irrelevant parent re-render and assert keyboard/keys still do not re-render. Equivalence tests assert that virtual click handling and physical-note highlighting produce the same visible state transitions as before.

**Rationale**: counting renders is the only assertion that directly pins the memoization contract; asserting only "output HTML is equal" would pass even if everything re-rendered (the original bug produced correct output, just wastefully).

## Risks / Trade-offs

- **[Stale memo due to incomplete dependency list in D2]** → A missing field in a hook's `useMemo` dependency array would freeze a stale value and cause real bugs (e.g. `currentExpectedNote` not advancing). Mitigation: dependency arrays are enumerated exhaustively, one entry per returned field; the strengthened tests plus existing trainer test suites must pass; `eslint` react-hooks exhaustive-deps rule (already part of `npm run lint`) flags missing deps.
- **[Stale key styling after refactoring `getKeyStyle` into `PianoKey`]** → If the style function closes over outdated sets, a key could render the wrong color. Mitigation: sets are `useMemo`'d on the exact props and passed down as values; visual-equivalence assertions in the test suite cover the full priority ladder (pressed > stimulus > heatmap > active > default).
- **[`clickedNote` parent re-render still occurs]** → The `setTimeout(..., 250)` reset re-renders the parent once. This is bounded (twice per click) and is not the hot path; the audit target is the per-MIDI-event churn. Accepted trade-off to keep the interaction pattern unchanged.
- **[`useMemo` memory overhead]** → Each memo adds a small allocation and comparison cost. For a 37-key keyboard with small note sets this is negligible relative to the O(n) scans it removes; the win grows with MIDI event rate, which is exactly the failing scenario.
- **[Behavioral drift risk in black-key offset math]** → `getBlackKeyOffsetPercent` depends on `whiteKeys` identity and ordering; memoizing must not change ordering. Mitigation: `filter` preserves order; existing positioning is unchanged and covered by equivalence tests.

## Migration Plan

1. Land D1 (constant) and D2 (hook memoization) first — these are leaf changes with no component-structure impact; run `npm run typecheck && npm run lint && npm run test` after each.
2. Land D4/D5 (partition + Set memoization) inside `PianoKeyboard` — internal refactor, no prop change.
3. Land D3 (`PianoKey` extraction) — largest structural change; verify the full priority ladder and offset positioning via the strengthened `s3-render-performance.test.tsx` and the existing trainer component tests.
4. Rollback strategy: each decision is a discrete commit that can be reverted independently; none changes the public component interface, so no downstream migration is required.

## Open Questions

None — all decisions are self-contained within the renderer layer and do not alter specs, APIs, or the task breakdown.
