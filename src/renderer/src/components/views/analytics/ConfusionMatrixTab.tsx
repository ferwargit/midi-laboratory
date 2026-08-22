import React from 'react'
import { AnalyticsMetrics, AnalyticsModeFilter } from '../../../domain/analytics/historyAnalytics'
import { Card } from '../../ui/Card'

interface ConfusionMatrixTabProps {
  modeFilter: AnalyticsModeFilter
  metrics: AnalyticsMetrics
}

export function ConfusionMatrixTab({
  modeFilter,
  metrics
}: ConfusionMatrixTabProps): React.ReactElement {
  return (
    <Card className="space-y-4 bg-zinc-900/80 backdrop-blur-2xl border-zinc-800/80 shadow-2xl">
      <div className="font-mono">
        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
          Análisis Psicoacústico de Confusiones ({modeFilter})
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Patrones recurrentes de error auditivo y espectro de tiempo de decisión:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
        {/* Top pares confundidos */}
        <div className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 space-y-2.5">
          <span className="text-xs font-bold text-rose-400 block uppercase">
            Top Pares Confundidos:
          </span>
          {metrics.topConfusions.length === 0 ? (
            <div className="text-zinc-600 text-xs italic py-4 text-center">
              Sin patrones de confusión críticos registrados.
            </div>
          ) : (
            <div className="space-y-2">
              {metrics.topConfusions.map((c, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center text-xs p-2.5 bg-zinc-900/90 rounded-xl border border-zinc-800"
                >
                  <span>
                    <strong className="text-sky-300">{c.expected}</strong> ➔ Confundida con{' '}
                    <strong className="text-rose-400">{c.played}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-rose-950/80 text-rose-300 font-bold text-[10px]">
                    {c.count} veces
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distribución de velocidad */}
        <div className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 space-y-3.5 text-xs">
          <span className="font-bold text-sky-400 block uppercase">
            Distribución de Velocidad Cognitiva:
          </span>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-emerald-400 font-semibold">
                  ⚡ Reflejo Inmediato (&lt; 1.2s)
                </span>
                <span className="font-bold text-zinc-300">
                  {metrics.fastResponsesCount} respuestas
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                  style={{
                    width: `${metrics.totalAnswers > 0 ? (metrics.fastResponsesCount / metrics.totalAnswers) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-amber-400 font-semibold">
                  🤔 Deducción Activa (1.2s - 2.8s)
                </span>
                <span className="font-bold text-zinc-300">
                  {metrics.mediumResponsesCount} respuestas
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                  style={{
                    width: `${metrics.totalAnswers > 0 ? (metrics.mediumResponsesCount / metrics.totalAnswers) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-rose-400 font-semibold">⏳ Inseguridad (&gt; 2.8s)</span>
                <span className="font-bold text-zinc-300">
                  {metrics.slowResponsesCount} respuestas
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-300 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                  style={{
                    width: `${metrics.totalAnswers > 0 ? (metrics.slowResponsesCount / metrics.totalAnswers) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
