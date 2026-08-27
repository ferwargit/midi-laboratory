import React, { useState } from 'react'
import {
  DetailedSessionAnalysis,
  reconstructSessionConfig,
  COGNITIVE_LATENCY_THRESHOLDS
} from '../../../domain/analytics/historyAnalytics'
import { DbAnswerRecord, DbSessionRecord } from '../../../domain/database/types'
import { INSTRUMENT_CATALOG } from '../../../domain/music/instruments'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { ConfirmModal } from '../../ui/ConfirmModal'
import { SessionDetailModal } from './SessionDetailModal'
import { AiExercisePrescription } from '../../../domain/ai/types'
import { SortColumnKey, SortDirection } from './types'
import { PedagogicalTooltip } from '../../ui/PedagogicalTooltip'

type TableFontSize = 'sm' | 'md' | 'lg'

interface SessionsTableTabProps {
  displayedList: DetailedSessionAnalysis[]
  answers: DbAnswerRecord[]
  sortKey: SortColumnKey
  sortDirection: SortDirection
  onSortClick: (key: SortColumnKey) => void
  onLoadPrescription: (p: AiExercisePrescription) => void
  onDeleteSession: (sessionId: string) => Promise<void>
  onDeleteSessions: (sessionIds: string[]) => Promise<void>
  onCompareSessionsWithAi: (selectedIds: string[]) => void
  onIsolateSessions?: (sessionIds: string[]) => void
  isIsolatedMode?: boolean
  onClearIsolation?: () => void
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
  onLoadPrescription,
  onDeleteSession,
  onDeleteSessions,
  onCompareSessionsWithAi,
  onIsolateSessions,
  isIsolatedMode = false,
  onClearIsolation
}: SessionsTableTabProps): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [sessionToDeleteSingle, setSessionToDeleteSingle] = useState<string | null>(null)
  const [sessionForDetail, setSessionForDetail] = useState<DbSessionRecord | null>(null)
  const [tableFontSize, setTableFontSize] = useState<TableFontSize>('md')

  const allVisibleIds = displayedList.map((d) => d.session.id)
  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id))

  const toggleSelectAll = (): void => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allVisibleIds))
    }
  }

  const toggleSelectOne = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleConfirmDelete = async (): Promise<void> => {
    if (sessionToDeleteSingle) {
      await onDeleteSession(sessionToDeleteSingle)
      setSessionToDeleteSingle(null)
    } else if (selectedIds.size > 0) {
      await onDeleteSessions(Array.from(selectedIds))
      setSelectedIds(new Set())
    }
    setIsDeleteModalOpen(false)
  }

  const renderSortIndicator = (column: SortColumnKey): React.ReactElement => {
    if (sortKey !== column) {
      return <span className="opacity-0 group-hover:opacity-40 ml-1">⇅</span>
    }
    return (
      <span className="text-sky-400 font-bold ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>
    )
  }

  const fontClass =
    tableFontSize === 'lg' ? 'text-sm' : tableFontSize === 'sm' ? 'text-[11px]' : 'text-xs'

  return (
    <>
      <Card className="space-y-3 bg-zinc-900/80 backdrop-blur-2xl border-zinc-800/80 shadow-2xl relative w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-zinc-800/80">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 font-mono uppercase tracking-wider m-0">
              Registro Histórico y Telemetría Clínica ({displayedList.length} sesiones)
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Haz clic en cualquier sesión o en <strong>🔍 Detalle</strong> para ver la línea de
              tiempo micro-cronológica:
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* SELECTOR DE ZOOM / TAMAÑO DE FUENTE */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-[10px] font-mono select-none">
              <span className="text-zinc-500 px-1 uppercase font-bold">Zoom:</span>
              <button
                type="button"
                onClick={() => setTableFontSize('sm')}
                className={`px-2 py-0.5 rounded-lg cursor-pointer ${tableFontSize === 'sm' ? 'bg-sky-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                title="Tamaño de texto compacto"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setTableFontSize('md')}
                className={`px-2 py-0.5 rounded-lg cursor-pointer ${tableFontSize === 'md' ? 'bg-sky-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                title="Tamaño de texto estándar"
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setTableFontSize('lg')}
                className={`px-2 py-0.5 rounded-lg cursor-pointer ${tableFontSize === 'lg' ? 'bg-sky-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                title="Tamaño de texto grande (Legibilidad aumentada)"
              >
                A+
              </button>
            </div>

            <div className="text-[10px] font-mono bg-zinc-950 border border-zinc-800 px-2.5 py-1 rounded-lg text-zinc-400 flex items-center gap-1.5">
              <span>Orden:</span>
              <strong className="text-sky-400 uppercase">{sortKey}</strong>
              <span className="text-zinc-200 font-bold">
                {sortDirection === 'asc' ? '▲ (Menor a Mayor)' : '▼ (Mayor a Menor)'}
              </span>
            </div>
          </div>
        </div>

        {/* BARRA FLOTANTE DE ACCIONES MÚLTIPLES */}
        {selectedIds.size > 0 && (
          <div className="p-2.5 bg-gradient-to-r from-sky-950/90 via-purple-950/90 to-zinc-950 border border-sky-500/50 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3 font-mono text-xs shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
              <span className="font-bold text-white">
                {selectedIds.size}{' '}
                {selectedIds.size === 1 ? 'sesión seleccionada' : 'sesiones seleccionadas'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* BOTÓN AISLAR EN ANALÍTICA */}
              {onIsolateSessions && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(): void => onIsolateSessions(Array.from(selectedIds))}
                  className="bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 font-bold text-xs shadow-md cursor-pointer border border-sky-400/40"
                  title="Recalcular todo el panel de analítica exclusivamente para estas sesiones marcadas"
                >
                  📊 Aislar en Analítica ({selectedIds.size})
                </Button>
              )}

              {selectedIds.size >= 2 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(): void => onCompareSessionsWithAi(Array.from(selectedIds))}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold text-xs shadow-md cursor-pointer border border-purple-400/30"
                >
                  🔬 Comparar con IA Local ({selectedIds.size})
                </Button>
              )}

              <Button
                variant="danger"
                size="sm"
                onClick={(): void => {
                  setSessionToDeleteSingle(null)
                  setIsDeleteModalOpen(true)
                }}
                className="font-bold text-xs shadow-md cursor-pointer"
              >
                🗑️ Eliminar Seleccionadas ({selectedIds.size})
              </Button>

              <button
                type="button"
                onClick={(): void => setSelectedIds(new Set())}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white text-xs cursor-pointer"
              >
                ✕ Desmarcar
              </button>
            </div>
          </div>
        )}

        {displayedList.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs italic font-mono">
            {isIsolatedMode ? (
              <div className="space-y-2">
                <div>No hay sesiones en el grupo aislado.</div>
                <button
                  type="button"
                  onClick={onClearIsolation}
                  className="text-sky-400 underline cursor-pointer"
                >
                  Volver a ver todas las sesiones
                </button>
              </div>
            ) : (
              'No hay sesiones que coincidan con los filtros aplicados.'
            )}
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className={`w-full text-left font-mono ${fontClass}`}>
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase tracking-wider select-none">
                  <th className="pb-2.5 pl-2 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="rounded bg-zinc-950 border-zinc-700 text-sky-500 focus:ring-0 cursor-pointer"
                      title="Seleccionar todas las visibles"
                    />
                  </th>

                  <th
                    onClick={(): void => onSortClick('date')}
                    className="pb-2.5 cursor-pointer hover:text-zinc-200 transition-colors group"
                  >
                    <div className="flex items-center">
                      <span>Fecha & ISI</span>
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
                    onClick={(): void => onSortClick('cpi')}
                    className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                  >
                    <div className="flex items-center justify-center">
                      <PedagogicalTooltip conceptId="cpi_score">
                        <span>Score CPI</span>
                      </PedagogicalTooltip>
                      {renderSortIndicator('cpi')}
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
                        <span>Reflejo ({COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL})</span>
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

                  <th className="pb-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {displayedList.map((item) => {
                  const s = item.session
                  const inst = INSTRUMENT_CATALOG.find((i) => i.id === s.instrumentId)
                  const isSelected = selectedIds.has(s.id)

                  let displayContent = s.presetName || ''
                  if (displayContent.includes('•')) {
                    displayContent = displayContent.split('•')[0].trim()
                  }

                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSessionForDetail(s)}
                      className={`transition-colors cursor-pointer ${
                        isSelected ? 'bg-sky-950/40 border-sky-800/60' : 'hover:bg-zinc-950/70'
                      }`}
                    >
                      <td className="py-3 pl-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(): void => toggleSelectOne(s.id)}
                          className="rounded bg-zinc-950 border-zinc-700 text-sky-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* 1. Fecha & Descanso ISI */}
                      <td className="py-3 text-zinc-400 whitespace-nowrap">
                        <div className="font-semibold text-zinc-300">
                          {new Date(s.createdAt).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        <div className="mt-0.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold whitespace-nowrap ${
                              item.interSessionGapLabel === 'Inicio'
                                ? 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                                : item.interSessionGapMs !== null && item.interSessionGapMs < 900000
                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                                  : item.interSessionGapMs !== null &&
                                      item.interSessionGapMs >= 43200000 &&
                                      item.interSessionGapMs <= 172800000
                                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                                    : 'bg-zinc-900 text-sky-400 border border-zinc-800'
                            }`}
                            title={`Descanso previo: ${item.interSessionGapLabel}`}
                          >
                            {item.interSessionGapLabel === 'Inicio'
                              ? 'Inicio'
                              : `⏱️ +${item.interSessionGapLabel}`}
                          </span>
                        </div>
                      </td>

                      {/* 2. Contenido y Timbre */}
                      <td className="py-3 font-sans whitespace-nowrap">
                        <div className="font-bold text-zinc-100">{displayContent}</div>
                        <div className="text-[11px] font-mono text-zinc-400 mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                          <span className="text-zinc-300">{inst?.name || s.instrumentId}</span>
                          <span className="text-zinc-600">•</span>
                          <span
                            className={
                              item.inputMethod === 'hardware'
                                ? 'text-emerald-400 font-bold'
                                : item.inputMethod === 'virtual'
                                  ? 'text-purple-400 font-semibold'
                                  : 'text-amber-400'
                            }
                          >
                            {item.inputMethod === 'hardware'
                              ? '🎹 Roland FP-8'
                              : item.inputMethod === 'virtual'
                                ? '🖱️ Ratón Virtual'
                                : '🔀 Mixto'}
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span className="text-zinc-500 font-mono text-[10px]">
                            {s.strategyId}
                          </span>
                        </div>
                      </td>

                      {/* 3. Formato */}
                      <td className="py-3 whitespace-nowrap">
                        {item.formatType === 'time' ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-950/70 border border-amber-800 text-amber-300 font-bold whitespace-nowrap">
                            {item.formatLabel}
                          </span>
                        ) : item.formatType === 'mastery' ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-950/70 border border-purple-800 text-purple-300 font-bold whitespace-nowrap">
                            🎯 Maestría
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 whitespace-nowrap">
                            {item.formatLabel}
                          </span>
                        )}
                      </td>

                      {/* 4. SCORE CPI */}
                      <td className="py-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-lg border font-mono font-bold whitespace-nowrap ${
                            item.cpiScore >= 750
                              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                              : item.cpiScore >= 450
                                ? 'bg-sky-950/80 border-sky-500/60 text-sky-300'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          {item.cpiScore >= 750
                            ? `🌟 ${item.cpiScore}`
                            : item.cpiScore >= 450
                              ? `🔥 ${item.cpiScore}`
                              : `${item.cpiScore} pts`}
                        </span>
                      </td>

                      {/* 5. Carga (Pool) */}
                      <td className="py-3 text-center whitespace-nowrap">
                        <span className="text-zinc-200 font-bold">{item.poolSize} notas</span>
                        <span className="block text-[10px] text-purple-400 font-semibold">
                          {item.entropyBits} bits
                        </span>
                      </td>

                      {/* 6. Preguntas */}
                      <td className="py-3 text-center whitespace-nowrap font-bold">
                        <span className="text-emerald-400">{s.correctAnswers}</span> /{' '}
                        <span>{s.totalQuestions}</span>
                      </td>

                      {/* 7. Duración */}
                      <td className="py-3 text-center text-zinc-300 whitespace-nowrap font-semibold">
                        {formatDuration(s.durationSeconds || 0)}
                      </td>

                      {/* 8. Precisión Cruda */}
                      <td className="py-3 text-center text-zinc-100 font-bold whitespace-nowrap">
                        {s.accuracyPercentage}%
                      </td>

                      {/* 9. Oído Real IRT */}
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

                      {/* 10. Reflejo Inmediato */}
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

                      {/* 11. Sesgo Direccional */}
                      <td className="py-3 text-center whitespace-nowrap">
                        <span className="text-zinc-300 text-[11px]">
                          {item.dominantBias === 'sharp' ? (
                            <span className="text-purple-400 font-bold">▲ +st Agudo</span>
                          ) : item.dominantBias === 'flat' ? (
                            <span className="text-amber-400 font-bold">▼ -st Grave</span>
                          ) : (
                            <span className="text-zinc-500">● Neutro</span>
                          )}
                        </span>
                      </td>

                      {/* 12. Cadencia / RPM */}
                      <td className="py-3 text-right text-sky-400 font-bold whitespace-nowrap">
                        {item.responsesPerMinute}{' '}
                        <span className="text-[10px] font-normal text-zinc-500">RPM</span>
                      </td>

                      {/* Acciones */}
                      <td
                        className="py-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(): void => setSessionForDetail(s)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] font-mono font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1"
                            title="Ver telemetría micro-cronológica pregunta a pregunta"
                          >
                            <span>🔍</span>
                            <span>Detalle</span>
                          </button>

                          <button
                            type="button"
                            onClick={(): void => {
                              const config = reconstructSessionConfig(s, answers)
                              onLoadPrescription(config)
                            }}
                            className="px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-600/60 hover:border-sky-400 text-sky-200 text-[11px] font-mono font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1"
                            title={`Clonar y repetir esta sesión idéntica (${s.presetName})`}
                          >
                            <span>🔁</span>
                            <span>Re-testar</span>
                          </button>

                          <button
                            type="button"
                            onClick={(): void => {
                              setSessionToDeleteSingle(s.id)
                              setIsDeleteModalOpen(true)
                            }}
                            className="p-1 rounded-lg bg-zinc-900 hover:bg-rose-950/80 border border-zinc-800 hover:border-rose-700/60 text-zinc-400 hover:text-rose-300 transition-all cursor-pointer"
                            title="Eliminar esta sesión de la base de datos"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* MODAL DE INSPECCIÓN CLÍNICA */}
      <SessionDetailModal
        session={sessionForDetail}
        answers={answers}
        isOpen={sessionForDetail !== null}
        onClose={() => setSessionForDetail(null)}
        onReTest={onLoadPrescription}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title={
          sessionToDeleteSingle
            ? '¿Eliminar Sesión de Entrenamiento?'
            : `¿Eliminar ${selectedIds.size} Sesiones Seleccionadas?`
        }
        message={
          sessionToDeleteSingle
            ? 'Esta acción eliminará permanentemente esta sesión y todas sus respuestas individuales de la base de datos.'
            : `Se eliminarán permanentemente las ${selectedIds.size} sesiones seleccionadas y todas sus respuestas de la memoria local. Esta operación no se puede deshacer.`
        }
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={(): void => {
          setIsDeleteModalOpen(false)
          setSessionToDeleteSingle(null)
        }}
      />
    </>
  )
}
