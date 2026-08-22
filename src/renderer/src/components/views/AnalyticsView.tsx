import React, { useState, useEffect, useMemo } from 'react'
import { useDatabaseStore } from '../../stores/useDatabaseStore'
import { useAnalyticsStore } from '../../stores/useAnalyticsStore'
import { useAiStore } from '../../stores/useAiStore'
import {
  AnalyticsMasteryFilter,
  filterSessionsAdvanced,
  DetailedSessionAnalysis
} from '../../domain/analytics/historyAnalytics'
import { AnalyticsCharts } from '../trainer/AnalyticsCharts'
import { AiExercisePrescription } from '../../domain/ai/types'

// Subcomponentes modulares
import { SortColumnKey, SortDirection, AnalyticsTabKey } from './analytics/types'
import { AnalyticsKpiCards } from './analytics/AnalyticsKpiCards'
import { AnalyticsFilterBar } from './analytics/AnalyticsFilterBar'
import { AnalyticsTabNav } from './analytics/AnalyticsTabNav'
import { SessionsTableTab } from './analytics/SessionsTableTab'
import { AiDiagnosticTab } from './analytics/AiDiagnosticTab'
import { LongitudinalTab } from './analytics/LongitudinalTab'
import { AiHistoryTab } from './analytics/AiHistoryTab'
import { ConfusionMatrixTab } from './analytics/ConfusionMatrixTab'
import { AiConsultationTab } from './analytics/AiConsultationTab'

interface AnalyticsViewProps {
  onLoadPrescription: (prescription: AiExercisePrescription) => void
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

  const aiConsultations = useDatabaseStore((state) => state.aiConsultations)
  const saveAiConsultation = useDatabaseStore((state) => state.saveAiConsultation)

  const [activeTab, setActiveTab] = useState<AnalyticsTabKey>('sessions')

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

  return (
    <div className="space-y-4 font-sans">
      {/* 1. KPIs Psicométricos Superiores */}
      <AnalyticsKpiCards metrics={metrics} totalFilteredSessions={displayedAnalysisList.length} />

      {/* 2. Barra de Filtros Multidimensionales */}
      <AnalyticsFilterBar
        modeFilter={modeFilter}
        onSelectModeFilter={(m): void => setModeFilter(m, sessions, answers)}
        isLmStudioOnline={isLmStudioOnline}
        onCheckLmStudio={checkLmStudioStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedInstrument={selectedInstrument}
        onInstrumentChange={setSelectedInstrument}
        selectedFormat={selectedFormat}
        onFormatChange={setSelectedFormat}
        selectedMastery={selectedMastery}
        onMasteryChange={setSelectedMastery}
      />

      {/* 3. Navegación de 6 Pestañas Especializadas */}
      <AnalyticsTabNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        sessionsCount={displayedAnalysisList.length}
        longitudinalCount={metrics.longitudinalComparisons?.length || 0}
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
        />
      )}

      {activeTab === 'ai_report' && (
        <AiDiagnosticTab
          modeFilter={modeFilter}
          currentAiResponse={currentAiResponse}
          isAiAnalyzing={isAiAnalyzing}
          reasoningSeconds={reasoningSeconds}
          lastGeneratedAt={lastGeneratedAt}
          metrics={metrics}
          onRunDiagnostic={handleRunDiagnostic}
          onLoadPrescription={onLoadPrescription}
        />
      )}

      {activeTab === 'ai_consultation' && (
        <AiConsultationTab
          modeFilter={modeFilter}
          metrics={metrics}
          consultations={aiConsultations}
          onSaveConsultation={saveAiConsultation}
        />
      )}

      {activeTab === 'longitudinal' && (
        <LongitudinalTab
          comparisons={metrics.longitudinalComparisons || []}
          answers={answers}
          onLoadPrescription={onLoadPrescription}
        />
      )}

      {activeTab === 'confusions' && (
        <ConfusionMatrixTab modeFilter={modeFilter} metrics={metrics} />
      )}

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
