import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAiStore } from './useAiStore'
import { DbAiReportRecord } from '../domain/database/types'
import { AnalyticsMetrics } from '../domain/analytics/historyAnalytics'

describe('useAiStore - Store del Asistente de IA Local Segregado por Modalidad', () => {
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
    useAiStore.getState().resetAiMemory()
  })

  it('hydrateReportsByMode debe cargar el informe correspondiente a cada modalidad de forma segregada', () => {
    const mockReports: DbAiReportRecord[] = [
      {
        id: 'rep_note',
        createdAt: new Date().toISOString(),
        modelName: 'qwen3.5-9b',
        modeFilter: 'single_note',
        analysisText: 'Diagnóstico exclusivo de Notas.',
        prescription: {
          title: 'Prescripción de Notas',
          rationale: 'Foco en semitonos',
          targetMode: 'single_note',
          instrumentId: 'acoustic_grand_piano',
          recommendedNotes: [60, 62],
          limitType: 'questions',
          questionsCount: 10,
          durationMinutes: 5,
          advanceMode: 'smart'
        }
      },
      {
        id: 'rep_int',
        createdAt: new Date().toISOString(),
        modelName: 'qwen3.5-9b',
        modeFilter: 'intervals',
        analysisText: 'Diagnóstico exclusivo de Intervalos.',
        prescription: {
          title: 'Prescripción de Intervalos',
          rationale: 'Foco en 3as',
          targetMode: 'intervals',
          instrumentId: 'acoustic_grand_piano',
          recommendedNotes: [60],
          recommendedIntervals: [3, 4],
          limitType: 'questions',
          questionsCount: 10,
          durationMinutes: 5,
          advanceMode: 'smart'
        }
      }
    ]

    useAiStore.getState().hydrateReportsByMode(mockReports, mockMetrics)

    const responses = useAiStore.getState().aiResponsesByMode

    expect(responses.single_note?.analysisText).toBe('Diagnóstico exclusivo de Notas.')
    expect(responses.intervals?.analysisText).toBe('Diagnóstico exclusivo de Intervalos.')
  })

  it('resetAiMemory debe purgar las respuestas cacheadas en memoria', () => {
    useAiStore.getState().setAiResponseForMode('single_note', {
      source: 'lm_studio_ai',
      modelName: 'Qwen',
      analysisText: 'Texto temporal',
      prescription: {
        title: 'T',
        rationale: 'R',
        targetMode: 'single_note',
        instrumentId: 'acoustic_grand_piano',
        recommendedNotes: [60, 62],
        limitType: 'questions',
        questionsCount: 10,
        durationMinutes: 5,
        advanceMode: 'smart'
      }
    })

    expect(useAiStore.getState().aiResponsesByMode.single_note).not.toBeNull()

    useAiStore.getState().resetAiMemory()
    expect(useAiStore.getState().aiResponsesByMode.single_note).toBeNull()
  })
})
