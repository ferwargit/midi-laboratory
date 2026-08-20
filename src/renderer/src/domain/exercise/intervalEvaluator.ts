import { IntervalDirection, getIntervalDefinition } from '../music/intervals'
import { DEFAULT_EVALUATION_POLICY, EvaluationPolicy, sanitizeResponseTime } from './evalPolicy'

export interface IntervalExerciseStimulus {
  rootNote: number
  targetNote: number
  semitones: number
  direction: IntervalDirection
}

export interface IntervalExerciseResult {
  expectedStimulus: IntervalExerciseStimulus
  playedNotes: [number, number]
  playedSemitones: number
  playedDirection: IntervalDirection
  isIntervalCorrect: boolean
  isRootCorrect: boolean
  isExactMatch: boolean
  isTransposedCorrect: boolean
  semitoneDistanceError: number
  responseTimeMs: number
  feedbackMessage: string
}

export function evaluateIntervalAnswer(
  stimulus: IntervalExerciseStimulus,
  playedNotes: [number, number],
  rawResponseTimeMs: number,
  policy: EvaluationPolicy = DEFAULT_EVALUATION_POLICY
): IntervalExerciseResult {
  const [playedRoot, playedTarget] = playedNotes
  const playedDiff = playedTarget - playedRoot
  const playedSemitones = Math.abs(playedDiff)
  const playedDirection: IntervalDirection =
    playedDiff === 0 ? 'harmonic' : playedDiff > 0 ? 'ascending' : 'descending'

  const isIntervalCorrect =
    playedSemitones === stimulus.semitones && playedDirection === stimulus.direction
  const isRootCorrect = playedRoot === stimulus.rootNote
  const isExactMatch = isIntervalCorrect && isRootCorrect
  const isTransposedCorrect = isIntervalCorrect && !isRootCorrect
  const semitoneDistanceError = playedSemitones - stimulus.semitones
  const responseTimeMs = sanitizeResponseTime(rawResponseTimeMs, policy)

  const expectedDef = getIntervalDefinition(stimulus.semitones)
  const playedDef = getIntervalDefinition(playedSemitones)

  let feedbackMessage = ''
  if (isExactMatch) {
    feedbackMessage = `✅ ¡Excelente! ${expectedDef.fullName} (${expectedDef.shortName}) exacta.`
  } else if (isTransposedCorrect) {
    feedbackMessage = `🎯 ¡Oído perfecto! Reconociste la ${expectedDef.fullName} (${expectedDef.shortName}), pero transportada a otra nota base.`
  } else {
    feedbackMessage = `❌ Tocaste ${playedDef.fullName} (${playedDef.shortName}). Era ${expectedDef.fullName} (${expectedDef.shortName} - "${expectedDef.anchorSong}").`
  }

  return {
    expectedStimulus: stimulus,
    playedNotes,
    playedSemitones,
    playedDirection,
    isIntervalCorrect,
    isRootCorrect,
    isExactMatch,
    isTransposedCorrect,
    semitoneDistanceError,
    responseTimeMs,
    feedbackMessage
  }
}
