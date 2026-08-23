import { describe, it, expect } from 'vitest'
import {
  isValidPrescription,
  validateAndParseAiResponse,
  extractBalancedJsonObject
} from './schemaValidator'
import { generateAlgorithmicFallback } from './fallbackGenerator'
import { AnalyticsMetrics } from '../analytics/historyAnalytics'

describe('s2-ai-schema-validation - Validación Estricta y Extracción Balanceada de JSON', () => {
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

  it('debe aislar el JSON válido e ignorar bloques de razonamiento <think> con llaves internas', () => {
    const thinkResponse = `
<think>
El alumno comete fallos. Objeto de prueba: { debug: "fail", notes: [60] }
Procedo a estructurar la respuesta en JSON.
</think>

\`\`\`json
${JSON.stringify(validPrescriptionJson)}
\`\`\`
Texto adicional post-JSON.
    `.trim()

    const result = validateAndParseAiResponse(thinkResponse, 'qwen3.5-deepseek')
    expect(result).not.toBeNull()
    expect(result?.prescription.title).toBe('Refuerzo de Semitonos')
    expect(result?.prescription.recommendedNotes).toEqual([60, 62, 64])
  })

  it('extractBalancedJsonObject maneja strings con llaves escapadas correctamente', () => {
    const text =
      'Prefacio { "analysisText": "Nota: {C4} es clave", "prescription": ' +
      JSON.stringify(validPrescriptionJson.prescription) +
      ' } Postfacio'
    const extracted = extractBalancedJsonObject(text)
    expect(extracted).not.toBeNull()
    expect(JSON.parse(extracted!).analysisText).toBe('Nota: {C4} es clave')
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

  it('generateAlgorithmicFallback debe generar prescripciones adaptadas según la modalidad y notas difíciles', () => {
    const intFallback = generateAlgorithmicFallback({ ...mockMetrics, modeFilter: 'intervals' })
    expect(intFallback.prescription.targetMode).toBe('intervals')
    expect(intFallback.prescription.recommendedIntervals).toEqual([2, 4, 5, 7])

    const seqFallback = generateAlgorithmicFallback({ ...mockMetrics, modeFilter: 'sequences' })
    expect(seqFallback.prescription.targetMode).toBe('sequences')
    expect(seqFallback.prescription.sequenceLength).toBe(3)
  })
})
