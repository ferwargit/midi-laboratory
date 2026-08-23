import { describe, it, expect } from 'vitest'
import { SpacedRepetitionStrategy } from './spacedRepetitionEngine'
import { ExerciseResult } from '../exercise/types'

describe('s4-spaced-repetition - Motor de Repetición Espaciada Leitner / SM-2', () => {
  it('weak items retried more frequently: un elemento fallado se asigna a Caja 1 con mayor peso y repetición cercana', () => {
    const strategy = new SpacedRepetitionStrategy()
    const activeNotes = [60, 64]

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
      }
    ]

    const performances = strategy.getNotePerformances(activeNotes, history)
    const c4Perf = performances.get(60)!
    const e4Perf = performances.get(64)!

    expect(c4Perf.weight).toBe(0.4)
    expect(e4Perf.weight).toBe(4.0)
    expect(e4Perf.weight).toBeGreaterThan(c4Perf.weight)
  })

  it('repeated wrong answer gets higher priority: fallos repetidos mantienen el elemento en Caja 1', () => {
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
    expect(decision.reason).toBeDefined()
  })

  it('graduated items spaced further apart: notas con aciertos consecutivos se espacian en Caja 3', () => {
    const strategy = new SpacedRepetitionStrategy()
    const activeNotes = [60, 62]

    const history: ExerciseResult[] = [
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 800 },
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 750 },
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 700 }
    ]

    const perfs = strategy.getNotePerformances(activeNotes, history)
    expect(perfs.get(60)!.weight).toBe(0.4)
  })

  it('debe ejecutar la ruleta ponderada cuando no hay elementos de Caja 1 vencidos inmediatamente', () => {
    const strategy = new SpacedRepetitionStrategy()
    const activeNotes = [60, 62, 64]

    // Historial donde todas las notas están en Caja 2 o 3 (sin vencimientos urgentes de Caja 1)
    const history: ExerciseResult[] = [
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 800 },
      { expectedNote: 62, playedNote: 62, correct: true, semitoneDistance: 0, responseTimeMs: 850 },
      { expectedNote: 64, playedNote: 64, correct: true, semitoneDistance: 0, responseTimeMs: 900 }
    ]

    const decision = strategy.selectNextNote({
      activeNotes,
      history,
      lastPlayedNote: 60
    })

    expect(activeNotes).toContain(decision.selectedNote)
    expect(decision.selectedNote).not.toBe(60) // Respeta anti-repetición
    expect(decision.reason).toContain('Caja')
  })

  it('debe manejar casos de borde: pool de 1 nota y lanzar error si está vacío', () => {
    const strategy = new SpacedRepetitionStrategy()

    // 1 sola nota
    const singleDecision = strategy.selectNextNote({
      activeNotes: [60],
      history: [],
      lastPlayedNote: null
    })
    expect(singleDecision.selectedNote).toBe(60)

    // Pool vacío
    expect(() =>
      strategy.selectNextNote({
        activeNotes: [],
        history: [],
        lastPlayedNote: null
      })
    ).toThrow(/no hay notas/i)
  })

  it('debe degradar inmediatamente a Caja 1 tras un fallo después de haber estado en Caja 3', () => {
    const strategy = new SpacedRepetitionStrategy()
    const activeNotes = [60, 62]

    // 3 aciertos (promoción a Caja 3) y luego un fallo (degradación a Caja 1)
    const history: ExerciseResult[] = [
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 800 },
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 800 },
      { expectedNote: 60, playedNote: 60, correct: true, semitoneDistance: 0, responseTimeMs: 800 },
      {
        expectedNote: 60,
        playedNote: 61,
        correct: false,
        semitoneDistance: 1,
        responseTimeMs: 1600
      }
    ]

    const perfs = strategy.getNotePerformances(activeNotes, history)
    const c4Perf = perfs.get(60)!

    expect(c4Perf.weight).toBe(4.0) // Caja 1
    expect(c4Perf.lastResultWasCorrect).toBe(false)
  })
})
