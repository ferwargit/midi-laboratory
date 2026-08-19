import { describe, it, expect } from 'vitest'
import { generateAlgorithmicFallback } from './fallbackGenerator'
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder'
import { AnalyticsMetrics } from '../analytics/historyAnalytics'
import { LmStudioService } from './lmStudioService'

describe('ai - Servicios de IA y Prescripción Pedagógica', () => {
  const mockMetrics: AnalyticsMetrics = {
    totalAnswers: 10,
    totalCorrect: 8,
    overallAccuracy: 80,
    avgResponseTimeMs: 1400,
    fastResponsesCount: 6,
    mediumResponsesCount: 3,
    slowResponsesCount: 1,
    sharpBiasCount: 1,
    flatBiasCount: 1,
    topConfusions: [{ expected: 'C#4', played: 'D4', count: 1 }],
    mostDifficultNotes: [{ noteName: 'C#4', accuracy: 50, attempts: 2 }],
    strongestNotes: [{ noteName: 'C4', accuracy: 100, attempts: 4 }]
  }

  it('buildSystemPrompt y buildUserPrompt deben generar prompts válidos', () => {
    const sys = buildSystemPrompt()
    const user = buildUserPrompt(mockMetrics)

    expect(sys).toContain('Profesor de Oído Musical')
    expect(user).toContain('"overallAccuracy": 80')
  })

  it('generateAlgorithmicFallback debe generar un análisis y prescripción válida sin conexión', () => {
    const response = generateAlgorithmicFallback(mockMetrics)

    expect(response.source).toBe('algorithmic_fallback')
    expect(response.prescription).toBeDefined()
    expect(response.prescription.targetMode).toBeDefined()
    expect(response.prescription.recommendedNotes.length).toBeGreaterThan(0)
  })

  it('LmStudioService debe retornar fallback rápidamente si el puerto no responde', async () => {
    const service = new LmStudioService('http://127.0.0.1:9999') // Puerto ficticio
    const result = await service.analyzeAndPrescribe(mockMetrics)
    expect(result.source).toBe('algorithmic_fallback')
    expect(result.prescription).toBeDefined()
  })
})
