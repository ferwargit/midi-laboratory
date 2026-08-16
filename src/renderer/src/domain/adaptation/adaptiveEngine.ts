import { ExerciseResult } from '../exercise/types'
import {
  ExerciseSelectionStrategy,
  NotePerformance,
  SelectionContext,
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

  selectNextNote(context: SelectionContext): number {
    const { activeNotes, lastPlayedNote } = context
    if (activeNotes.length === 0) throw new Error('No hay notas activas.')
    if (activeNotes.length === 1) return activeNotes[0]

    // Anti-repetición inmediata si hay 3 o más notas
    const candidates =
      activeNotes.length >= 3 && lastPlayedNote !== null
        ? activeNotes.filter((n) => n !== lastPlayedNote)
        : activeNotes

    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  getNotePerformances(
    activeNotes: number[],
    history: ExerciseResult[]
  ): Map<number, NotePerformance> {
    return calculateBasePerformances(activeNotes, history, () => 1.0)
  }
}

/**
 * Estrategia 2: Motor Adaptativo v1 (Ponderado por Memoria de Errores y Matriz de Confusión)
 */
export class AdaptiveV1SelectionStrategy implements ExerciseSelectionStrategy {
  readonly id: StrategyId = 'adaptive_v1'
  readonly name = 'Adaptativo Inteligente (v1)'
  readonly description =
    'Prioriza notas con fallos frecuentes, errores recientes y pares de confusión de semitono.'

  selectNextNote(context: SelectionContext): number {
    const { activeNotes, history, lastPlayedNote } = context
    if (activeNotes.length === 0) throw new Error('No hay notas activas.')
    if (activeNotes.length === 1) return activeNotes[0]

    const performances = this.getNotePerformances(activeNotes, history)

    // Filtrar candidatos para evitar repetición inmediata si hay opciones
    const candidates =
      activeNotes.length >= 3 && lastPlayedNote !== null
        ? activeNotes.filter((n) => n !== lastPlayedNote)
        : activeNotes

    // Selección por Ruleta Ponderada (Weighted Random Choice)
    let totalWeight = 0
    for (const note of candidates) {
      const perf = performances.get(note)
      totalWeight += perf ? perf.weight : 1.0
    }

    let randomThreshold = Math.random() * totalWeight
    for (const note of candidates) {
      const perf = performances.get(note)
      const weight = perf ? perf.weight : 1.0
      if (randomThreshold <= weight) {
        return note
      }
      randomThreshold -= weight
    }

    return candidates[candidates.length - 1]
  }

  getNotePerformances(
    activeNotes: number[],
    history: ExerciseResult[]
  ): Map<number, NotePerformance> {
    return calculateBasePerformances(activeNotes, history, (perf, _, confusions) => {
      let weight = 1.0

      // Si nunca se ha preguntado, peso neutral
      if (perf.attempts === 0) return 1.0

      // 1. Penalización por baja precisión: más peso a menor precisión
      const errorRate = 1 - perf.accuracyPercentage / 100
      weight += errorRate * 2.5 // Hasta +2.5 de peso si tiene 0% de aciertos

      // 2. Si el último intento fue fallo, prioridad alta inmediata (+2.0)
      if (perf.lastResultWasCorrect === false) {
        weight += 2.0
      }

      // 3. Matriz de confusión: si esta nota fue tocada erróneamente en lugar de otra
      if (confusions.has(perf.noteNumber)) {
        weight += 1.5
      }

      // 4. Si la nota está dominada (>85% con al menos 3 intentos), reducimos su frecuencia
      if (perf.accuracyPercentage >= 85 && perf.attempts >= 3) {
        weight = 0.3
      }

      return Math.max(0.2, weight)
    })
  }
}

/**
 * Función auxiliar pura para calcular el mapa de rendimiento de notas.
 */
function calculateBasePerformances(
  activeNotes: number[],
  history: ExerciseResult[],
  weightCalculator: (
    perf: NotePerformance,
    recentMistakes: Set<number>,
    confusions: Set<number>
  ) => number
): Map<number, NotePerformance> {
  const result = new Map<number, NotePerformance>()
  const recentMistakes = new Set<number>()
  const confusions = new Set<number>()

  // Inicializar todas las notas activas
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

  // Procesar historial
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
      // La nota que tocó el usuario entra en el radar de confusión
      confusions.add(item.playedNote)
    }
    perf.accuracyPercentage = Math.round((perf.correct / perf.attempts) * 100)
  }

  // Calcular pesos finales
  for (const [, perf] of result) {
    perf.weight = weightCalculator(perf, recentMistakes, confusions)
  }

  return result
}

export const AVAILABLE_STRATEGIES: StrategyInfo[] = [
  {
    id: 'adaptive_v1',
    name: 'Adaptativo Inteligente (v1)',
    description: 'Aprende de tus errores y refuerza notas débiles automáticamente.'
  },
  {
    id: 'random',
    name: 'Aleatorio Clásico',
    description: 'Todas las notas tienen la misma probabilidad matemática.'
  }
]

export function createStrategy(id: StrategyId): ExerciseSelectionStrategy {
  switch (id) {
    case 'adaptive_v1':
      return new AdaptiveV1SelectionStrategy()
    case 'random':
      return new RandomSelectionStrategy()
    default:
      return new AdaptiveV1SelectionStrategy()
  }
}
