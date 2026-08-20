import React, { useMemo, memo } from 'react'
import { DbSessionRecord, DbAnswerRecord } from '../../domain/database/types'
import { SessionPsychometrics } from '../../domain/analytics/historyAnalytics'

interface AnalyticsChartsProps {
  sessions: DbSessionRecord[]
  answers: DbAnswerRecord[]
  psychometrics?: SessionPsychometrics[]
}

function AnalyticsChartsComponent({
  sessions,
  answers,
  psychometrics = []
}: AnalyticsChartsProps): React.ReactElement {
  const recentSessions = useMemo(() => [...sessions].slice(0, 10).reverse(), [sessions])
  const recentPsychometrics = useMemo(
    () => [...psychometrics].slice(0, 10).reverse(),
    [psychometrics]
  )

  const { biasDistribution, maxBiasCount } = useMemo(() => {
    const dist: Record<number, number> = {
      '-3': 0,
      '-2': 0,
      '-1': 0,
      '0': 0,
      '1': 0,
      '2': 0,
      '3': 0
    }
    answers.forEach((ans) => {
      const d = ans.semitoneDistance
      if (d >= -3 && d <= 3) {
        dist[d] = (dist[d] || 0) + 1
      }
    })
    return {
      biasDistribution: dist,
      maxBiasCount: Math.max(1, ...Object.values(dist))
    }
  }, [answers])

  return (
    <div className="space-y-4 select-none">
      {/* 1. CURVA TEMPORAL */}
      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-sky-400">
            📈 Precisión Cruda vs. Corregida por Azar (Últimas Sesiones):
          </span>
          <div className="flex gap-3 text-[10px] font-mono">
            <span className="text-sky-400">● Cruda</span>
            <span className="text-purple-400">● Corregida (Azar)</span>
            <span className="text-emerald-500">--- Meta (85%)</span>
          </div>
        </div>

        {recentSessions.length < 2 ? (
          <div className="h-32 flex items-center justify-center text-xs text-zinc-600 italic">
            Completa al menos 2 sesiones para visualizar la curva psicométrica.
          </div>
        ) : (
          <div className="h-36 w-full relative pt-2">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 500 100"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="15"
                x2="500"
                y2="15"
                stroke="#059669"
                strokeDasharray="4 4"
                strokeWidth="1"
                opacity="0.6"
              />

              {(() => {
                const pointsRaw = recentSessions.map((s, idx) => {
                  const x = (idx / (recentSessions.length - 1)) * 500
                  const y = 100 - (s.accuracyPercentage / 100) * 100
                  return { x, y, acc: s.accuracyPercentage }
                })
                const pointsNorm = recentPsychometrics.map((p, idx) => {
                  const x = (idx / Math.max(1, recentPsychometrics.length - 1)) * 500
                  const y = 100 - (p.normalizedAccuracy / 100) * 100
                  return { x, y, acc: p.normalizedAccuracy }
                })

                const pathRaw = pointsRaw
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                  .join(' ')
                const pathNorm = pointsNorm
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                  .join(' ')

                return (
                  <>
                    <path
                      d={pathNorm}
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                    <path d={pathRaw} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
                    {pointsRaw.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="3.5"
                        fill="#0284c7"
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                      />
                    ))}
                  </>
                )
              })()}
            </svg>
          </div>
        )}
      </div>

      {/* 2. HISTOGRAMA DE SESGOS Y ENTROPÍA */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-amber-400">🎯 Sesgo de Semitono (-3st a +3st):</span>
            <span className="text-zinc-500 text-[10px]">0st = Exacto</span>
          </div>

          <div className="flex items-end justify-between h-28 pt-4 gap-1.5">
            {[-3, -2, -1, 0, 1, 2, 3].map((st) => {
              const count = biasDistribution[st] || 0
              const heightPercent = (count / maxBiasCount) * 100
              const isExact = st === 0
              const isSharp = st > 0

              return (
                <div
                  key={st}
                  className="flex-1 flex flex-col items-center h-full justify-end group"
                >
                  <span className="text-[9px] font-mono text-zinc-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {count}
                  </span>
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${
                      isExact
                        ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                        : isSharp
                          ? 'bg-purple-500/80 hover:bg-purple-400'
                          : 'bg-amber-500/80 hover:bg-amber-400'
                    }`}
                    style={{ height: `${Math.max(4, heightPercent)}%` }}
                  />
                  <span
                    className={`text-[10px] font-mono mt-1 ${isExact ? 'text-emerald-400 font-bold' : 'text-zinc-400'}`}
                  >
                    {st > 0 ? `+${st}` : st}st
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold text-emerald-400">🧠 Resistencia a la Entropía (Pool):</span>
            <span className="text-zinc-500 text-[10px]">Incertidumbre Contextual</span>
          </div>

          <div className="space-y-2.5 pt-1 font-mono text-[11px]">
            {recentPsychometrics.slice(0, 4).map((p, idx) => (
              <div key={idx} className="p-2 bg-zinc-900 rounded border border-zinc-800 space-y-1">
                <div className="flex justify-between text-zinc-300">
                  <span>
                    Pool: {p.poolSize} notas ({p.entropyBits} bits)
                  </span>
                  <span className="text-sky-400 font-bold">{p.rawAccuracy}% acierto</span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Azar base: {p.chanceBaseline}%</span>
                  <span className="text-purple-400">Oído Real: {p.normalizedAccuracy}%</span>
                  <span>Vel: {p.responsesPerMinute} RPM</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export const AnalyticsCharts = memo(AnalyticsChartsComponent)
