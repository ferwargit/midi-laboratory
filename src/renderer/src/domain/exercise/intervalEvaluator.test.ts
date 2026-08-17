import { describe, it, expect } from 'vitest'
import { evaluateIntervalAnswer, IntervalExerciseStimulus } from './intervalEvaluator'

describe('intervalEvaluator - Evaluador de Respuestas de Intervalos', () => {
  const stimulus3M: IntervalExerciseStimulus = {
    rootNote: 60, // C4
    targetNote: 64, // E4
    semitones: 4,
    direction: 'ascending'
  }

  it('debe marcar coincidencia exacta cuando toca C4 -> E4', () => {
    const result = evaluateIntervalAnswer(stimulus3M, [60, 64], 1400)

    expect(result.isExactMatch).toBe(true)
    expect(result.isIntervalCorrect).toBe(true)
    expect(result.isRootCorrect).toBe(true)
    expect(result.isTransposedCorrect).toBe(false)
    expect(result.semitoneDistanceError).toBe(0)
  })

  it('debe reconocer transporte (oído correcto, error motor) al tocar D4 -> F#4', () => {
    // Tocó 4 semitonos pero arrancando en 62 (D4)
    const result = evaluateIntervalAnswer(stimulus3M, [62, 66], 1200)

    expect(result.isIntervalCorrect).toBe(true)
    expect(result.isRootCorrect).toBe(false)
    expect(result.isExactMatch).toBe(false)
    expect(result.isTransposedCorrect).toBe(true)
    expect(result.feedbackMessage).toContain('transportada')
  })

  it('debe calcular error de semitono al confundir 3M (4 st) con 3m (3 st)', () => {
    // Tocó C4 (60) -> D#4 (63)
    const result = evaluateIntervalAnswer(stimulus3M, [60, 63], 1500)

    expect(result.isIntervalCorrect).toBe(false)
    expect(result.isExactMatch).toBe(false)
    expect(result.semitoneDistanceError).toBe(-1)
    expect(result.feedbackMessage).toContain('Tercera Menor')
  })
})
