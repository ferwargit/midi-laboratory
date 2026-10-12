# Design

## Context

See proposal.md for motivation. Current state:

- `src/renderer/src/domain/analytics/thresholds.ts` exports a single global `COGNITIVE_LATENCY_THRESHOLDS` constant (1400/2800ms for single_note)
- `historyAnalytics.ts` imports and uses this constant in two places: `computeAnalyticsMetrics` (lines 111-113, 168-170) and `analyzeSessionTimeline` (line 32)
- `SessionsTableTab.tsx` uses `COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL` for the "Reflejo" column header tooltip (line 358)
- `SessionDetailModal.tsx` uses `COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS` for the SVG chart dashed line position and Y-axis label (lines 350-373)
- Session records have a `targetMode` field (canonical: `single_note`, `intervals`, `sequences`, `repertoire`)
- Classifiers `isSingleNoteSession`, `isIntervalSession`, `isSequenceSession`, `isRepertoireSession` exist in `sessionClassification.ts`

## Goals / Non-Goals

**Goals:**

1. Create `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` with per-modality `LatencyThresholdConfig`
2. Export `getLatencyThresholds(mode?)` helper that resolves correct config (defaults to single_note)
3. Keep `COGNITIVE_LATENCY_THRESHOLDS` as backward-compatible alias to single_note config
4. Update `analyzeSessionTimeline` and `computeAnalyticsMetrics` to resolve thresholds by session `targetMode`
5. Update `SessionsTableTab` column header to show modality-specific `FAST_LABEL` based on `modeFilter`
6. Update `SessionDetailModal` SVG chart line position and Y-axis label to use session's modality `FAST_MAX_MS`
7. All changes maintain full backward compatibility

**Non-Goals:**

- Changing any other threshold constants (MASTERY, ISI, BIAS)
- Modifying database schema or session record structure
- Adding new UI components beyond the specified updates
- Changing the psychometric formulas (IRT, CPI, entropy)

## Decisions

### 1. New thresholds.ts structure (new file or extend existing)

**Decision**: Extend existing `thresholds.ts` rather than create new file.

**Rationale**: The file is small (21 lines), already imported everywhere via barrel export in `historyAnalytics.ts`. Adding the new config and helper here maintains single SSOT principle without fragmentation.

**Alternative considered**: New file `thresholdsByModality.ts` - rejected because it would require updating 35+ import sites per OLA 4.3 decision.

### 2. LatencyThresholdConfig type and COGNITIVE_LATENCY_THRESHOLDS_BY_MODE

**Decision**: Define `LatencyThresholdConfig` interface with 5 fields, then `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` as `Record<ModalityKey, LatencyThresholdConfig>` where `ModalityKey = 'single_note' | 'intervals' | 'sequences' | 'repertoire'`.

**Values (physiologically calibrated):**

| Modality    | FAST_MAX_MS | MEDIUM_MAX_MS | FAST_LABEL | MEDIUM_LABEL  | SLOW_LABEL |
| ----------- | ----------- | ------------- | ---------- | ------------- | ---------- |
| single_note | 1400        | 2800          | '< 1.4s'   | '1.4s - 2.8s' | '> 2.8s'   |
| intervals   | 2400        | 3800          | '< 2.4s'   | '2.4s - 3.8s' | '> 3.8s'   |
| sequences   | 3500        | 5000          | '< 3.5s'   | '3.5s - 5.0s' | '> 5.0s'   |
| repertoire  | 2500        | 4000          | '< 2.5s'   | '2.5s - 4.0s' | '> 4.0s'   |

**Rationale**: These values are grounded in:

- Donders' subtraction method (simple vs choice reaction time)
- Sternberg's memory scanning paradigm (serial vs parallel)
- Auditory temporal integration windows (~2-3s for phrase perception)
- Piano mechanics: 2-note interval ~1100ms audio + 2 keystrokes minimum

### 3. getLatencyThresholds helper

**Decision**: Pure function `getLatencyThresholds(mode?: string): LatencyThresholdConfig` that:

- Accepts optional mode string
- Normalizes to canonical keys
- Returns `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE[mode] || COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note`
- Exported from `thresholds.ts` and re-exported via `historyAnalytics.ts` barrel

**Alternative considered**: Class with static method - rejected, pure function is simpler and testable.

### 4. Session mode resolution in analytics engine

**Decision**: In `computeAnalyticsMetrics` and `analyzeSessionTimeline`:

- Each session already has `targetMode` in its record
- For per-session metrics (`sessionPsychometricsList`), use that session's `targetMode`
- For aggregate metrics (`fastResponsesCount` etc.), the current code mixes all sessions - we need to decide: either (a) compute per-session then aggregate, or (b) require modeFilter to be single modality for meaningful aggregates

**Chosen approach**: (a) Per-session resolution. In `computeAnalyticsMetrics`, when building `sessionPsychometricsList`, each session gets its own thresholds via `getLatencyThresholds(session.targetMode || inferMode(session))`. The aggregate `fastCount`/`medCount`/`slowCount` will sum across sessions using their respective modalities - this is correct because each response is classified by its session's modality.

**For `analyzeSessionTimeline`**: The session parameter is single, so `getLatencyThresholds(session.targetMode)` directly.

### 5. UI: SessionsTableTab column header

**Decision**: The column header tooltip currently shows `Reflejo (${COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL})`. We need to make it reactive to `modeFilter`.

**Implementation**: The component doesn't currently receive `modeFilter` as prop. Options:

- A) Add `modeFilter` prop from parent `AnalyticsView`
- B) Read from `useAnalyticsStore` (which has `modeFilter` state)
- C) Infer from displayed sessions (all same mode when filtered)

**Chosen**: A) Add `modeFilter: AnalyticsModeFilter` prop. Parent `AnalyticsView` already has this state and passes other props.

### 6. UI: SessionDetailModal chart line

**Decision**: The modal receives a single `session` prop. Use `getLatencyThresholds(session.targetMode)` to get `FAST_MAX_MS` and `FAST_LABEL` for the SVG line position and label.

**Implementation**: Replace hardcoded `COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS` with `thresholds.FAST_MAX_MS` where `thresholds = getLatencyThresholds(session.targetMode)`.

### 7. Backward compatibility

**Decision**: Keep `COGNITIVE_LATENCY_THRESHOLDS` export pointing to `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note`. This ensures:

- Existing imports continue working unchanged
- Any code not yet migrated still gets single_note thresholds
- No breaking changes to public API

## Risks / Trade-offs

| Risk                                                                | Mitigation                                                                                                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aggregate `fastResponsesCount` mixing modalities could be confusing | Document that per-session breakdown in `sessionPsychometricsList` is the authoritative source; aggregate is sum across modalities                                |
| `modeFilter` prop not currently passed to `SessionsTableTab`        | Minimal prop addition; parent already has the state                                                                                                              |
| Sessions without `targetMode` (legacy data)                         | Default to `single_note` via `getLatencyThresholds` fallback; `inferMode` from `sessionClassification.ts` as secondary                                           |
| Test updates needed across multiple files                           | TDD protocol: update tests first, then implementation                                                                                                            |
| SVG chart Y-scale uses `maxTime` which may be less than threshold   | Existing guard `FAST_MAX_MS <= maxTime` handles this; modality thresholds may exceed maxTime for very fast sessions - line simply won't render, which is correct |

## Migration Plan

1. **Phase 1**: Extend `thresholds.ts` with `LatencyThresholdConfig`, `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE`, `getLatencyThresholds`, keep `COGNITIVE_LATENCY_THRESHOLDS` alias
2. **Phase 2**: Update `analyzeSessionTimeline` to use `getLatencyThresholds(session.targetMode)`
3. **Phase 3**: Update `computeAnalyticsMetrics` to resolve per-session thresholds in `sessionPsychometricsList` loop
4. **Phase 4**: Add `modeFilter` prop to `SessionsTableTab`, update column header
5. **Phase 5**: Update `SessionDetailModal` to use session's modality thresholds
6. **Phase 6**: Update tests (thresholdsConsistency, historyAnalytics, SessionDetailModal)
7. **Phase 7**: Run `npm run typecheck && npm run test` - all must pass

**Label usage by component:**

- `SessionsTableTab`: column header tooltip displays only `FAST_LABEL` (e.g., "Reflejo (< 2.4s)" for intervals)
- `ConfusionMatrixTab`: distribution of cognitive velocity shows all three labels: FAST_LABEL, MEDIUM_LABEL, SLOW_LABEL
- `SessionDetailModal`: SVG chart line position uses `FAST_MAX_MS`; Y-axis label uses `FAST_LABEL`

**Rollback**: Each phase is independently reversible. Git commit per phase.

## Open Questions

None - all design decisions resolved with clear rationale.
