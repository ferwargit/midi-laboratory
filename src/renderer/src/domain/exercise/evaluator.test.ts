import { describe, it, expect } from 'vitest'
import { evaluateSingleNoteAnswer, calculateSessionStats } from './evaluator'
import { ExerciseResult } from './types'
import { DEFAULT_EVALUATION_POLICY } from './evalPolicy'

describe('evaluator - Motor de evaluación de ejercicios con política musical', () => {
  describe('evaluateSingleNoteAnswer', () => {
    it('debe marcar como correcto cuando las notas coinciden y distancia 0', () => {
      const result = evaluateSingleNoteAnswer(60, 60, 1200)
      expect(result.correct).toBe(true)
      expect(result.semitoneDistance).toBe(0)
      expect(result.responseTimeMs).toBe(1200)
    })

    it('debe calcular correctamente la distancia positiva en semitonos (tocó más agudo)', () => {
      const result = evaluateSingleNoteAnswer(60, 62, 850) // C4 esperado, D4 tocado
      expect(result.correct).toBe(false)
      expect(result.semitoneDistance).toBe(2)
    })

    it('debe calcular correctamente la distancia negativa en semitonos (tocó más grave)', () => {
      const result = evaluateSingleNoteAnswer(60, 59, 900) // C4 esperado, B3 tocado
      expect(result.correct).toBe(false)
      expect(result.semitoneDistance).toBe(-1)
    })

    it('debe respetar una política flexible de octava si se especifica', () => {
      const flexiblePolicy = { ...DEFAULT_EVALUATION_POLICY, strictOctave: false }
      const result = evaluateSingleNoteAnswer(60, 72, 1000, flexiblePolicy) // C4 esperado, C5 tocado
      expect(result.correct).toBe(true)
    })

    it('debe sanitizar latencias anormales o negativas según la política', () => {
      const result = evaluateSingleNoteAnswer(60, 60, -200)
      expect(result.responseTimeMs).toBe(DEFAULT_EVALUATION_POLICY.clampResponseTime.minMs)
    })
  })

  describe('calculateSessionStats', () => {
    it('debe devolver estadísticas en 0 si no hay historial', () => {
      const stats = calculateSessionStats([])
      expect(stats.totalAnswers).toBe(0)
      expect(stats.accuracyPercentage).toBe(0)
      expect(stats.avgResponseTimeMs).toBe(0)
    })

    it('debe calcular correctamente precisión y tiempo medio', () => {
      const mockHistory: ExerciseResult[] = [
        {
          expectedNote: 60,
          playedNote: 60,
          correct: true,
          semitoneDistance: 0,
          responseTimeMs: 1000
        },
        {
          expectedNote: 62,
          playedNote: 64,
          correct: false,
          semitoneDistance: 2,
          responseTimeMs: 2000
        }
      ]

      const stats = calculateSessionStats(mockHistory)
      expect(stats.totalAnswers).toBe(2)
      expect(stats.correctAnswers).toBe(1)
      expect(stats.accuracyPercentage).toBe(50)
      expect(stats.avgResponseTimeMs).toBe(1500)
    })
  })
})
