import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { midiNoteToName } from '../music/noteUtils'
import { EXERCISE_PRESETS } from '../music/presets'
import { AiExercisePrescription } from '../ai/types'

export const COGNITIVE_LATENCY_THRESHOLDS = {
  FAST_MAX_MS: 1400,
  MEDIUM_MAX_MS: 2800,
  FAST_LABEL: '< 1.4s',
  MEDIUM_LABEL: '1.4s - 2.8s',
  SLOW_LABEL: '> 2.8s'
} as const

export const MASTERY_THRESHOLDS = {
  MASTERED_MIN: 85,
  LEARNING_MIN: 50,
  CRITICAL_MAX: 50
} as const

export type AnalyticsModeFilter = 'all' | 'single_note' | 'intervals' | 'sequences'
export type AnalyticsMasteryFilter = 'all' | 'mastered' | 'learning' | 'critical'

export interface AnalyticsFilterOptions {
  mode: AnalyticsModeFilter
  instrumentId?: string
  strategyId?: string
  presetFilter?: string
  format?: string
  mastery?: AnalyticsMasteryFilter
  inputSource?: 'all' | 'hardware' | 'virtual'
  biasFilter?: 'all' | 'sharp' | 'flat' | 'balanced'
  poolSizeFilter?: string
  isiFilter?: 'all' | 'massed' | 'optimal' | 'spaced'
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

export interface SessionFormatInfo {
  formatType: 'time' | 'mastery' | 'questions' | 'infinite'
  formatLabel: string
  nominalMinutes?: number
  nominalQuestions?: number
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
  formatLabel: string
  inputMethod: 'hardware' | 'virtual' | 'mixed'
  interSessionGapMs: number | null
  interSessionGapLabel: string
  cpiScore: number
}

export interface LongitudinalComparison {
  contentName: string
  baselineSession: DbSessionRecord
  latestSession: DbSessionRecord
  totalAttempts: number
  rawAccuracyDelta: number
  normalizedAccuracyDelta: number
  responseTimeDeltaMs: number
  rpmDelta: number
  isImproved: boolean
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
  longitudinalComparisons: LongitudinalComparison[]
}

/**
 * Resuelve de forma canónica el formato objetivo configurado para una sesión.
 */
export function resolveSessionFormat(session: DbSessionRecord): SessionFormatInfo {
  const name = (session.presetName || '').toLowerCase()
  const isTimed = name.includes('tiempo') || name.includes('cronometrado')
  const isMastery = name.includes('maestría')

  if (isMastery) {
    return {
      formatType: 'mastery',
      formatLabel: '🎯 Maestría'
    }
  }

  if (isTimed) {
    const matchMin = name.match(/(?:cronometrado|tiempo)\s*(\d+)\s*(?:m|min)?/i)
    let nominalMinutes = matchMin ? parseInt(matchMin[1], 10) : undefined

    if (!nominalMinutes) {
      const dur = session.durationSeconds || 60
      if (dur <= 90) nominalMinutes = 1
      else if (dur <= 240) nominalMinutes = 3
      else if (dur <= 420) nominalMinutes = 5
      else nominalMinutes = 10
    }

    return {
      formatType: 'time',
      nominalMinutes,
      formatLabel: `⏱️ ${nominalMinutes}m 0s`
    }
  }

  const matchQ = name.match(/(?:bloque|serie)\s*(\d+)/i)
  const nominalQuestions = matchQ ? parseInt(matchQ[1], 10) : session.totalQuestions || 10

  return {
    formatType: 'questions',
    nominalQuestions,
    formatLabel: `🔢 Serie ${nominalQuestions}`
  }
}

export function calculateSessionCPI(
  normalizedAccuracy: number,
  entropyBits: number,
  responsesPerMinute: number,
  avgResponseTimeMs: number,
  inputMethod: 'hardware' | 'virtual' | 'mixed'
): number {
  if (normalizedAccuracy <= 0) return 0

  const entropyFactor = Math.max(0.5, entropyBits / 3.0)
  const latencySec = Math.max(0.6, avgResponseTimeMs / 1000)
  const speedFactor = Math.max(0.3, Math.min(2.5, (responsesPerMinute / 15.0) * (1.5 / latencySec)))
  const inputFactor = inputMethod === 'hardware' ? 1.0 : inputMethod === 'mixed' ? 0.92 : 0.85

  const rawScore = normalizedAccuracy * entropyFactor * speedFactor * inputFactor * 10
  return Math.round(Math.max(0, rawScore))
}

export function formatInterSessionGap(gapMs: number | null): string {
  if (gapMs === null || gapMs < 0) return 'Inicio'
  const seconds = Math.round(gapMs / 1000)
  if (seconds < 60) return 'Inmediato'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Number((minutes / 60).toFixed(1))
  if (hours < 24) return `${hours} h`
  const days = Math.round(hours / 24)
  return `${days} d`
}

function resolveNominalPoolSize(session: DbSessionRecord, empiricalUniqueCount: number): number {
  const name = (session.presetName || '').toLowerCase()

  if (name.includes('nivel 3') || name.includes('octava diatónica')) return 8
  if (name.includes('nivel 1')) return 3
  if (name.includes('nivel 2')) return 5
  if (name.includes('nivel 4') || name.includes('cromático')) return 13
  if (name.includes('pentatónica')) return 6

  const match = name.match(/notas\s*(?:personalizadas)?\s*\((\d+)\)/i)
  if (match) {
    return parseInt(match[1], 10)
  }

  return Math.max(2, empiricalUniqueCount)
}

export function isSequenceSession(s: DbSessionRecord): boolean {
  if (s.targetMode) return s.targetMode === 'sequences'
  const name = (s.presetName || '').toLowerCase()
  return (
    s.strategyId.includes('sequences') ||
    s.instrumentId === 'piano_sequences' ||
    name.includes('secuencia')
  )
}

export function isIntervalSession(s: DbSessionRecord): boolean {
  if (s.targetMode) return s.targetMode === 'intervals'
  const name = (s.presetName || '').toLowerCase()
  return (
    s.strategyId.includes('intervals') ||
    s.instrumentId === 'piano_intervals' ||
    name.includes('intervalo')
  )
}

export function isSingleNoteSession(s: DbSessionRecord): boolean {
  if (s.targetMode) return s.targetMode === 'single_note'
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
    // 1. Modalidad
    if (filters.mode === 'single_note' && !isSingleNoteSession(s)) return false
    if (filters.mode === 'intervals' && !isIntervalSession(s)) return false
    if (filters.mode === 'sequences' && !isSequenceSession(s)) return false

    // 2. Instrumento
    if (
      filters.instrumentId &&
      filters.instrumentId !== 'all' &&
      s.instrumentId !== filters.instrumentId
    ) {
      return false
    }

    // 3. Estrategia / Motor
    if (filters.strategyId && filters.strategyId !== 'all' && s.strategyId !== filters.strategyId) {
      return false
    }

    // 4. Preset / Contenido Musical
    if (filters.presetFilter && filters.presetFilter !== 'all') {
      const pName = (s.presetName || '').toLowerCase()
      const target = filters.presetFilter.toLowerCase()

      const isLevel3 =
        (target.includes('nivel 3') || target.includes('octava diatónica')) &&
        (pName.includes('nivel 3') ||
          pName.includes('octava diatónica') ||
          pName.includes('c4 a c5'))
      const isLevel1 = target.includes('nivel 1') && pName.includes('nivel 1')
      const isLevel2 = target.includes('nivel 2') && pName.includes('nivel 2')
      const isLevel4 =
        (target.includes('nivel 4') || target.includes('cromático')) &&
        (pName.includes('nivel 4') || pName.includes('cromático'))
      const isPentatonic = target.includes('pentatónica') && pName.includes('pentatónica')
      const isCustom =
        target.includes('personalizadas') &&
        (pName.includes('personalizadas') || pName.includes('notas ('))
      const isDirectMatch = pName.includes(target)

      if (
        !isLevel3 &&
        !isLevel1 &&
        !isLevel2 &&
        !isLevel4 &&
        !isPentatonic &&
        !isCustom &&
        !isDirectMatch
      ) {
        return false
      }
    }

    // 5. Formato y Duración Quirúrgica con SSOT
    if (filters.format && filters.format !== 'all') {
      const formatInfo = resolveSessionFormat(s)

      if (filters.format === 'time' || filters.format === 'time_all') {
        if (formatInfo.formatType !== 'time') return false
      } else if (filters.format === 'time_1') {
        if (formatInfo.formatType !== 'time' || formatInfo.nominalMinutes !== 1) return false
      } else if (filters.format === 'time_3') {
        if (formatInfo.formatType !== 'time' || formatInfo.nominalMinutes !== 3) return false
      } else if (filters.format === 'time_5') {
        if (formatInfo.formatType !== 'time' || formatInfo.nominalMinutes !== 5) return false
      } else if (filters.format === 'time_10') {
        if (formatInfo.formatType !== 'time' || formatInfo.nominalMinutes !== 10) return false
      } else if (filters.format === 'questions' || filters.format === 'questions_all') {
        if (formatInfo.formatType !== 'questions') return false
      } else if (filters.format === 'questions_5') {
        if (formatInfo.formatType !== 'questions' || formatInfo.nominalQuestions !== 5) return false
      } else if (filters.format === 'questions_10') {
        if (formatInfo.formatType !== 'questions' || formatInfo.nominalQuestions !== 10)
          return false
      } else if (filters.format === 'questions_20') {
        if (formatInfo.formatType !== 'questions' || formatInfo.nominalQuestions !== 20)
          return false
      } else if (filters.format === 'mastery') {
        if (formatInfo.formatType !== 'mastery') return false
      }
    }

    // 6. Carga / Tamaño de Pool
    if (filters.poolSizeFilter && filters.poolSizeFilter !== 'all') {
      const targetPool = parseInt(filters.poolSizeFilter, 10)
      const nominalPool = resolveNominalPoolSize(s, 0)
      if (nominalPool !== targetPool) return false
    }

    // 7. Nivel de Dominio
    if (filters.mastery === 'mastered' && s.accuracyPercentage < 85) return false
    if (filters.mastery === 'learning' && (s.accuracyPercentage < 50 || s.accuracyPercentage >= 85))
      return false
    if (filters.mastery === 'critical' && s.accuracyPercentage >= 50) return false

    // 8. Búsqueda por texto
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.toLowerCase()
      const matchName = (s.presetName || '').toLowerCase().includes(q)
      const matchInst = (s.instrumentId || '').toLowerCase().includes(q)
      const matchStrat = (s.strategyId || '').toLowerCase().includes(q)
      if (!matchName && !matchInst && !matchStrat) return false
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

export function reconstructSessionConfig(
  session: DbSessionRecord,
  allAnswers: DbAnswerRecord[]
): AiExercisePrescription {
  const sessionAnswers = allAnswers.filter((a) => a.sessionId === session.id)

  let targetMode: 'single_note' | 'intervals' | 'sequences' = 'single_note'
  if (session.targetMode && session.targetMode !== 'repertoire') {
    targetMode = session.targetMode
  } else if (isIntervalSession(session)) {
    targetMode = 'intervals'
  } else if (isSequenceSession(session)) {
    targetMode = 'sequences'
  }

  let recommendedNotes: number[] = [60, 62, 64]
  let recommendedIntervals: number[] | undefined = undefined
  let sequenceLength: number | undefined = undefined

  const pName = (session.presetName || '').toLowerCase()

  if (targetMode === 'single_note') {
    if (pName.includes('nivel 1')) {
      recommendedNotes = [
        ...(EXERCISE_PRESETS.find((p) => p.id === 'level_1_c_d_e')?.notes || [60, 62, 64])
      ]
    } else if (pName.includes('nivel 2')) {
      recommendedNotes = [
        ...(EXERCISE_PRESETS.find((p) => p.id === 'level_2_c_to_g')?.notes || [60, 62, 64, 65, 67])
      ]
    } else if (pName.includes('nivel 3') || pName.includes('octava diatónica')) {
      recommendedNotes = [
        ...(EXERCISE_PRESETS.find((p) => p.id === 'level_3_octave_diatonic')?.notes || [
          60, 62, 64, 65, 67, 69, 71, 72
        ])
      ]
    } else if (pName.includes('nivel 4') || pName.includes('cromático')) {
      recommendedNotes = [
        ...(EXERCISE_PRESETS.find((p) => p.id === 'level_4_octave_chromatic')?.notes || [
          60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72
        ])
      ]
    } else if (pName.includes('pentatónica')) {
      recommendedNotes = [
        ...(EXERCISE_PRESETS.find((p) => p.id === 'pentatonic_c_major')?.notes || [
          60, 62, 64, 67, 69, 72
        ])
      ]
    } else {
      const uniqueNotes = Array.from(new Set(sessionAnswers.map((a) => a.expectedNote))).sort(
        (a, b) => a - b
      )
      recommendedNotes = uniqueNotes.length >= 2 ? uniqueNotes : [60, 62, 64]
    }
  } else if (targetMode === 'intervals') {
    const stList: number[] = []
    sessionAnswers.forEach((a) => {
      const match = a.reasonTelemetry.match(/(\d+)\s*st/i)
      if (match) stList.push(parseInt(match[1], 10))
    })
    recommendedIntervals = Array.from(new Set(stList)).sort((a, b) => a - b)
    if (recommendedIntervals.length === 0) recommendedIntervals = [2, 4, 5, 7, 12]
  } else if (targetMode === 'sequences') {
    const candidateSet = new Set<number>()
    let detectedLength = 3

    sessionAnswers.forEach((a) => {
      const seqMatch = a.reasonTelemetry.match(/Secuencia:\s*\[([^\]]+)\]/i)
      if (seqMatch && seqMatch[1]) {
        const parsedNotes = seqMatch[1]
          .split(',')
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => !isNaN(n))

        parsedNotes.forEach((n) => candidateSet.add(n))
        if (parsedNotes.length >= 3) {
          detectedLength = parsedNotes.length
        }
      } else if (a.expectedNote) {
        candidateSet.add(a.expectedNote)
      }
    })

    const uniqueNotes = Array.from(candidateSet).sort((a, b) => a - b)
    recommendedNotes = uniqueNotes.length >= 2 ? uniqueNotes : [60, 62, 64, 65, 67]
    sequenceLength = detectedLength
  }

  const isTimed = pName.includes('tiempo') || pName.includes('cronometrado')
  const isMastery = pName.includes('maestría')

  const limitType = isTimed ? 'time' : isMastery ? 'mastery' : 'questions'
  const durationMinutes = Math.max(1, Math.round((session.durationSeconds || 60) / 60))
  const questionsCount = session.totalQuestions || 10

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

export function computeLongitudinalComparisons(
  sessionDetails: DetailedSessionAnalysis[]
): LongitudinalComparison[] {
  const groups = new Map<string, DetailedSessionAnalysis[]>()

  sessionDetails.forEach((item) => {
    let contentKey = item.session.presetName || 'General'
    if (contentKey.includes('•')) {
      contentKey = contentKey.split('•')[0].trim()
    }
    const groupKey = `${item.session.instrumentId}_${contentKey}`
    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(item)
  })

  const comparisons: LongitudinalComparison[] = []

  groups.forEach((items) => {
    if (items.length < 2) return

    const sorted = [...items].sort(
      (a, b) => new Date(a.session.createdAt).getTime() - new Date(b.session.createdAt).getTime()
    )

    const baseline = sorted[0]
    const latest = sorted[sorted.length - 1]

    let contentName = latest.session.presetName || ''
    if (contentName.includes('•')) {
      contentName = contentName.split('•')[0].trim()
    }

    const rawAccuracyDelta = latest.session.accuracyPercentage - baseline.session.accuracyPercentage
    const normalizedAccuracyDelta = latest.normalizedAccuracy - baseline.normalizedAccuracy
    const responseTimeDeltaMs =
      latest.session.avgResponseTimeMs - baseline.session.avgResponseTimeMs
    const rpmDelta = Number((latest.responsesPerMinute - baseline.responsesPerMinute).toFixed(1))

    const isImproved =
      rawAccuracyDelta > 0 || (rawAccuracyDelta === 0 && responseTimeDeltaMs < -100)

    comparisons.push({
      contentName,
      baselineSession: baseline.session,
      latestSession: latest.session,
      totalAttempts: sorted.length,
      rawAccuracyDelta,
      normalizedAccuracyDelta,
      responseTimeDeltaMs,
      rpmDelta,
      isImproved
    })
  })

  return comparisons
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
      sessionPsychometricsList: [],
      longitudinalComparisons: []
    }
  }

  const chronologicalSessions = [...filteredSessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const gapMap = new Map<string, { gapMs: number | null; label: string }>()
  for (let i = 0; i < chronologicalSessions.length; i++) {
    const current = chronologicalSessions[i]
    if (i === 0) {
      gapMap.set(current.id, { gapMs: null, label: 'Inicio' })
    } else {
      const prev = chronologicalSessions[i - 1]
      const diffMs = Math.max(
        0,
        new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime()
      )
      gapMap.set(current.id, { gapMs: diffMs, label: formatInterSessionGap(diffMs) })
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
    let hardwareCount = 0
    let virtualCount = 0

    sAnswers.forEach((ans) => {
      if (ans.responseTimeMs < COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS) sFast++
      else if (ans.responseTimeMs <= COGNITIVE_LATENCY_THRESHOLDS.MEDIUM_MAX_MS) sMed++
      else sSlow++

      if (!ans.isCorrect) {
        if (ans.semitoneDistance > 0) sSharp++
        else if (ans.semitoneDistance < 0) sFlat++
      }

      if (ans.inputSource === 'virtual_ui') {
        virtualCount++
      } else {
        hardwareCount++
      }
    })

    const totalAns = Math.max(1, sAnswers.length)
    const fastPercent = Math.round((sFast / totalAns) * 100)
    const mediumPercent = Math.round((sMed / totalAns) * 100)
    const slowPercent = Math.round((sSlow / totalAns) * 100)

    const dominantBias = sSharp > sFlat * 1.4 ? 'sharp' : sFlat > sSharp * 1.4 ? 'flat' : 'balanced'

    const formatInfo = resolveSessionFormat(session)

    const inputMethod: 'hardware' | 'virtual' | 'mixed' =
      virtualCount === 0 ? 'hardware' : hardwareCount === 0 ? 'virtual' : 'mixed'

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
