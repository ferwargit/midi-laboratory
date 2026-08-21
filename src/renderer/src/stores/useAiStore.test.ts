import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAiStore } from './useAiStore'
import { DbAiReportRecord } from '../domain/database/types'
import { AnalyticsMetrics } from '../domain/analytics/historyAnalytics'
import { LmStudioService } from '../domain/ai/lmStudioService'

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
    vi.restoreAllMocks()
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

  it('runAiDiagnostic debe recurrir al fallback y actualizar el estado si el servicio falla o no conecta', async () => {
    const saveCallback = vi.fn().mockResolvedValue(undefined)

    // Mockeamos analyzeAndPrescribe para simular rechazo inmediato sin llamar a la GPU real
    vi.spyOn(LmStudioService.prototype, 'analyzeAndPrescribe').mockRejectedValueOnce(
      new Error('LM Studio no disponible en prueba unitaria')
    )
    vi.spyOn(LmStudioService.prototype, 'checkConnection').mockResolvedValueOnce(false)

    await useAiStore.getState().runAiDiagnostic(mockMetrics, saveCallback)

    const state = useAiStore.getState()
    expect(state.isAiAnalyzing).toBe(false)
    expect(state.aiResponsesByMode.single_note).not.toBeNull()
    expect(state.aiResponsesByMode.single_note?.source).toBe('algorithmic_fallback')
  })

  it('runAiDiagnostic debe persistir el reporte si el servicio de IA responde exitosamente', async () => {
    const saveCallback = vi.fn().mockResolvedValue(undefined)

    vi.spyOn(LmStudioService.prototype, 'checkConnection').mockResolvedValueOnce(true)
    vi.spyOn(LmStudioService.prototype, 'analyzeAndPrescribe').mockResolvedValueOnce({
      source: 'lm_studio_ai',
      modelName: 'qwen3.5-mock',
      analysisText: 'Diagnóstico IA mockeado exitoso.',
      prescription: {
        title: 'Prescripción Mock',
        rationale: 'Razón',
        targetMode: 'single_note',
        instrumentId: 'acoustic_grand_piano',
        recommendedNotes: [60, 62],
        limitType: 'questions',
        questionsCount: 10,
        durationMinutes: 5,
        advanceMode: 'smart'
      }
    })

    await useAiStore.getState().runAiDiagnostic(mockMetrics, saveCallback)

    const state = useAiStore.getState()
    expect(state.isAiAnalyzing).toBe(false)
    expect(state.aiResponsesByMode.single_note?.modelName).toBe('qwen3.5-mock')
    expect(saveCallback).toHaveBeenCalledTimes(1)
  })
})
