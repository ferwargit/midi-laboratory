import React, { useState, useEffect } from 'react'
import { useDatabaseStore } from '../../stores/useDatabaseStore'
import { useAnalyticsStore } from '../../stores/useAnalyticsStore'
import { useAiStore } from '../../stores/useAiStore'
import { AnalyticsModeFilter, filterSessionsByMode } from '../../domain/analytics/historyAnalytics'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { AnalyticsCharts } from '../trainer/AnalyticsCharts'
import { AiExercisePrescription } from '../../domain/ai/types'

interface AnalyticsViewProps {
  onLoadPrescription: (prescription: AiExercisePrescription) => void
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}m ${secs}s`
}

export function AnalyticsView({ onLoadPrescription }: AnalyticsViewProps): React.ReactElement {
  // Store 1: Base de Datos
  const sessions = useDatabaseStore((state) => state.sessions)
  const answers = useDatabaseStore((state) => state.answers)
  const aiReports = useDatabaseStore((state) => state.aiReports)
  const saveAiReport = useDatabaseStore((state) => state.saveAiReport)

  // Store 2: Analítica & Filtros
  const modeFilter = useAnalyticsStore((state) => state.modeFilter)
  const metrics = useAnalyticsStore((state) => state.metrics)
  const setModeFilter = useAnalyticsStore((state) => state.setModeFilter)
  const recomputeMetrics = useAnalyticsStore((state) => state.recomputeMetrics)

  // Store 3: Asistente IA Local Segregado por Modalidad
  const aiResponsesByMode = useAiStore((state) => state.aiResponsesByMode)
  const isLmStudioOnline = useAiStore((state) => state.isLmStudioOnline)
  const isAiAnalyzing = useAiStore((state) => state.isAiAnalyzing)
  const runAiDiagnostic = useAiStore((state) => state.runAiDiagnostic)
  const checkLmStudioStatus = useAiStore((state) => state.checkLmStudioStatus)
  const hydrateReportsByMode = useAiStore((state) => state.hydrateReportsByMode)

  const [activeTab, setActiveTab] = useState<
    'ai_report' | 'ai_history' | 'charts' | 'confusions' | 'sessions'
  >('ai_report')

  useEffect(() => {
    recomputeMetrics(sessions, answers)
  }, [sessions, answers, recomputeMetrics])

  useEffect(() => {
    checkLmStudioStatus()
  }, [checkLmStudioStatus])

  useEffect(() => {
    hydrateReportsByMode(aiReports, metrics)
  }, [aiReports, metrics, hydrateReportsByMode])

  const currentAiResponse = aiResponsesByMode[modeFilter]
  const displayedSessions = filterSessionsByMode(sessions, modeFilter)
  const filteredReports = aiReports.filter(
    (r) => modeFilter === 'all' || r.modeFilter === modeFilter
  )

  return (
    <div className="space-y-4 font-sans">
      {/* 1. FRANJA DE KPIS PSICOMÉTRICOS SUPERIORES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 font-mono text-center select-none">
        <div className="bg-zinc-900/60 backdrop-blur-xl p-3 rounded-2xl border border-zinc-800/80 shadow-lg">
          <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
            Sesiones Analizadas
          </span>
          <strong className="text-lg text-zinc-100">{metrics.filteredSessionsCount}</strong>
        </div>

        <div className="bg-zinc-900/60 backdrop-blur-xl p-3 rounded-2xl border border-zinc-800/80 shadow-lg">
          <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
            Oído Real (Corregido Azar)
          </span>
          <strong
            className={`text-lg ${
              metrics.normalizedOverallAccuracy >= 80
                ? 'text-emerald-400'
                : metrics.normalizedOverallAccuracy >= 50
                  ? 'text-amber-400'
                  : 'text-rose-400'
            }`}
          >
            {metrics.normalizedOverallAccuracy}%
          </strong>
        </div>

        <div className="bg-zinc-900/60 backdrop-blur-xl p-3 rounded-2xl border border-zinc-800/80 shadow-lg">
          <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
            Entropía de Incertidumbre
          </span>
          <strong className="text-lg text-purple-400">{metrics.avgEntropyBits} bits</strong>
        </div>

        <div className="bg-zinc-900/60 backdrop-blur-xl p-3 rounded-2xl border border-zinc-800/80 shadow-lg">
          <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
            Latencia Cognitiva
          </span>
          <strong className="text-lg text-sky-400">
            {(metrics.avgResponseTimeMs / 1000).toFixed(2)}s
          </strong>
        </div>
      </div>

      {/* 2. FILTRO DE MODALIDAD Y ESTADO GPU EN LÍNEA */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-zinc-900/60 backdrop-blur-xl p-2 rounded-2xl border border-zinc-800/80 gap-3 shadow-lg text-xs font-mono">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-zinc-500 text-[10px] uppercase font-bold px-2">Filtrar:</span>
          {(
            [
              ['all', 'Global'],
              ['single_note', 'Notas'],
              ['intervals', 'Intervalos'],
              ['sequences', 'Secuencias']
            ] as [AnalyticsModeFilter, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={(): void => setModeFilter(val, sessions, answers)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${
                modeFilter === val
                  ? 'bg-sky-600 border-sky-400 text-white font-bold shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-2">
          <span className="text-zinc-500 text-[11px]">LM Studio:</span>
          <span
            className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold ${
              isLmStudioOnline
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
            }`}
          >
            {isLmStudioOnline ? '🟢 GPU Activa' : '🟡 Motor Local'}
          </span>
          <button
            type="button"
            onClick={(): void => {
              checkLmStudioStatus()
            }}
            title="Re-comprobar conexión"
            className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
          >
            🔄
          </button>
        </div>
      </div>

      {/* 3. PESTAÑAS DE INSPECCIÓN */}
      <div className="flex gap-1.5 border-b border-zinc-800/80 pb-2 overflow-x-auto text-xs font-mono">
        {[
          { id: 'ai_report', label: '🧠 Diagnóstico IA' },
          { id: 'ai_history', label: `📜 Historial (${filteredReports.length})` },
          { id: 'charts', label: '📈 Gráficos & Curvas' },
          { id: 'confusions', label: '📊 Matriz de Confusión' },
          { id: 'sessions', label: `📋 Sesiones (${displayedSessions.length})` }
        ].map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={(): void => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? tab.id === 'ai_report'
                    ? 'bg-purple-600 text-white font-bold shadow-[0_0_15px_rgba(168,85,247,0.35)]'
                    : 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 4. CONTENIDO SEGÚN LA PESTAÑA SELECCIONADA */}

      {/* TAB 1: DIAGNÓSTICO Y PRESCRIPCIÓN IA */}
      {activeTab === 'ai_report' && (
        <Card className="space-y-4 bg-zinc-900/80 backdrop-blur-2xl border-purple-900/40 shadow-2xl">
          <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-purple-400 m-0 tracking-tight flex items-center gap-2">
                <span>✨ Diagnóstico Psicoacústico ({modeFilter.toUpperCase()})</span>
              </h3>
              <span className="text-[11px] text-zinc-500 font-mono">
                Motor: {currentAiResponse?.modelName || 'Iniciando...'}
              </span>
            </div>

            <Button
              size="sm"
              variant="primary"
              disabled={isAiAnalyzing}
              onClick={(): void => {
                runAiDiagnostic(metrics, saveAiReport)
              }}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-400/30"
            >
              {isAiAnalyzing ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>Razonando en GPU...</span>
                </div>
              ) : (
                '🔄 Generar Nueva Prescripción'
              )}
            </Button>
          </div>

          {metrics.totalAnswers < 10 && (
            <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-300 font-mono">
              ℹ️ Se recomienda acumular al menos 10 respuestas en esta modalidad para mayor
              precisión estadística (llevas {metrics.totalAnswers}).
            </div>
          )}

          {/* TEXTO CLINICO */}
          <div className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 text-xs text-zinc-300 leading-relaxed whitespace-pre-line font-sans">
            {currentAiResponse?.analysisText || 'Generando informe...'}
          </div>

          {/* TARJETA DE PRESCRIPCIÓN EJECUTABLE */}
          {currentAiResponse?.prescription && (
            <div className="p-4 bg-purple-950/30 border border-purple-800/60 rounded-2xl space-y-3.5 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                <div>
                  <span className="text-[10px] text-purple-400 font-mono uppercase tracking-wider font-bold block">
                    🎯 Prescripción Pedagógica Diseñada a Medida:
                  </span>
                  <h4 className="text-base font-bold text-zinc-100 mt-1 m-0">
                    {currentAiResponse.prescription.title}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-normal">
                    {currentAiResponse.prescription.rationale}
                  </p>
                </div>

                <Button
                  variant="success"
                  onClick={(): void => onLoadPrescription(currentAiResponse.prescription)}
                  className="shrink-0 font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
                >
                  🚀 Cargar y Ejecutar Ejercicio
                </Button>
              </div>

              {/* Chips de parámetros */}
              <div className="flex flex-wrap gap-2 text-[11px] font-mono pt-3 border-t border-purple-900/40">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                  Modo:{' '}
                  <strong className="text-sky-300">
                    {currentAiResponse.prescription.targetMode}
                  </strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                  Timbre:{' '}
                  <strong className="text-emerald-300">
                    {currentAiResponse.prescription.instrumentId}
                  </strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                  Criterio:{' '}
                  <strong className="text-amber-300">
                    {currentAiResponse.prescription.limitType}
                  </strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                  Avance:{' '}
                  <strong className="text-purple-300">
                    {currentAiResponse.prescription.advanceMode}
                  </strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                  Tonos:{' '}
                  <strong className="text-white">
                    {currentAiResponse.prescription.recommendedNotes
                      .map((n) => midiNoteToName(n))
                      .join(', ')}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: HISTORIAL DE INFORMES */}
      {activeTab === 'ai_history' && (
        <Card className="space-y-3 bg-zinc-900/80 backdrop-blur-2xl border-zinc-800/80 shadow-2xl">
          <h3 className="text-sm font-bold text-zinc-100 font-mono uppercase tracking-wider">
            Informes Históricos ({modeFilter}: {filteredReports.length})
          </h3>
          {filteredReports.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-xs italic font-mono">
              No hay informes guardados en la modalidad activa ({modeFilter}).
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 space-y-2.5"
                >
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="font-bold text-purple-400">{rep.prescription.title}</span>
                    <span className="text-zinc-500 text-[11px]">
                      {new Date(rep.createdAt).toLocaleString('es-AR')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed line-clamp-3 m-0">
                    {rep.analysisText}
                  </p>
                  <div className="flex justify-between items-center pt-2 border-t border-zinc-900 text-[10px] font-mono">
                    <span className="text-zinc-500">
                      Modo: {rep.modeFilter} | {rep.modelName}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(): void => onLoadPrescription(rep.prescription)}
                      className="text-xs cursor-pointer"
                    >
                      🚀 Re-ejecutar Prescripción
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: GRÁFICOS */}
      {activeTab === 'charts' && (
        <AnalyticsCharts
          sessions={displayedSessions}
          answers={answers}
          psychometrics={metrics.sessionPsychometricsList}
        />
      )}

      {/* TAB 4: MATRIZ DE CONFUSIÓN Y LATENCIAS */}
      {activeTab === 'confusions' && (
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
            {/* Top pares de confusión */}
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

            {/* Velocidad cognitiva */}
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
      )}

      {/* TAB 5: HISTORIAL DE SESIONES */}
      {activeTab === 'sessions' && (
        <Card className="space-y-3 bg-zinc-900/80 backdrop-blur-2xl border-zinc-800/80 shadow-2xl">
          <h3 className="text-sm font-bold text-zinc-100 font-mono uppercase tracking-wider">
            Registro Histórico de Sesiones ({modeFilter}: {displayedSessions.length})
          </h3>
          {displayedSessions.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-xs italic font-mono">
              No hay sesiones registradas en la modalidad seleccionada ({modeFilter}).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase">
                    <th className="pb-2.5">Fecha</th>
                    <th className="pb-2.5">Preset</th>
                    <th className="pb-2.5 text-center">Preguntas</th>
                    <th className="pb-2.5 text-center">Duración</th>
                    <th className="pb-2.5 text-center">Precisión Cruda</th>
                    <th className="pb-2.5 text-center">Oído Real</th>
                    <th className="pb-2.5 text-right">Tiempo Medio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {displayedSessions.map((s) => {
                    const psych = metrics.sessionPsychometricsList.find((p) => p.sessionId === s.id)
                    return (
                      <tr key={s.id} className="hover:bg-zinc-950/50 transition-colors">
                        <td className="py-2.5 text-zinc-400 text-[11px]">
                          {new Date(s.createdAt).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-2.5 font-sans font-medium text-zinc-100">
                          {s.presetName}
                        </td>
                        <td className="py-2.5 text-center">
                          <span className="text-emerald-400 font-bold">{s.correctAnswers}</span> /{' '}
                          {s.totalQuestions}
                        </td>
                        <td className="py-2.5 text-center text-zinc-400">
                          {formatDuration(s.durationSeconds || 0)}
                        </td>
                        <td className="py-2.5 text-center text-zinc-300 font-bold">
                          {s.accuracyPercentage}%
                        </td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`font-bold ${
                              (psych?.normalizedAccuracy || s.accuracyPercentage) >= 80
                                ? 'text-emerald-400'
                                : (psych?.normalizedAccuracy || s.accuracyPercentage) >= 50
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                            }`}
                          >
                            {psych ? `${psych.normalizedAccuracy}%` : `${s.accuracyPercentage}%`}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-zinc-300 font-mono">
                          {(s.avgResponseTimeMs / 1000).toFixed(2)}s
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
