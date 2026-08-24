import { describe, it, expect } from 'vitest'
import {
  RandomSelectionStrategy,
  AdaptiveV1SelectionStrategy,
  createStrategy,
  AVAILABLE_STRATEGIES
} from './adaptiveEngine'
import { SpacedRepetitionStrategy } from './spacedRepetitionEngine'
import { ExerciseResult } from '../exercise/types'
import { StrategyId } from './types'

describe('adaptiveEngine - Estrategias de selección de ejercicios', () => {
  describe('RandomSelectionStrategy', () => {
    it('debe seleccionar una nota perteneciente al conjunto de notas activas con motivo explicable', () => {
      const strategy = new RandomSelectionStrategy()
      const activeNotes = [60, 62, 64]
      const decision = strategy.selectNextNote({
        activeNotes,
        history: [],
        lastPlayedNote: null
      })
      expect(activeNotes).toContain(decision.selectedNote)
      expect(decision.reason).toBeDefined()
    })

    it('no debe repetir la misma nota inmediatamente si hay 3 o más notas', () => {
      const strategy = new RandomSelectionStrategy()
      const activeNotes = [60, 62, 64]
      for (let i = 0; i < 20; i++) {
        const decision = strategy.selectNextNote({
          activeNotes,
          history: [],
          lastPlayedNote: 60
        })
        expect(decision.selectedNote).not.toBe(60)
      }
    })
  })

  describe('AdaptiveV1SelectionStrategy', () => {
    it('debe asignar mayor peso a una nota fallada recientemente y explicar el motivo', () => {
      const strategy = new AdaptiveV1SelectionStrategy()
      const activeNotes = [60, 64]
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
      expect(e4Perf.weight).toBeGreaterThan(c4Perf.weight)
    })

    it('debe generar telemetría con snapshot de pesos por nota', () => {
      const strategy = new AdaptiveV1SelectionStrategy()
      const activeNotes = [60, 62]
      const decision = strategy.selectNextNote({
        activeNotes,
        history: [],
        lastPlayedNote: null
      })

      expect(decision.weightsSnapshot).toBeDefined()
      expect(decision.weightsSnapshot['C4']).toBe(1.0)
      expect(decision.weightsSnapshot['D4']).toBe(1.0)
    })

    it('la matriz de confusión real otorga peso extra solo ante repetición del par específico (>= 2 veces)', () => {
      const strategy = new AdaptiveV1SelectionStrategy()
      const activeNotes = [60, 62, 64]

      // Solo 1 error aislado entre 60 y 62 (accidente motor o resbalón)
      const singleErrorHistory: ExerciseResult[] = [
        {
          expectedNote: 60,
          playedNote: 62,
          correct: false,
          semitoneDistance: 2,
          responseTimeMs: 1200
        },
        {
          expectedNote: 60,
          playedNote: 60,
          correct: true,
          semitoneDistance: 0,
          responseTimeMs: 1000
        }
      ]

      const perfSingle = strategy.getNotePerformances(activeNotes, singleErrorHistory)
      // 62 no debe recibir el boost de confusión recurrente porque solo ocurrió 1 vez
      expect(perfSingle.get(62)!.weight).toBe(1.0)

      // 2 errores en el mismo par específico 60 -> 62 (patrón real de confusión)
      const recurringErrorHistory: ExerciseResult[] = [
        {
          expectedNote: 60,
          playedNote: 62,
          correct: false,
          semitoneDistance: 2,
          responseTimeMs: 1200
        },
        {
          expectedNote: 60,
          playedNote: 62,
          correct: false,
          semitoneDistance: 2,
          responseTimeMs: 1300
        }
      ]

      const perfRecurring = strategy.getNotePerformances(activeNotes, recurringErrorHistory)
      // Ahora 62 sí recibe el peso extra (+1.5) por confusión recurrente
      expect(perfRecurring.get(62)!.weight).toBeGreaterThanOrEqual(2.5)
    })
  })

  describe('Simulación de convergencia adaptativa', () => {
    it('debe presentar con mayor frecuencia las notas con tasa de error alta', () => {
      const strategy = new AdaptiveV1SelectionStrategy()
      const activeNotes = [60, 62, 64, 65, 67]
      const simulatedHistory: ExerciseResult[] = []

      for (let i = 0; i < 50; i++) {
        const decision = strategy.selectNextNote({
          activeNotes,
          history: simulatedHistory,
          lastPlayedNote: null
        })

        const isWeakNote = decision.selectedNote === 67
        simulatedHistory.push({
          expectedNote: decision.selectedNote,
          playedNote: isWeakNote ? 65 : decision.selectedNote,
          correct: !isWeakNote,
          semitoneDistance: isWeakNote ? -2 : 0,
          responseTimeMs: 1200
        })
      }

      const g4Attempts = simulatedHistory.filter((h) => h.expectedNote === 67).length
      const c4Attempts = simulatedHistory.filter((h) => h.expectedNote === 60).length

      expect(g4Attempts).toBeGreaterThan(c4Attempts)
    })
  })

  describe('Factory createStrategy y Registro de Estrategias', () => {
    it('debe instanciar las 3 estrategias correctamente según su ID', () => {
      expect(createStrategy('random')).toBeInstanceOf(RandomSelectionStrategy)
      expect(createStrategy('adaptive_v1')).toBeInstanceOf(AdaptiveV1SelectionStrategy)
      expect(createStrategy('spaced_repetition' as StrategyId)).toBeInstanceOf(
        SpacedRepetitionStrategy
      )
    })

    it('AVAILABLE_STRATEGIES debe contener las 3 opciones seleccionables', () => {
      const ids = AVAILABLE_STRATEGIES.map((s) => s.id)
      expect(ids).toContain('adaptive_v1')
      expect(ids).toContain('spaced_repetition')
      expect(ids).toContain('random')
    })
  })
})
