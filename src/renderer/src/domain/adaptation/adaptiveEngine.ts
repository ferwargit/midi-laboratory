import { ExerciseResult } from '../exercise/types'
import { midiNoteToName } from '../music/noteUtils'
import { SpacedRepetitionStrategy } from './spacedRepetitionEngine'
import {
  ExerciseSelectionStrategy,
  NotePerformance,
  SelectionContext,
  SelectionDecision,
  StrategyId,
  StrategyInfo
} from './types'

/**
 * Estrategia 1: Selección Aleatoria Uniforme (Clásica)
 */
export class RandomSelectionStrategy implements ExerciseSelectionStrategy {
  readonly id: StrategyId = 'random'
  readonly name = 'Aleatorio Clásico'
  readonly description = 'Todas las notas seleccionadas tienen exactamente la misma probabilidad.'

  selectNextNote(context: SelectionContext): SelectionDecision {
    const { activeNotes, lastPlayedNote } = context
    if (activeNotes.length === 0) throw new Error('No hay notas activas.')
    if (activeNotes.length === 1) {
      return {
        selectedNote: activeNotes[0],
        reason: 'Única nota disponible',
        weightsSnapshot: { [midiNoteToName(activeNotes[0])]: 1.0 }
      }
    }

    const candidates =
      activeNotes.length >= 3 && lastPlayedNote !== null
        ? activeNotes.filter((n) => n !== lastPlayedNote)
        : activeNotes

    const selected = candidates[Math.floor(Math.random() * candidates.length)]
    const weightsSnapshot: Record<string, number> = {}
    activeNotes.forEach((n) => {
      weightsSnapshot[midiNoteToName(n)] = 1.0
    })

    return {
      selectedNote: selected,
      reason: 'Selección uniforme aleatoria',
      weightsSnapshot
    }
  }

  getNotePerformances(
    activeNotes: number[],
    history: ExerciseResult[]
  ): Map<number, NotePerformance> {
    return calculateBasePerformances(activeNotes, history, () => 1.0)
  }
}

/**
 * Estrategia 2: Motor Adaptativo v1 (Ponderado por Memoria de Errores y Matriz de Confusión Real)
 */
export class AdaptiveV1SelectionStrategy implements ExerciseSelectionStrategy {
  readonly id: StrategyId = 'adaptive_v1'
  readonly name = 'Adaptativo Inteligente (v1)'
  readonly description =
    'Prioriza notas con fallos frecuentes, errores recientes y patrones recurrentes de confusión.'

  selectNextNote(context: SelectionContext): SelectionDecision {
    const { activeNotes, history, lastPlayedNote } = context
    if (activeNotes.length === 0) throw new Error('No hay notas activas.')
    if (activeNotes.length === 1) {
      return {
        selectedNote: activeNotes[0],
        reason: 'Única nota activa',
        weightsSnapshot: { [midiNoteToName(activeNotes[0])]: 1.0 }
      }
    }

    const performances = this.getNotePerformances(activeNotes, history)

    const candidates =
      activeNotes.length >= 3 && lastPlayedNote !== null
        ? activeNotes.filter((n) => n !== lastPlayedNote)
        : activeNotes

    const weightsSnapshot: Record<string, number> = {}
    activeNotes.forEach((note) => {
      const perf = performances.get(note)
      weightsSnapshot[midiNoteToName(note)] = perf ? Number(perf.weight.toFixed(1)) : 1.0
    })

    let totalWeight = 0
    for (const note of candidates) {
      const perf = performances.get(note)
      totalWeight += perf ? perf.weight : 1.0
    }

    let randomThreshold = Math.random() * totalWeight
    let chosenNote = candidates[candidates.length - 1]

    for (const note of candidates) {
      const perf = performances.get(note)
      const weight = perf ? perf.weight : 1.0
      if (randomThreshold <= weight) {
        chosenNote = note
        break
      }
      randomThreshold -= weight
    }

    const perf = performances.get(chosenNote)
    let reason = 'Exploración inicial'
    if (perf && perf.attempts > 0) {
      if (perf.lastResultWasCorrect === false) {
        reason = `🎯 Refuerzo inmediato de fallo reciente (Precisión: ${perf.accuracyPercentage}%)`
      } else if (perf.accuracyPercentage < 50) {
        reason = `⚠️ Nota con tasa de error alta (Precisión: ${perf.accuracyPercentage}%)`
      } else if (perf.accuracyPercentage >= 85 && perf.attempts >= 3) {
        reason = `🔁 Mantenimiento de nota dominada (${perf.accuracyPercentage}%)`
      } else {
        reason = `📈 Entrenamiento en progreso (${perf.accuracyPercentage}%)`
      }
    }

    return {
      selectedNote: chosenNote,
      reason,
      weightsSnapshot
    }
  }

  getNotePerformances(
    activeNotes: number[],
    history: ExerciseResult[]
  ): Map<number, NotePerformance> {
    return calculateBasePerformances(
      activeNotes,
      history,
      (perf, _recentMistakes, recurrentConfusions) => {
        let weight = 1.0

        if (perf.attempts > 0) {
          const errorRate = 1 - perf.accuracyPercentage / 100
          weight += errorRate * 2.5

          if (perf.lastResultWasCorrect === false) {
            weight += 2.0
          }

          if (perf.accuracyPercentage >= 85 && perf.attempts >= 3) {
            weight = 0.3
          }
        }

        // Matriz de confusión real: si la nota forma parte de un par recurrente (>= 2 veces),
        // recibe peso extra (+1.5) para que el motor presente ambas notas y resuelva la interferencia
        if (recurrentConfusions.has(perf.noteNumber)) {
          weight += 1.5
        }

        return Math.max(0.2, weight)
      }
    )
  }
}

function calculateBasePerformances(
  activeNotes: number[],
  history: ExerciseResult[],
  weightCalculator: (
    perf: NotePerformance,
    recentMistakes: Set<number>,
    recurrentConfusions: Set<number>
  ) => number
): Map<number, NotePerformance> {
  const result = new Map<number, NotePerformance>()
  const recentMistakes = new Set<number>()
  const pairCounts = new Map<string, number>()
  const recurrentConfusions = new Set<number>()

  for (const note of activeNotes) {
    result.set(note, {
      noteNumber: note,
      attempts: 0,
      correct: 0,
      lastResultWasCorrect: null,
      accuracyPercentage: 0,
      weight: 1.0
    })
  }

  for (const item of history) {
    if (!result.has(item.expectedNote)) continue

    const perf = result.get(item.expectedNote)!
    perf.attempts += 1
    if (item.correct) {
      perf.correct += 1
      perf.lastResultWasCorrect = true
    } else {
      perf.lastResultWasCorrect = false
      recentMistakes.add(item.expectedNote)

      // Registrar el par específico en la matriz de confusión
      const pairKey = `${item.expectedNote}_${item.playedNote}`
      const count = (pairCounts.get(pairKey) || 0) + 1
      pairCounts.set(pairKey, count)

      if (count >= 2) {
        recurrentConfusions.add(item.expectedNote)
        recurrentConfusions.add(item.playedNote)
      }
    }
    perf.accuracyPercentage = Math.round((perf.correct / perf.attempts) * 100)
  }

  for (const [, perf] of result) {
    perf.weight = weightCalculator(perf, recentMistakes, recurrentConfusions)
  }

  return result
}

export const AVAILABLE_STRATEGIES: StrategyInfo[] = [
  {
    id: 'adaptive_v1',
    name: 'Adaptativo Inteligente (v1)',
    description: 'Pondera por matriz de confusión y sesgos de semitono.'
  },
  {
    id: 'spaced_repetition' as StrategyId,
    name: 'Repetición Espaciada (Leitner / SM-2)',
    description: 'Organiza notas en cajas de memoria y espacia las dominadas.'
  },
  {
    id: 'random',
    name: 'Aleatorio Clásico',
    description: 'Todas las notas tienen exactamente la misma probabilidad.'
  }
]

export function createStrategy(id: StrategyId): ExerciseSelectionStrategy {
  switch (id) {
    case 'spaced_repetition' as StrategyId:
      return new SpacedRepetitionStrategy()
    case 'adaptive_v1':
      return new AdaptiveV1SelectionStrategy()
    case 'random':
      return new RandomSelectionStrategy()
    default:
      return new AdaptiveV1SelectionStrategy()
  }
}
