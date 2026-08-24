import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LmStudioService } from './lmStudioService'
import { AnalyticsMetrics, DetailedSessionAnalysis } from '../analytics/historyAnalytics'
import { DbAiConsultationRecord, DbAiReportRecord } from '../database/types'

describe('lmStudioService - Pruebas de Integración con Mocks (Inferencia, IPC y Multi-Turn)', () => {
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
    sessionPsychometricsList: [],
    longitudinalComparisons: []
  }

  const mockPastConsultation: DbAiConsultationRecord = {
    id: 'consult_1',
    createdAt: new Date('2026-08-21T10:00:00Z').toISOString(),
    modelName: 'qwen3.5-9b',
    modeFilter: 'single_note',
    userQuery: '¿Por qué me cuesta F4?',
    aiResponse: 'F4 tiene armónicos cercanos a E4 en el piano acústico...'
  }

  const mockPastReport: DbAiReportRecord = {
    id: 'rep_1',
    createdAt: new Date('2026-08-21T09:00:00Z').toISOString(),
    modelName: 'qwen3.5-9b',
    modeFilter: 'single_note',
    analysisText: 'Reporte previo',
    prescription: {
      title: 'Consolidación F4/E4',
      rationale: 'Foco en semitonos',
      targetMode: 'single_note',
      instrumentId: 'acoustic_grand_piano',
      recommendedNotes: [64, 65],
      limitType: 'mastery',
      questionsCount: 10,
      durationMinutes: 5,
      advanceMode: 'smart'
    }
  }

  const mockSelectedAnalysis: DetailedSessionAnalysis[] = [
    {
      session: {
        id: 's_comp_1',
        createdAt: new Date('2026-08-21T10:00:00Z').toISOString(),
        strategyId: 'adaptive_v1',
        instrumentId: 'acoustic_grand_piano',
        presetName: 'Nivel 1 (C, D, E)',
        totalQuestions: 10,
        correctAnswers: 8,
        accuracyPercentage: 80,
        avgResponseTimeMs: 1200,
        durationSeconds: 60
      },
      poolSize: 3,
      entropyBits: 1.58,
      chanceBaseline: 33,
      normalizedAccuracy: 70,
      responsesPerMinute: 10,
      fastPercent: 60,
      mediumPercent: 30,
      slowPercent: 10,
      sharpBiasCount: 1,
      flatBiasCount: 0,
      dominantBias: 'sharp',
      formatType: 'time',
      inputMethod: 'hardware',
      interSessionGapMs: null,
      interSessionGapLabel: 'Inicio',
      cpiScore: 650
    }
  ]

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

  it('askCustomConsultation debe transmitir la secuencia Multi-Turn con historial conversacional vía fetch', async () => {
    const fakeModelsResponse = { data: [{ id: 'qwen3.5-mock' }] }
    const fakeChatResponse = {
      model: 'qwen3.5-mock',
      choices: [
        {
          message: {
            content: 'Respuesta del tutor recordando el diálogo previo sobre F4.'
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
    const result = await service.askCustomConsultation(
      '¿Y cómo lo practico en el Roland FP-8?',
      mockMetrics,
      'irt_normalized_accuracy',
      [mockPastConsultation],
      [mockPastReport]
    )

    expect(result.modelName).toBe('qwen3.5-mock')
    expect(result.content).toBe('Respuesta del tutor recordando el diálogo previo sobre F4.')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('askCustomConsultation debe comunicarse vía Electron IPC customAPI si está disponible', async () => {
    window.customAPI = {
      checkLmStudioModels: vi.fn().mockResolvedValue('qwen-ipc-model'),
      chatLmStudio: vi.fn().mockResolvedValue({
        success: true,
        model: 'qwen-ipc-model',
        content: 'Respuesta del tutor vía IPC.'
      })
    }

    const service = new LmStudioService()
    const result = await service.askCustomConsultation('Consulta IPC', mockMetrics)

    expect(result.modelName).toBe('qwen-ipc-model')
    expect(result.content).toBe('Respuesta del tutor vía IPC.')

    delete (window as unknown as { customAPI?: unknown }).customAPI
  })

  it('askMultiSessionComparison debe transmitir la telemetría cruzada de las sesiones seleccionadas vía IPC', async () => {
    window.customAPI = {
      checkLmStudioModels: vi.fn().mockResolvedValue('qwen-ipc-model'),
      chatLmStudio: vi.fn().mockResolvedValue({
        success: true,
        model: 'qwen-ipc-model',
        content: 'Informe comparativo cruzado generado exitosamente por IPC.'
      })
    }

    const service = new LmStudioService()
    const result = await service.askMultiSessionComparison(mockSelectedAnalysis, mockMetrics)

    expect(result.modelName).toBe('qwen-ipc-model')
    expect(result.content).toBe('Informe comparativo cruzado generado exitosamente por IPC.')

    delete (window as unknown as { customAPI?: unknown }).customAPI
  })

  it('debe comunicarse exitosamente vía Electron IPC customAPI en analyzeAndPrescribe', async () => {
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

    delete (window as unknown as { customAPI?: unknown }).customAPI
  })

  it('askCustomConsultation debe comunicarse vía Electron IPC customAPI transmitiendo la baseUrl configurada', async () => {
    const checkModelsSpy = vi.fn().mockResolvedValue('qwen-ipc-model')
    const chatLmStudioSpy = vi.fn().mockResolvedValue({
      success: true,
      model: 'qwen-ipc-model',
      content: 'Respuesta del tutor vía IPC.'
    })

    window.customAPI = {
      checkLmStudioModels: checkModelsSpy,
      chatLmStudio: chatLmStudioSpy
    }

    const service = new LmStudioService('http://127.0.0.1:1234')
    const result = await service.askCustomConsultation('Consulta IPC', mockMetrics)

    expect(result.modelName).toBe('qwen-ipc-model')
    expect(result.content).toBe('Respuesta del tutor vía IPC.')
    expect(checkModelsSpy).toHaveBeenCalledWith('http://127.0.0.1:1234')
    expect(chatLmStudioSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'http://127.0.0.1:1234'
      })
    )

    delete (window as unknown as { customAPI?: unknown }).customAPI
  })
})
