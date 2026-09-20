import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { midiNoteToName } from '../music/noteUtils'
import { COGNITIVE_LATENCY_THRESHOLDS } from './thresholds'
import { QuestionTelemetryPoint, SessionTimelineAnalysis } from './types'

export function analyzeSessionTimeline(
  session: DbSessionRecord,
  sessionAnswers: DbAnswerRecord[]
): SessionTimelineAnalysis {
  const sorted = [...sessionAnswers].sort((a, b) => a.questionIndex - b.questionIndex)
  const total = sorted.length

  const activeNotes = Array.from(new Set(sorted.map((a) => a.expectedNote))).sort((a, b) => a - b)
  let correctCount = 0
  let totalLatency = 0
  let fastCount = 0
  let totalPreListens = 0
  let singleListenCount = 0
  let totalPostErrorListens = 0
  let postErrorDwellSum = 0
  let errorCount = 0
  let repairedErrorsCount = 0

  const questions: QuestionTelemetryPoint[] = []

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]
    if (a.isCorrect) correctCount++
    else errorCount++

    totalLatency += a.responseTimeMs
    if (a.responseTimeMs < COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS) fastCount++

    const preListens = a.preAnswerListens || 1
    totalPreListens += preListens
    if (preListens === 1) singleListenCount++

    const postListens = a.postErrorListens || 0
    totalPostErrorListens += postListens
    if (!a.isCorrect && postListens > 0) repairedErrorsCount++

    const dwellTime = a.postErrorDwellTimeMs || 0
    postErrorDwellSum += dwellTime

    const windowSlice = sorted.slice(Math.max(0, i - 2), i + 1)
    const windowAvg = Math.round(
      windowSlice.reduce((sum, item) => sum + item.responseTimeMs, 0) / windowSlice.length
    )

    questions.push({
      questionIndex: a.questionIndex || i + 1,
      expectedNote: a.expectedNote,
      expectedName: midiNoteToName(a.expectedNote),
      playedNote: a.playedNote,
      playedName: midiNoteToName(a.playedNote),
      isCorrect: a.isCorrect,
      semitoneDistance: a.semitoneDistance,
      responseTimeMs: a.responseTimeMs,
      velocity: a.velocity,
      inputSource: a.inputSource,
      movingAvgLatencyMs: windowAvg,
      preAnswerListens: preListens,
      postErrorListens: postListens,
      postErrorDwellTimeMs: dwellTime
    })
  }

  const warmUpSlice = sorted.slice(0, 3)
  const warmUpErrorsCount = warmUpSlice.filter((a) => !a.isCorrect).length

  const postErrorDeltas: number[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    if (!sorted[i].isCorrect) {
      const regularAvg = totalLatency / Math.max(1, total)
      const nextTime = sorted[i + 1].responseTimeMs
      postErrorDeltas.push(nextTime - regularAvg)
    }
  }

  const postErrorSlowingAvgDeltaMs =
    postErrorDeltas.length > 0
      ? Math.round(postErrorDeltas.reduce((sum, d) => sum + d, 0) / postErrorDeltas.length)
      : null

  const mid = Math.floor(total / 2)
  const firstHalf = sorted.slice(0, mid)
  const secondHalf = sorted.slice(mid)

  // Corrección F-13 (Auditoría Frente 3): una sesión sin respuestas no puede
  // reportar 100% de precisión por mitad, ni 100% de confianza ni de reparación;
  // esos indicadores carecen de base muestral y deben valer 0. El fallback de
  // 100 para mitades vacías se conserva solo para sesiones no vacías con
  // repartos impares, que es el comportamiento cubierto por la suite existente.
  const noData = total === 0

  const firstHalfAcc = noData
    ? 0
    : firstHalf.length > 0
      ? Math.round((firstHalf.filter((a) => a.isCorrect).length / firstHalf.length) * 100)
      : 100
  const secondHalfAcc = noData
    ? 0
    : secondHalf.length > 0
      ? Math.round((secondHalf.filter((a) => a.isCorrect).length / secondHalf.length) * 100)
      : 100

  const firstHalfAvgLat =
    firstHalf.length > 0
      ? Math.round(firstHalf.reduce((sum, a) => sum + a.responseTimeMs, 0) / firstHalf.length)
      : 0
  const secondHalfAvgLat =
    secondHalf.length > 0
      ? Math.round(secondHalf.reduce((sum, a) => sum + a.responseTimeMs, 0) / secondHalf.length)
      : 0

  const fatigueDetected =
    total >= 10 && (secondHalfAvgLat > firstHalfAvgLat + 180 || secondHalfAcc < firstHalfAcc - 12)

  const firstListenConfidencePercent = noData
    ? 0
    : total > 0
      ? Math.round((singleListenCount / total) * 100)
      : 100
  const errorRepairRatePercent = noData
    ? 0
    : errorCount > 0
      ? Math.round((repairedErrorsCount / errorCount) * 100)
      : 100
  const avgPostErrorDwellTimeMs = errorCount > 0 ? Math.round(postErrorDwellSum / errorCount) : 0

  let subsequentCorrectAfterError = 0
  let subsequentTotalAfterError = 0

  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].isCorrect) {
      const noteFailed = sorted[i].expectedNote
      const nextOccurrence = sorted.slice(i + 1).find((a) => a.expectedNote === noteFailed)
      if (nextOccurrence) {
        subsequentTotalAfterError++
        if (nextOccurrence.isCorrect) subsequentCorrectAfterError++
      }
    }
  }

  const repairEffectivenessPercent =
    subsequentTotalAfterError > 0
      ? Math.round((subsequentCorrectAfterError / subsequentTotalAfterError) * 100)
      : null

  return {
    session,
    questions,
    totalQuestions: total,
    correctCount,
    errorCount: total - correctCount,
    overallAccuracy: total > 0 ? Math.round((correctCount / total) * 100) : 0,
    avgLatencyMs: total > 0 ? Math.round(totalLatency / total) : 0,
    warmUpErrorsCount,
    postErrorSlowingAvgDeltaMs,
    firstHalfAccuracy: firstHalfAcc,
    secondHalfAccuracy: secondHalfAcc,
    firstHalfAvgLatencyMs: firstHalfAvgLat,
    secondHalfAvgLatencyMs: secondHalfAvgLat,
    fatigueDetected,
    fastReflexCount: fastCount,
    activeNotes,
    totalPreAnswerListens: totalPreListens,
    totalPostErrorListens: totalPostErrorListens,
    firstListenConfidencePercent,
    errorRepairRatePercent,
    avgPostErrorDwellTimeMs,
    repairEffectivenessPercent
  }
}
