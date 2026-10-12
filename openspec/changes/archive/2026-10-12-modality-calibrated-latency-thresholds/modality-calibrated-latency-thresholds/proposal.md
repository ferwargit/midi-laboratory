# Proposal

## Why

The current `COGNITIVE_LATENCY_THRESHOLDS` uses a single global threshold of < 1.4s for "Reflejo Inmediato" across all training modalities. This is physiologically correct for Single Note (1 note heard + 1 key pressed), but incorrect for other modalities:
- **Intervals**: 2 sequential notes (~1100ms audio) + 2 physical keys → absolute minimum ~2.0–2.1s
- **Sequences**: 3–6 notes → audio phrase lasts 2–3 seconds before response possible
- **Repertoire**: Variable but typically 2–4 seconds minimum

Measuring against 1.4s for Intervals/Sequences causes perfectly executed sessions at maximum speed to incorrectly register "0% Reflejo", invalidating the cognitive latency analysis.

## What Changes

- **New capability**: `05-analytics-psychometrics/latency-thresholds-by-modality` — Modality-specific cognitive latency thresholds backed by mental chronometry (Donders/Sternberg) and auditory psychophysics
- **Modified capability**: `05-analytics-psychometrics` — The existing "Fuente Única de Verdad de Umbrales Psicoacústicos" requirement will be extended to document per-modality calibration and add scenarios for Intervals and Sequences
- **Code changes** (no breaking changes):
  - `src/renderer/src/domain/analytics/thresholds.ts` (new file): `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE`, `LatencyThresholdConfig`, `getLatencyThresholds(mode)`, backward-compatible `COGNITIVE_LATENCY_THRESHOLDS` alias
  - `src/renderer/src/domain/analytics/historyAnalytics.ts`: `analyzeSessionTimeline` and `computeAnalyticsMetrics` resolve thresholds by session `targetMode`
  - `src/renderer/src/components/views/analytics/SessionsTableTab.tsx`: Column header shows modality-specific label (e.g., "REFLEJO (< 2.4s)" for intervals)
  - `src/renderer/src/components/views/analytics/SessionDetailModal.tsx`: SVG chart dashed line and Y-axis label positioned at modality's FAST threshold
- **Tests**: Unit tests for thresholds consistency, history analytics, and SessionDetailModal validating modality-specific classification and UI positioning

## Capabilities

### New Capabilities

- `05-analytics-psychometrics/latency-thresholds-by-modality`: Modality-calibrated cognitive latency thresholds (Single Note, Intervals, Sequences, Repertoire) with helper to resolve thresholds by mode

### Modified Capabilities

- `05-analytics-psychometrics`: Extend the "Fuente Única de Verdad de Umbrales Psicoacústicos" requirement to include per-modality `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` configuration and add GIVEN/WHEN/THEN scenarios for Intervals and Sequences modalities

## Impact

**Code affected:**
- `src/renderer/src/domain/analytics/thresholds.ts` (new)
- `src/renderer/src/domain/analytics/historyAnalytics.ts`
- `src/renderer/src/components/views/analytics/SessionsTableTab.tsx`
- `src/renderer/src/components/views/analytics/SessionDetailModal.tsx`
- Test files: `thresholdsConsistency.test.tsx`, `historyAnalytics.test.ts`, `SessionDetailModal.test.tsx`

**Specifications affected:**
- `openspec/specs/05-analytics-psychometrics/spec.md` (delta spec for modified capability)
- `openspec/specs/05-analytics-psychometrics/latency-thresholds-by-modality/spec.md` (new capability spec)

**No breaking changes**: The existing `COGNITIVE_LATENCY_THRESHOLDS` constant remains pointing to single_note config for full backward compatibility.