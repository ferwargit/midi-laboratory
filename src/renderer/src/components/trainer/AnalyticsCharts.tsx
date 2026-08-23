import React, { useMemo, useState, memo } from 'react'
import { DbSessionRecord, DbAnswerRecord } from '../../domain/database/types'
import {
  SessionPsychometrics,
  MASTERY_THRESHOLDS,
  AnalyticsModeFilter
} from '../../domain/analytics/historyAnalytics'

interface AnalyticsChartsProps {
  sessions: DbSessionRecord[]
  answers: DbAnswerRecord[]
  psychometrics?: SessionPsychometrics[]
  modeFilter?: AnalyticsModeFilter
  activeFiltersLabel?: string
}

interface HoveredPointInfo {
  x: number
  y: number
  session: DbSessionRecord
  psych?: SessionPsychometrics
  rawAcc: number
  normAcc: number
  dateStr: string
}

function AnalyticsChartsComponent({
  sessions,
  answers,
  psychometrics = [],
  modeFilter = 'all',
  activeFiltersLabel = 'Todos los datos'
}: AnalyticsChartsProps): React.ReactElement {
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPointInfo | null>(null)

  const recentSessions = useMemo(() => [...sessions].slice(0, 14).reverse(), [sessions])
  const recentPsychometrics = useMemo(
    () => [...psychometrics].slice(0, 14).reverse(),
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
      {/* 1. BANNER DINÁMICO EDUCATIVO Y DE CONTEXTO */}
      <div className="p-4 bg-gradient-to-r from-sky-950/40 via-purple-950/40 to-zinc-900 rounded-2xl border border-sky-500/30 space-y-2.5 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <span className="font-bold text-sky-300 uppercase tracking-wider">
              Contexto de la Muestra Graficada ({recentSessions.length} sesiones):
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
            Filtros: <strong className="text-sky-400">{modeFilter.toUpperCase()}</strong> •{' '}
            {activeFiltersLabel}
          </span>
        </div>

        {/* Guía de lectura pedagógica de la curva */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-sans text-xs">
          <div className="p-2 bg-zinc-950/80 rounded-xl border border-sky-800/40 space-y-0.5">
            <strong className="text-sky-400 font-mono text-[11px] flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> 🔵 Precisión
              Cruda:
            </strong>
            <p className="text-[11px] text-zinc-400 m-0">
              Acierto bruto ($K/N$). Incluye la probabilidad estadística de suerte por descarte.
            </p>
          </div>

          <div className="p-2 bg-zinc-950/80 rounded-xl border border-purple-800/40 space-y-0.5">
            <strong className="text-purple-400 font-mono text-[11px] flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" /> 🟣 Oído Real
              (IRT):
            </strong>
            <p className="text-[11px] text-zinc-400 m-0">
              Precisión corregida descontando el azar según el tamaño del pool de notas ($1/N$).
            </p>
          </div>

          <div className="p-2 bg-zinc-950/80 rounded-xl border border-emerald-800/40 space-y-0.5">
            <strong className="text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-400 inline-block" />{' '}
              🟢 Meta ({MASTERY_THRESHOLDS.MASTERED_MIN}%):
            </strong>
            <p className="text-[11px] text-zinc-400 m-0">
              Umbral canónico de maestría necesario para considerar el nivel consolidado.
            </p>
          </div>
        </div>
      </div>

      {/* 2. CURVA TEMPORAL PSICOMÉTRICA CON EJES GRADUADOS */}
      <div className="p-5 bg-zinc-950/90 backdrop-blur-2xl rounded-2xl border border-zinc-800/80 space-y-3 shadow-2xl relative">
        <div className="flex justify-between items-center pb-2 border-b border-zinc-800/80 text-xs">
          <span className="font-bold text-zinc-100 uppercase tracking-wider">
            Curva Psicométrica (Eje X Cronológico ➔ Eje Y Precisión)
          </span>
          <span className="text-[10px] text-zinc-500">
            Pasa el mouse sobre los puntos para inspeccionar
          </span>
        </div>

        {recentSessions.length < 2 ? (
          <div className="h-48 flex items-center justify-center text-xs text-zinc-600 italic">
            Completa al menos 2 sesiones para proyectar la curva psicométrica.
          </div>
        ) : (
          <div className="relative pt-2 pb-6">
            <div className="h-48 w-full relative">
              <svg
                className="w-full h-full overflow-visible"
                viewBox="0 0 600 120"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="cyanAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                  </linearGradient>

                  <linearGradient id="purpleAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Líneas Guía del Eje Y */}
                <line x1="45" y1="10" x2="590" y2="10" stroke="#27272a" strokeWidth="1" />
                <text x="5" y="13" fill="#71717a" fontSize="9" fontFamily="monospace">
                  100%
                </text>

                <line
                  x1="45"
                  y1="26.5"
                  x2="590"
                  y2="26.5"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.7"
                />
                <text
                  x="5"
                  y="29.5"
                  fill="#34d399"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  85%
                </text>

                <line
                  x1="45"
                  y1="65"
                  x2="590"
                  y2="65"
                  stroke="#27272a"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text x="12" y="68" fill="#71717a" fontSize="9" fontFamily="monospace">
                  50%
                </text>

                <line x1="45" y1="115" x2="590" y2="115" stroke="#3f3f46" strokeWidth="1" />
                <text x="20" y="118" fill="#71717a" fontSize="9" fontFamily="monospace">
                  0%
                </text>

                {(() => {
                  const xStart = 55
                  const xEnd = 585
                  const yTop = 10
                  const yBottom = 115
                  const ySpan = yBottom - yTop

                  const pointsRaw = recentSessions.map((s, idx) => {
                    const x =
                      xStart + (idx / Math.max(1, recentSessions.length - 1)) * (xEnd - xStart)
                    const y = yBottom - (s.accuracyPercentage / 100) * ySpan
                    return { x, y, s }
                  })

                  const pointsNorm = recentSessions.map((s, idx) => {
                    const psych = recentPsychometrics[idx]
                    const normAcc = psych ? psych.normalizedAccuracy : s.accuracyPercentage
                    const x =
                      xStart + (idx / Math.max(1, recentSessions.length - 1)) * (xEnd - xStart)
                    const y = yBottom - (normAcc / 100) * ySpan
                    return { x, y, s, psych, normAcc }
                  })

                  const pathRaw = pointsRaw
                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                    .join(' ')
                  const pathNorm = pointsNorm
                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                    .join(' ')

                  const areaRaw = `${pathRaw} L ${pointsRaw[pointsRaw.length - 1].x} ${yBottom} L ${pointsRaw[0].x} ${yBottom} Z`
                  const areaNorm = `${pathNorm} L ${pointsNorm[pointsNorm.length - 1].x} ${yBottom} L ${pointsNorm[0].x} ${yBottom} Z`

                  return (
                    <>
                      <path d={areaNorm} fill="url(#purpleAreaGrad)" />
                      <path d={areaRaw} fill="url(#cyanAreaGrad)" />

                      <path
                        d={pathNorm}
                        fill="none"
                        stroke="#c084fc"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                      <path d={pathRaw} fill="none" stroke="#38bdf8" strokeWidth="2.5" />

                      {pointsRaw.map((p, i) => {
                        const psych = recentPsychometrics[i]
                        const normP = pointsNorm[i]
                        const dateStr = new Date(p.s.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })

                        return (
                          <g key={i} className="cursor-pointer group">
                            <circle
                              cx={normP.x}
                              cy={normP.y}
                              r="3.5"
                              fill="#9333ea"
                              stroke="#c084fc"
                              strokeWidth="1.5"
                            />

                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="4.5"
                              fill="#0284c7"
                              stroke="#38bdf8"
                              strokeWidth="2"
                              onMouseEnter={(): void =>
                                setHoveredPoint({
                                  x: p.x,
                                  y: p.y,
                                  session: p.s,
                                  psych,
                                  rawAcc: p.s.accuracyPercentage,
                                  normAcc: normP.normAcc,
                                  dateStr
                                })
                              }
                              onMouseLeave={(): void => setHoveredPoint(null)}
                            />

                            <text
                              x={p.x}
                              y={yBottom + 14}
                              fill="#71717a"
                              fontSize="8"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              {new Date(p.s.createdAt).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: 'short'
                              })}
                            </text>
                          </g>
                        )
                      })}
                    </>
                  )
                })()}
              </svg>

              {hoveredPoint && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${Math.min(75, Math.max(15, (hoveredPoint.x / 600) * 100))}%`,
                    top: '-10px',
                    transform: 'translate(-50%, -100%)'
                  }}
                  className="p-3 bg-zinc-950/95 border border-sky-500/60 rounded-xl shadow-2xl text-[11px] font-mono space-y-1 z-30 pointer-events-none whitespace-nowrap"
                >
                  <div className="font-bold text-zinc-100 flex justify-between gap-3 border-b border-zinc-800 pb-1">
                    <span>{hoveredPoint.session.presetName}</span>
                    <span className="text-zinc-500 text-[10px]">{hoveredPoint.dateStr}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-sky-300">
                      Cruda: <strong>{hoveredPoint.rawAcc}%</strong>
                    </span>
                    <span className="text-purple-300">
                      Oído Real: <strong>{hoveredPoint.normAcc}%</strong>
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 text-[10px] text-zinc-400 pt-0.5">
                    <span>
                      Latencia: {(hoveredPoint.session.avgResponseTimeMs / 1000).toFixed(2)}s
                    </span>
                    <span>{hoveredPoint.psych?.responsesPerMinute || '-'} RPM</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. HISTOGRAMA DE SESGOS Y CARGA CONTEXTUAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-zinc-950/90 backdrop-blur-2xl rounded-2xl border border-zinc-800/80 space-y-3 shadow-xl">
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
                  <span className="text-[10px] text-zinc-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    className={`text-xs mt-1.5 font-bold ${isExact ? 'text-emerald-400' : 'text-zinc-400'}`}
                  >
                    {st > 0 ? `+${st}` : st}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-5 bg-zinc-950/90 backdrop-blur-2xl rounded-2xl border border-zinc-800/80 space-y-3 shadow-xl text-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold text-purple-400">
              🧠 INCERTIDUMBRE Y ENTROPÍA (SHANNON):
            </span>
            <span className="text-zinc-500 text-[10px]">Carga Cognitiva</span>
          </div>

          <div className="space-y-2 pt-1 text-xs">
            {recentPsychometrics.slice(0, 3).map((p, idx) => (
              <div
                key={idx}
                className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800/80 space-y-1"
              >
                <div className="flex justify-between text-zinc-200">
                  <span>
                    Pool: <strong>{p.poolSize} notas</strong> ({p.entropyBits} bits)
                  </span>
                  <span className="text-sky-400 font-bold">{p.rawAccuracy}% cruda</span>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
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
