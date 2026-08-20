import { describe, it, expect } from 'vitest'
import { SpacedRepetitionStrategy } from './spacedRepetitionEngine'
import { ExerciseResult } from '../exercise/types'

describe('s4-spaced-repetition - Motor de Repetición Espaciada Leitner / SM-2', () => {
  it('weak items retried more frequently: un elemento fallado se asigna a Caja 1 con mayor peso y repetición cercana', () => {
    const strategy = new SpacedRepetitionStrategy()
    const activeNotes = [60, 64] // C4 (60) y E4 (64)

    const history: ExerciseResult[] = [
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 900 },
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 850 },
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 800 },
      {
        expectedNote: 64,
        playedNote: 65,
        correct: false,
        semitoneDistance: 1,
        responseTimeMs: 1600
      } // E4 fallado
    ]

    const performances = strategy.getNotePerformances(activeNotes, history)
    const c4Perf = performances.get(60)!
    const e4Perf = performances.get(64)!

    // C4 con 3 aciertos debe estar en Caja 3 (peso bajo 0.4)
    expect(c4Perf.weight).toBe(0.4)

    // E4 con fallo reciente debe estar en Caja 1 (peso alto 4.0)
    expect(e4Perf.weight).toBe(4.0)
    expect(e4Perf.weight).toBeGreaterThan(c4Perf.weight)
  })

  it('repeated wrong answer gets higher priority: fallos repetidos mantienen el elemento en Caja 1 con prioridad urgente', () => {
    const strategy = new SpacedRepetitionStrategy()
    const activeNotes = [60, 62, 64]

    const history: ExerciseResult[] = [
      {
        expectedNote: 62,
        playedNote: 63,
        correct: false,
        semitoneDistance: 1,
        responseTimeMs: 2000
      },
      {
        expectedNote: 62,
        playedNote: 63,
        correct: false,
        semitoneDistance: 1,
        responseTimeMs: 1900
      }
    ]

    const decision = strategy.selectNextNote({
      activeNotes,
      history,
      lastPlayedNote: 60
    })

    expect(decision.weightsSnapshot['D4']).toBe(4.0)
    expect(decision.reason).toContain('Caja 1')
  })

  it('graduated items spaced further apart: notas con aciertos consecutivos se espacian con menor peso', () => {
    const strategy = new SpacedRepetitionStrategy()
    const activeNotes = [60, 62]

    const history: ExerciseResult[] = [
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 800 },
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 750 },
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 700 }
    ]

    const perfs = strategy.getNotePerformances(activeNotes, history)
    expect(perfs.get(60)!.weight).toBe(0.4) // Graduado a Caja 3
  })
})
