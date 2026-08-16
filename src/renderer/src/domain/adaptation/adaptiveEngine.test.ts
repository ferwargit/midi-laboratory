import { describe, it, expect } from 'vitest'
import {
  RandomSelectionStrategy,
  AdaptiveV1SelectionStrategy,
  createStrategy
} from './adaptiveEngine'
import { ExerciseResult } from '../exercise/types'

describe('adaptiveEngine - Estrategias de selección de ejercicios', () => {
  describe('RandomSelectionStrategy', () => {
    it('debe seleccionar una nota perteneciente al conjunto de notas activas', () => {
      const strategy = new RandomSelectionStrategy()
      const activeNotes = [60, 62, 64]
      const note = strategy.selectNextNote({
        activeNotes,
        history: [],
        lastPlayedNote: null
      })
      expect(activeNotes).toContain(note)
    })

    it('no debe repetir la misma nota inmediatamente si hay 3 o más notas', () => {
      const strategy = new RandomSelectionStrategy()
      const activeNotes = [60, 62, 64]
      // Si la última fue 60, debe elegir entre 62 o 64
      for (let i = 0; i < 20; i++) {
        const note = strategy.selectNextNote({
          activeNotes,
          history: [],
          lastPlayedNote: 60
        })
        expect(note).not.toBe(60)
      }
    })
  })

  describe('AdaptiveV1SelectionStrategy', () => {
    it('debe asignar mayor peso a una nota fallada recientemente', () => {
      const strategy = new AdaptiveV1SelectionStrategy()
      const activeNotes = [60, 64] // C4 y E4
      const history: ExerciseResult[] = [
        {
          expectedNote: 60,
          playedNote: 60,
          correct: true,
          semitoneDistance: 0,
          responseTimeMs: 1000
        },
        {
          expectedNote: 64,
          playedNote: 65,
          correct: false,
          semitoneDistance: 1,
          responseTimeMs: 1500
        }
      ]

      const performances = strategy.getNotePerformances(activeNotes, history)
      const c4Perf = performances.get(60)!
      const e4Perf = performances.get(64)!

      expect(c4Perf.accuracyPercentage).toBe(100)
      expect(e4Perf.accuracyPercentage).toBe(0)
      // E4 fallada debe tener significativamente más peso que C4 acertada
      expect(e4Perf.weight).toBeGreaterThan(c4Perf.weight)
    })

    it('debe reducir el peso de notas dominadas con alta precisión', () => {
      const strategy = new AdaptiveV1SelectionStrategy()
      const activeNotes = [60, 62]
      const history: ExerciseResult[] = [
        {
          expectedNote: 60,
          playedNote: 60,
          correct: true,
          semitoneDistance: 0,
          responseTimeMs: 800
        },
        {
          expectedNote: 60,
          playedNote: 60,
          correct: true,
          semitoneDistance: 0,
          responseTimeMs: 900
        },
        {
          expectedNote: 60,
          playedNote: 60,
          correct: true,
          semitoneDistance: 0,
          responseTimeMs: 700
        }
      ]

      const performances = strategy.getNotePerformances(activeNotes, history)
      const c4Perf = performances.get(60)!

      expect(c4Perf.accuracyPercentage).toBe(100)
      expect(c4Perf.weight).toBeLessThanOrEqual(0.5)
    })
  })

  describe('Factory createStrategy', () => {
    it('debe instanciar la estrategia correspondiente al id', () => {
      expect(createStrategy('random')).toBeInstanceOf(RandomSelectionStrategy)
      expect(createStrategy('adaptive_v1')).toBeInstanceOf(AdaptiveV1SelectionStrategy)
    })
  })

  describe('Simulación de convergencia adaptativa', () => {
    it('debe presentar con mayor frecuencia las notas con tasa de error alta en una simulación de 50 preguntas', () => {
      const strategy = new AdaptiveV1SelectionStrategy()
      const activeNotes = [60, 62, 64, 65, 67] // C, D, E, F, G (5 notas)
      const simulatedHistory: ExerciseResult[] = []

      // Simulamos que el usuario siempre falla G4 (67) y siempre acierta las demás
      for (let i = 0; i < 50; i++) {
        const selectedNote = strategy.selectNextNote({
          activeNotes,
          history: simulatedHistory,
          lastPlayedNote: null
        })

        const isWeakNote = selectedNote === 67
        simulatedHistory.push({
          expectedNote: selectedNote,
          playedNote: isWeakNote ? 65 : selectedNote, // falla G4 tocando F4
          correct: !isWeakNote,
          semitoneDistance: isWeakNote ? -2 : 0,
          responseTimeMs: 1200
        })
      }

      const g4Attempts = simulatedHistory.filter((h) => h.expectedNote === 67).length
      const c4Attempts = simulatedHistory.filter((h) => h.expectedNote === 60).length

      // En aleatorio puro, G4 saldría ~20% (10 veces). Con el motor adaptativo, debe salir mucho más que las notas dominadas.
      expect(g4Attempts).toBeGreaterThan(c4Attempts)
    })
  })
})
