import { create } from 'zustand'
import { DatabaseEngine } from '../domain/database/databaseEngine'
import {
  DatabaseSummary,
  DbAnswerRecord,
  DbSessionRecord,
  DbAiReportRecord
} from '../domain/database/types'
import {
  AnalyticsMetrics,
  AnalyticsModeFilter,
  computeAnalyticsMetrics
} from '../domain/analytics/historyAnalytics'
import { LmStudioService } from '../domain/ai/lmStudioService'
import { AiAnalysisResponse } from '../domain/ai/types'
import { generateAlgorithmicFallback } from '../domain/ai/fallbackGenerator'

interface DatabaseState {
  engine: DatabaseEngine | null
  summary: DatabaseSummary
  sessions: DbSessionRecord[]
  answers: DbAnswerRecord[]
  aiReports: DbAiReportRecord[]
  modeFilter: AnalyticsModeFilter
  setModeFilter: (filter: AnalyticsModeFilter) => void
  metrics: AnalyticsMetrics
  aiResponse: AiAnalysisResponse | null
  isLmStudioOnline: boolean
  isAiAnalyzing: boolean
  isInitialized: boolean
  initialize: () => Promise<void>
  saveSession: (session: DbSessionRecord, answers: DbAnswerRecord[]) => Promise<void>
  clearDatabase: () => Promise<void>
  reloadAllData: () => Promise<void>
  runAiDiagnostic: () => Promise<void>
  checkLmStudioStatus: () => Promise<void>
}

const emptyMetrics: AnalyticsMetrics = {
  modeFilter: 'all',
  totalAnswers: 0,
  totalCorrect: 0,
  overallAccuracy: 0,
  avgResponseTimeMs: 0,
  fastResponsesCount: 0,
  mediumResponsesCount: 0,
  slowResponsesCount: 0,
  sharpBiasCount: 0,
  flatBiasCount: 0,
  topConfusions: [],
  mostDifficultNotes: [],
  strongestNotes: []
}

const aiService = new LmStudioService()

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  engine: null,
  summary: {
    totalSessions: 0,
    totalExercises: 0,
    overallAccuracy: 0,
    overallAvgTimeMs: 0
  },
  sessions: [],
  answers: [],
  aiReports: [],
  modeFilter: 'all',
  metrics: emptyMetrics,
  aiResponse: null,
  isLmStudioOnline: false,
  isAiAnalyzing: false,
  isInitialized: false,

  setModeFilter: (modeFilter: AnalyticsModeFilter): void => {
    const { sessions, answers } = get()
    const metrics = computeAnalyticsMetrics(sessions, answers, modeFilter)
    const fallback = generateAlgorithmicFallback(metrics)
    set({ modeFilter, metrics, aiResponse: fallback })
  },

  initialize: async (): Promise<void> => {
    if (get().isInitialized) return

    const engine = new DatabaseEngine()
    try {
      await engine.initialize()
      set({ engine, isInitialized: true })
      await get().reloadAllData()
      await get().checkLmStudioStatus()
    } catch (err) {
      console.error('Error al inicializar IndexedDB en Zustand:', err)
    }
  },

  checkLmStudioStatus: async (): Promise<void> => {
    const isOnline = await aiService.checkConnection()
    set({ isLmStudioOnline: isOnline })
  },

  reloadAllData: async (): Promise<void> => {
    const { engine, modeFilter } = get()
    if (!engine) return

    const summary = await engine.getSummary()
    const sessions = await engine.getAllSessions()
    const answers = await engine.getAllAnswers()
    const aiReports = await engine.getAllAiReports()
    const metrics = computeAnalyticsMetrics(sessions, answers, modeFilter)
    const fallback = generateAlgorithmicFallback(metrics)

    set({ summary, sessions, answers, aiReports, metrics, aiResponse: fallback })
  },

  runAiDiagnostic: async (): Promise<void> => {
    const { metrics, engine, modeFilter } = get()
    set({ isAiAnalyzing: true })
    await get().checkLmStudioStatus()

    try {
      const response = await aiService.analyzeAndPrescribe(metrics)
      set({ aiResponse: response, isAiAnalyzing: false })

      // Guardar informe en la base de datos persistente
      if (engine && response.prescription) {
        const reportRecord: DbAiReportRecord = {
          id: `ai_rep_${Date.now()}`,
          createdAt: new Date().toISOString(),
          modelName: response.modelName,
          modeFilter,
          analysisText: response.analysisText,
          prescription: response.prescription
        }
        await engine.saveAiReport(reportRecord)
        const updatedReports = await engine.getAllAiReports()
        set({ aiReports: updatedReports })
      }
    } catch {
      set({ aiResponse: generateAlgorithmicFallback(metrics), isAiAnalyzing: false })
    }
  },

  saveSession: async (session: DbSessionRecord, answers: DbAnswerRecord[]): Promise<void> => {
    const { engine, reloadAllData } = get()
    if (!engine) return
    await engine.saveSession(session, answers)
    await reloadAllData()
  },

  clearDatabase: async (): Promise<void> => {
    const { engine } = get()
    if (!engine) return
    await engine.clearDatabase()
    set({
      summary: {
        totalSessions: 0,
        totalExercises: 0,
        overallAccuracy: 0,
        overallAvgTimeMs: 0
      },
      sessions: [],
      answers: [],
      aiReports: [],
      metrics: emptyMetrics,
      aiResponse: generateAlgorithmicFallback(emptyMetrics)
    })
  }
}))
