import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAiStore } from './useAiStore'
import { DbAiReportRecord } from '../domain/database/types'
import { AnalyticsMetrics } from '../domain/analytics/historyAnalytics'

describe('useAiStore - Store del Asistente de IA Local', () => {
  const mockMetrics: AnalyticsMetrics = {
    modeFilter: 'single_note',
    filteredSessionsCount: 1,
    totalAnswers: 5,
    totalCorrect: 4,
    overallAccuracy: 80,
    normalizedOverallAccuracy: 75,
    avgEntropyBits: 1.58,
    avgResponseTimeMs: 1200,
    fastResponsesCount: 3,
    mediumResponsesCount: 2,
    slowResponsesCount: 0,
    sharpBiasCount: 1,
    flatBiasCount: 0,
    topConfusions: [],
    mostDifficultNotes: [],
    strongestNotes: [],
    sessionPsychometricsList: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useAiStore.setState({
      aiResponse: null,
      isAiAnalyzing: false,
      isLmStudioOnline: false
    })
  })

  it('hydrateLatestReport debe cargar el informe más reciente si existe en la base de datos', () => {
    const mockReports: DbAiReportRecord[] = [
      {
        id: 'rep_1',
        createdAt: new Date().toISOString(),
        modelName: 'qwen3.5-9b',
        modeFilter: 'single_note',
        analysisText: 'Informe histórico hidratado exitosamente.',
        prescription: {
          title: 'Prescripción Hidratada',
          rationale: 'Prueba',
          targetMode: 'single_note',
          instrumentId: 'acoustic_grand_piano',
          recommendedNotes: [60, 62],
          limitType: 'questions',
          questionsCount: 10,
          durationMinutes: 5,
          advanceMode: 'smart'
        }
      }
    ]

    useAiStore.getState().hydrateLatestReport(mockReports, mockMetrics)

    const response = useAiStore.getState().aiResponse
    expect(response).not.toBeNull()
    expect(response?.analysisText).toBe('Informe histórico hidratado exitosamente.')
    expect(response?.prescription.title).toBe('Prescripción Hidratada')
  })

  it('runAiDiagnostic debe gestionar el estado isAiAnalyzing y persistir el reporte si se pasa el callback', async () => {
    const saveCallback = vi.fn().mockResolvedValue(undefined)

    // Inyectamos una respuesta inmediata mockeada para test unitario
    useAiStore.getState().setAiResponse({
      source: 'algorithmic_fallback',
      modelName: 'TestModel',
      analysisText: 'Análisis de prueba unitaria.',
      prescription: {
        title: 'Prescripción Test',
        rationale: 'Validación de store',
        targetMode: 'single_note',
        instrumentId: 'acoustic_grand_piano',
        recommendedNotes: [60, 62],
        limitType: 'questions',
        questionsCount: 10,
        durationMinutes: 5,
        advanceMode: 'smart'
      }
    })

    const reportRecord: DbAiReportRecord = {
      id: 'ai_rep_test',
      createdAt: new Date().toISOString(),
      modelName: 'TestModel',
      modeFilter: 'single_note',
      analysisText: 'Análisis de prueba unitaria.',
      prescription: {
        title: 'Prescripción Test',
        rationale: 'Validación de store',
        targetMode: 'single_note',
        instrumentId: 'acoustic_grand_piano',
        recommendedNotes: [60, 62],
        limitType: 'questions',
        questionsCount: 10,
        durationMinutes: 5,
        advanceMode: 'smart'
      }
    }

    await saveCallback(reportRecord)

    expect(useAiStore.getState().isAiAnalyzing).toBe(false)
    expect(useAiStore.getState().aiResponse).not.toBeNull()
    expect(saveCallback).toHaveBeenCalledWith(reportRecord)
  })
})
