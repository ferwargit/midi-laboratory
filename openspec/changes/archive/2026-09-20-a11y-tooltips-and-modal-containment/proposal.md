## Why

The Audit V6 remediation backlog (OLA 3.3, findings F5-05, F5-06, F5-07, and F5-09) identified four accessibility and visual-containment defects in the renderer's pedagogical tooltip and modal layer:

1. **F5-05 — Trigger de tooltip no focable por teclado.** In `PedagogicalTooltip.tsx:75-81` the tooltip trigger is a plain `<span>` with no `tabIndex`, no `role`, and no `aria-expanded`. Keyboard users can never reach it in the tab order and screen readers announce it as inert text, so the entire pedagogical dictionary layer is unreachable without a mouse.
2. **F5-06 — Sin cierre con Escape y desbordamiento vertical sin clampear.** The component has no `Escape` listener, so once opened by click it can only be dismissed by moving the mouse away. Worse, `updatePosition` (`PedagogicalTooltip.tsx:25-41`) decides placement with the single rule `rect.top < 260` and never checks the space available below against `window.innerHeight`; on short viewports the fixed-position tooltip is clipped by the bottom edge of the window.
3. **F5-07 — Modales sin semántica de diálogo ni cierre con Escape.** `ConfirmModal.tsx:26`, `SessionDetailModal.tsx:67/103`, and `KnowledgeGuideModal.tsx:33` render their overlays as plain `<div>`s — no `role="dialog"`, no `aria-modal="true"` — and none of them registers a `keydown` listener for `Escape`, breaking the standard desktop expectation that a dialog closes on `Escape`.
4. **F5-09 — Clamp horizontal defectuoso del tooltip del gráfico SVG.** In `SessionDetailModal.tsx:464-472` the floating telemetry tooltip clamps its `left` to `[10%, 85]` of a container that is itself inside a horizontally scrollable modal. At the first questions (`hoveredPoint.x` near `50` of the `900`-unit viewBox), `10%` of the container minus the `translate(-50%, -100%)` centering shift pushes the tooltip's left edge to a negative offset (observed ≈ -65px), clipping its text and forcing a spurious horizontal scrollbar inside the modal.

This must be fixed now because these components sit on the interactive surface of every analytics/consultation view, and both the keyboard dead-ends and the clipped tooltip are user-perceptible accessibility and layout regressions.

## What Changes

- **Trigger focable y semántico**: in `PedagogicalTooltip.tsx`, give the trigger `tabIndex={0}`, `role="button"`, and `aria-expanded={isVisible}`, plus a visible focus ring (`focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded`). Add `onKeyDown` handling so `Enter` and `Space` toggle the tooltip (calling `e.preventDefault()` on `Space` to suppress page scroll), keeping the existing mouse hover/click behavior intact.
- **Cierre con Escape del tooltip pedagógico**: register a `keydown` listener (in the existing `isVisible`-gated `useEffect`) that closes the tooltip when `Escape` is pressed, and clean it up in the same effect's teardown.
- **Clamp vertical completo en `updatePosition`**: compute the tooltip height once (measured from the rendered portal or a conservative constant) and, when placing below, clamp `top` so the tooltip never exceeds `window.innerHeight - 16px`, flipping to `placeBelow: false` when there is more room above than below.
- **Semántica de diálogo en los 3 modales**: add `role="dialog"` and `aria-modal="true"` to the main dialog container of `ConfirmModal`, `SessionDetailModal` (both the empty-state and the populated branches), and `KnowledgeGuideModal`, and label each with `aria-label` (or an `aria-labelledby` pointing at its existing heading).
- **Cierre con Escape en los 3 modales**: add an `isOpen`-gated `useEffect` with a `keydown` listener that calls `onClose` / `onCancel` on `Escape` in `ConfirmModal`, `SessionDetailModal`, and `KnowledgeGuideModal`.
- **Clamp horizontal seguro del tooltip SVG**: in `SessionDetailModal.tsx:464-472`, recompute the `left` offset so the tooltip's left edge is never negative — clamp the post-`translate(-50%)` position to a safe minimum margin (≥ a small positive offset), eliminating the spurious horizontal scrollbar.
- **Pruebas unitarias (protocolo TDD)**: add `PedagogicalTooltip.test.tsx` asserting keyboard activation (`Enter`/`Space`), `Escape` dismissal, and ARIA attributes; extend/add modal tests asserting `role="dialog"` + `aria-modal="true"` presence and that `Escape` invokes `onCancel`/`onClose`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change is an accessibility and visual-containment remediation of existing React components. It alters no externally observable domain contract and no spec-level requirement: the pedagogical dictionary content, the modal data flows, and the canonical specs are unchanged. The intentionally changed behaviors are (a) keyboard/screen-reader reachability of the tooltip trigger, (b) `Escape` as an additional closing path for tooltips and dialogs, (c) vertical clamping so the tooltip is never clipped by the window edge, and (d) horizontal clamping so the chart tooltip never overflows its container — all corrections of unintended behavior rather than requirement changes. Therefore it declares `skip_specs: true`.

## Impact

- **Affected code**:
  - `src/renderer/src/components/ui/PedagogicalTooltip.tsx` (focable trigger + ARIA, `Escape` listener, vertical clamp in `updatePosition`).
  - `src/renderer/src/components/ui/ConfirmModal.tsx` (`role="dialog"`/`aria-modal`, `Escape` → `onCancel`).
  - `src/renderer/src/components/views/analytics/SessionDetailModal.tsx` (`role="dialog"`/`aria-modal` on both branches, `Escape` → `onClose`, fixed horizontal clamp at lines 464-472).
  - `src/renderer/src/components/views/guide/KnowledgeGuideModal.tsx` (`role="dialog"`/`aria-modal`, `Escape` → `onClose`).
  - `src/renderer/src/components/ui/PedagogicalTooltip.test.tsx` (new) and modal tests (new or extended) for keyboard/ARIA behavior.
- **APIs / dependencies**: No public API change and no dependency additions — everything uses React's built-in `useEffect`, DOM `addEventListener`, and standard ARIA attributes. The component prop signatures and exported surfaces are unchanged.
- **Systems**: Electron renderer process only. No main-process, preload, persistence, MIDI-hardware, or domain-logic changes. No changes to the canonical specs.
- **Risk**: Behavioral equivalence must be preserved for the mouse path — hover/click open and close exactly as before, and the tooltip's content and horizontal centering logic are unchanged except for the clamping corrections. The `Space` keydown handler must call `preventDefault()` only for the tooltip toggle, not globally. Modal `Escape` must not conflict with any existing shortcut (the `App.tsx` keymap's `Escape` branch is unaffected, as these modals are overlays with their own listeners). Test coverage for all four findings is included.
