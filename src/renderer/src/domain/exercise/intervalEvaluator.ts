import { IntervalDirection, getIntervalDefinition } from '../music/intervals'

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
  isIntervalCorrect: boolean // ¿Acertó la distancia de oído?
  isRootCorrect: boolean // ¿Arrancó en la nota base pedida?
  isExactMatch: boolean // ¿Acertó ambas cosas (100% exacto)?
  isTransposedCorrect: boolean // Tocó el intervalo correcto pero transportado (error motor, no de oído)
  semitoneDistanceError: number // Distancia de error en semitonos (ej: tocó 3 semitonos en vez de 4 -> -1)
  responseTimeMs: number
  feedbackMessage: string
}

/**
 * Evalúa una respuesta de 2 notas frente a un intervalo estímulo.
 */
export function evaluateIntervalAnswer(
  stimulus: IntervalExerciseStimulus,
  playedNotes: [number, number],
  responseTimeMs: number
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
    responseTimeMs: Math.max(0, responseTimeMs),
    feedbackMessage
  }
}
