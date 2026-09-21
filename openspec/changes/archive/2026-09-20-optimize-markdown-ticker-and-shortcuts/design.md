## Context

The three defects being fixed live in the Electron renderer's React layer and were diagnosed in Audit V6 OLA 3.2 (findings F5-03, F5-04, F5-15). See `proposal.md - Why` for the failure modes and user-perceptible symptoms. The relevant current state:

- `MarkdownRenderer.tsx:23` calls `parseMarkdownBlocks(content)` (module-private, O(lines) tokenizer with regex per line) unconditionally in the render body; the component is a plain function with no `React.memo`.
- `AiConsultationTab.tsx:54-56` runs a 1 s `setInterval` updating `reasoningSeconds` while the AI answers; the persistent history block (`AiConsultationTab.tsx:212-261`) maps over `filteredConsultations` and renders one `MarkdownRenderer` per saved consultation inline, so every tick re-parses all historical answers.
- `App.tsx:481-491` calls `e.preventDefault()` on `Space` before any mode/waiting check; `App.tsx:492` matches `r`/`R` with no modifier filter. `AppMode` is `'single_note' | 'intervals' | 'sequences' | 'repertoire' | 'analytics'` (`App.tsx:29`).
- Test infrastructure: Vitest 4 + jsdom + `@testing-library/react` 16 (`vitest.config.ts`, `npm run test` = `vitest run`). The repo's TDD protocol (AGENTS.md §IV) requires tests first.

Note: `AnalyticsView.tsx:95-106` hosts a second 1 s reasoning ticker for report generation (`reasoningSeconds`, state that re-renders the whole view each second while `isAiAnalyzing`). That view renders `AiDiagnosticTab` (which receives `reasoningSeconds` directly as a prop), `AiConsultationTab`, and `AiHistoryTab` (whose `AiHistoryTab.tsx:61` renders one `MarkdownRenderer` per saved report). It is **not** modified here — the `MarkdownRenderer` memoization (D1) eliminates the per-tick re-parsing cost across all three tabs, so no restructuring of that ticker is needed.

## Goals / Non-Goals

**Goals:**

- Eliminate per-second markdown re-parsing during AI reasoning, both at the component level (memo) and at the list level (isolated history items).
- Restore native spacebar scrolling wherever Space has no assigned action; keep Space advancing exactly when a modality waits for manual advance.
- Prevent `Ctrl+R` / `Cmd+R` / `Alt+R` from firing the acoustic repeat handler.
- Make all three behaviors assertable with fast, deterministic unit tests that do not require mounting the full `App` tree.

**Non-Goals:**

- No change to markdown parsing rules, block types, inline formatting, or rendered DOM — output must be byte-for-byte identical.
- No change to trainer advance/repeat business logic, session state machines, or MIDI handling.
- No restructuring of `AnalyticsView.tsx`'s own ticker (see Context); its per-tick re-parsing cost is already eliminated by D1's memoization.
- No virtualization/windowing of the consultation history list; item memoization is sufficient for the defect, and virtualization is a separate concern.
- No changes to the 7 canonical specs (this change declares `skip_specs: true`).

## Decisions

### D1 — `React.memo` + `useMemo` in `MarkdownRenderer`, with hook-order-safe guard

Wrap the component in `React.memo` and hoist parsing into `useMemo`:

```tsx
export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, className = '' }) {
  const blocks = useMemo(() => parseMarkdownBlocks(content ?? ''), [content])
  if (!content || typeof content !== 'string') return <></>
  return ( /* unchanged JSX tree */ )
})
```

The empty-content early return must move **after** the `useMemo` call; keeping it before the hook would violate the Rules of Hooks (conditional hook call) and break under the test that re-renders with empty then non-empty content. The memo's guard moves inside the callback (`content ?? ''`) so the hook always receives a string.

**Alternatives considered:** (a) `useDeferredValue` on content — rejected, it only schedules work and still re-parses; (b) an external memoization cache keyed by content string — rejected, adds state and memory pressure for no gain over `useMemo`, which is keyed on prop identity anyway.

**Testing seam:** the memoization contract is asserted by spying on the parser, following the repo's own OLA 3.1 precedent (`vi.spyOn(noteUtils, 'midiNoteToName')` in `s3-render-performance.test.tsx`, where call counts are an exact proxy for render activity). Because a bare in-module `parseMarkdownBlocks` call cannot be spied (ESM internal binding), the pure parser (`parseMarkdownBlocks`, `splitTableRow`, `formatInline`, and the `BlockType`/`ParsedBlock` types) was extracted into `src/renderer/src/components/ui/markdownParser.tsx`, and `MarkdownRenderer.tsx` consumes it via a namespace import (`markdownParser.parseMarkdownBlocks(...)`). The tests then assert the spy is invoked exactly once across identical re-renders. Two earlier approaches were rejected during implementation: a render-count spy wrapper (counts the wrapper's own renders, not the child's — memo bailouts are invisible to it) and `React.Profiler` (its `onRender` fires per Profiler-fiber commit regardless of child bailouts).

The memo dependency is `content` only, so a `className` change re-renders the component but intentionally does **not** re-parse — that is the optimization, and it is pinned by a test.

### D2 — Extracted memoized `ConsultationHistoryItem`

Move the per-item JSX at `AiConsultationTab.tsx:212-261` into a module-private subcomponent:

```tsx
const ConsultationHistoryItem = React.memo(function ConsultationHistoryItem({
  consultation
}: { consultation: DbAiConsultationRecord }): React.ReactElement { ... })
```

Props are a single `consultation` object whose identity is stable across `reasoningSeconds` updates (it comes from the persisted `filteredConsultations` array, which reasoning ticks never recreate). The ticker-driven re-render therefore stops at `AiConsultationTab` and never reaches the history items. The empty-history branch and the scroll container stay in the parent.

**Alternatives considered:** (a) `useSyncExternalStore`-style selector for `reasoningSeconds` — rejected, it is local UI state, not external; (b) moving the HUD into its own component only — rejected, it would still re-render the parent and thus the list (React re-renders children by default; the memo must sit on the list items).

### D3 — Conditional `preventDefault()` on Space

Replace the unconditional `e.preventDefault()` with a single derived condition:

```ts
const isWaitingManualAdvance =
  (appMode === 'single_note' && singleNoteWaiting) ||
  (appMode === 'intervals' && intervalWaiting) ||
  (appMode === 'sequences' && sequenceWaiting) ||
  (appMode === 'repertoire' && repertoireWaiting)

if (e.code === 'Space') {
  if (isWaitingManualAdvance) {
    e.preventDefault()
    // existing mode-dispatch chain (singleNoteAdvance / intervalAdvance / ...)
  }
}
```

Semantics: `preventDefault()` is called exactly when an advance will actually run. In `analytics` mode, or in a trainer mode with no question pending, the browser keeps its native scroll. The advance dispatch chain and the `useEffect` dependency array are otherwise untouched (all four `*Waiting` flags are already listed at `App.tsx:530-549`).

### D4 — Strict modifier guard on the repeat shortcut

```ts
} else if (
  (e.key === 'r' || e.key === 'R') &&
  !e.ctrlKey && !e.metaKey && !e.altKey
) {
```

`Shift+R` remains a valid repeat trigger (shift is the only modifier not filtered, matching the bare-key intent). This also fixes the concurrent reload+repeat race for `Ctrl+R` / `Cmd+R`.

### D5 — Pure, testable shortcut decision function

Extract the branch logic above into a side-effect-free module so it can be unit-tested without mounting `App`:

```
src/renderer/src/services/keyboard/shortcutDecision.ts
  export type ShortcutAction = 'advance' | 'repeat' | null
  export interface ShortcutContext { appMode; singleNoteWaiting; singleNoteActive; intervalWaiting; intervalActive; sequenceWaiting; sequenceActive; repertoireWaiting; repertoireActive }
  export function resolveShortcutDecision(event: Pick<KeyboardEvent, 'code' | 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>, ctx: ShortcutContext): { action: ShortcutAction; shouldPreventDefault: boolean }
```

`App.tsx`'s `handleKeyDown` becomes a thin dispatcher: it calls `resolveShortcutDecision`, applies `event.preventDefault()` only when `shouldPreventDefault` is true, and invokes the corresponding trainer action. The function is pure (no React, no DOM mutation), so tests assert `shouldPreventDefault === false` for Space with no waiting modality, `true` for Space with a waiting modality, `action === null` for `Ctrl+R`, and `action === 'repeat'` for bare `R`.

**Alternatives considered:** (a) testing by rendering `<App />` in jsdom — rejected, it requires mocking `navigator.requestMIDIAccess`, Electron IPC, IndexedDB, and all four trainer hooks, and would be brittle and slow; (b) exporting the handler from `App.tsx` — rejected, it would bind the shortcut logic to the root component module and still need its closure state reconstructed. The `services/` directory is an existing organizational unit already covered by the coverage config, so the new module fits the project layout.

### D6 — Test strategy (TDD ordering)

Per AGENTS.md §IV, tests are written/extended first and must fail (Red) before implementation (Green):

1. `MarkdownRenderer.test.tsx` — new suite section: `vi.spyOn(markdownParser, 'parseMarkdownBlocks')` (delegating to the real implementation) proves the parser runs exactly once across repeated renders with identical props (memo short-circuit ⇒ no re-parse); equivalence cases prove re-rendering with changed `content` re-parses, and that a `className`-only change intentionally does not.
2. `AiConsultationTab.test.tsx` (new) — `ConsultationHistoryItem` isolation: with `isAnswering` true and `reasoningSeconds` advancing via fake timers, the history items do not re-render (item render count stays at the number of items) and their markdown is parsed once.
3. `shortcutDecision.test.ts` (new) — pure-function table over the matrix in D5: Space × {waiting, not waiting, analytics mode}; `R` × {bare, Ctrl, Meta, Alt, Shift}; plus the `isTyping` / reset-modal guards remaining in `App.tsx` (asserted there, not in the pure function — the pure function only sees the post-guard event).

## Risks / Trade-offs

- **Rules-of-hooks regression in `MarkdownRenderer`** → the early return is moved below the `useMemo` and the guard is internalized; the new empty→non-empty re-render test pins this.
- **`React.memo` on `MarkdownRenderer` changes its export type** (function → memoized component) → source-compatible with all current JSX call sites. Verified consumers, all JSX usage: `AiConsultationTab.tsx:196` and `:257`, `AiDiagnosticTab.tsx:104`, and `AiHistoryTab.tsx:61`, plus the test files. If a consumer ever passed it as a non-JSX value it would break, but no such usage exists.
- **Over-memoization cost** → `React.memo` does a shallow prop compare per render; props are a string plus an optional className, so the compare is far cheaper than the tokenizer it replaces. For history items, the compare is one object reference.
- **Restored spacebar scroll could surprise users in trainer modes** → scroll is only restored when no advance is pending, i.e. exactly when Space previously did nothing useful; during a waiting state behavior is unchanged. Mitigated by the Space tests.
- **`Shift+R` still triggers repeat** → intentional (bare-key semantics); documented in D4 so it is not "fixed" later by accident.
- **New `services/keyboard` module adds a layer** → justified by testability; the dispatcher in `App.tsx` (the `shortcutContext` object plus the `shouldPreventDefault`/action dispatch, `App.tsx:487-525`) is ~27 lines of declarative wiring with no duplicated decision logic.

## Migration Plan

Single-release, backwards-compatible, no persistence or data migration. Order:

1. Add failing tests (D6.1–D6.3) → confirm Red.
2. Implement `shortcutDecision.ts`, then wire it into `App.tsx` (D3 + D4 + D5).
3. Memoize `MarkdownRenderer` (D1).
4. Extract `ConsultationHistoryItem` (D2).
5. Run `npm run typecheck`, `npm run lint`, `npm run test` (all must be Green).
6. Manual smoke check in the Electron app (analytics view scroll, AI consultation reasoning, `Ctrl+R` reload, bare `R` repeat) — non-interactive verification per the Electron guardrail remains the automated gate.

**Rollback:** revert the change directory's implementation commits; each fix is confined to its own file and independently revertible (`shortcutDecision.ts` + `App.tsx` wiring, `MarkdownRenderer.tsx`, `AiConsultationTab.tsx`). No schema, config, or persisted-state change needs reversal.

## Open Questions

None — all decisions needed for the task breakdown are resolved above. Whether to eventually apply the same history-item isolation to `AnalyticsView.tsx`'s report rendering is deferred to a future change (it is mitigated today by D1).
