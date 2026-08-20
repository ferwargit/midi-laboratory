import { calculateMelodicContour, ContourDirection } from '../music/sequences'
import {
  DEFAULT_EVALUATION_POLICY,
  EvaluationPolicy,
  checkNoteMatch,
  sanitizeResponseTime
} from './evalPolicy'

export interface SequenceExerciseResult {
  expectedNotes: number[]
  playedNotes: number[]
  exactMatchesCount: number
  isExactMatch: boolean
  expectedContour: ContourDirection[]
  playedContour: ContourDirection[]
  isContourCorrect: boolean
  levenshteinDistance: number
  similarityScorePercentage: number
  noteByNoteEvaluation: Array<{
    expected: number
    played: number | null
    isCorrect: boolean
  }>
  responseTimeMs: number
  feedbackMessage: string
}

export function calculateLevenshteinDistance(a: number[], b: number[]): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

export function evaluateSequenceAnswer(
  expectedNotes: number[],
  playedNotes: number[],
  rawResponseTimeMs: number,
  policy: EvaluationPolicy = DEFAULT_EVALUATION_POLICY
): SequenceExerciseResult {
  const length = expectedNotes.length
  let exactMatchesCount = 0

  const noteByNoteEvaluation = expectedNotes.map((expected, idx) => {
    const played = idx < playedNotes.length ? playedNotes[idx] : null
    const isCorrect = played !== null && checkNoteMatch(expected, played, policy)
    if (isCorrect) exactMatchesCount++
    return { expected, played, isCorrect }
  })

  const isExactMatch = exactMatchesCount === length && playedNotes.length === length

  const expectedContour = calculateMelodicContour(expectedNotes)
  const playedContour = calculateMelodicContour(playedNotes)
  const isContourCorrect =
    expectedContour.length === playedContour.length &&
    expectedContour.every((val, idx) => val === playedContour[idx])

  const distance = calculateLevenshteinDistance(expectedNotes, playedNotes)
  const maxLen = Math.max(expectedNotes.length, playedNotes.length)
  const similarityScorePercentage = Math.max(0, Math.round(((maxLen - distance) / maxLen) * 100))
  const responseTimeMs = sanitizeResponseTime(rawResponseTimeMs, policy)

  let feedbackMessage = ''
  if (isExactMatch) {
    feedbackMessage = `🎉 ¡Melodía perfecta! Acertaste las ${length} notas con su contorno exacto.`
  } else if (isContourCorrect) {
    if (exactMatchesCount > 0) {
      feedbackMessage = `🎶 ¡Excelente contorno! Reprodujiste la forma de la melodía (${exactMatchesCount}/${length} notas exactas).`
    } else {
      feedbackMessage = `🎯 ¡Contorno melódico perfecto! Reprodujiste la dirección de la frase (transportada).`
    }
  } else if (exactMatchesCount > 0) {
    feedbackMessage = `👍 Acierto parcial: ${exactMatchesCount} de ${length} notas (${similarityScorePercentage}% de similitud).`
  } else {
    feedbackMessage = `❌ No coincide la secuencia. Escuchá el motivo y volvé a intentarlo.`
  }

  return {
    expectedNotes,
    playedNotes,
    exactMatchesCount,
    isExactMatch,
    expectedContour,
    playedContour,
    isContourCorrect,
    levenshteinDistance: distance,
    similarityScorePercentage,
    noteByNoteEvaluation,
    responseTimeMs,
    feedbackMessage
  }
}
