import { AiExercisePrescription } from '../ai/types'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { midiNoteToName } from '../music/noteUtils'

export type AnalyticsModeFilter = 'all' | 'single_note' | 'intervals' | 'sequences'
export type AnalyticsMasteryFilter = 'all' | 'mastered' | 'learning' | 'critical'

export interface AnalyticsFilterOptions {
  mode: AnalyticsModeFilter
  instrumentId?: string
  strategyId?: string
  format?: 'all' | 'time' | 'questions' | 'mastery'
  mastery?: AnalyticsMasteryFilter
  searchQuery?: string
}

export interface ConfusionPair {
  expected: string
  played: string
  count: number
}

export interface SessionPsychometrics {
  sessionId: string
  poolSize: number
  entropyBits: number
  chanceBaseline: number
  rawAccuracy: number
  normalizedAccuracy: number
  durationSeconds: number
  responsesPerMinute: number
}

export interface DetailedSessionAnalysis {
  session: DbSessionRecord
  poolSize: number
  entropyBits: number
  chanceBaseline: number
  normalizedAccuracy: number
  responsesPerMinute: number
  fastPercent: number
  mediumPercent: number
  slowPercent: number
  sharpBiasCount: number
  flatBiasCount: number
  dominantBias: 'sharp' | 'flat' | 'balanced'
  formatType: 'time' | 'mastery' | 'questions' | 'infinite'
}

export interface AnalyticsMetrics {
  modeFilter: AnalyticsModeFilter
  filteredSessionsCount: number
  totalAnswers: number
  totalCorrect: number
  overallAccuracy: number
  normalizedOverallAccuracy: number
  avgEntropyBits: number
  avgResponseTimeMs: number
  fastResponsesCount: number
  mediumResponsesCount: number
  slowResponsesCount: number
  sharpBiasCount: number
  flatBiasCount: number
  topConfusions: ConfusionPair[]
  mostDifficultNotes: Array<{ noteName: string; accuracy: number; attempts: number }>
  strongestNotes: Array<{ noteName: string; accuracy: number; attempts: number }>
  sessionPsychometricsList: DetailedSessionAnalysis[]
}

export function isSequenceSession(s: DbSessionRecord): boolean {
  const name = (s.presetName || '').toLowerCase()
  return (
    s.strategyId.includes('sequences') ||
    s.instrumentId === 'piano_sequences' ||
    name.includes('secuencia')
  )
}

export function isIntervalSession(s: DbSessionRecord): boolean {
  const name = (s.presetName || '').toLowerCase()
  return (
    s.strategyId.includes('intervals') ||
    s.instrumentId === 'piano_intervals' ||
    name.includes('intervalo')
  )
}

export function isSingleNoteSession(s: DbSessionRecord): boolean {
  if (isSequenceSession(s) || isIntervalSession(s)) return false
  const name = (s.presetName || '').toLowerCase()
  return (
    s.strategyId === 'random' ||
    s.strategyId === 'adaptive_v1' ||
    s.strategyId === 'spaced_repetition' ||
    name.includes('nota') ||
    name.includes('maestría') ||
    name.includes('tiempo') ||
    name.includes('cronometrado')
  )
}

export function filterSessionsAdvanced(
  sessions: DbSessionRecord[],
  filters: AnalyticsFilterOptions
): DbSessionRecord[] {
  return sessions.filter((s) => {
    // 1. Filtro Modalidad
    if (filters.mode === 'single_note' && !isSingleNoteSession(s)) return false
    if (filters.mode === 'intervals' && !isIntervalSession(s)) return false
    if (filters.mode === 'sequences' && !isSequenceSession(s)) return false

    // 2. Filtro Instrumento
    if (
      filters.instrumentId &&
      filters.instrumentId !== 'all' &&
      s.instrumentId !== filters.instrumentId
    ) {
      return false
    }

    // 3. Filtro Estrategia
    if (filters.strategyId && filters.strategyId !== 'all' && s.strategyId !== filters.strategyId) {
      return false
    }

    // 4. Filtro Formato
    const name = (s.presetName || '').toLowerCase()
    const isTimed = name.includes('tiempo') || name.includes('cronometrado')
    const isMastery = name.includes('maestría') || name.includes('mastery')

    if (filters.format === 'time' && !isTimed) return false
    if (filters.format === 'mastery' && !isMastery) return false
    if (filters.format === 'questions' && (isTimed || isMastery)) return false

    // 5. Filtro Nivel de Dominio
    if (filters.mastery === 'mastered' && s.accuracyPercentage < 85) return false
    if (filters.mastery === 'learning' && (s.accuracyPercentage < 50 || s.accuracyPercentage >= 85))
      return false
    if (filters.mastery === 'critical' && s.accuracyPercentage >= 50) return false

    // 6. Búsqueda por texto
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.toLowerCase()
      const matchName = s.presetName.toLowerCase().includes(q)
      const matchInst = s.instrumentId.toLowerCase().includes(q)
      if (!matchName && !matchInst) return false
    }

    return true
  })
}

export function filterSessionsByMode(
  sessions: DbSessionRecord[],
  modeFilter: AnalyticsModeFilter
): DbSessionRecord[] {
  return filterSessionsAdvanced(sessions, { mode: modeFilter })
}

export function computeAnalyticsMetrics(
  sessions: DbSessionRecord[],
  answers: DbAnswerRecord[],
  modeFilter: AnalyticsModeFilter = 'all',
  advancedFilters?: Omit<AnalyticsFilterOptions, 'mode'>
): AnalyticsMetrics {
  const filteredSessions = advancedFilters
    ? filterSessionsAdvanced(sessions, { mode: modeFilter, ...advancedFilters })
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
      sessionPsychometricsList: []
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

  // Análisis detallado por sesión
  const sessionPsychometricsList: DetailedSessionAnalysis[] = filteredSessions.map((session) => {
    const sAnswers = filteredAnswers.filter((a) => a.sessionId === session.id)
    const uniqueExpected = new Set(sAnswers.map((a) => a.expectedNote))
    const poolSize = Math.max(2, uniqueExpected.size)
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
      if (ans.responseTimeMs < 1200) sFast++
      else if (ans.responseTimeMs <= 2800) sMed++
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

    const dominantBias = sSharp > sFlat * 1.4 ? 'sharp' : sFlat > sSharp * 1.4 ? 'flat' : 'balanced'

    const pName = (session.presetName || '').toLowerCase()
    const formatType: 'time' | 'mastery' | 'questions' | 'infinite' =
      pName.includes('tiempo') || pName.includes('cronometrado')
        ? 'time'
        : pName.includes('maestría')
          ? 'mastery'
          : 'questions'

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
      formatType
    }
  })

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
    sessionPsychometricsList
  }
}

export function reconstructSessionConfig(
  session: DbSessionRecord,
  allAnswers: DbAnswerRecord[]
): AiExercisePrescription {
  const sessionAnswers = allAnswers.filter((a) => a.sessionId === session.id)

  // 1. Detección de Modalidad
  let targetMode: 'single_note' | 'intervals' | 'sequences' = 'single_note'
  if (isIntervalSession(session)) targetMode = 'intervals'
  else if (isSequenceSession(session)) targetMode = 'sequences'

  // 2. Reconstrucción del Pool de Notas / Intervalos
  let recommendedNotes: number[] = [60, 62, 64]
  let recommendedIntervals: number[] | undefined = undefined
  let sequenceLength: number | undefined = undefined

  if (targetMode === 'single_note') {
    const uniqueNotes = Array.from(new Set(sessionAnswers.map((a) => a.expectedNote))).sort(
      (a, b) => a - b
    )
    recommendedNotes = uniqueNotes.length >= 2 ? uniqueNotes : [60, 62, 64]
  } else if (targetMode === 'intervals') {
    // Si fue de intervalos, extraer los semitonos practicados
    const stList: number[] = []
    sessionAnswers.forEach((a) => {
      const match = a.reasonTelemetry.match(/(\d+)\s*st/i)
      if (match) stList.push(parseInt(match[1], 10))
    })
    recommendedIntervals = Array.from(new Set(stList)).sort((a, b) => a - b)
    if (recommendedIntervals.length === 0) recommendedIntervals = [2, 4, 5, 7, 12]
  } else if (targetMode === 'sequences') {
    const uniqueNotes = Array.from(new Set(sessionAnswers.map((a) => a.expectedNote))).sort(
      (a, b) => a - b
    )
    recommendedNotes = uniqueNotes.length >= 2 ? uniqueNotes : [60, 62, 64, 65, 67]
    sequenceLength =
      sessionAnswers.length > 0 ? Math.min(6, Math.max(3, session.totalQuestions > 0 ? 3 : 4)) : 3
  }

  // 3. Reconstrucción del Formato y Límite
  const name = (session.presetName || '').toLowerCase()
  const isTimed =
    name.includes('tiempo') || name.includes('cronometrado') || session.durationSeconds >= 55
  const isMastery = name.includes('maestría')

  const limitType = isTimed ? 'time' : isMastery ? 'mastery' : 'questions'
  const durationMinutes = Math.max(1, Math.round((session.durationSeconds || 60) / 60))
  const questionsCount = session.totalQuestions || 10

  // 4. Mapeo de Instrumento
  const validInstruments = ['acoustic_grand_piano', 'flute', 'violin', 'clarinet', 'acoustic_bass']
  const instrumentId = validInstruments.includes(session.instrumentId)
    ? (session.instrumentId as AiExercisePrescription['instrumentId'])
    : 'acoustic_grand_piano'

  return {
    title: `Re-testeo: ${session.presetName}`,
    rationale: `Sesión clonada de tu registro histórico (${new Date(session.createdAt).toLocaleDateString('es-AR')}) para evaluar evolución longitudinal bajo las mismas condiciones.`,
    targetMode,
    instrumentId,
    recommendedNotes,
    recommendedIntervals,
    sequenceLength,
    limitType,
    questionsCount,
    durationMinutes,
    advanceMode: 'smart',
    noteDurationMs: 500
  }
}
