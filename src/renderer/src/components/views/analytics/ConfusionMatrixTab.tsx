import React, { useMemo, useState } from 'react'
import {
  AnalyticsMetrics,
  AnalyticsModeFilter,
  COGNITIVE_LATENCY_THRESHOLDS,
  computePitchClassConfusionMatrix,
  PitchClassConfusionCell
} from '../../../domain/analytics/historyAnalytics'
import { DbAnswerRecord } from '../../../domain/database/types'
import { Card } from '../../ui/Card'

interface ConfusionMatrixTabProps {
  modeFilter: AnalyticsModeFilter
  metrics: AnalyticsMetrics
  answers?: DbAnswerRecord[]
  totalFilteredSessions?: number
}

function getCellPedagogicalExplanation(cell: PitchClassConfusionCell): string {
  if (cell.count === 0) {
    return `Sin intentos registrados entre ${cell.expectedName} y ${cell.playedName}.`
  }

  if (cell.isDiagonal) {
    return `🎯 Afinación Exacta: Cuando sonó ${cell.expectedName}, la reconociste con precisión en ${cell.count} oportunidad(es) (${cell.percentageOfExpected}% de efectividad).`
  }

  const semitonesDiff = (cell.playedPc - cell.expectedPc + 12) % 12
  const signedDiff = semitonesDiff > 6 ? semitonesDiff - 12 : semitonesDiff
  const directionText =
    signedDiff > 0
      ? `+${signedDiff} semitono(s) hacia lo agudo`
      : `${signedDiff} semitono(s) hacia lo grave`

  return `⚠️ Atracción Tonal: Cuando sonó ${cell.expectedName}, tocaste ${cell.playedName} (${directionText}) en ${cell.count} oportunidad(es) [${cell.percentageOfExpected}% de los ensayos de ${cell.expectedName}]. Esto evidencia anticipación o búsqueda de resolución armónica en frecuencias cercanas.`
}

export function ConfusionMatrixTab({
  modeFilter,
  metrics,
  answers = [],
  totalFilteredSessions = 0
}: ConfusionMatrixTabProps): React.ReactElement {
  const [hoveredCell, setHoveredCell] = useState<PitchClassConfusionCell | null>(null)

  const confusion2D = useMemo(() => {
    return computePitchClassConfusionMatrix(answers)
  }, [answers])

  return (
    <Card className="space-y-4 bg-zinc-900/80 backdrop-blur-2xl border-zinc-800/80 shadow-2xl">
      <div className="font-mono">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider m-0">
            Análisis Psicoacústico de Confusiones ({modeFilter})
          </h3>
          <span className="text-[11px] text-zinc-400 bg-zinc-950 px-2.5 py-0.5 rounded-lg border border-zinc-800">
            {totalFilteredSessions || metrics.filteredSessionsCount} sesión(es) • {answers.length}{' '}
            respuestas
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-0.5">
          Matriz bidimensional de atracción tonal (12 × 12 de Do a Si) y espectro de tiempo de
          decisión:
        </p>
      </div>

      {/* 1. MATRIZ 2D INTERACTIVA DE CLASES DE TONO */}
      <div className="p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 space-y-3 font-mono">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">📊</span>
            <span className="font-bold text-sky-400 uppercase tracking-wider">
              Matriz Cromática de Confusión (Filas = Estímulo ➔ Columnas = Tocada):
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block shadow-[0_0_8px_rgba(16,185,129,0.6)]" />{' '}
              Diagonal (Acierto)
            </span>
            <span className="flex items-center gap-1 text-purple-400">
              <span className="w-2.5 h-2.5 rounded bg-purple-600 inline-block" /> Foco de Confusión
            </span>
          </div>
        </div>

        {answers.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs italic">
            Sin respuestas registradas para los filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto pt-1">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr>
                  <th className="p-1.5 text-[10px] text-zinc-500 uppercase font-bold text-left">
                    Estímulo \ Tocaste
                  </th>
                  {confusion2D.pitchClasses.map((pc) => (
                    <th
                      key={pc}
                      className="p-1.5 text-[11px] text-zinc-300 font-bold border-b border-zinc-800"
                    >
                      {pc}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 font-mono">
                {confusion2D.grid.map((row, rowIdx) => {
                  const expectedName = confusion2D.pitchClasses[rowIdx]
                  const rowTotal = confusion2D.totalTestsPerPitchClass[rowIdx]

                  return (
                    <tr key={expectedName} className="hover:bg-zinc-900/30">
                      <td className="p-1.5 text-left text-sky-300 font-bold text-[11px] border-r border-zinc-800 whitespace-nowrap">
                        {expectedName}{' '}
                        <span className="text-[9px] text-zinc-500 font-normal">({rowTotal})</span>
                      </td>

                      {row.map((cell) => {
                        const hasValue = cell.count > 0
                        const isDiag = cell.isDiagonal

                        let cellBg = 'bg-zinc-950/40 text-zinc-600'
                        if (isDiag && hasValue) {
                          cellBg =
                            'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                        } else if (!isDiag && hasValue) {
                          const intensityRatio = cell.count / confusion2D.maxOffDiagonalCount
                          cellBg =
                            intensityRatio > 0.6
                              ? 'bg-rose-950 border border-rose-500 text-rose-300 font-bold shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                              : intensityRatio > 0.3
                                ? 'bg-purple-950 border border-purple-500/60 text-purple-200 font-semibold'
                                : 'bg-zinc-900 border border-purple-900/50 text-purple-300'
                        }

                        return (
                          <td
                            key={cell.playedPc}
                            onMouseEnter={() => setHoveredCell(cell)}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`p-1.5 transition-all cursor-pointer ${cellBg}`}
                          >
                            {hasValue ? cell.count : '·'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* EXPLICACIÓN MUSICAL DINÁMICA AL PASAR EL MOUSE */}
            <div className="min-h-12 mt-2 p-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80 text-xs flex items-center justify-between text-zinc-300 font-sans px-3">
              {hoveredCell && hoveredCell.count > 0 ? (
                <div className="animate-in fade-in flex items-center gap-2">
                  <span className="text-base">{hoveredCell.isDiagonal ? '🎯' : '💡'}</span>
                  <span>{getCellPedagogicalExplanation(hoveredCell)}</span>
                </div>
              ) : (
                <span className="text-zinc-500 text-[11px] italic">
                  👉 Pasa el mouse sobre cualquier celda con números para ver la interpretación
                  musical del error o acierto.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. TOP PARES Y DISTRIBUCIÓN DE LATENCIA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
        {/* Top pares confundidos */}
        <div className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800 space-y-2.5">
          <span className="text-xs font-bold text-rose-400 block uppercase">
            Top Pares Confundidos Recurrentes:
          </span>
          {metrics.topConfusions.length === 0 ? (
            <div className="text-zinc-600 text-xs italic py-4 text-center">
              Sin patrones de confusión críticos en la selección activa.
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

        {/* Distribución de velocidad cognitiva */}
        <div className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800 space-y-3.5 text-xs">
          <span className="font-bold text-sky-400 block uppercase">
            Distribución de Velocidad Cognitiva:
          </span>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-emerald-400 font-semibold">
                  ⚡ Reflejo Inmediato ({COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL})
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
                  🤔 Deducción Activa ({COGNITIVE_LATENCY_THRESHOLDS.MEDIUM_LABEL})
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
                <span className="text-rose-400 font-semibold">
                  ⏳ Inseguridad ({COGNITIVE_LATENCY_THRESHOLDS.SLOW_LABEL})
                </span>
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
