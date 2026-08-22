import React, { useState, useEffect, useMemo } from 'react'
import { useDatabaseStore } from '../../stores/useDatabaseStore'
import { useAnalyticsStore } from '../../stores/useAnalyticsStore'
import { useAiStore } from '../../stores/useAiStore'
import {
  AnalyticsModeFilter,
  AnalyticsMasteryFilter,
  filterSessionsAdvanced,
  DetailedSessionAnalysis,
  reconstructSessionConfig,
  LongitudinalComparison
} from '../../domain/analytics/historyAnalytics'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { INSTRUMENT_CATALOG } from '../../domain/music/instruments'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { AnalyticsCharts } from '../trainer/AnalyticsCharts'
import { AiExercisePrescription } from '../../domain/ai/types'

interface AnalyticsViewProps {
  onLoadPrescription: (prescription: AiExercisePrescription) => void
}

type SortColumnKey =
  | 'date'
  | 'content'
  | 'format'
  | 'pool'
  | 'questions'
  | 'duration'
  | 'accuracy'
  | 'normalizedAccuracy'
  | 'fastPercent'
  | 'bias'
  | 'rpm'

type SortDirection = 'asc' | 'desc'

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}m ${secs}s`
}

// Generador de Diagnóstico Psicoacústico Explicativo para la UI
function getPsychoacousticInterpretation(c: LongitudinalComparison): {
  badge: string
  badgeColor: string
  explanation: string
  actionableTip: string
} {
  const isAccuracyHigher = c.rawAccuracyDelta > 0
  const isAccuracyStable = c.rawAccuracyDelta === 0 || c.rawAccuracyDelta === -1
  const isSlower = c.responseTimeDeltaMs > 150
  const isFaster = c.responseTimeDeltaMs < -150

  if (isAccuracyHigher && isFaster) {
    return {
      badge: '🌟 CONSOLIDACIÓN ÓPTIMA',
      badgeColor: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300',
      explanation: `Tu cerebro mejoró su precisión (+${c.rawAccuracyDelta}%) reduciendo el tiempo de reacción (${Math.abs(c.responseTimeDeltaMs)}ms más rápido). Esto evidencia una representación mental del tono más sólida y un acceso directo sin sobrepensamiento.`,
      actionableTip:
        'Recomendación: Estás listo para ampliar el pool de notas o aumentar la entropía agregando alteraciones cromáticas.'
    }
  }

  if (isAccuracyHigher && isSlower) {
    return {
      badge: '🎯 MAYOR PRECISIÓN CON DEDUCCIÓN ACTIVA',
      badgeColor: 'bg-sky-950/80 border-sky-500/60 text-sky-300',
      explanation: `Lograste mayor exactitud (+${c.rawAccuracyDelta}%), pero requirió +${c.responseTimeDeltaMs}ms de procesamiento mental. Tu oído está discriminando bien, pero aún utiliza deducción interválica en lugar de reconocimiento de reflejo instantáneo.`,
      actionableTip:
        'Recomendación: Realizar sesiones cronometradas cortas (1 minuto) para acelerar la velocidad de decisión.'
    }
  }

  if (isAccuracyStable && isSlower) {
    return {
      badge: '⚠️ PRECISIÓN ESTABLE CON FATIGA AUDITIVA',
      badgeColor: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
      explanation: `Tu oído mantuvo la precisión casi intacta (${c.baselineSession.accuracyPercentage}% ➔ ${c.latestSession.accuracyPercentage}%), pero tardó +${c.responseTimeDeltaMs}ms más por nota. En psicoacústica, cuando la precisión se sostiene pero la latencia sube tras varias sesiones, es el síntoma clínico primario de fatiga auditiva (el cerebro tarda más en decodificar los armónicos).`,
      actionableTip:
        'Recomendación: Realizar una pausa de descanso auditivo de 15 minutos antes de la siguiente sesión.'
    }
  }

  if (isAccuracyStable && isFaster) {
    return {
      badge: '⚡ MAYOR VELOCIDAD DE FLUJO',
      badgeColor: 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300',
      explanation: `Mantuviste la misma tasa de acierto respondiendo ${Math.abs(c.responseTimeDeltaMs)}ms más rápido y aumentando tu cadencia en +${c.rpmDelta} RPM. Tu reflejo auditivo se está automatizando.`,
      actionableTip:
        'Recomendación: Mantener este formato para fijar el reflejo antes de subir de nivel.'
    }
  }

  return {
    badge: '🔄 NECESIDAD DE ANCLAJE TONAL',
    badgeColor: 'bg-rose-950/80 border-rose-500/60 text-rose-300',
    explanation: `Se detectó una disminución en la tasa de acierto (${c.rawAccuracyDelta}%) con un cambio en la velocidad de respuesta. Las notas conflictivas están generando interferencia perceptual transitoria.`,
    actionableTip:
      'Recomendación: Entrenar en Modo Maestría focalizado exclusivamente en los pares de notas conflictivas.'
  }
}

export function AnalyticsView({ onLoadPrescription }: AnalyticsViewProps): React.ReactElement {
  const sessions = useDatabaseStore((state) => state.sessions)
  const answers = useDatabaseStore((state) => state.answers)
  const aiReports = useDatabaseStore((state) => state.aiReports)
  const saveAiReport = useDatabaseStore((state) => state.saveAiReport)

  const modeFilter = useAnalyticsStore((state) => state.modeFilter)
  const metrics = useAnalyticsStore((state) => state.metrics)
  const setModeFilter = useAnalyticsStore((state) => state.setModeFilter)
  const recomputeMetrics = useAnalyticsStore((state) => state.recomputeMetrics)

  const aiResponsesByMode = useAiStore((state) => state.aiResponsesByMode)
  const isLmStudioOnline = useAiStore((state) => state.isLmStudioOnline)
  const isAiAnalyzing = useAiStore((state) => state.isAiAnalyzing)
  const runAiDiagnostic = useAiStore((state) => state.runAiDiagnostic)
  const checkLmStudioStatus = useAiStore((state) => state.checkLmStudioStatus)
  const hydrateReportsByMode = useAiStore((state) => state.hydrateReportsByMode)

  const [activeTab, setActiveTab] = useState<
    'sessions' | 'ai_report' | 'ai_history' | 'charts' | 'confusions'
  >('sessions')

  // Filtros Secundarios
  const [selectedInstrument, setSelectedInstrument] = useState<string>('all')
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'time' | 'questions' | 'mastery'>(
    'all'
  )
  const [selectedMastery, setSelectedMastery] = useState<AnalyticsMasteryFilter>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Estado de Ordenamiento
  const [sortKey, setSortKey] = useState<SortColumnKey>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Temporizador de inferencia en vivo
  const [reasoningSeconds, setReasoningSeconds] = useState<number>(0)
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null)

  useEffect(() => {
    recomputeMetrics(sessions, answers)
  }, [sessions, answers, recomputeMetrics])

  useEffect(() => {
    checkLmStudioStatus()
  }, [checkLmStudioStatus])

  useEffect(() => {
    hydrateReportsByMode(aiReports, metrics)
  }, [aiReports, metrics, hydrateReportsByMode])

  // Cronómetro de razonamiento en GPU (100% compliant con las reglas de React)
  useEffect(() => {
    if (!isAiAnalyzing) return

    const startTime = Date.now()
    const interval = setInterval(() => {
      setReasoningSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)))
    }, 1000)

    return (): void => {
      clearInterval(interval)
    }
  }, [isAiAnalyzing])

  const currentAiResponse = aiResponsesByMode[modeFilter]

  const handleRunDiagnostic = async (): Promise<void> => {
    setReasoningSeconds(0)
    await runAiDiagnostic(metrics, saveAiReport)
    const nowStr = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    setLastGeneratedAt(nowStr)
  }

  const handleSortClick = (column: SortColumnKey): void => {
    if (sortKey === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(column)
      const defaultDescColumns: SortColumnKey[] = [
        'date',
        'accuracy',
        'normalizedAccuracy',
        'fastPercent',
        'rpm',
        'pool',
        'questions',
        'duration'
      ]
      setSortDirection(defaultDescColumns.includes(column) ? 'desc' : 'asc')
    }
  }

  const displayedAnalysisList: DetailedSessionAnalysis[] = useMemo(() => {
    const filteredRaw = filterSessionsAdvanced(sessions, {
      mode: modeFilter,
      instrumentId: selectedInstrument,
      format: selectedFormat,
      mastery: selectedMastery,
      searchQuery
    })
    const validIds = new Set(filteredRaw.map((s) => s.id))
    const list = (metrics.sessionPsychometricsList || []).filter((item) =>
      validIds.has(item.session.id)
    )

    return [...list].sort((a, b) => {
      let comparison = 0

      switch (sortKey) {
        case 'date':
          comparison =
            new Date(a.session.createdAt).getTime() - new Date(b.session.createdAt).getTime()
          break
        case 'content':
          comparison = (a.session.presetName || '').localeCompare(b.session.presetName || '')
          break
        case 'format':
          comparison = a.formatType.localeCompare(b.formatType)
          break
        case 'pool':
          comparison = a.poolSize - b.poolSize || a.entropyBits - b.entropyBits
          break
        case 'questions':
          comparison =
            a.session.totalQuestions - b.session.totalQuestions ||
            a.session.correctAnswers - b.session.correctAnswers
          break
        case 'duration':
          comparison = (a.session.durationSeconds || 0) - (b.session.durationSeconds || 0)
          break
        case 'accuracy':
          comparison = a.session.accuracyPercentage - b.session.accuracyPercentage
          break
        case 'normalizedAccuracy':
          comparison = a.normalizedAccuracy - b.normalizedAccuracy
          break
        case 'fastPercent':
          comparison = a.fastPercent - b.fastPercent
          break
        case 'bias':
          comparison = a.dominantBias.localeCompare(b.dominantBias)
          break
        case 'rpm':
          comparison = a.responsesPerMinute - b.responsesPerMinute
          break
        default:
          comparison = 0
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [
    sessions,
    modeFilter,
    selectedInstrument,
    selectedFormat,
    selectedMastery,
    searchQuery,
    metrics,
    sortKey,
    sortDirection
  ])

  const filteredReports = aiReports.filter(
    (r) => modeFilter === 'all' || r.modeFilter === modeFilter
  )

  const renderSortIndicator = (column: SortColumnKey): React.ReactElement => {
    if (sortKey !== column) {
      return <span className="opacity-0 group-hover:opacity-40 ml-1">⇅</span>
    }
    return (
      <span className="text-sky-400 font-bold ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>
    )
  }

  return (
    <div className="space-y-4 font-sans">
      {/* 1. FRANJA DE KPIS PSICOMÉTRICOS SUPERIORES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 font-mono text-center select-none">
        <div className="bg-zinc-900/60 backdrop-blur-xl p-3 rounded-2xl border border-zinc-800/80 shadow-lg">
          <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
            Sesiones Analizadas
          </span>
          <strong className="text-lg text-zinc-100">{displayedAnalysisList.length}</strong>
        </div>

        <div className="bg-zinc-900/60 backdrop-blur-xl p-3 rounded-2xl border border-zinc-800/80 shadow-lg">
          <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
            Oído Real (IRT Corregido)
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

      {/* 2. BARRA DE FILTROS MULTIDIMENSIONALES */}
      <div className="bg-zinc-900/70 backdrop-blur-2xl p-3 rounded-2xl border border-zinc-800/80 space-y-2.5 shadow-xl font-mono text-xs">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-500 text-[10px] uppercase font-bold px-1">Modalidad:</span>
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
                className={`px-3 py-1 rounded-xl transition-all cursor-pointer border ${
                  modeFilter === val
                    ? 'bg-sky-600 border-sky-400 text-white font-bold shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
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

        {/* Fila de filtros cruzados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800/80 text-[11px]">
          <div>
            <input
              type="text"
              placeholder="🔍 Buscar sesión o preset..."
              value={searchQuery}
              onChange={(e): void => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <select
              value={selectedInstrument}
              onChange={(e): void => setSelectedInstrument(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="all">🎹 Todos los Timbres</option>
              {INSTRUMENT_CATALOG.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedFormat}
              onChange={(e): void => setSelectedFormat(e.target.value as typeof selectedFormat)}
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="all">⏱️ Todos los Formatos</option>
              <option value="time">⏱️ Cronometrado</option>
              <option value="mastery">🎯 Modo Maestría</option>
              <option value="questions">🔢 Por Preguntas</option>
            </select>
          </div>

          <div>
            <select
              value={selectedMastery}
              onChange={(e): void => setSelectedMastery(e.target.value as AnalyticsMasteryFilter)}
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="all">🎯 Todo Nivel de Éxito</option>
              <option value="mastered">🟢 Dominadas (≥85%)</option>
              <option value="learning">🟡 En Progreso (50-85%)</option>
              <option value="critical">🔴 Críticas (&lt;50%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. PESTAÑAS DE INSPECCIÓN */}
      <div className="flex gap-1.5 border-b border-zinc-800/80 pb-2 overflow-x-auto text-xs font-mono">
        {[
          { id: 'sessions', label: `📋 Registro Clínico (${displayedAnalysisList.length})` },
          { id: 'ai_report', label: '🧠 Diagnóstico IA' },
          { id: 'ai_history', label: `📜 Historial IA (${filteredReports.length})` },
          { id: 'charts', label: '📈 Gráficos & Curvas' },
          { id: 'confusions', label: '📊 Matriz de Confusión' }
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

      {/* 4. TABLA CLÍNICA DE SESIONES CON ORDENAMIENTO Y ACCIÓN DE RE-TESTEO */}
      {activeTab === 'sessions' && (
        <Card className="space-y-3 bg-zinc-900/80 backdrop-blur-2xl border-zinc-800/80 shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-zinc-800/80">
            <div>
              <h3 className="text-sm font-bold text-zinc-100 font-mono uppercase tracking-wider m-0">
                Registro Histórico y Telemetría Clínica ({displayedAnalysisList.length} sesiones)
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Haz clic en cualquier cabecera para ordenar o en 🔁 Re-testar para evaluar tu
                evolución:
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

          {displayedAnalysisList.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-xs italic font-mono">
              No hay sesiones que coincidan con los filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase tracking-wider select-none">
                    <th
                      onClick={(): void => handleSortClick('date')}
                      className="pb-2.5 cursor-pointer hover:text-zinc-200 transition-colors group"
                    >
                      <div className="flex items-center">
                        <span>Fecha</span>
                        {renderSortIndicator('date')}
                      </div>
                    </th>

                    <th
                      onClick={(): void => handleSortClick('content')}
                      className="pb-2.5 cursor-pointer hover:text-zinc-200 transition-colors group"
                    >
                      <div className="flex items-center">
                        <span>Contenido & Timbre</span>
                        {renderSortIndicator('content')}
                      </div>
                    </th>

                    <th
                      onClick={(): void => handleSortClick('format')}
                      className="pb-2.5 cursor-pointer hover:text-zinc-200 transition-colors group"
                    >
                      <div className="flex items-center">
                        <span>Formato</span>
                        {renderSortIndicator('format')}
                      </div>
                    </th>

                    <th
                      onClick={(): void => handleSortClick('pool')}
                      className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                    >
                      <div className="flex items-center justify-center">
                        <span>Carga (Pool)</span>
                        {renderSortIndicator('pool')}
                      </div>
                    </th>

                    <th
                      onClick={(): void => handleSortClick('questions')}
                      className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                    >
                      <div className="flex items-center justify-center">
                        <span>Preguntas</span>
                        {renderSortIndicator('questions')}
                      </div>
                    </th>

                    <th
                      onClick={(): void => handleSortClick('duration')}
                      className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                    >
                      <div className="flex items-center justify-center">
                        <span>Duración</span>
                        {renderSortIndicator('duration')}
                      </div>
                    </th>

                    <th
                      onClick={(): void => handleSortClick('accuracy')}
                      className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                    >
                      <div className="flex items-center justify-center">
                        <span>Precisión</span>
                        {renderSortIndicator('accuracy')}
                      </div>
                    </th>

                    <th
                      onClick={(): void => handleSortClick('normalizedAccuracy')}
                      className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                    >
                      <div className="flex items-center justify-center">
                        <span>Oído Real (IRT)</span>
                        {renderSortIndicator('normalizedAccuracy')}
                      </div>
                    </th>

                    <th
                      onClick={(): void => handleSortClick('fastPercent')}
                      className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                    >
                      <div className="flex items-center justify-center">
                        <span>Reflejo (&lt;1.2s)</span>
                        {renderSortIndicator('fastPercent')}
                      </div>
                    </th>

                    <th
                      onClick={(): void => handleSortClick('bias')}
                      className="pb-2.5 text-center cursor-pointer hover:text-zinc-200 transition-colors group"
                    >
                      <div className="flex items-center justify-center">
                        <span>Sesgo</span>
                        {renderSortIndicator('bias')}
                      </div>
                    </th>

                    <th
                      onClick={(): void => handleSortClick('rpm')}
                      className="pb-2.5 text-right cursor-pointer hover:text-zinc-200 transition-colors group"
                    >
                      <div className="flex items-center justify-end">
                        <span>Cadencia</span>
                        {renderSortIndicator('rpm')}
                      </div>
                    </th>

                    <th className="pb-2.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {displayedAnalysisList.map((item) => {
                    const s = item.session
                    const inst = INSTRUMENT_CATALOG.find((i) => i.id === s.instrumentId)

                    let displayContent = s.presetName || ''
                    if (displayContent.includes('•')) {
                      displayContent = displayContent.split('•')[0].trim()
                    }

                    return (
                      <tr key={s.id} className="hover:bg-zinc-950/50 transition-colors">
                        {/* 1. Fecha */}
                        <td className="py-3 text-zinc-400 text-[11px] whitespace-nowrap">
                          {new Date(s.createdAt).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>

                        {/* 2. Contenido y Timbre */}
                        <td className="py-3 font-sans">
                          <div className="font-semibold text-zinc-100 text-xs flex items-center gap-1.5">
                            <span>{displayContent}</span>
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 mt-0.5 flex items-center gap-2">
                            <span>{inst?.name || s.instrumentId}</span>
                            <span>•</span>
                            <span className="text-zinc-400">{s.strategyId}</span>
                          </div>
                        </td>

                        {/* 3. Formato */}
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

                        {/* 4. Carga (Pool) */}
                        <td className="py-3 text-center whitespace-nowrap">
                          <span className="text-zinc-300 font-bold">{item.poolSize} notas</span>
                          <span className="block text-[10px] text-purple-400">
                            {item.entropyBits} bits
                          </span>
                        </td>

                        {/* 5. Preguntas */}
                        <td className="py-3 text-center whitespace-nowrap">
                          <span className="text-emerald-400 font-bold">{s.correctAnswers}</span> /{' '}
                          {s.totalQuestions}
                        </td>

                        {/* 6. Duración */}
                        <td className="py-3 text-center text-zinc-400 whitespace-nowrap">
                          {formatDuration(s.durationSeconds || 0)}
                        </td>

                        {/* 7. Precisión Cruda */}
                        <td className="py-3 text-center text-zinc-200 font-bold whitespace-nowrap">
                          {s.accuracyPercentage}%
                        </td>

                        {/* 8. Oído Real IRT */}
                        <td className="py-3 text-center whitespace-nowrap">
                          <span
                            className={`font-bold ${
                              item.normalizedAccuracy >= 80
                                ? 'text-emerald-400'
                                : item.normalizedAccuracy >= 50
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                            }`}
                          >
                            {item.normalizedAccuracy}%
                          </span>
                        </td>

                        {/* 9. Reflejo Inmediato */}
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

                        {/* 10. Sesgo Direccional */}
                        <td className="py-3 text-center whitespace-nowrap">
                          {item.dominantBias === 'sharp' ? (
                            <span className="text-purple-400 text-[10px] font-bold">
                              ▲ +st Agudo
                            </span>
                          ) : item.dominantBias === 'flat' ? (
                            <span className="text-amber-400 text-[10px] font-bold">
                              ▼ -st Grave
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-[10px]">● Neutro</span>
                          )}
                        </td>

                        {/* 11. Cadencia / RPM */}
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
      )}

      {/* TAB 2: DIAGNÓSTICO IA CON HUD DE RAZONAMIENTO EN VIVO Y DESGLOSE PSICOPEDAGÓGICO */}
      {activeTab === 'ai_report' && (
        <Card className="space-y-4 bg-zinc-900/80 backdrop-blur-2xl border-purple-900/40 shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-purple-400 m-0 tracking-tight flex items-center gap-2">
                <span>✨ Diagnóstico Psicoacústico ({modeFilter.toUpperCase()})</span>
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-zinc-500 font-mono">
                  Modelo: {currentAiResponse?.modelName || 'Qwen 3.5 en GPU NVIDIA'}
                </span>
                {lastGeneratedAt && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/80 text-emerald-300">
                    ✅ Generado a las {lastGeneratedAt}
                  </span>
                )}
              </div>
            </div>

            <Button
              size="sm"
              variant="primary"
              disabled={isAiAnalyzing}
              onClick={handleRunDiagnostic}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-400/30 shrink-0"
            >
              {isAiAnalyzing ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>Razonando en GPU ({reasoningSeconds}s)...</span>
                </div>
              ) : (
                '🔄 Generar Diagnóstico & Comparativa'
              )}
            </Button>
          </div>

          {/* HUD VISUAL DE ESTADO EN TIEMPO REAL CUANDO EL MODELO ESTÁ PENSANDO EN LM STUDIO */}
          {isAiAnalyzing && (
            <div className="p-5 bg-purple-950/30 border border-purple-500/50 rounded-2xl space-y-3 font-mono animate-pulse">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <span className="w-4 h-4 rounded-full bg-purple-400 animate-ping absolute" />
                  <span className="w-3 h-3 rounded-full bg-purple-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-purple-200 m-0">
                    🧠 El modelo de IA Local está razonando en GPU NVIDIA ({reasoningSeconds}{' '}
                    segundos transcurridos)...
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Analizando patrones de fatiga, velocidad de reflejo, correlación de sesgo
                    direccional y calculando deltas de re-testeo.
                  </p>
                </div>
              </div>
              <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-sky-400 animate-pulse" />
              </div>
            </div>
          )}

          {/* BANNER DE EVOLUCIÓN LONGITUDINAL CON DESGLOSE MATEMÁTICO Y EXPLICACIÓN PSICOPEDAGÓGICA */}
          {metrics.longitudinalComparisons && metrics.longitudinalComparisons.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-sky-950/40 via-purple-950/40 to-zinc-900 rounded-2xl border border-sky-500/40 space-y-3 font-mono shadow-xl">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-sky-500/20">
                <span className="font-bold text-sky-300 flex items-center gap-2">
                  <span className="text-base">📈</span>
                  <span className="tracking-wider uppercase">
                    Evolución Longitudinal de Re-testeo (Test-Retest):
                  </span>
                </span>
                <span className="text-[10px] text-zinc-400">
                  {metrics.longitudinalComparisons.length} comparativa(s) activa(s)
                </span>
              </div>

              <div className="space-y-3">
                {metrics.longitudinalComparisons.map((c, i) => {
                  const interp = getPsychoacousticInterpretation(c)
                  const baselineDate = new Date(c.baselineSession.createdAt).toLocaleDateString(
                    'es-AR',
                    {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    }
                  )
                  const latestDate = new Date(c.latestSession.createdAt).toLocaleDateString(
                    'es-AR',
                    {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    }
                  )

                  return (
                    <div
                      key={i}
                      className="p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 space-y-3 text-xs"
                    >
                      {/* Cabecera del Contenido */}
                      <div className="flex justify-between items-center">
                        <strong className="text-zinc-100 font-sans text-sm">{c.contentName}</strong>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold font-mono ${interp.badgeColor}`}
                        >
                          {interp.badge}
                        </span>
                      </div>

                      {/* Cuadrícula Comparativa: Baseline vs Retest vs Delta */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 text-[11px] font-mono">
                        {/* 1. Baseline (Origen) */}
                        <div className="space-y-1 p-2 bg-zinc-950 rounded-lg border border-zinc-800/60">
                          <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold block">
                            1. Baseline (Primer Intento: {baselineDate})
                          </span>
                          <div className="text-zinc-300">
                            Precisión:{' '}
                            <strong className="text-white">
                              {c.baselineSession.accuracyPercentage}%
                            </strong>{' '}
                            ({c.baselineSession.correctAnswers}/{c.baselineSession.totalQuestions})
                          </div>
                          <div className="text-zinc-300">
                            Latencia:{' '}
                            <strong className="text-white">
                              {(c.baselineSession.avgResponseTimeMs / 1000).toFixed(2)}s
                            </strong>{' '}
                            ({c.baselineSession.avgResponseTimeMs}ms)
                          </div>
                        </div>

                        {/* 2. Retest (Último) */}
                        <div className="space-y-1 p-2 bg-zinc-950 rounded-lg border border-zinc-800/60">
                          <span className="text-[9px] uppercase tracking-wider text-sky-400 font-bold block">
                            2. Retest (Último Intento: {latestDate})
                          </span>
                          <div className="text-zinc-300">
                            Precisión:{' '}
                            <strong className="text-white">
                              {c.latestSession.accuracyPercentage}%
                            </strong>{' '}
                            ({c.latestSession.correctAnswers}/{c.latestSession.totalQuestions})
                          </div>
                          <div className="text-zinc-300">
                            Latencia:{' '}
                            <strong className="text-white">
                              {(c.latestSession.avgResponseTimeMs / 1000).toFixed(2)}s
                            </strong>{' '}
                            ({c.latestSession.avgResponseTimeMs}ms)
                          </div>
                        </div>

                        {/* 3. Deltas Matemáticos */}
                        <div className="space-y-1 p-2 bg-zinc-950 rounded-lg border border-zinc-800/60">
                          <span className="text-[9px] uppercase tracking-wider text-purple-400 font-bold block">
                            3. Cálculo de Deltas (Δ)
                          </span>
                          <div className="text-zinc-300">
                            Δ Precisión:{' '}
                            <strong
                              className={
                                c.rawAccuracyDelta >= 0
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-rose-400 font-bold'
                              }
                            >
                              {c.latestSession.accuracyPercentage}% -{' '}
                              {c.baselineSession.accuracyPercentage}% ={' '}
                              {c.rawAccuracyDelta >= 0
                                ? `+${c.rawAccuracyDelta}`
                                : c.rawAccuracyDelta}
                              %
                            </strong>
                          </div>
                          <div className="text-zinc-300">
                            Δ Latencia:{' '}
                            <strong
                              className={
                                c.responseTimeDeltaMs <= 0
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-amber-400 font-bold'
                              }
                            >
                              {c.latestSession.avgResponseTimeMs}ms -{' '}
                              {c.baselineSession.avgResponseTimeMs}ms ={' '}
                              {c.responseTimeDeltaMs > 0
                                ? `+${c.responseTimeDeltaMs}`
                                : c.responseTimeDeltaMs}
                              ms {c.responseTimeDeltaMs > 0 ? '(más lento)' : '(más rápido)'}
                            </strong>
                          </div>
                          <div className="text-zinc-400 text-[10px]">
                            Δ Cadencia: {c.rpmDelta >= 0 ? `+${c.rpmDelta}` : c.rpmDelta} RPM
                          </div>
                        </div>
                      </div>

                      {/* Interpretación Psicoacústica Detallada y Consejo */}
                      <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-1.5 font-sans">
                        <div className="text-xs text-zinc-200 leading-relaxed">
                          <strong className="text-sky-300 font-mono text-[11px] uppercase mr-1.5">
                            Diagnóstico Clínico:
                          </strong>
                          {interp.explanation}
                        </div>
                        <div className="text-xs text-emerald-300/90 font-medium">
                          💡 {interp.actionableTip}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* INFORME DE DIAGNÓSTICO EN LENGUAJE NATURAL EMITIDO POR LA IA */}
          {!isAiAnalyzing && (
            <div className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 text-xs text-zinc-300 leading-relaxed whitespace-pre-line font-sans shadow-inner">
              {currentAiResponse?.analysisText || 'Generando informe psicométrico...'}
            </div>
          )}

          {/* PRESCRIPCIÓN DE EJERCICIO ADAPTATIVO */}
          {!isAiAnalyzing && currentAiResponse?.prescription && (
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

      {/* TAB 3: HISTORIAL IA */}
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

      {/* TAB 4: GRÁFICOS */}
      {activeTab === 'charts' && (
        <AnalyticsCharts
          sessions={displayedAnalysisList.map((d) => d.session)}
          answers={answers}
          psychometrics={displayedAnalysisList.map((d) => ({
            sessionId: d.session.id,
            poolSize: d.poolSize,
            entropyBits: d.entropyBits,
            chanceBaseline: d.chanceBaseline,
            rawAccuracy: d.session.accuracyPercentage,
            normalizedAccuracy: d.normalizedAccuracy,
            durationSeconds: d.session.durationSeconds,
            responsesPerMinute: d.responsesPerMinute
          }))}
        />
      )}

      {/* TAB 5: MATRIZ DE CONFUSIÓN */}
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
    </div>
  )
}
