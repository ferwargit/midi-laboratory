import { describe, it, expect } from 'vitest'
import { isValidPrescription, validateAndParseAiResponse } from './schemaValidator'
import { generateAlgorithmicFallback } from './fallbackGenerator'
import { AnalyticsMetrics } from '../analytics/historyAnalytics'

describe('s2-ai-schema-validation - Validación Estricta de Salida del LLM', () => {
  const validPrescriptionJson = {
    analysisText: 'Excelente progreso en discriminación auditiva.',
    prescription: {
      title: 'Refuerzo de Semitonos',
      rationale: 'Focalizado en notas críticas.',
      targetMode: 'single_note',
      instrumentId: 'acoustic_grand_piano',
      recommendedNotes: [60, 62, 64],
      recommendedIntervals: [1, 2],
      sequenceLength: 3,
      limitType: 'questions',
      questionsCount: 10,
      durationMinutes: 5,
      advanceMode: 'smart'
    }
  }

  const mockMetrics: AnalyticsMetrics = {
    modeFilter: 'single_note',
    filteredSessionsCount: 1,
    totalAnswers: 10,
    totalCorrect: 8,
    overallAccuracy: 80,
    normalizedOverallAccuracy: 75,
    avgEntropyBits: 1.58,
    avgResponseTimeMs: 1200,
    fastResponsesCount: 6,
    mediumResponsesCount: 3,
    slowResponsesCount: 1,
    sharpBiasCount: 1,
    flatBiasCount: 1,
    topConfusions: [],
    mostDifficultNotes: [],
    strongestNotes: [],
    sessionPsychometricsList: [],
    longitudinalComparisons: []
  }

  it('valid payload accepted: debe aceptar y parsear un payload 100% válido', () => {
    const raw = JSON.stringify(validPrescriptionJson)
    const result = validateAndParseAiResponse(raw, 'qwen3.5')

    expect(result).not.toBeNull()
    expect(result?.source).toBe('lm_studio_ai')
    expect(result?.prescription.recommendedNotes).toEqual([60, 62, 64])
  })

  it('malformed JSON rejected: debe rechazar cadenas que no sean JSON válido', () => {
    const malformed = 'Esto no es un JSON { incompleto...'
    const result = validateAndParseAiResponse(malformed, 'qwen3.5')

    expect(result).toBeNull()
  })

  it('missing prescription rejected: debe rechazar objetos que no tengan el bloque de prescripción o campos requeridos', () => {
    const missingPrescription = JSON.stringify({ analysisText: 'Solo texto' })
    expect(validateAndParseAiResponse(missingPrescription, 'qwen3.5')).toBeNull()

    const invalidNotes = JSON.stringify({
      analysisText: 'Texto',
      prescription: {
        ...validPrescriptionJson.prescription,
        recommendedNotes: [-10, 500]
      }
    })
    expect(validateAndParseAiResponse(invalidNotes, 'qwen3.5')).toBeNull()

    const invalidMode = JSON.stringify({
      analysisText: 'Texto',
      prescription: {
        ...validPrescriptionJson.prescription,
        targetMode: 'chords_mode_inexistente'
      }
    })
    expect(validateAndParseAiResponse(invalidMode, 'qwen3.5')).toBeNull()
  })

  it('fallback used on invalid schema: cuando el esquema es inválido, el sistema recurre al fallback algorítmico', () => {
    const invalidPayload = 'corrupted data'
    const parsed = validateAndParseAiResponse(invalidPayload, 'qwen3.5')

    const finalResponse = parsed || generateAlgorithmicFallback(mockMetrics)

    expect(finalResponse.source).toBe('algorithmic_fallback')
    expect(isValidPrescription(finalResponse.prescription)).toBe(true)
  })
})
