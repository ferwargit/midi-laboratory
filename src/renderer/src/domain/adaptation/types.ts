import { ExerciseResult } from '../exercise/types'

export type StrategyId = 'random' | 'adaptive_v1' | 'spaced_repetition'

export interface StrategyInfo {
  id: StrategyId
  name: string
  description: string
}

export interface NotePerformance {
  noteNumber: number
  attempts: number
  correct: number
  lastResultWasCorrect: boolean | null
  accuracyPercentage: number
  weight: number
}

export interface SelectionContext {
  activeNotes: number[]
  history: ExerciseResult[]
  lastPlayedNote: number | null
}

export interface SelectionDecision {
  selectedNote: number
  reason: string
  weightsSnapshot: Record<string, number>
}

export interface ExerciseSelectionStrategy {
  readonly id: StrategyId
  readonly name: string
  readonly description: string
  selectNextNote(context: SelectionContext): SelectionDecision
  getNotePerformances(
    activeNotes: number[],
    history: ExerciseResult[]
  ): Map<number, NotePerformance>
}
