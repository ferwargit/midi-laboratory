## Context

The four defects being fixed live in the Electron renderer's React layer and were diagnosed in Audit V6 OLA 3.3 (findings F5-05, F5-06, F5-07, F5-09). See `proposal.md - Why` for the failure modes. The relevant current state:

- `PedagogicalTooltip.tsx:75-81` renders the trigger as a plain `<span>` (no `tabIndex`, no `role`, no `aria-*`), wired only to `onMouseEnter` / `onMouseLeave` / `onClick`. The portal at `PedagogicalTooltip.tsx:88-136` is rendered into `document.body` with `position: fixed`.
- `updatePosition` (`PedagogicalTooltip.tsx:25-41`) decides placement with the single rule `placeBelow = rect.top < 260` and clamps `left` against `window.innerWidth - tooltipWidth - 16`, but never checks the space below against `window.innerHeight`. The render branch at `PedagogicalTooltip.tsx:94-98` uses `top` when `placeBelow` and `bottom: window.innerHeight - coords.top` otherwise — i.e. `coords.top` means the _top edge_ in one branch and the _bottom edge_ in the other.
- The only `useEffect` (`PedagogicalTooltip.tsx:58-67`) subscribes `scroll`/`resize` while visible; there is no keyboard subscription.
- `ConfirmModal.tsx:26`, `SessionDetailModal.tsx:67` (empty branch) and `:103` (populated branch), and `KnowledgeGuideModal.tsx:33` render overlay `<div>`s with no dialog semantics and no keyboard handling. `ConfirmModal` / `KnowledgeGuideModal` / `SessionDetailModal` all early-return `null` when closed (`:23` / `:22` / `:63`), so any new hook must be registered **before** those returns.
- `SessionDetailModal.tsx:464-472` positions the SVG telemetry tooltip with `left: Math.min(85, Math.max(10, (hoveredPoint.x / 900) * 100))%` plus `transform: translate(-50%, -100%)`. At the first questions (`hoveredPoint.x ≈ 50` over the `900`-unit viewBox) the clamped `10%` minus the centering shift drives the left edge to ≈ −65px, clipping text and forcing the modal's horizontal scrollbar. The tooltip has `whitespace-nowrap` (auto width) and sits in the `relative` chart container (`SessionDetailModal.tsx:192`).
- Consumers (all JSX, unaffected by prop changes): `PedagogicalTooltip` in `AnalyticsKpiCards.tsx:27/47/57` and `SessionsTableTab.tsx:289-381`; `ConfirmModal` in `App.tsx:724` and `SessionsTableTab.tsx:647`; `SessionDetailModal` in `SessionsTableTab.tsx:639`; `KnowledgeGuideModal` in `AnalyticsFilterBar.tsx:306`.
- Test infrastructure: Vitest 4 + jsdom + `@testing-library/react` 16 (`vitest.config.ts`, `npm run test` = `vitest run`, jsdom returns `0` for `clientWidth`/`offsetHeight`/`innerHeight`-independent measurements). The repo's TDD protocol (AGENTS.md §IV) requires tests first.

## Goals / Non-Goals

**Goals:**

- Make the pedagogical tooltip trigger reachable by keyboard and correctly announced by screen readers, with `Enter`/`Space` toggling it and `Escape` dismissing it.
- Guarantee the fixed-position tooltip is never clipped by either the bottom or the top edge of the viewport, on any window height.
- Give the three modals standard dialog semantics and `Escape`-to-close.
- Eliminate the negative left edge and the spurious horizontal scrollbar of the chart telemetry tooltip.
- Make all four behaviors assertable with fast, deterministic unit tests that do not require mounting the full `App` tree.

**Non-Goals:**

- No focus trap or focus restoration inside modals (a11y best practice, but a larger behavioral change; the modals stay overlay-only — scoped out of OLA 3.3).
- No change to tooltip/modal content, data flow, or styling beyond the a11y attributes and the clamping math.
- No change to `App.tsx`'s global keymap: its `Escape` branch is untouched, and none of these overlays is reachable from it.
- No change to the SVG chart itself, the viewBox, or `preserveAspectRatio`.
- No changes to the canonical specs (this change declares `skip_specs: true`).

## Decisions

### D1 — Focable, semantic trigger with `Enter`/`Space` activation

The trigger `<span>` (`PedagogicalTooltip.tsx:75-81`) becomes:

```tsx
<span
  ref={triggerRef}
  role="button"
  tabIndex={0}
  aria-expanded={isVisible}
  aria-controls={isVisible ? TOOLTIP_ID : undefined}
  className={`inline-flex items-center cursor-help group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded ${className}`}
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
  onClick={handleClick}
  onKeyDown={handleTriggerKeyDown}
>
```

`handleTriggerKeyDown` toggles on `Enter` and `Space` (`e.key === 'Enter' || e.key === ' '`), calling `e.preventDefault()` (for `Space`, to suppress page scroll) then `updatePosition()` + `setIsVisible(prev => !prev)`. This is the WAI-ARIA button pattern for a non-native element. The portal div gets `id={TOOLTIP_ID}` so `aria-controls` points at it while open.

**Mouse path is unchanged**: hover opens, mouse-leave closes, click toggles. The `aria-expanded` value simply reflects `isVisible`.

**Alternatives considered:** (a) swapping the `<span>` for a real `<button>` — rejected, it would change inline text flow (`inline-flex` span wraps a dotted-underline text node and the `ⓘ` glyph; a `<button>` carries default styles and semantics around flex gaps that would alter the visual integration) and require CSS reset; (b) `role="link"` — rejected, the control toggles a transient popup, not navigation; `role="button"` with `aria-expanded` is the correct pattern.

### D2 — `Escape` dismissal for the tooltip

Extend the existing `isVisible`-gated `useEffect` (`PedagogicalTooltip.tsx:58-67`) rather than adding a second effect:

```ts
useEffect(() => {
  if (!isVisible) return
  const handleScrollOrResize = (): void => updatePosition()
  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') setIsVisible(false)
  }
  window.addEventListener('scroll', handleScrollOrResize, true)
  window.addEventListener('resize', handleScrollOrResize)
  window.addEventListener('keydown', handleKeyDown)
  return (): void => {
    window.removeEventListener('scroll', handleScrollOrResize, true)
    window.removeEventListener('resize', handleScrollOrResize)
    window.removeEventListener('keydown', handleKeyDown)
  }
}, [isVisible])
```

The listener is only alive while the tooltip is open, so the closed state has zero keyboard cost, and teardown is symmetric with the existing subscriptions. `Escape` does not call `preventDefault()` — nothing else in the component owns that key, and the global `App.tsx` keymap is not on this path.

### D3 — Bidirectional vertical clamping via a pure placement helper

Two changes to `updatePosition`:

1. **Unify the coordinate semantics.** `coords.top` becomes the _top edge_ in both branches: when placing above, `top = rect.top - 8 - tooltipHeight` instead of `rect.top - 8`. The render branch (`PedagogicalTooltip.tsx:94-98`) then always uses `top: ${coords.top}px` and the `bottom:` expression is dropped — no more dual meaning.
2. **Clamp against the viewport.** `placeBelow` becomes a real space comparison (`spaceBelow >= spaceAbove`, where `spaceBelow = innerHeight - rect.bottom` and `spaceAbove = rect.top`), and the resulting top edge is clamped into `[16, innerHeight - tooltipHeight - 16]`.

The math lives in a dedicated pure module, `src/renderer/src/components/ui/tooltipPlacement.ts`, so it is unit-testable with plain numbers (no DOM, no jsdom measurement) and its exports do not trip the repo's `react-refresh/only-export-components` lint rule (same convention as OLA 3.2's `shortcutDecision.ts` / `markdownParser.tsx`):

```ts
export const TOOLTIP_WIDTH = 320
export const ESTIMATED_TOOLTIP_HEIGHT = 260
export const VIEWPORT_MARGIN = 16

export interface TriggerRect {
  top: number
  bottom: number
  left: number
  width: number
}
export interface TooltipPlacement {
  top: number
  left: number
  placeBelow: boolean
}

export function computeTooltipPlacement(
  rect: TriggerRect,
  viewport: { innerWidth: number; innerHeight: number },
  tooltipHeight: number
): TooltipPlacement
```

Behavior: `placeBelow = (innerHeight - rect.bottom) >= rect.top`; `top = placeBelow ? rect.bottom + 8 : rect.top - 8 - tooltipHeight`; then `top = Math.max(VIEWPORT_MARGIN, Math.min(innerHeight - tooltipHeight - VIEWPORT_MARGIN, top))`. `left` keeps the existing centered logic (`Math.max(16, Math.min(innerWidth - TOOLTIP_WIDTH - 16, ...))`), moved into the helper for cohesion.

`tooltipHeight` is measured from the portal (`tooltipRef.current?.offsetHeight`) once mounted, falling back to `ESTIMATED_TOOLTIP_HEIGHT` (260) on the first open. A `useLayoutEffect` re-runs `updatePosition` right after the portal mounts so the position corrects itself with the real height before paint. When the viewport is too short for the tooltip plus margins, the clamp keeps it fully inside the window (it may overlap the trigger text — preferred over clipping).

Note: the container width for the chart tooltip is likewise read inside the circle's `onMouseEnter` handler (never during render) and stored in `chartTooltipLeft` state — reading a ref during render is rejected by the repo's `react-hooks/refs` lint rule.

**Alternatives considered:** (a) keeping `rect.top < 260` as the flip rule and only clamping the bottom — rejected, it leaves the top-overflow case unhandled (a trigger at the bottom of a short window still clips upward) and the magic number has no relationship to actual space; (b) CSS-only clamping (`max()`/`min()` on `top`) — rejected, `position: fixed` with a clamped `top` still needs the height known at render time, which CSS cannot derive for auto-height content; (c) `useFloating`/Floating UI — rejected, it adds a dependency for four components that only need elementary clamping, and the repo has no such dependency today.

### D4 — Dialog semantics on the three modals

Add to each modal's main dialog container (the inner panel, not the backdrop):

- `role="dialog"` and `aria-modal="true"`
- `aria-label` bound to the existing title: `ConfirmModal` → `aria-label={title}` (its `<h3>` at `:33`); `SessionDetailModal` → `aria-label={session.presetName}` (both the empty branch at `:68` and the populated branch at `:104`); `KnowledgeGuideModal` → the fixed string `'Centro de Conocimiento Psicoacústico & Metacognición'` (its `<h2>` at `:42`).

`aria-label` (string) is chosen over `aria-labelledby` (element id) to avoid adding id bookkeeping to three components; the labels are already available as values. `aria-modal="true"` on the panel (not the backdrop) is the standard placement.

### D5 — `Escape`-to-close on the three modals

Each modal gains a single `useEffect` registered **before** its `if (!isOpen) return null`:

```ts
useEffect(() => {
  if (!isOpen) return
  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') onClose()
  }
  window.addEventListener('keydown', handleKeyDown)
  return (): void => window.removeEventListener('keydown', handleKeyDown)
}, [isOpen, onClose])
```

In `ConfirmModal` the callback is `onCancel` (the documented close/cancel handler; `onConfirm` is the destructive action and must not fire on `Escape`). In `SessionDetailModal` and `KnowledgeGuideModal` it is `onClose`. Registering before the early return keeps the Rules of Hooks intact (the effect's own `if (!isOpen) return` makes it a no-op when closed, so no listener is ever attached for a closed modal).

**Interaction:** none of the three modals contains a `PedagogicalTooltip`, and the chart tooltip in `SessionDetailModal` is a local hover state (`hoveredPoint`), not a keyboard subscription — so there is no competing `Escape` handler within a modal. `App.tsx`'s global keymap does not handle `Escape` today, so closing the modal is the only effect.

**Alternatives considered:** (a) `onCloseOrCancel` unified handler — rejected, `ConfirmModal`'s two-callback contract is existing API; (b) stopping propagation — unnecessary, only one listener is active per overlay.

### D6 — Safe horizontal clamp for the chart tooltip

Replace the percentage-plus-centering expression at `SessionDetailModal.tsx:464-472` with pixel-based clamping of the tooltip's **left edge**. Extract the pure helper into its own module, `src/renderer/src/components/views/analytics/chartTooltipPlacement.ts` (again to satisfy `react-refresh/only-export-components`):

```ts
export const CHART_TOOLTIP_WIDTH = 260
export const CHART_MARGIN = 8

export function clampChartTooltipLeftEdge(
  centerX: number,
  containerWidth: number,
  tooltipWidth: number,
  margin = CHART_MARGIN
): number {
  const naturalLeft = centerX - tooltipWidth / 2
  const maxLeft = Math.max(margin, containerWidth - tooltipWidth - margin)
  return Math.max(margin, Math.min(maxLeft, naturalLeft))
}
```

The component measures `containerWidth` (chart container ref `clientWidth`, read in the hover handler) and derives `left` from `chartTooltipLeft` state; the tooltip gets `w-[260px]` (fixed width, replacing auto `whitespace-nowrap` width) and `transform: 'translateY(-100%)'` — `translate(-50%)` is dropped because the helper already centers the left edge. `maxLeft` uses `Math.max(margin, ...)` so that a container narrower than the tooltip degrades to `left = margin` instead of a negative value. In jsdom (`clientWidth === 0`) the helper returns `margin`, so the rendered `left` is never negative and the assertion is deterministic.

**Why not CSS `max()`/`min()` in the style string:** the centering offset is a pixel quantity (`tooltipWidth/2`) that cannot be expressed as a percentage of an unknown container width inside a `calc()`; the measurement + pure helper is the minimal deterministic unit. **Why not keep the `%` clamp and raise the lower bound:** the safe lower bound depends on the tooltip's actual rendered width, which is content-dependent — the fixed width + helper removes that variability entirely.

### D7 — Test strategy (TDD ordering)

Per AGENTS.md §IV, tests are written first and must fail (Red) before implementation (Green):

1. **`src/renderer/src/components/ui/PedagogicalTooltip.test.tsx`** (new) — using a real concept id (`irt_normalized_accuracy`, present in `pedagogicalDictionary.ts`):
   - the trigger exposes `role="button"`, `tabIndex={0}`, `aria-expanded="false"`; `fireEvent.keyDown(trigger, { key: 'Enter' })` opens it (concept title appears via the `document.body` portal) and flips `aria-expanded` to `"true"`; `Space` toggles identically and calls `preventDefault()`.
   - with the tooltip open, `fireEvent.keyDown(window, { key: 'Escape' })` closes it (title disappears) and restores `aria-expanded="false"`.
   - `computeTooltipPlacement(rect, viewport, height)` (imported from `tooltipPlacement.ts`) pure table: short viewport (`innerHeight: 400`, trigger near top) clamps the top edge so `top + height <= 400 - 16`; trigger near the bottom of a normal viewport places above without negative top; normal viewport places below with `top = rect.bottom + 8`.
2. **`src/renderer/src/components/ui/ConfirmModal.test.tsx`** (new) — `role="dialog"` + `aria-modal="true"` present when open; `aria-label` equals the title; `Escape` invokes `onCancel` exactly once and does not invoke `onConfirm`.
3. **`src/renderer/src/components/views/analytics/SessionDetailModal.test.tsx`** (new) — both render branches (`session` with no answers → empty branch; `session` + fixture `DbAnswerRecord[]` → populated branch) expose `role="dialog"` + `aria-modal="true"`; `Escape` invokes `onClose`; `clampChartTooltipLeftEdge` (imported from `chartTooltipPlacement.ts`) table: first-question x (≈ 45px of 900 viewBox units) yields a left edge ≥ 8 and never negative; x beyond the right edge clamps inside the container; a container narrower than the tooltip yields the margin, not a negative value.
4. **`src/renderer/src/components/views/guide/KnowledgeGuideModal.test.tsx`** (new) — `role="dialog"` + `aria-modal="true"` present; `Escape` invokes `onClose`. The five diagram subcomponents render real SVG; if any proves heavy in jsdom the test mocks its module (`vi.mock('./IrtCurveDiagram')` and siblings) — the assertions are about the modal container, not the diagrams.

**Fixture note:** `DbSessionRecord` / `DbAnswerRecord` (`src/renderer/src/domain/database/types.ts:5-36`) are flat primitive-only records, so the populated-branch fixture needs no mocks of IPC or persistence. The modal's own `analyzeSessionTimeline` runs for real on the fixture.

## Risks / Trade-offs

- **Rules-of-Hooks regression in the modals** → each new `useEffect` is placed before the `if (!isOpen) return null` guard, and the guard is duplicated inside the effect; the three modal test files render open and closed, pinning this.
- **`role="button"` on a `<span>` needs keyboard handling to be valid ARIA** → provided by D1 (`Enter`/`Space`); a test pins both keys, so the pattern cannot regress to "role without keys".
- **Measured-height first-open estimate (260px) can be wrong for a very long concept** → the `useLayoutEffect` re-position with the real `offsetHeight` corrects it before paint; the fallback only ever affects the first frame.
- **Clamping may make the tooltip overlap its trigger on very short viewports** → intentional; full visibility is preferred over clipping, and the normal viewport path (`top = rect.bottom + 8`) is unchanged.
- **Dropping `whitespace-nowrap` for a fixed `w-[260px]` chart tooltip** → the tooltip content is a fixed three-row telemetry card; at 260px the rows wrap instead of overflowing, which is the desired containment. If a future row grows, it wraps rather than widening — contained by construction.
- **`Escape` on a modal could conflict with a future global handler** → none exists today; the modals' listeners are attached only while open, and the effect teardown removes them on close.
- **Mocking guide diagrams would weaken the modal test** → only resorted to if rendering real SVG is slow in jsdom; the assertions target the container attributes either way.

## Migration Plan

Single-release, backwards-compatible, no persistence or data migration. Order:

1. Add the four failing test files (D7.1–D7.4) → confirm Red.
2. Implement `computeTooltipPlacement` + trigger a11y + `Escape` + vertical clamp in `PedagogicalTooltip.tsx` (D1–D3).
3. Add dialog semantics + `Escape` to `ConfirmModal.tsx`, `SessionDetailModal.tsx` (both branches), `KnowledgeGuideModal.tsx` (D4–D5).
4. Add `clampChartTooltipLeftEdge` and rewire the chart tooltip (D6).
5. Run `npm run typecheck`, `npm run lint`, `npm run test` (all must be Green).
6. Manual smoke check in the Electron app (tab to a pedagogical tooltip, `Enter`/`Space`/`Escape`, resize the window short, hover the first chart points, `Escape` in each modal) — non-interactive verification per the Electron guardrail remains the automated gate.

**Rollback:** each fix is confined to its own file and independently revertible (`PedagogicalTooltip.tsx`, the three modals, plus their four test files). No schema, config, or persisted-state change needs reversal.

## Open Questions

None — all decisions needed for the task breakdown are resolved above.
