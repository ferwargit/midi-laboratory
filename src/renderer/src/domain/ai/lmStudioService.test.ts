import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateAlgorithmicFallback } from './fallbackGenerator'
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder'
import { AnalyticsMetrics } from '../analytics/historyAnalytics'
import { LmStudioService } from './lmStudioService'
import { CircuitBreaker } from './circuitBreaker'
import { DbAiConsultationRecord, DbAiReportRecord } from '../database/types'

describe('ai - Servicios de IA, Prescripción y Tutor Psicoacústico', () => {
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

  it('buildSystemPrompt y buildUserPrompt generan prompts válidos con el catálogo formal', () => {
    const sys = buildSystemPrompt('single_note')
    const user = buildUserPrompt(mockMetrics)

    expect(sys).toContain('Profesor de Oído Musical')
    expect(sys).toContain('CATÁLOGO FORMAL DE PARÁMETROS DISPONIBLES')
    expect(sys).toContain('recommendedNotes')
    expect(user).toContain('Precisión Cruda Global: 80%')
    expect(user).toContain('Entropía Media del Contexto')
  })

  it('generateAlgorithmicFallback genera un análisis y prescripción válida sin conexión', () => {
    const response = generateAlgorithmicFallback(mockMetrics)

    expect(response.source).toBe('algorithmic_fallback')
    expect(response.prescription).toBeDefined()
    expect(response.prescription.targetMode).toBeDefined()
    expect(response.prescription.recommendedNotes.length).toBeGreaterThan(0)
  })

  it('LmStudioService retorna fallback rápidamente si el puerto no responde sin bloquear la práctica', async () => {
    const fastCircuitBreaker = new CircuitBreaker({
      failureThreshold: 2,
      cooldownPeriodMs: 1000,
      requestTimeoutMs: 100
    })
    const service = new LmStudioService('http://127.0.0.1:9999', fastCircuitBreaker)
    const result = await service.analyzeAndPrescribe(mockMetrics)

    expect(result.source).toBe('algorithmic_fallback')
    expect(result.prescription).toBeDefined()
  })

  it('askCustomConsultation debe retornar respuesta heurística si el servidor está desconectado', async () => {
    const fastCircuitBreaker = new CircuitBreaker({
      failureThreshold: 2,
      cooldownPeriodMs: 1000,
      requestTimeoutMs: 100
    })
    const service = new LmStudioService('http://127.0.0.1:9999', fastCircuitBreaker)
    const consultation = await service.askCustomConsultation(
      '¿Por qué tengo fatiga auditiva?',
      mockMetrics
    )

    expect(consultation.modelName).toBe('Motor Heurístico Local')
    expect(consultation.content).toContain('Tutor Local')
    expect(consultation.content).toContain('fatiga auditiva')
  })
})

describe('lmStudioService - Pruebas de Integración con Mocks (Inferencia y Multi-Turn)', () => {
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

  it('askCustomConsultation debe transmitir la secuencia Multi-Turn con historial conversacional', async () => {
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

    // @ts-ignore -- Limpieza de window.customAPI tras completar la prueba unitaria
    delete window.customAPI
  })
})
