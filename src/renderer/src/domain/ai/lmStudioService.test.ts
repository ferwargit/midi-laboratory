import { describe, it, expect, vi } from 'vitest'
import { generateAlgorithmicFallback } from './fallbackGenerator'
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder'
import { AnalyticsMetrics, DetailedSessionAnalysis } from '../analytics/historyAnalytics'
import { LmStudioService } from './lmStudioService'
import { CircuitBreaker } from './circuitBreaker'

describe('ai - Servicios de IA, Prescripción, Tutor y Comparador Multi-Sesión', () => {
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
      inputMethod: 'hardware'
    }
  ]

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

  it('checkConnection y getLoadedModelId deben retornar null/false si la conexión falla o el circuit breaker está abierto', async () => {
    const breaker = new CircuitBreaker()
    vi.spyOn(breaker, 'canExecute').mockReturnValue(false)
    const service = new LmStudioService('http://127.0.0.1:9999', breaker)

    expect(await service.getLoadedModelId()).toBeNull()
    expect(await service.checkConnection()).toBe(false)
  })

  it('analyzeAndPrescribe debe activar fallback si no hay modelo cargado en el servidor', async () => {
    const service = new LmStudioService('http://127.0.0.1:9999')
    vi.spyOn(service, 'getLoadedModelId').mockResolvedValue(null)

    const result = await service.analyzeAndPrescribe(mockMetrics)
    expect(result.source).toBe('algorithmic_fallback')
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
  })

  it('askMultiSessionComparison debe retornar informe heurístico comparativo si el servidor está desconectado', async () => {
    const fastCircuitBreaker = new CircuitBreaker({
      failureThreshold: 2,
      cooldownPeriodMs: 1000,
      requestTimeoutMs: 100
    })
    const service = new LmStudioService('http://127.0.0.1:9999', fastCircuitBreaker)
    const comparison = await service.askMultiSessionComparison(mockSelectedAnalysis, mockMetrics)

    expect(comparison.modelName).toBe('Motor Heurístico Local')
    expect(comparison.content).toContain('Comparativa Cruzada Heurística (1 Sesiones)')
  })
})
