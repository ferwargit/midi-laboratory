## Why

The Audit V6 remediation backlog (OLA 3.2, findings F5-03, F5-04, and F5-15) identified three independent defects in the renderer that degrade performance and accessibility:

1. **F5-03 — Reparseo de markdown por tick de reloj.** `MarkdownRenderer` (`src/renderer/src/components/ui/MarkdownRenderer.tsx:23`) is not memoized and calls `parseMarkdownBlocks(content)` directly in the render body. In `AiConsultationTab.tsx:54-56` the reasoning-seconds HUD advances via a 1-second `setInterval`, which re-renders the whole tab every second while the AI is reasoning. Because the persistent consultation history (lines 212-261) renders one un-memoized `MarkdownRenderer` per saved consultation, each tick re-parses the complete markdown of **every** historical answer once per second — work that scales with conversation length and is pure waste, since historical content never changes during reasoning.
2. **F5-04 — Scroll nativo suprimido globalmente.** In `App.tsx:481-491` the `Space` keydown handler calls `e.preventDefault()` unconditionally, before checking whether any modality is actually waiting for a manual advance. In `analytics` mode — where there is no active session and Space has no assigned action — the browser's native spacebar scrolling is still suppressed across the entire application.
3. **F5-15 — El atajo 'R' no filtra modificadores.** The `r`/`R` branch at `App.tsx:492` does not check modifier keys, so `Ctrl+R` / `Cmd+R` both triggers acoustic repetition of the current note **and** the browser/Electron page reload, corrupting the practice session.

This must be fixed now because the AI consultation view and the keyboard shortcuts sit on the interactive hot path of every practice session, and both the wasted re-parsing cost and the suppressed scroll are user-perceptible.

## What Changes

- **`MarkdownRenderer` memoizado y parseo memoizado**: wrap the component in `React.memo` and replace the direct `parseMarkdownBlocks(content)` call with `useMemo(() => parseMarkdownBlocks(content), [content])`, so repeated renders with identical props reuse the parsed block array instead of re-tokenizing.
- **Aislamiento del ticker de IA**: extract a memoized `<ConsultationHistoryItem>` subcomponent in `AiConsultationTab.tsx` that renders each saved consultation (query, timestamp, model, markdown response, metrics snapshot). State updates to `reasoningSeconds` in the active HUD no longer re-render — or re-parse markdown for — the historical items.
- **`preventDefault()` condicional para Space**: in `App.tsx`, call `e.preventDefault()` on the `Space` branch only when a modality is actually waiting for a manual advance (`singleNoteWaiting`, `intervalWaiting`, `sequenceWaiting`, or `repertoireWaiting` for the active `appMode`). When `appMode === 'analytics'` or no trainer is waiting, native spacebar scrolling is restored.
- **Filtro estricto de modificadores para 'R'**: guard the repeat shortcut with `!e.ctrlKey && !e.metaKey && !e.altKey`, so `Ctrl+R` / `Cmd+R` / `Alt+R` reload the page (native behavior) without firing `repeatCurrent*`.
- **Pruebas unitarias (protocolo TDD)**: extend `MarkdownRenderer.test.tsx` to assert that the memoized component re-renders without re-parsing when props are unchanged, and add keyboard-shortcut tests asserting that `Space` does not call `preventDefault()` when no manual advance is waiting, and that `Ctrl+R` does not invoke the repeat handler.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change is a render-performance and accessibility fix of existing React components. It alters no externally observable domain contract and no spec-level requirement: markdown output, trainer advance/repeat semantics, and the canonical specs are unchanged. The only intentionally changed behaviors are (a) the suppression scope of the Space shortcut, which is being narrowed to restore native scrolling where Space has no assigned action, and (b) the modifier guard on the repeat shortcut, which is a defect fix — both are corrections of unintended behavior rather than requirement changes. Therefore it declares `skip_specs: true`.

## Impact

- **Affected code**:
  - `src/renderer/src/components/ui/MarkdownRenderer.tsx` (`React.memo` wrapper, `useMemo`-backed parsing).
  - `src/renderer/src/components/ui/MarkdownRenderer.test.tsx` (memoization regression tests).
  - `src/renderer/src/components/views/analytics/AiConsultationTab.tsx` (extracted `ConsultationHistoryItem` subcomponent).
  - `src/renderer/src/App.tsx` (conditional `preventDefault()` on Space, modifier guard on 'R', keyboard-shortcut tests).
- **APIs / dependencies**: No public API change and no dependency additions — everything uses React's built-in `memo`/`useMemo`. `ConsultationHistoryItem` is a new module-private (non-exported) component; the exported `AiConsultationTab` and `MarkdownRenderer` surfaces are unchanged. Note that `MarkdownRenderer` becomes an export of a `React.memo` wrapped component, which is source-compatible with existing JSX usage but is a subtle type-level change if any consumer relies on the raw function identity.
- **Systems**: Electron renderer process only. No main-process, preload, persistence, MIDI-hardware, or domain-logic changes. No changes to the 7 canonical specs.
- **Risk**: Behavioral equivalence must be preserved — parsed markdown output and rendered DOM must be byte-for-byte identical to today's output (only the recompute frequency changes), the Space shortcut must still advance the waiting trainer exactly as before, and the repeat shortcut must still fire on bare `R`/`r`. Test coverage for both is included.
