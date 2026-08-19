import { ExerciseResult, SessionStats } from './types'
import {
  DEFAULT_EVALUATION_POLICY,
  EvaluationPolicy,
  checkNoteMatch,
  sanitizeResponseTime
} from './evalPolicy'

/**
 * Evalúa la respuesta de un usuario frente a una nota esperada usando la política musical centralizada.
 */
export function evaluateSingleNoteAnswer(
  expectedNote: number,
  playedNote: number,
  rawResponseTimeMs: number,
  policy: EvaluationPolicy = DEFAULT_EVALUATION_POLICY
): ExerciseResult {
  const correct = checkNoteMatch(expectedNote, playedNote, policy)
  const semitoneDistance = policy.normalizedDistance(expectedNote, playedNote)
  const responseTimeMs = sanitizeResponseTime(rawResponseTimeMs, policy)

  return {
    expectedNote,
    playedNote,
    correct,
    semitoneDistance,
    responseTimeMs
  }
}

/**
 * Calcula las estadísticas agregadas de una sesión en base a su historial.
 */
export function calculateSessionStats(history: ExerciseResult[]): SessionStats {
  const totalAnswers = history.length
  if (totalAnswers === 0) {
    return {
      totalAnswers: 0,
      correctAnswers: 0,
      accuracyPercentage: 0,
      avgResponseTimeMs: 0
    }
  }

  const correctAnswers = history.filter((item) => item.correct).length
  const accuracyPercentage = Math.round((correctAnswers / totalAnswers) * 100)
  const totalTime = history.reduce((acc, item) => acc + item.responseTimeMs, 0)
  const avgResponseTimeMs = Math.round(totalTime / totalAnswers)

  return {
    totalAnswers,
    correctAnswers,
    accuracyPercentage,
    avgResponseTimeMs
  }
}
