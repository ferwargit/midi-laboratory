import { create } from 'zustand'
import { LmStudioService } from '../domain/ai/lmStudioService'
import { AiAnalysisResponse } from '../domain/ai/types'
import { AnalyticsMetrics } from '../domain/analytics/historyAnalytics'
import { generateAlgorithmicFallback } from '../domain/ai/fallbackGenerator'
import { DbAiReportRecord } from '../domain/database/types'

interface AiState {
  aiResponse: AiAnalysisResponse | null
  isLmStudioOnline: boolean
  isAiAnalyzing: boolean
  checkLmStudioStatus: () => Promise<void>
  hydrateLatestReport: (reports: DbAiReportRecord[], metrics: AnalyticsMetrics) => void
  runAiDiagnostic: (
    metrics: AnalyticsMetrics,
    saveReportCallback?: (report: DbAiReportRecord) => Promise<void>
  ) => Promise<void>
  setAiResponse: (response: AiAnalysisResponse) => void
}

const aiService = new LmStudioService()

export const useAiStore = create<AiState>((set, get) => ({
  aiResponse: null,
  isLmStudioOnline: false,
  isAiAnalyzing: false,

  setAiResponse: (aiResponse: AiAnalysisResponse): void => set({ aiResponse }),

  hydrateLatestReport: (reports: DbAiReportRecord[], metrics: AnalyticsMetrics): void => {
    if (get().aiResponse !== null) return

    if (reports && reports.length > 0) {
      const latest = reports[0]
      set({
        aiResponse: {
          source: 'lm_studio_ai',
          modelName: latest.modelName,
          analysisText: latest.analysisText,
          prescription: latest.prescription
        }
      })
    } else {
      set({ aiResponse: generateAlgorithmicFallback(metrics) })
    }
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

    try {
      const response = await aiService.analyzeAndPrescribe(metrics)
      set({ aiResponse: response, isAiAnalyzing: false })

      if (saveReportCallback && response.prescription) {
        const reportRecord: DbAiReportRecord = {
          id: `ai_rep_${Date.now()}`,
          createdAt: new Date().toISOString(),
          modelName: response.modelName,
          modeFilter: metrics.modeFilter,
          analysisText: response.analysisText,
          prescription: response.prescription
        }
        await saveReportCallback(reportRecord)
      }
    } catch {
      const fallback = generateAlgorithmicFallback(metrics)
      set({ aiResponse: fallback, isAiAnalyzing: false })
    }
  }
}))
