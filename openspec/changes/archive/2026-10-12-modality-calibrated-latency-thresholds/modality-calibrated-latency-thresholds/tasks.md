# Tasks

## 1. Thresholds Module Extension (thresholds.ts)

- [x] 1.1 Add `LatencyThresholdConfig` interface with `FAST_MAX_MS`, `MEDIUM_MAX_MS`, `FAST_LABEL`, `MEDIUM_LABEL`, `SLOW_LABEL` fields and verify TypeScript compiles
- [x] 1.2 Add `ModalityKey` type union `'single_note' | 'intervals' | 'sequences' | 'repertoire'` and verify type safety
- [x] 1.3 Define `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` constant with all four modalities and calibrated values, verify `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note.FAST_MAX_MS === 1400`
- [x] 1.4 Implement `getLatencyThresholds(mode?: string): LatencyThresholdConfig` helper with fallback to `single_note`, verify `getLatencyThresholds('intervals').FAST_MAX_MS === 2400` and `getLatencyThresholds('unknown').FAST_MAX_MS === 1400`
- [x] 1.5 Keep `COGNITIVE_LATENCY_THRESHOLDS` export as alias to `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note`, verify existing imports still resolve to 1400/2800ms
- [x] 1.6 Add unit tests in `thresholdsConsistency.test.tsx` (or new `thresholds.test.ts`) validating all four modality configs and helper behavior, verify `npm run test` passes for new tests

## 2. Analytics Engine Updates (historyAnalytics.ts, timelineTelemetry.ts)

- [x] 2.1 Update `analyzeSessionTimeline` to import `getLatencyThresholds` and resolve thresholds via `getLatencyThresholds(session.targetMode)`, verify with test: intervals session with 2100ms response classified as fast
- [x] 2.2 Update `computeAnalyticsMetrics` per-session loop to resolve thresholds per session via `getLatencyThresholds(session.targetMode || inferMode(session))`, verify `fastPercent`/`mediumPercent`/`slowPercent` use modality-specific thresholds
- [x] 2.3 Update aggregate `fastCount`/`medCount`/`slowCount` in `computeAnalyticsMetrics` to use per-session thresholds when iterating `filteredAnswers`, verify sum across mixed-modality sessions classifies each response by its session's modality
- [x] 2.4 Add test cases in `historyAnalytics.test.ts` for:
  - Intervals session: responses at 2350ms, 3100ms, 4200ms → fast=1, medium=1, slow=1
  - Sequences session: responses at 3400ms, 4200ms, 5500ms → fast=1, medium=1, slow=1
  - Repertoire session: responses at 2400ms, 3300ms, 4500ms → fast=1, medium=1, slow=1
  - Mixed modalities aggregate sums correctly
    Verify `npm run test` passes

## 3. UI: SessionsTableTab Column Header

- [x] 3.1 Add `modeFilter: AnalyticsModeFilter` prop to `SessionsTableTab` component interface
- [x] 3.2 Import `getLatencyThresholds` and resolve thresholds via `getLatencyThresholds(modeFilter)` for column header
- [x] 3.3 Update column header tooltip at line 358 to use `thresholds.FAST_LABEL` (e.g., "Reflejo (< 2.4s)" for intervals), verify visual inspection shows correct label per mode filter
- [x] 3.4 Update `AnalyticsView.tsx` (parent) to pass `modeFilter` to `SessionsTableTab`, verify no TypeScript errors
- [x] 3.5 Add test in `SessionsTableTab.test.tsx` validating header shows correct FAST_LABEL for each modeFilter value, verify `npm run test` passes

## 4. UI: SessionDetailModal SVG Chart

- [x] 4.1 Import `getLatencyThresholds` in `SessionDetailModal.tsx`
- [x] 4.2 Resolve session-specific thresholds via `getLatencyThresholds(session.targetMode)` in component
- [x] 4.3 Replace `COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS` with `thresholds.FAST_MAX_MS` in SVG line position (lines 350-356) and Y-axis label (lines 362-371)
- [x] 4.4 Replace hardcoded "1.4s" label with `thresholds.FAST_LABEL`, verify intervals session shows line at 2400ms with label "< 2.4s"
- [x] 4.5 Add test in `SessionDetailModal.test.tsx` validating chart line position and label for intervals and sequences modalities, verify `npm run test` passes

## 5. Specification Synchronization (OpenSpec Delta)

- [x] 5.1 Verify `openspec/specs/05-analytics-psychometrics/spec.md` delta spec (already created in specs artifact) matches implementation plan
- [x] 5.2 Verify `openspec/specs/05-analytics-psychometrics/latency-thresholds-by-modality/spec.md` new capability spec (already created) is complete
- [x] 5.3 Run `openspec validate modality-calibrated-latency-thresholds --strict` and verify zero errors

## 6. Integration Verification

- [x] 6.1 Run `npm run typecheck` and verify zero TypeScript errors
- [x] 6.2 Run `npm run test` and verify all tests pass (including new tests from tasks 1.6, 2.4, 3.5, 4.5)
- [x] 6.3 Manual verification: Start dev server, navigate to Analytics view, filter by intervals mode, confirm:
  - SessionsTableTab "Reflejo" column header shows "(< 2.4s)"
  - Open an intervals session detail, confirm SVG chart line at 2.4s
  - Open a sequences session detail, confirm SVG chart line at 3.5s
  - Open a single_note session, confirm SVG chart line at 1.4s (backward compatibility)
- [x] 6.4 Run `openspec validate modality-calibrated-latency-thresholds --strict` final verification
