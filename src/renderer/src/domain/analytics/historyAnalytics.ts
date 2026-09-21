import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { midiNoteToName } from '../music/noteUtils'

// Barrel export: preserva el 100% de la API pública del módulo para que
// ninguno de los 35 sitios consumidores (stores, hooks, views, dominio
// IA/adaptación y tests) deba modificar sus imports (OLA 4.3, Decisión 1).
export * from './thresholds'
export * from './types'
export * from './sessionClassification'
export * from './psychometrics'
export * from './latencyStats'
export * from './timelineTelemetry'
export * from './confusionMatrix'
export * from './sessionFilters'
export * from './longitudinal'

import { COGNITIVE_LATENCY_THRESHOLDS } from './thresholds'
import {
  AnalyticsFilterOptions,
  AnalyticsMetrics,
  AnalyticsModeFilter,
  ConfusionPair,
  DetailedSessionAnalysis
} from './types'
import { calculateSessionCPI } from './psychometrics'
import {
  computeInterSessionGapMap,
  resolveNominalPoolSize,
  resolveSessionDominantBias,
  resolveSessionFormat,
  resolveSessionInputMethod
} from './sessionClassification'
import { computeLongitudinalComparisons } from './longitudinal'
import { filterSessionsAdvanced, filterSessionsByMode } from './sessionFilters'

export function computeAnalyticsMetrics(
  sessions: DbSessionRecord[],
  answers: DbAnswerRecord[],
  modeFilter: AnalyticsModeFilter = 'all',
  advancedFilters?: Omit<AnalyticsFilterOptions, 'mode'>
): AnalyticsMetrics {
  const filteredSessions = advancedFilters
    ? filterSessionsAdvanced(sessions, { mode: modeFilter, ...advancedFilters }, answers)
    : filterSessionsByMode(sessions, modeFilter)

  const validSessionIds = new Set(filteredSessions.map((s) => s.id))
  const filteredAnswers = answers.filter((a) => validSessionIds.has(a.sessionId))

  const totalAnswers = filteredAnswers.length
  if (totalAnswers === 0) {
    return {
      modeFilter,
      filteredSessionsCount: filteredSessions.length,
      totalAnswers: 0,
      totalCorrect: 0,
      overallAccuracy: 0,
      normalizedOverallAccuracy: 0,
      avgEntropyBits: 0,
      avgResponseTimeMs: 0,
      fastResponsesCount: 0,
      mediumResponsesCount: 0,
      slowResponsesCount: 0,
      sharpBiasCount: 0,
      flatBiasCount: 0,
      topConfusions: [],
      mostDifficultNotes: [],
      strongestNotes: [],
      sessionPsychometricsList: [],
      longitudinalComparisons: []
    }
  }

  const gapMap = computeInterSessionGapMap(filteredSessions)

  let totalCorrect = 0
  let totalTime = 0
  let fastCount = 0
  let medCount = 0
  let slowCount = 0
  let sharpBias = 0
  let flatBias = 0

  const noteStatsMap = new Map<number, { attempts: number; correct: number }>()
  const confusionMap = new Map<string, number>()

  const sessionPsychometricsList: DetailedSessionAnalysis[] = filteredSessions.map((session) => {
    const sAnswers = filteredAnswers.filter((a) => a.sessionId === session.id)
    const uniqueExpected = new Set(sAnswers.map((a) => a.expectedNote))

    const poolSize = resolveNominalPoolSize(session, uniqueExpected.size)
    const chanceBaseline = 1 / poolSize
    const entropyBits = Number(Math.log2(poolSize).toFixed(2))

    const rawAccuracy = session.accuracyPercentage
    const accDec = rawAccuracy / 100
    const normalizedAccuracy =
      accDec <= chanceBaseline
        ? 0
        : Math.round(((accDec - chanceBaseline) / (1 - chanceBaseline)) * 100)

    const durSec = Math.max(1, session.durationSeconds || 1)
    const responsesPerMinute = Number(((session.totalQuestions / durSec) * 60).toFixed(1))

    let sFast = 0
    let sMed = 0
    let sSlow = 0
    let sSharp = 0
    let sFlat = 0

    sAnswers.forEach((ans) => {
      if (ans.responseTimeMs < COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS) sFast++
      else if (ans.responseTimeMs <= COGNITIVE_LATENCY_THRESHOLDS.MEDIUM_MAX_MS) sMed++
      else sSlow++

      if (!ans.isCorrect) {
        if (ans.semitoneDistance > 0) sSharp++
        else if (ans.semitoneDistance < 0) sFlat++
      }
    })

    const totalAns = Math.max(1, sAnswers.length)
    const fastPercent = Math.round((sFast / totalAns) * 100)
    const mediumPercent = Math.round((sMed / totalAns) * 100)
    const slowPercent = Math.round((sSlow / totalAns) * 100)

    const dominantBias = resolveSessionDominantBias(session, sAnswers)

    const formatInfo = resolveSessionFormat(session)

    const inputMethod = resolveSessionInputMethod(session, sAnswers)

    const gapInfo = gapMap.get(session.id) || { gapMs: null, label: 'Inicio' }

    const cpiScore = calculateSessionCPI(
      normalizedAccuracy,
      entropyBits,
      responsesPerMinute,
      session.avgResponseTimeMs,
      inputMethod
    )

    return {
      session,
      poolSize,
      entropyBits,
      chanceBaseline: Math.round(chanceBaseline * 100),
      normalizedAccuracy,
      responsesPerMinute,
      fastPercent,
      mediumPercent,
      slowPercent,
      sharpBiasCount: sSharp,
      flatBiasCount: sFlat,
      dominantBias,
      formatType: formatInfo.formatType,
      formatLabel: formatInfo.formatLabel,
      inputMethod,
      interSessionGapMs: gapInfo.gapMs,
      interSessionGapLabel: gapInfo.label,
      cpiScore
    }
  })

  for (const ans of filteredAnswers) {
    if (ans.isCorrect) totalCorrect++
    totalTime += ans.responseTimeMs

    if (ans.responseTimeMs < COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS) fastCount++
    else if (ans.responseTimeMs <= COGNITIVE_LATENCY_THRESHOLDS.MEDIUM_MAX_MS) medCount++
    else slowCount++

    if (!ans.isCorrect) {
      if (ans.semitoneDistance > 0) sharpBias++
      else if (ans.semitoneDistance < 0) flatBias++

      const expName = midiNoteToName(ans.expectedNote)
      const playName = midiNoteToName(ans.playedNote)
      const key = `${expName} ➔ ${playName}`
      confusionMap.set(key, (confusionMap.get(key) || 0) + 1)
    }

    if (!noteStatsMap.has(ans.expectedNote)) {
      noteStatsMap.set(ans.expectedNote, { attempts: 0, correct: 0 })
    }
    const stat = noteStatsMap.get(ans.expectedNote)!
    stat.attempts++
    if (ans.isCorrect) stat.correct++
  }

  const topConfusions: ConfusionPair[] = Array.from(confusionMap.entries())
    .map(([key, count]) => {
      const [expected, played] = key.split(' ➔ ')
      return { expected, played, count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const notesArray = Array.from(noteStatsMap.entries()).map(([noteNumber, stat]) => ({
    noteName: midiNoteToName(noteNumber),
    accuracy: Math.round((stat.correct / stat.attempts) * 100),
    attempts: stat.attempts
  }))

  const mostDifficultNotes = [...notesArray]
    .filter((n) => n.attempts >= 2 && n.accuracy < 80)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5)

  const strongestNotes = [...notesArray]
    .filter((n) => n.attempts >= 2 && n.accuracy >= 80)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5)

  const avgEntropy =
    sessionPsychometricsList.length > 0
      ? Number(
          (
            sessionPsychometricsList.reduce((acc, s) => acc + s.entropyBits, 0) /
            sessionPsychometricsList.length
          ).toFixed(2)
        )
      : 0

  const avgNormalized =
    sessionPsychometricsList.length > 0
      ? Math.round(
          sessionPsychometricsList.reduce((acc, s) => acc + s.normalizedAccuracy, 0) /
            sessionPsychometricsList.length
        )
      : 0

  const longitudinalComparisons = computeLongitudinalComparisons(sessionPsychometricsList)

  return {
    modeFilter,
    filteredSessionsCount: filteredSessions.length,
    totalAnswers,
    totalCorrect,
    overallAccuracy: Math.round((totalCorrect / totalAnswers) * 100),
    normalizedOverallAccuracy: avgNormalized,
    avgEntropyBits: avgEntropy,
    avgResponseTimeMs: Math.round(totalTime / totalAnswers),
    fastResponsesCount: fastCount,
    mediumResponsesCount: medCount,
    slowResponsesCount: slowCount,
    sharpBiasCount: sharpBias,
    flatBiasCount: flatBias,
    topConfusions,
    mostDifficultNotes,
    strongestNotes,
    sessionPsychometricsList,
    longitudinalComparisons
  }
}
