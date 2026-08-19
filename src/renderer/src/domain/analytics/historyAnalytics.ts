import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { midiNoteToName } from '../music/noteUtils'

export type AnalyticsModeFilter = 'all' | 'single_note' | 'intervals' | 'sequences'

export interface ConfusionPair {
  expected: string
  played: string
  count: number
}

export interface AnalyticsMetrics {
  modeFilter: AnalyticsModeFilter
  filteredSessionsCount: number
  totalAnswers: number
  totalCorrect: number
  overallAccuracy: number
  avgResponseTimeMs: number
  fastResponsesCount: number
  mediumResponsesCount: number
  slowResponsesCount: number
  sharpBiasCount: number
  flatBiasCount: number
  topConfusions: ConfusionPair[]
  mostDifficultNotes: Array<{ noteName: string; accuracy: number; attempts: number }>
  strongestNotes: Array<{ noteName: string; accuracy: number; attempts: number }>
}

export function filterSessionsByMode(
  sessions: DbSessionRecord[],
  modeFilter: AnalyticsModeFilter
): DbSessionRecord[] {
  if (modeFilter === 'all') return sessions
  if (modeFilter === 'single_note') {
    return sessions.filter(
      (s) =>
        s.strategyId === 'random' ||
        s.strategyId === 'adaptive_v1' ||
        s.presetName.toLowerCase().includes('notas') ||
        s.presetName.toLowerCase().includes('maestría')
    )
  }
  if (modeFilter === 'intervals') {
    return sessions.filter(
      (s) => s.strategyId.includes('intervals') || s.presetName.toLowerCase().includes('intervalo')
    )
  }
  if (modeFilter === 'sequences') {
    return sessions.filter(
      (s) => s.strategyId.includes('sequences') || s.presetName.toLowerCase().includes('secuencia')
    )
  }
  return sessions
}

export function computeAnalyticsMetrics(
  sessions: DbSessionRecord[],
  answers: DbAnswerRecord[],
  modeFilter: AnalyticsModeFilter = 'all'
): AnalyticsMetrics {
  const filteredSessions = filterSessionsByMode(sessions, modeFilter)
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
      avgResponseTimeMs: 0,
      fastResponsesCount: 0,
      mediumResponsesCount: 0,
      slowResponsesCount: 0,
      sharpBiasCount: 0,
      flatBiasCount: 0,
      topConfusions: [],
      mostDifficultNotes: [],
      strongestNotes: []
    }
  }

  let totalCorrect = 0
  let totalTime = 0
  let fastCount = 0
  let medCount = 0
  let slowCount = 0
  let sharpBias = 0
  let flatBias = 0

  const noteStatsMap = new Map<number, { attempts: number; correct: number }>()
  const confusionMap = new Map<string, number>()

  for (const ans of filteredAnswers) {
    if (ans.isCorrect) totalCorrect++
    totalTime += ans.responseTimeMs

    if (ans.responseTimeMs < 1200) fastCount++
    else if (ans.responseTimeMs <= 2800) medCount++
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

  return {
    modeFilter,
    filteredSessionsCount: filteredSessions.length,
    totalAnswers,
    totalCorrect,
    overallAccuracy: Math.round((totalCorrect / totalAnswers) * 100),
    avgResponseTimeMs: Math.round(totalTime / totalAnswers),
    fastResponsesCount: fastCount,
    mediumResponsesCount: medCount,
    slowResponsesCount: slowCount,
    sharpBiasCount: sharpBias,
    flatBiasCount: flatBias,
    topConfusions,
    mostDifficultNotes,
    strongestNotes
  }
}
