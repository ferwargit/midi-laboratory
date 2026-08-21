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
  const recentSessions = useMemo(() => [...sessions].slice(0, 12).reverse(), [sessions])
  const recentPsychometrics = useMemo(
    () => [...psychometrics].slice(0, 12).reverse(),
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
    <div className="space-y-4 select-none font-mono">
      {/* 1. CURVA TEMPORAL DE PRECISIÓN */}
      <div className="p-4 bg-zinc-950/80 backdrop-blur-xl rounded-2xl border border-zinc-800/80 space-y-3 shadow-xl">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <span className="font-bold text-zinc-100">
              CURVA PSICOMÉTRICA (PRECISIÓN CRUDA VS. OÍDO CORREGIDO POR AZAR):
            </span>
          </div>
          <div className="flex gap-3 text-[10px]">
            <span className="text-sky-400">● Cruda</span>
            <span className="text-purple-400">● Corregida (IRT)</span>
            <span className="text-emerald-500 font-bold">--- Meta (85%)</span>
          </div>
        </div>

        {recentSessions.length < 2 ? (
          <div className="h-36 flex items-center justify-center text-xs text-zinc-600 italic">
            Completa al menos 2 sesiones para proyectar la curva psicométrica.
          </div>
        ) : (
          <div className="h-40 w-full relative pt-2">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 500 100"
              preserveAspectRatio="none"
            >
              {/* Línea de meta 85% */}
              <line
                x1="0"
                y1="15"
                x2="500"
                y2="15"
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth="1"
                opacity="0.6"
              />

              {(() => {
                const pointsRaw = recentSessions.map((s, idx) => {
                  const x = (idx / (recentSessions.length - 1)) * 500
                  const y = 100 - (s.accuracyPercentage / 100) * 100
                  return { x, y }
                })
                const pointsNorm = recentPsychometrics.map((p, idx) => {
                  const x = (idx / Math.max(1, recentPsychometrics.length - 1)) * 500
                  const y = 100 - (p.normalizedAccuracy / 100) * 100
                  return { x, y }
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
                      strokeDasharray="4 4"
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Histograma direccional de errores */}
        <div className="p-4 bg-zinc-950/80 backdrop-blur-xl rounded-2xl border border-zinc-800/80 space-y-3 shadow-xl">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-amber-400">🎯 SESGO DE DESVIACIÓN (-3st a +3st):</span>
            <span className="text-zinc-500 text-[10px]">0st = Centro Tonal Exacto</span>
          </div>

          <div className="flex items-end justify-between h-32 pt-4 gap-2">
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
                  <span className="text-[9px] text-zinc-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {count}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      isExact
                        ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                        : isSharp
                          ? 'bg-purple-500/80 hover:bg-purple-400'
                          : 'bg-amber-500/80 hover:bg-amber-400'
                    }`}
                    style={{ height: `${Math.max(6, heightPercent)}%` }}
                  />
                  <span
                    className={`text-[10px] mt-1.5 ${isExact ? 'text-emerald-400 font-bold' : 'text-zinc-400'}`}
                  >
                    {st > 0 ? `+${st}` : st}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Resistencia a la entropía */}
        <div className="p-4 bg-zinc-950/80 backdrop-blur-xl rounded-2xl border border-zinc-800/80 space-y-3 shadow-xl text-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold text-purple-400">
              🧠 INCERTIDUMBRE Y ENTROPÍA (SHANNON):
            </span>
            <span className="text-zinc-500 text-[10px]">Carga Cognitiva</span>
          </div>

          <div className="space-y-2 pt-1 text-[11px]">
            {recentPsychometrics.slice(0, 3).map((p, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-zinc-900/90 rounded-xl border border-zinc-800/80 space-y-1"
              >
                <div className="flex justify-between text-zinc-200">
                  <span>
                    Pool: <strong>{p.poolSize} notas</strong> ({p.entropyBits} bits)
                  </span>
                  <span className="text-sky-400 font-bold">{p.rawAccuracy}% cruda</span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Azar base: {p.chanceBaseline}%</span>
                  <span className="text-purple-400 font-bold">
                    Oído Real: {p.normalizedAccuracy}%
                  </span>
                  <span>{p.responsesPerMinute} RPM</span>
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
