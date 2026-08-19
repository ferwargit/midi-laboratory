import React from 'react'
import { DbSessionRecord, DbAnswerRecord } from '../../domain/database/types'

interface AnalyticsChartsProps {
  sessions: DbSessionRecord[]
  answers: DbAnswerRecord[]
}

export function AnalyticsCharts({ sessions, answers }: AnalyticsChartsProps): React.ReactElement {
  // Últimas 10 sesiones ordenadas cronológicamente
  const recentSessions = [...sessions].slice(0, 10).reverse()

  // Distribución de errores por distancia en semitonos (-3 a +3)
  const biasDistribution: Record<number, number> = {
    '-3': 0,
    '-2': 0,
    '-1': 0,
    '0': 0,
    '1': 0,
    '2': 0,
    '3': 0
  }
  answers.forEach((ans) => {
    const dist = ans.semitoneDistance
    if (dist >= -3 && dist <= 3) {
      biasDistribution[dist] = (biasDistribution[dist] || 0) + 1
    }
  })
  const maxBiasCount = Math.max(1, ...Object.values(biasDistribution))

  return (
    <div className="space-y-4">
      {/* 1. GRÁFICO DE CURVA DE EVOLUCIÓN HISTÓRICA */}
      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-sky-400">
            📈 Curva de Precisión en las Últimas Sesiones:
          </span>
          <span className="text-zinc-500 font-mono text-[10px]">Meta: &ge; 85%</span>
        </div>

        {recentSessions.length < 2 ? (
          <div className="h-32 flex items-center justify-center text-xs text-zinc-600 italic">
            Completa al menos 2 sesiones para visualizar la curva de aprendizaje.
          </div>
        ) : (
          <div className="h-36 w-full relative pt-2">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 500 100"
              preserveAspectRatio="none"
            >
              {/* Línea de Meta 85% */}
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

              {/* Área y Línea de Precisión */}
              {(() => {
                const points = recentSessions.map((s, idx) => {
                  const x = (idx / (recentSessions.length - 1)) * 500
                  const y = 100 - (s.accuracyPercentage / 100) * 100
                  return {
                    x,
                    y,
                    acc: s.accuracyPercentage,
                    time: (s.avgResponseTimeMs / 1000).toFixed(1)
                  }
                })
                const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                const areaD = `${pathD} L 500 100 L 0 100 Z`

                return (
                  <>
                    <path d={areaD} fill="url(#accuracyGradient)" opacity="0.25" />
                    <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
                    {points.map((p, i) => (
                      <g key={i}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="4"
                          fill="#0284c7"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                        <text
                          x={p.x}
                          y={p.y - 8}
                          fill="#e0f2fe"
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {p.acc}%
                        </text>
                      </g>
                    ))}
                    <defs>
                      <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </>
                )
              })()}
            </svg>
          </div>
        )}
      </div>

      {/* 2. DISTRIBUCIÓN DE SESGO DE SEMITONOS (HISTOGRAMA) */}
      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-amber-400">
            🎯 Distribución de Errores por Distancia en Semitonos:
          </span>
          <span className="text-zinc-500 text-[10px]">Centro = Nota Exacta (0 st)</span>
        </div>

        {answers.length === 0 ? (
          <div className="h-28 flex items-center justify-center text-xs text-zinc-600 italic">
            Sin respuestas registradas.
          </div>
        ) : (
          <div className="flex items-end justify-between h-28 pt-4 gap-2">
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
        )}
      </div>
    </div>
  )
}
