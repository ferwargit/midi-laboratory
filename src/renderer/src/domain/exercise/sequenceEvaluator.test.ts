import { describe, it, expect } from 'vitest'
import { evaluateSequenceAnswer, calculateLevenshteinDistance } from './sequenceEvaluator'

describe('sequenceEvaluator - Evaluador de Secuencias en 3 Capas', () => {
  it('calculateLevenshteinDistance debe dar 0 para secuencias idénticas', () => {
    expect(calculateLevenshteinDistance([60, 62, 64], [60, 62, 64])).toBe(0)
  })

  it('calculateLevenshteinDistance debe dar 1 ante un error de una nota', () => {
    expect(calculateLevenshteinDistance([60, 62, 64], [60, 63, 64])).toBe(1)
  })

  it('debe evaluar coincidencia exacta al 100%', () => {
    const expected = [60, 64, 67, 72] // C4 E4 G4 C5
    const result = evaluateSequenceAnswer(expected, [60, 64, 67, 72], 2500)

    expect(result.isExactMatch).toBe(true)
    expect(result.exactMatchesCount).toBe(4)
    expect(result.isContourCorrect).toBe(true)
    expect(result.similarityScorePercentage).toBe(100)
  })

  it('debe reconocer acierto de contorno aunque haya notas transportadas', () => {
    const expected = [60, 64, 67] // C4 -> E4 -> G4 (up, up)
    const played = [62, 65, 69] // D4 -> F4 -> A4 (up, up)

    const result = evaluateSequenceAnswer(expected, played, 2000)

    expect(result.isExactMatch).toBe(false)
    expect(result.isContourCorrect).toBe(true)
    expect(result.feedbackMessage.toLowerCase()).toContain('contorno')
  })
})
