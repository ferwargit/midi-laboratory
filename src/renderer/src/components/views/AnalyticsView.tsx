import React, { useState, useEffect, useMemo } from 'react'
import { useDatabaseStore } from '../../stores/useDatabaseStore'
import { useAnalyticsStore } from '../../stores/useAnalyticsStore'
import { useAiStore } from '../../stores/useAiStore'
import {
  AnalyticsMasteryFilter,
  filterSessionsAdvanced,
  computeAnalyticsMetrics,
  DetailedSessionAnalysis
} from '../../domain/analytics/historyAnalytics'
import { LmStudioService } from '../../domain/ai/lmStudioService'
import { AnalyticsCharts } from '../trainer/AnalyticsCharts'
import { AiExercisePrescription } from '../../domain/ai/types'
import { DbAiConsultationRecord } from '../../domain/database/types'

// Subcomponentes modulares
import { SortColumnKey, SortDirection, AnalyticsTabKey } from './analytics/types'
import { AnalyticsKpiCards } from './analytics/AnalyticsKpiCards'
import { AnalyticsFilterBar } from './analytics/AnalyticsFilterBar'
import { AnalyticsTabNav } from './analytics/AnalyticsTabNav'
import { SessionsTableTab } from './analytics/SessionsTableTab'
import { AiDiagnosticTab } from './analytics/AiDiagnosticTab'
import { AiConsultationTab } from './analytics/AiConsultationTab'
import { LongitudinalTab } from './analytics/LongitudinalTab'
import { AiHistoryTab } from './analytics/AiHistoryTab'
import { ConfusionMatrixTab } from './analytics/ConfusionMatrixTab'

interface AnalyticsViewProps {
  onLoadPrescription: (prescription: AiExercisePrescription) => void
}

const aiService = new LmStudioService()

export function AnalyticsView({ onLoadPrescription }: AnalyticsViewProps): React.ReactElement {
  const sessions = useDatabaseStore((state) => state.sessions)
  const answers = useDatabaseStore((state) => state.answers)
  const aiReports = useDatabaseStore((state) => state.aiReports)
  const aiConsultations = useDatabaseStore((state) => state.aiConsultations)
  const saveAiReport = useDatabaseStore((state) => state.saveAiReport)
  const saveAiConsultation = useDatabaseStore((state) => state.saveAiConsultation)
  const deleteSession = useDatabaseStore((state) => state.deleteSession)
  const deleteSessions = useDatabaseStore((state) => state.deleteSessions)

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

  const [activeTab, setActiveTab] = useState<AnalyticsTabKey>('sessions')

  // Filtros Secundarios
  const [selectedInstrument, setSelectedInstrument] = useState<string>('all')
  const [selectedStrategy, setSelectedStrategy] = useState<string>('all')
  const [selectedPreset, setSelectedPreset] = useState<string>('all')
  const [selectedFormat, setSelectedFormat] = useState<string>('all')
  const [selectedMastery, setSelectedMastery] = useState<AnalyticsMasteryFilter>('all')
  const [selectedInputSource, setSelectedInputSource] = useState<'all' | 'hardware' | 'virtual'>(
    'all'
  )
  const [selectedBias, setSelectedBias] = useState<'all' | 'sharp' | 'flat' | 'balanced'>('all')
  const [selectedPoolSize, setSelectedPoolSize] = useState<string>('all')
  const [selectedIsi, setSelectedIsi] = useState<'all' | 'massed' | 'optimal' | 'spaced'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Estado de Aislamiento de Selección Manual
  const [isolatedSessionIds, setIsolatedSessionIds] = useState<Set<string> | null>(null)

  // Estado de Ordenamiento
  const [sortKey, setSortKey] = useState<SortColumnKey>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Temporizador de inferencia
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

  const handleResetAllFilters = (): void => {
    setSearchQuery('')
    setSelectedInstrument('all')
    setSelectedStrategy('all')
    setSelectedPreset('all')
    setSelectedFormat('all')
    setSelectedMastery('all')
    setSelectedInputSource('all')
    setSelectedBias('all')
    setSelectedPoolSize('all')
    setSelectedIsi('all')
    setIsolatedSessionIds(null)
  }

  const handleSortClick = (column: SortColumnKey): void => {
    if (sortKey === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(column)
      const defaultDescColumns: SortColumnKey[] = [
        'date',
        'cpi',
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

  // 1. Filtrado Reactivo de Sesiones
  const displayedAnalysisList: DetailedSessionAnalysis[] = useMemo(() => {
    const filteredRaw = filterSessionsAdvanced(sessions, {
      mode: modeFilter,
      instrumentId: selectedInstrument,
      strategyId: selectedStrategy,
      presetFilter: selectedPreset,
      format: selectedFormat,
      mastery: selectedMastery,
      poolSizeFilter: selectedPoolSize,
      searchQuery
    })
    const validIds = new Set(filteredRaw.map((s) => s.id))
    let list = (metrics.sessionPsychometricsList || []).filter((item) =>
      validIds.has(item.session.id)
    )

    if (selectedInputSource !== 'all') {
      list = list.filter((item) => item.inputMethod === selectedInputSource)
    }

    if (selectedBias !== 'all') {
      list = list.filter((item) => item.dominantBias === selectedBias)
    }

    if (selectedIsi !== 'all') {
      list = list.filter((item) => {
        const gap = item.interSessionGapMs
        if (gap === null) return selectedIsi === 'spaced'
        if (selectedIsi === 'massed') return gap < 900000
        if (selectedIsi === 'optimal') return gap >= 43200000 && gap <= 172800000
        if (selectedIsi === 'spaced') return gap > 172800000
        return true
      })
    }

    // Si está activo el modo aislamiento por casillas
    if (isolatedSessionIds && isolatedSessionIds.size > 0) {
      list = list.filter((item) => isolatedSessionIds.has(item.session.id))
    }

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
        case 'cpi':
          comparison = a.cpiScore - b.cpiScore
          break
        case 'format': {
          if (a.formatType === 'time' && b.formatType === 'time') {
            comparison = (a.session.durationSeconds || 0) - (b.session.durationSeconds || 0)
          } else if (a.formatType === 'questions' && b.formatType === 'questions') {
            comparison = (a.session.totalQuestions || 0) - (b.session.totalQuestions || 0)
          } else {
            const formatRank: Record<string, number> = {
              time: 1,
              mastery: 2,
              questions: 3,
              infinite: 4
            }
            comparison = (formatRank[a.formatType] || 0) - (formatRank[b.formatType] || 0)
          }
          break
        }
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
    selectedStrategy,
    selectedPreset,
    selectedFormat,
    selectedMastery,
    selectedInputSource,
    selectedBias,
    selectedPoolSize,
    selectedIsi,
    searchQuery,
    isolatedSessionIds,
    metrics,
    sortKey,
    sortDirection
  ])

  // 2. Filtrado Reactivo de Respuestas Específicas del Subconjunto
  const displayedSessionIds = useMemo(() => {
    return new Set(displayedAnalysisList.map((d) => d.session.id))
  }, [displayedAnalysisList])

  const displayedAnswers = useMemo(() => {
    return answers.filter((a) => displayedSessionIds.has(a.sessionId))
  }, [answers, displayedSessionIds])

  const displayedSessions = useMemo(() => {
    return displayedAnalysisList.map((d) => d.session)
  }, [displayedAnalysisList])

  // 3. Métricas Psicométricas Reactivas del Subconjunto Filtrado
  const displayedMetrics = useMemo(() => {
    return computeAnalyticsMetrics(displayedSessions, displayedAnswers, modeFilter)
  }, [displayedSessions, displayedAnswers, modeFilter])

  const currentAiResponse = aiResponsesByMode[modeFilter]

  const handleRunDiagnostic = async (): Promise<void> => {
    setReasoningSeconds(0)
    await runAiDiagnostic(displayedMetrics, saveAiReport)
    const nowStr = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    setLastGeneratedAt(nowStr)
  }

  const handleCompareSessionsWithAi = async (selectedIds: string[]): Promise<void> => {
    const selectedAnalysis = displayedAnalysisList.filter((d) => selectedIds.includes(d.session.id))
    if (selectedAnalysis.length < 2) return

    setActiveTab('ai_consultation')

    try {
      const res = await aiService.askMultiSessionComparison(selectedAnalysis, displayedMetrics)

      const namesSummary = selectedAnalysis.map((s) => s.session.presetName).join(' vs ')
      const consultationRecord: DbAiConsultationRecord = {
        id: `ai_compare_${Date.now()}`,
        createdAt: new Date().toISOString(),
        modelName: res.modelName,
        modeFilter,
        userQuery: `Comparativa Cruzada (${selectedAnalysis.length} sesiones): ${namesSummary}`,
        aiResponse: res.content,
        associatedMetricsSnapshot: {
          overallAccuracy: displayedMetrics.overallAccuracy,
          normalizedAccuracy: displayedMetrics.normalizedOverallAccuracy,
          avgLatencyMs: displayedMetrics.avgResponseTimeMs,
          poolEntropyBits: displayedMetrics.avgEntropyBits
        }
      }
      await saveAiConsultation(consultationRecord)
    } catch (err) {
      console.error('Error al ejecutar comparativa multi-sesión:', err)
    }
  }

  const filteredReports = aiReports.filter(
    (r) => modeFilter === 'all' || r.modeFilter === modeFilter
  )

  return (
    <div className="space-y-4 font-sans w-full">
      {/* BANNER DE MODO AISLADO ACTIVO */}
      {isolatedSessionIds && (
        <div className="p-3 bg-gradient-to-r from-sky-950 via-purple-950 to-zinc-950 border border-sky-400 rounded-2xl flex justify-between items-center font-mono text-xs shadow-2xl animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-sky-400 animate-ping" />
            <span className="text-zinc-100 font-bold">
              🔍 MODO AISLADO ACTIVO: Visualizando analítica exclusiva de {isolatedSessionIds.size}{' '}
              sesión(es) seleccionada(s).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsolatedSessionIds(null)}
            className="px-3 py-1 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-all cursor-pointer shadow-md"
          >
            ✕ Quitar Aislamiento (Ver Todas)
          </button>
        </div>
      )}

      {/* 1. KPIs Psicométricos Superiores Reactivos al Filtro Activo */}
      <AnalyticsKpiCards
        metrics={displayedMetrics}
        totalFilteredSessions={displayedAnalysisList.length}
      />

      {/* 2. Barra de Filtros */}
      <AnalyticsFilterBar
        modeFilter={modeFilter}
        onSelectModeFilter={(m): void => {
          setIsolatedSessionIds(null)
          setModeFilter(m, sessions, answers)
        }}
        isLmStudioOnline={isLmStudioOnline}
        onCheckLmStudio={checkLmStudioStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedInstrument={selectedInstrument}
        onInstrumentChange={setSelectedInstrument}
        selectedStrategy={selectedStrategy}
        onStrategyChange={setSelectedStrategy}
        selectedPreset={selectedPreset}
        onPresetChange={setSelectedPreset}
        selectedFormat={selectedFormat}
        onFormatChange={setSelectedFormat}
        selectedMastery={selectedMastery}
        onMasteryChange={setSelectedMastery}
        selectedInputSource={selectedInputSource}
        onInputSourceChange={setSelectedInputSource}
        selectedBias={selectedBias}
        onBiasChange={setSelectedBias}
        selectedPoolSize={selectedPoolSize}
        onPoolSizeChange={setSelectedPoolSize}
        selectedIsi={selectedIsi}
        onIsiChange={setSelectedIsi}
        onResetAllFilters={handleResetAllFilters}
      />

      {/* 3. Navegación de Pestañas */}
      <AnalyticsTabNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        sessionsCount={displayedAnalysisList.length}
        longitudinalCount={displayedMetrics.longitudinalComparisons?.length || 0}
        aiHistoryCount={filteredReports.length}
      />

      {/* 4. Contenido Modular de la Pestaña Activa */}
      {activeTab === 'sessions' && (
        <SessionsTableTab
          displayedList={displayedAnalysisList}
          answers={answers}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortClick={handleSortClick}
          onLoadPrescription={onLoadPrescription}
          onDeleteSession={deleteSession}
          onDeleteSessions={deleteSessions}
          onCompareSessionsWithAi={handleCompareSessionsWithAi}
          onIsolateSessions={(ids) => setIsolatedSessionIds(new Set(ids))}
          isIsolatedMode={isolatedSessionIds !== null}
          onClearIsolation={() => setIsolatedSessionIds(null)}
        />
      )}

      {activeTab === 'ai_report' && (
        <AiDiagnosticTab
          modeFilter={modeFilter}
          currentAiResponse={currentAiResponse}
          isAiAnalyzing={isAiAnalyzing}
          reasoningSeconds={reasoningSeconds}
          lastGeneratedAt={lastGeneratedAt}
          metrics={displayedMetrics}
          onRunDiagnostic={handleRunDiagnostic}
          onLoadPrescription={onLoadPrescription}
        />
      )}

      {activeTab === 'ai_consultation' && (
        <AiConsultationTab
          modeFilter={modeFilter}
          metrics={displayedMetrics}
          consultations={aiConsultations}
          aiReports={aiReports}
          onSaveConsultation={saveAiConsultation}
        />
      )}

      {activeTab === 'longitudinal' && (
        <LongitudinalTab
          comparisons={displayedMetrics.longitudinalComparisons || []}
          answers={answers}
          onLoadPrescription={onLoadPrescription}
        />
      )}

      {activeTab === 'confusions' && (
        <ConfusionMatrixTab
          modeFilter={modeFilter}
          metrics={displayedMetrics}
          answers={displayedAnswers}
          totalFilteredSessions={displayedAnalysisList.length}
        />
      )}

      {activeTab === 'charts' && (
        <AnalyticsCharts
          sessions={displayedSessions}
          answers={displayedAnswers}
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

      {activeTab === 'ai_history' && (
        <AiHistoryTab
          modeFilter={modeFilter}
          filteredReports={filteredReports}
          onLoadPrescription={onLoadPrescription}
        />
      )}
    </div>
  )
}
