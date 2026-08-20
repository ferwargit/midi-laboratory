import { ExerciseResult } from '../exercise/types'
import {
  ExerciseSelectionStrategy,
  NotePerformance,
  SelectionContext,
  SelectionDecision,
  StrategyId
} from './types'
import { midiNoteToName } from '../music/noteUtils'

export interface LeitnerItemState {
  item: number
  box: 1 | 2 | 3 // 1 = Diario/Crítico, 2 = Medio, 3 = Dominado
  consecutiveCorrect: number
  lastAskedIndex: number // En qué índice de ejercicio se preguntó por última vez
  dueDistance: number // Cada cuántos ejercicios debe volver a preguntarse
}

export class SpacedRepetitionStrategy implements ExerciseSelectionStrategy {
  readonly id: StrategyId = 'spaced_repetition' as StrategyId
  readonly name = 'Repetición Espaciada (Leitner / SM-2)'
  readonly description =
    'Distribuye los ejercicios en cajas de memoria: refuerza fallos inmediatos y espacia notas dominadas.'

  selectNextNote(context: SelectionContext): SelectionDecision {
    const { activeNotes, history, lastPlayedNote } = context
    if (activeNotes.length === 0) throw new Error('No hay notas activas.')
    if (activeNotes.length === 1) {
      return {
        selectedNote: activeNotes[0],
        reason: 'Única nota disponible',
        weightsSnapshot: { [midiNoteToName(activeNotes[0])]: 1.0 }
      }
    }

    const currentExerciseIndex = history.length
    const itemStates = this.calculateLeitnerStates(activeNotes, history)

    // Filtrar candidatos para evitar repetición inmediata si el pool lo permite
    const candidates =
      activeNotes.length >= 3 && lastPlayedNote !== null
        ? activeNotes.filter((n) => n !== lastPlayedNote)
        : activeNotes

    // 1. Prioridad: Buscar elementos de Caja 1 cuyo intervalo de vencimiento ya expiró
    const urgentItems = candidates.filter((note) => {
      const state = itemStates.get(note)
      if (!state) return false
      const exercisesSinceLast = currentExerciseIndex - state.lastAskedIndex
      return state.box === 1 && exercisesSinceLast >= state.dueDistance
    })

    let selectedNote: number
    let reason = ''

    if (urgentItems.length > 0) {
      selectedNote = urgentItems[Math.floor(Math.random() * urgentItems.length)]
      reason = '🔁 Repetición Espaciada (Caja 1: Refuerzo de error vencido)'
    } else {
      // 2. Ruleta ponderada por urgencia de caja
      const weightsSnapshot: Record<string, number> = {}
      let totalWeight = 0

      for (const note of candidates) {
        const state = itemStates.get(note)!
        const weight = state.box === 1 ? 4.0 : state.box === 2 ? 1.5 : 0.4
        weightsSnapshot[midiNoteToName(note)] = weight
        totalWeight += weight
      }

      let threshold = Math.random() * totalWeight
      selectedNote = candidates[candidates.length - 1]

      for (const note of candidates) {
        const state = itemStates.get(note)!
        const weight = state.box === 1 ? 4.0 : state.box === 2 ? 1.5 : 0.4
        if (threshold <= weight) {
          selectedNote = note
          break
        }
        threshold -= weight
      }

      const finalState = itemStates.get(selectedNote)!
      reason =
        finalState.box === 1
          ? '🎯 Caja 1 (Prioridad alta por fallo reciente)'
          : finalState.box === 2
            ? '📈 Caja 2 (En consolidación intermedia)'
            : '🌟 Caja 3 (Verificación de retención a largo plazo)'
    }

    const weightsSnapshot: Record<string, number> = {}
    activeNotes.forEach((n) => {
      const state = itemStates.get(n)
      weightsSnapshot[midiNoteToName(n)] = state
        ? state.box === 1
          ? 4.0
          : state.box === 2
            ? 1.5
            : 0.4
        : 1.0
    })

    return {
      selectedNote,
      reason,
      weightsSnapshot
    }
  }

  getNotePerformances(
    activeNotes: number[],
    history: ExerciseResult[]
  ): Map<number, NotePerformance> {
    const states = this.calculateLeitnerStates(activeNotes, history)
    const result = new Map<number, NotePerformance>()

    for (const note of activeNotes) {
      const state = states.get(note)!
      const noteAnswers = history.filter((h) => h.expectedNote === note)
      const correct = noteAnswers.filter((h) => h.correct).length
      const attempts = noteAnswers.length
      const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0

      result.set(note, {
        noteNumber: note,
        attempts,
        correct,
        lastResultWasCorrect: attempts > 0 ? noteAnswers[attempts - 1].correct : null,
        accuracyPercentage: accuracy,
        weight: state.box === 1 ? 4.0 : state.box === 2 ? 1.5 : 0.4
      })
    }

    return result
  }

  private calculateLeitnerStates(
    activeNotes: number[],
    history: ExerciseResult[]
  ): Map<number, LeitnerItemState> {
    const states = new Map<number, LeitnerItemState>()

    for (const note of activeNotes) {
      states.set(note, {
        item: note,
        box: 1, // Todas arrancan en Caja 1
        consecutiveCorrect: 0,
        lastAskedIndex: -999,
        dueDistance: 1
      })
    }

    history.forEach((ans, index) => {
      const state = states.get(ans.expectedNote)
      if (!state) return

      state.lastAskedIndex = index

      if (ans.correct) {
        state.consecutiveCorrect += 1
        // Promoción de Caja según aciertos consecutivos
        if (state.consecutiveCorrect >= 3) {
          state.box = 3
          state.dueDistance = 8 // Caja 3: Se pregunta cada 8 ejercicios
        } else if (state.consecutiveCorrect >= 1) {
          state.box = 2
          state.dueDistance = 3 // Caja 2: Se pregunta cada 3 ejercicios
        }
      } else {
        // Degeneración inmediata a Caja 1 ante cualquier fallo
        state.consecutiveCorrect = 0
        state.box = 1
        state.dueDistance = 1 // Caja 1: Se pregunta en el siguiente turno
      }
    })

    return states
  }
}
