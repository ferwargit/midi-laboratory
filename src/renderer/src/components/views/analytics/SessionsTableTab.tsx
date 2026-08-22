import React from 'react'
import {
  DetailedSessionAnalysis,
  reconstructSessionConfig
} from '../../../domain/analytics/historyAnalytics'
import { DbAnswerRecord } from '../../../domain/database/types'
import { INSTRUMENT_CATALOG } from '../../../domain/music/instruments'
import { Card } from '../../ui/Card'
import { AiExercisePrescription } from '../../../domain/ai/types'
import { SortColumnKey, SortDirection } from './types'
import { PedagogicalTooltip } from '../../ui/PedagogicalTooltip'

interface SessionsTableTabProps {
  displayedList: DetailedSessionAnalysis[]
  answers: DbAnswerRecord[]
  sortKey: SortColumnKey
  sortDirection: SortDirection
  onSortClick: (key: SortColumnKey) => void
  onLoadPrescription: (p: AiExercisePrescription) => void
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}m ${secs}s`
}

export function SessionsTableTab({
  displayedList,
  answers,
  sortKey,
  sortDirection,
  onSortClick,
  onLoadPrescription
}: SessionsTableTabProps): React.ReactElement {
  const renderSortIndicator = (column: SortColumnKey): React.ReactElement => {
    if (sortKey !== column) {
      return <span className="opacity-0 group-hover:opacity-40 ml-1">⇅</span>
    }
    return (
      <span className="text-sky-400 font-bold ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>
    )
  }

  return (
    <Card className="space-y-3 bg-zinc-900/80 backdrop-blur-2xl border-zinc-800/80 shadow-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-zinc-800/80">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 font-mono uppercase tracking-wider m-0">
            Registro Histórico y Telemetría Clínica ({displayedList.length} sesiones)
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Pasa el mouse por los títulos con ⓘ para ver su explicación psicoacústica:
          </p>
        </div>

        <div className="text-[10px] font-mono bg-zinc-950 border border-zinc-800 px-2.5 py-1 rounded-lg text-zinc-400 flex items-center gap-1.5">
          <span>Orden:</span>
          <strong className="text-sky-400 uppercase">{sortKey}</strong>
          <span className="text-zinc-200 font-bold">
            {sortDirection === 'asc' ? '▲ (Menor a Mayor)' : '▼ (Mayor a Menor)'}
          </span>
        </div>
      </div>

      {displayedList.length === 0 ? (
        <div className="text-center py-8 text-zinc-600 text-xs italic font-mono">
          No hay sesiones que coincidan con los filtros aplicados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase tracking-wider select-none">
                <th
                  onClick={(): void => onSortClick('date')}
                  className="pb-2.5 cursor-pointer hover:text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center">
                    <span>Fecha</span>
                    {renderSortIndicator('date')}
                  </div>
                </th>

                <th
                  onClick={(): void => onSortClick('content')}
                  className="pb-2.5 cursor-pointer hover:text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center">
                    <span>Contenido & Timbre</span>
                    {renderSortIndicator('content')}
                  </div>
                </th>

                <th
                  onClick={(): void => onSortClick('format')}
                  className="pb-2.5 cursor-pointer hover:text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center">
                    <span>Formato</span>
                    {renderSortIndicator('format')}
                  </div>
                </th>

                <th
                  onClick={(): void => onSortClick('pool')}
                  className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center justify-center">
                    <PedagogicalTooltip conceptId="shannon_entropy">
                      <span>Carga (Pool)</span>
                    </PedagogicalTooltip>
                    {renderSortIndicator('pool')}
                  </div>
                </th>

                <th
                  onClick={(): void => onSortClick('questions')}
                  className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center justify-center">
                    <span>Preguntas</span>
                    {renderSortIndicator('questions')}
                  </div>
                </th>

                <th
                  onClick={(): void => onSortClick('duration')}
                  className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center justify-center">
                    <span>Duración</span>
                    {renderSortIndicator('duration')}
                  </div>
                </th>

                <th
                  onClick={(): void => onSortClick('accuracy')}
                  className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center justify-center">
                    <span>Precisión</span>
                    {renderSortIndicator('accuracy')}
                  </div>
                </th>

                <th
                  onClick={(): void => onSortClick('normalizedAccuracy')}
                  className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center justify-center">
                    <PedagogicalTooltip conceptId="irt_normalized_accuracy">
                      <span>Oído Real (IRT)</span>
                    </PedagogicalTooltip>
                    {renderSortIndicator('normalizedAccuracy')}
                  </div>
                </th>

                <th
                  onClick={(): void => onSortClick('fastPercent')}
                  className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center justify-center">
                    <PedagogicalTooltip conceptId="cognitive_latency">
                      <span>Reflejo (&lt;1.4s)</span>
                    </PedagogicalTooltip>
                    {renderSortIndicator('fastPercent')}
                  </div>
                </th>

                <th
                  onClick={(): void => onSortClick('bias')}
                  className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center justify-center">
                    <PedagogicalTooltip conceptId="directional_bias">
                      <span>Sesgo</span>
                    </PedagogicalTooltip>
                    {renderSortIndicator('bias')}
                  </div>
                </th>

                <th
                  onClick={(): void => onSortClick('rpm')}
                  className="pb-2.5 text-right cursor-pointer hover:text-zinc-200 transition-colors group"
                >
                  <div className="flex items-center justify-end">
                    <PedagogicalTooltip conceptId="responses_per_minute">
                      <span>Cadencia</span>
                    </PedagogicalTooltip>
                    {renderSortIndicator('rpm')}
                  </div>
                </th>

                <th className="pb-2.5 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {displayedList.map((item) => {
                const s = item.session
                const inst = INSTRUMENT_CATALOG.find((i) => i.id === s.instrumentId)

                let displayContent = s.presetName || ''
                if (displayContent.includes('•')) {
                  displayContent = displayContent.split('•')[0].trim()
                }

                return (
                  <tr key={s.id} className="hover:bg-zinc-950/50 transition-colors">
                    <td className="py-3 text-zinc-400 text-[11px] whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 font-sans">
                      <div className="font-semibold text-zinc-100 text-xs">{displayContent}</div>
                      <div className="text-[10px] font-mono text-zinc-500 mt-0.5 flex items-center gap-2">
                        <span>{inst?.name || s.instrumentId}</span>
                        <span>•</span>
                        <span
                          className={
                            item.inputMethod === 'hardware'
                              ? 'text-emerald-400 font-bold'
                              : item.inputMethod === 'virtual'
                                ? 'text-purple-400'
                                : 'text-amber-400'
                          }
                        >
                          {item.inputMethod === 'hardware'
                            ? '🎹 Roland FP-8'
                            : item.inputMethod === 'virtual'
                              ? '🖱️ Ratón Virtual'
                              : '🔀 Mixto'}
                        </span>
                        <span>•</span>
                        <span className="text-zinc-400">{s.strategyId}</span>
                      </div>
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      {item.formatType === 'time' ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-950/70 border border-amber-800 text-amber-300 text-[10px] font-bold">
                          ⏱️ {formatDuration(s.durationSeconds || 60)}
                        </span>
                      ) : item.formatType === 'mastery' ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-950/70 border border-purple-800 text-purple-300 text-[10px] font-bold">
                          🎯 Maestría
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px]">
                          🔢 Serie {s.totalQuestions}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-center whitespace-nowrap">
                      <span className="text-zinc-300 font-bold">{item.poolSize} notas</span>
                      <span className="block text-[10px] text-purple-400">
                        {item.entropyBits} bits
                      </span>
                    </td>
                    <td className="py-3 text-center whitespace-nowrap">
                      <span className="text-emerald-400 font-bold">{s.correctAnswers}</span> /{' '}
                      {s.totalQuestions}
                    </td>
                    <td className="py-3 text-center text-zinc-400 whitespace-nowrap">
                      {formatDuration(s.durationSeconds || 0)}
                    </td>
                    <td className="py-3 text-center text-zinc-200 font-bold whitespace-nowrap">
                      {s.accuracyPercentage}%
                    </td>
                    <td className="py-3 text-center whitespace-nowrap">
                      <span
                        className={`font-bold ${
                          item.normalizedAccuracy >= 85
                            ? 'text-emerald-400'
                            : item.normalizedAccuracy >= 50
                              ? 'text-amber-400'
                              : 'text-rose-400'
                        }`}
                      >
                        {item.normalizedAccuracy}%
                      </span>
                    </td>
                    <td className="py-3 text-center whitespace-nowrap">
                      <span
                        className={
                          item.fastPercent >= 60
                            ? 'text-emerald-400 font-bold'
                            : item.fastPercent >= 30
                              ? 'text-amber-400'
                              : 'text-zinc-400'
                        }
                      >
                        {item.fastPercent}%
                      </span>
                    </td>
                    <td className="py-3 text-center whitespace-nowrap">
                      <span className="text-zinc-300 text-[10px]">
                        {item.dominantBias === 'sharp' ? (
                          <span className="text-purple-400 font-bold">▲ +st Agudo</span>
                        ) : item.dominantBias === 'flat' ? (
                          <span className="text-amber-400 font-bold">▼ -st Grave</span>
                        ) : (
                          <span className="text-zinc-500">● Neutro</span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 text-right text-sky-400 font-bold whitespace-nowrap">
                      {item.responsesPerMinute}{' '}
                      <span className="text-[9px] font-normal text-zinc-500">RPM</span>
                    </td>
                    <td className="py-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(): void => {
                          const config = reconstructSessionConfig(s, answers)
                          onLoadPrescription(config)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-600/60 hover:border-sky-400 text-sky-200 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1 mx-auto"
                        title={`Clonar y repetir esta sesión idéntica (${s.presetName})`}
                      >
                        <span>🔁</span>
                        <span>Re-testar</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
