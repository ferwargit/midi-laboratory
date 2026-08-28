import { create } from 'zustand'
import { LmStudioService } from '../domain/ai/lmStudioService'
import { AiAnalysisResponse } from '../domain/ai/types'
import { AnalyticsMetrics, AnalyticsModeFilter } from '../domain/analytics/historyAnalytics'
import { generateAlgorithmicFallback } from '../domain/ai/fallbackGenerator'
import { DbAiReportRecord } from '../domain/database/types'

interface AiState {
  aiResponsesByMode: Record<AnalyticsModeFilter, AiAnalysisResponse | null>
  isLmStudioOnline: boolean
  isAiAnalyzing: boolean
  checkLmStudioStatus: () => Promise<void>
  hydrateReportsByMode: (reports: DbAiReportRecord[], metrics: AnalyticsMetrics) => void
  runAiDiagnostic: (
    metrics: AnalyticsMetrics,
    saveReportCallback?: (report: DbAiReportRecord) => Promise<void>
  ) => Promise<void>
  setAiResponseForMode: (mode: AnalyticsModeFilter, response: AiAnalysisResponse) => void
  resetAiMemory: () => void
}

const aiService = new LmStudioService()

const initialResponses: Record<AnalyticsModeFilter, AiAnalysisResponse | null> = {
  all: null,
  single_note: null,
  intervals: null,
  sequences: null,
  repertoire: null
}

export const useAiStore = create<AiState>((set, get) => ({
  aiResponsesByMode: initialResponses,
  isLmStudioOnline: false,
  isAiAnalyzing: false,

  setAiResponseForMode: (mode: AnalyticsModeFilter, response: AiAnalysisResponse): void => {
    set((state) => ({
      aiResponsesByMode: {
        ...state.aiResponsesByMode,
        [mode]: response
      }
    }))
  },

  resetAiMemory: (): void => {
    set({ aiResponsesByMode: initialResponses, isAiAnalyzing: false })
  },

  hydrateReportsByMode: (reports: DbAiReportRecord[], metrics: AnalyticsMetrics): void => {
    const currentMap: Record<AnalyticsModeFilter, AiAnalysisResponse | null> = {
      all: null,
      single_note: null,
      intervals: null,
      sequences: null,
      repertoire: null
    }
    const modes: AnalyticsModeFilter[] = [
      'all',
      'single_note',
      'intervals',
      'sequences',
      'repertoire'
    ]

    modes.forEach((mode) => {
      const match = reports.find((r) => r.modeFilter === mode)
      if (match) {
        currentMap[mode] = {
          source: 'lm_studio_ai',
          modelName: match.modelName,
          analysisText: match.analysisText,
          prescription: match.prescription
        }
      } else {
        const modeMetrics = { ...metrics, modeFilter: mode }
        currentMap[mode] = generateAlgorithmicFallback(modeMetrics)
      }
    })

    set({ aiResponsesByMode: currentMap })
  },

  checkLmStudioStatus: async (): Promise<void> => {
    const isOnline = await aiService.checkConnection()
    set({ isLmStudioOnline: isOnline })
  },

  runAiDiagnostic: async (
    metrics: AnalyticsMetrics,
    saveReportCallback?: (report: DbAiReportRecord) => Promise<void>
  ): Promise<void> => {
    set({ isAiAnalyzing: true })
    await get().checkLmStudioStatus()

    const currentMode = metrics.modeFilter

    try {
      const response = await aiService.analyzeAndPrescribe(metrics)
      get().setAiResponseForMode(currentMode, response)
      set({ isAiAnalyzing: false })

      if (saveReportCallback && response.prescription) {
        const reportRecord: DbAiReportRecord = {
          id: `ai_rep_${Date.now()}`,
          createdAt: new Date().toISOString(),
          modelName: response.modelName,
          modeFilter: currentMode,
          analysisText: response.analysisText,
          prescription: response.prescription
        }
        await saveReportCallback(reportRecord)
      }
    } catch {
      const fallback = generateAlgorithmicFallback(metrics)
      get().setAiResponseForMode(currentMode, fallback)
      set({ isAiAnalyzing: false })
    }
  }
}))
