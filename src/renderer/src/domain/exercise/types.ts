export interface ExerciseResult {
  expectedNote: number
  playedNote: number
  correct: boolean
  semitoneDistance: number
  responseTimeMs: number
}

export interface SessionStats {
  totalAnswers: number
  correctAnswers: number
  accuracyPercentage: number
  avgResponseTimeMs: number
}
