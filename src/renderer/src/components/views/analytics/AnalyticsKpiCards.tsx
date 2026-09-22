import React from 'react'
import { AnalyticsMetrics, MASTERY_THRESHOLDS } from '../../../domain/analytics/historyAnalytics'
import { PedagogicalTooltip } from '../../ui/PedagogicalTooltip'

interface AnalyticsKpiCardsProps {
  metrics: AnalyticsMetrics
  totalFilteredSessions: number
}

export function AnalyticsKpiCards({
  metrics,
  totalFilteredSessions
}: AnalyticsKpiCardsProps): React.ReactElement {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 font-mono text-center select-none">
      {/* 1. Sesiones */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
          Sesiones Analizadas
        </span>
        <strong className="tabular-nums font-mono text-2xl font-bold text-zinc-100">
          {totalFilteredSessions}
        </strong>
      </div>

      {/* 2. Oído Real IRT */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
          <PedagogicalTooltip conceptId="irt_normalized_accuracy">
            Oído Real (IRT)
          </PedagogicalTooltip>
        </span>
        <strong
          className={`tabular-nums font-mono text-2xl font-bold ${
            metrics.normalizedOverallAccuracy >= MASTERY_THRESHOLDS.MASTERED_MIN
              ? 'text-emerald-400'
              : metrics.normalizedOverallAccuracy >= MASTERY_THRESHOLDS.CRITICAL_MAX
                ? 'text-amber-400'
                : 'text-rose-400'
          }`}
        >
          {metrics.normalizedOverallAccuracy}%
        </strong>
      </div>

      {/* 3. Entropía */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
          <PedagogicalTooltip conceptId="shannon_entropy">
            Entropía (Incertidumbre)
          </PedagogicalTooltip>
        </span>
        <strong className="tabular-nums font-mono text-2xl font-bold text-purple-400">
          {metrics.avgEntropyBits} bits
        </strong>
      </div>

      {/* 4. Latencia */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
          <PedagogicalTooltip conceptId="cognitive_latency">Latencia Cognitiva</PedagogicalTooltip>
        </span>
        <strong className="tabular-nums font-mono text-2xl font-bold text-sky-400">
          {(metrics.avgResponseTimeMs / 1000).toFixed(2)}s
        </strong>
      </div>
    </div>
  )
}
