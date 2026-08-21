import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LmStudioService } from './lmStudioService'
import { AnalyticsMetrics } from '../analytics/historyAnalytics'

describe('lmStudioService - Pruebas de Integración con Mocks', () => {
  const mockMetrics: AnalyticsMetrics = {
    modeFilter: 'single_note',
    filteredSessionsCount: 2,
    totalAnswers: 10,
    totalCorrect: 8,
    overallAccuracy: 80,
    normalizedOverallAccuracy: 75,
    avgEntropyBits: 2.32,
    avgResponseTimeMs: 1400,
    fastResponsesCount: 6,
    mediumResponsesCount: 3,
    slowResponsesCount: 1,
    sharpBiasCount: 1,
    flatBiasCount: 1,
    topConfusions: [{ expected: 'C#4', played: 'D4', count: 1 }],
    mostDifficultNotes: [{ noteName: 'C#4', accuracy: 50, attempts: 2 }],
    strongestNotes: [{ noteName: 'C4', accuracy: 100, attempts: 4 }],
    sessionPsychometricsList: []
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('debe comunicarse exitosamente vía fetch HTTP y parsear la respuesta del modelo', async () => {
    const fakeModelsResponse = { data: [{ id: 'qwen3.5-mock' }] }
    const fakeChatResponse = {
      model: 'qwen3.5-mock',
      choices: [
        {
          message: {
            content: JSON.stringify({
              analysisText: 'Diagnóstico generado vía mock.',
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
          }
        }
      ]
    }

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => fakeModelsResponse
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => fakeChatResponse
      } as Response)

    const service = new LmStudioService('http://127.0.0.1:1234')
    const result = await service.analyzeAndPrescribe(mockMetrics)

    expect(result.source).toBe('lm_studio_ai')
    expect(result.modelName).toBe('qwen3.5-mock')
    expect(result.analysisText).toBe('Diagnóstico generado vía mock.')
    expect(result.prescription.title).toBe('Prescripción Mock')
  })

  it('debe comunicarse exitosamente vía Electron IPC customAPI si está disponible', async () => {
    // @ts-ignore -- Mock temporal de window.customAPI en entorno jsdom para prueba unitaria
    window.customAPI = {
      checkLmStudioModels: vi.fn().mockResolvedValue('qwen-ipc-model'),
      chatLmStudio: vi.fn().mockResolvedValue({
        success: true,
        model: 'qwen-ipc-model',
        content: JSON.stringify({
          analysisText: 'Diagnóstico IPC mock.',
          prescription: {
            title: 'Prescripción IPC',
            rationale: 'Razón IPC',
            targetMode: 'intervals',
            instrumentId: 'violin',
            recommendedNotes: [60],
            recommendedIntervals: [3, 4],
            limitType: 'questions',
            questionsCount: 10,
            durationMinutes: 5,
            advanceMode: 'smart'
          }
        })
      })
    }

    const service = new LmStudioService()
    const result = await service.analyzeAndPrescribe(mockMetrics)

    expect(result.source).toBe('lm_studio_ai')
    expect(result.modelName).toBe('qwen-ipc-model')
    expect(result.analysisText).toBe('Diagnóstico IPC mock.')
    expect(result.prescription.targetMode).toBe('intervals')

    // @ts-ignore -- Limpieza del mock de customAPI
    delete window.customAPI
  })
})
