import { describe, it, expect } from 'vitest'
import { isValidPrescription, validateAndParseAiResponse } from './schemaValidator'
import { generateAlgorithmicFallback } from './fallbackGenerator'
import { AnalyticsMetrics } from '../analytics/historyAnalytics'

describe('s2-ai-schema-validation - Validación Estricta de Salida del LLM y Generación de Fallback', () => {
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

  it('malformed JSON rejected: debe rechazar cadenas que no sean JSON válido o entradas no string', () => {
    expect(validateAndParseAiResponse('Esto no es un JSON { incompleto...', 'qwen3.5')).toBeNull()
    expect(validateAndParseAiResponse(null as unknown as string, 'qwen3.5')).toBeNull()
    expect(validateAndParseAiResponse(12345 as unknown as string, 'qwen3.5')).toBeNull()
  })

  it('isValidPrescription debe rechazar objetos nulos, no objetos y campos requeridos inválidos', () => {
    expect(isValidPrescription(null)).toBe(false)
    expect(isValidPrescription('no es un objeto')).toBe(false)
    expect(isValidPrescription({ ...validPrescriptionJson.prescription, title: '' })).toBe(false)
    expect(isValidPrescription({ ...validPrescriptionJson.prescription, rationale: '' })).toBe(
      false
    )
    expect(
      isValidPrescription({
        ...validPrescriptionJson.prescription,
        instrumentId: 'invalido' as unknown as 'flute'
      })
    ).toBe(false)
    expect(
      isValidPrescription({
        ...validPrescriptionJson.prescription,
        limitType: 'invalido' as unknown as 'time'
      })
    ).toBe(false)
    expect(
      isValidPrescription({
        ...validPrescriptionJson.prescription,
        advanceMode: 'invalido' as unknown as 'smart'
      })
    ).toBe(false)
    expect(
      isValidPrescription({ ...validPrescriptionJson.prescription, recommendedNotes: [] })
    ).toBe(false)
    expect(
      isValidPrescription({
        ...validPrescriptionJson.prescription,
        recommendedNotes: 'no-array' as unknown as number[]
      })
    ).toBe(false)
    expect(isValidPrescription({ ...validPrescriptionJson.prescription, questionsCount: -1 })).toBe(
      false
    )
    expect(isValidPrescription({ ...validPrescriptionJson.prescription, durationMinutes: 0 })).toBe(
      false
    )
  })

  it('missing prescription rejected: debe rechazar objetos que no tengan el bloque de prescripción', () => {
    const missingPrescription = JSON.stringify({ analysisText: 'Solo texto' })
    expect(validateAndParseAiResponse(missingPrescription, 'qwen3.5')).toBeNull()

    const emptyText = JSON.stringify({
      analysisText: '   ',
      prescription: validPrescriptionJson.prescription
    })
    expect(validateAndParseAiResponse(emptyText, 'qwen3.5')).toBeNull()
  })

  it('generateAlgorithmicFallback debe generar prescripciones adaptadas según la modalidad y notas difíciles', () => {
    // 1. Fallback para intervalos
    const intFallback = generateAlgorithmicFallback({ ...mockMetrics, modeFilter: 'intervals' })
    expect(intFallback.prescription.targetMode).toBe('intervals')
    expect(intFallback.prescription.recommendedIntervals).toEqual([2, 4, 5, 7])

    // 2. Fallback para secuencias
    const seqFallback = generateAlgorithmicFallback({ ...mockMetrics, modeFilter: 'sequences' })
    expect(seqFallback.prescription.targetMode).toBe('sequences')
    expect(seqFallback.prescription.sequenceLength).toBe(3)

    // 3. Fallback para notas individuales con notas difíciles acumuladas
    const diffFallback = generateAlgorithmicFallback({
      ...mockMetrics,
      modeFilter: 'single_note',
      mostDifficultNotes: [
        { noteName: 'C#4', accuracy: 40, attempts: 5 },
        { noteName: 'D4', accuracy: 45, attempts: 6 }
      ]
    })
    expect(diffFallback.prescription.targetMode).toBe('single_note')
    expect(diffFallback.prescription.recommendedNotes.length).toBeGreaterThanOrEqual(2)
  })
})
