import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { midiNoteToName } from '../music/noteUtils'

// Barrel export: preserva el 100% de la API pública del módulo para que
// ninguno de los 35 sitios consumidores (stores, hooks, views, dominio
// IA/adaptación y tests) deba modificar sus imports (OLA 4.3, Decisión 1).
// El SSOT sessionModality se re-exporta de forma explícita (no `export *`)
// porque `resolveNominalPoolSize` ya llega vía el delegador de
// sessionClassification; duplicarlo sería una ambigüedad de star-export.
export * from './thresholds'
export * from './types'
export {
  resolveSessionMode,
  resolveSessionPresetNotes,
  matchesSessionPreset
} from './sessionModality'
export type { SessionMode } from './sessionModality'
export * from './sessionClassification'
export * from './psychometrics'
export * from './latencyStats'
export * from './timelineTelemetry'
export * from './confusionMatrix'
export * from './sessionFilters'
export * from './longitudinal'

import { getLatencyThresholds, LatencyThresholdConfig } from './thresholds'
import {
  AnalyticsFilterOptions,
  AnalyticsMetrics,
  AnalyticsModeFilter,
  ConfusionPair,
  DetailedSessionAnalysis,
  InterSessionGapInfo
} from './types'
import { calculateSessionCPI } from './psychometrics'
import { resolveNominalPoolSize, resolveSessionMode, SessionMode } from './sessionModality'
import {
  computeInterSessionGapMap,
  resolveSessionDominantBias,
  resolveSessionFormat,
  resolveSessionInputMethod
} from './sessionClassification'
import { computeLongitudinalComparisons } from './longitudinal'
import { filterSessionsAdvanced, filterSessionsByMode } from './sessionFilters'

/**
 * Pre-agrupación de respuestas por sesión en una única pasada O(A)
 * (remediación F23): elimina el `filter` por sesión dentro del `.map()`
 * de sesiones, reduciendo el costo global de O(S×A) a O(S+A).
 */
function buildAnswersBySession(answers: DbAnswerRecord[]): Map<string, DbAnswerRecord[]> {
  const bySession = new Map<string, DbAnswerRecord[]>()
  for (const ans of answers) {
    const bucket = bySession.get(ans.sessionId)
    if (bucket) bucket.push(ans)
    else bySession.set(ans.sessionId, [ans])
  }
  return bySession
}

/**
 * Contexto de latencia por sesión (remediación F23): la modalidad se resuelve
 * una única vez por sesión con el SSOT `resolveSessionMode` y los umbrales se
 * derivan una única vez, en lugar de recalcularse por respuesta en el bucle de
 * agregación global.
 */
interface SessionLatencyContext {
  mode: SessionMode
  thresholds: LatencyThresholdConfig
}

function buildSessionLatencyContexts(
  sessions: DbSessionRecord[]
): Map<string, SessionLatencyContext> {
  const contexts = new Map<string, SessionLatencyContext>()
  for (const session of sessions) {
    const mode = resolveSessionMode(session) ?? 'single_note'
    contexts.set(session.id, { mode, thresholds: getLatencyThresholds(mode) })
  }
  return contexts
}

/**
 * Análisis psicrométrico de una sesión individual (remediación F23): pool,
 * entropía, precisión normalizada por azar, cronometría por umbrales de
 * modalidad, sesgo dominante, formato, método de entrada y CPI.
 */
function analyzeSessionPsychometrics(
  session: DbSessionRecord,
  sAnswers: DbAnswerRecord[],
  gapInfo: InterSessionGapInfo,
  latency: SessionLatencyContext | undefined
): DetailedSessionAnalysis {
  // Pool resuelto por el SSOT (remediación F21): canónico → heurístico →
  // empírico (notas únicas esperadas) con piso 2.
  const poolSize = resolveNominalPoolSize(session, sAnswers)
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

  // Modalidad y umbrales resueltos una única vez por sesión por el SSOT
  // (remediación F21/F23): `targetMode` canónico primero, heurísticas
  // históricas como fallback, default `single_note` para sesiones no
  // clasificables.
  const sessionMode = latency?.mode ?? 'single_note'
  const thresholds = latency?.thresholds ?? getLatencyThresholds(sessionMode)

  sAnswers.forEach((ans) => {
    if (ans.responseTimeMs < thresholds.FAST_MAX_MS) sFast++
    else if (ans.responseTimeMs <= thresholds.MEDIUM_MAX_MS) sMed++
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

  const cpiScore = calculateSessionCPI(
    normalizedAccuracy,
    entropyBits,
    responsesPerMinute,
    session.avgResponseTimeMs,
    inputMethod,
    sessionMode
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
}

/** Estadística acumulada de una nota esperada (intentos y aciertos). */
interface NoteStatAccumulator {
  attempts: number
  correct: number
}

/**
 * Acumuladores globales sobre todas las respuestas filtradas (remediación
 * F23): correctos, tiempo, buckets de latencia por umbrales de sesión,
 * sesgos, pares de confusión tipados y estadística por nota.
 */
interface GlobalAnswerAccumulators {
  totalCorrect: number
  totalTime: number
  fastCount: number
  medCount: number
  slowCount: number
  sharpBias: number
  flatBias: number
  confusionMap: Map<string, ConfusionPair>
  noteStatsMap: Map<number, NoteStatAccumulator>
}

function aggregateAnswerStats(
  filteredAnswers: DbAnswerRecord[],
  latencyContexts: Map<string, SessionLatencyContext>
): GlobalAnswerAccumulators {
  const acc: GlobalAnswerAccumulators = {
    totalCorrect: 0,
    totalTime: 0,
    fastCount: 0,
    medCount: 0,
    slowCount: 0,
    sharpBias: 0,
    flatBias: 0,
    confusionMap: new Map(),
    noteStatsMap: new Map()
  }

  for (const ans of filteredAnswers) {
    if (ans.isCorrect) acc.totalCorrect++
    acc.totalTime += ans.responseTimeMs

    // Umbrales reutilizados del contexto resuelto una vez por sesión (F23).
    const thresholds =
      latencyContexts.get(ans.sessionId)?.thresholds ?? getLatencyThresholds('single_note')

    if (ans.responseTimeMs < thresholds.FAST_MAX_MS) acc.fastCount++
    else if (ans.responseTimeMs <= thresholds.MEDIUM_MAX_MS) acc.medCount++
    else acc.slowCount++

    if (!ans.isCorrect) {
      if (ans.semitoneDistance > 0) acc.sharpBias++
      else if (ans.semitoneDistance < 0) acc.flatBias++

      // Par tipado acumulado sin round-trip de strings (remediación F23):
      // la clave compuesta usa los números MIDI originales y los nombres se
      // resuelven una sola vez por par.
      const pairKey = `${ans.expectedNote}|${ans.playedNote}`
      const existingPair = acc.confusionMap.get(pairKey)
      if (existingPair) {
        existingPair.count++
      } else {
        acc.confusionMap.set(pairKey, {
          expected: midiNoteToName(ans.expectedNote),
          played: midiNoteToName(ans.playedNote),
          count: 1
        })
      }
    }

    if (!acc.noteStatsMap.has(ans.expectedNote)) {
      acc.noteStatsMap.set(ans.expectedNote, { attempts: 0, correct: 0 })
    }
    const stat = acc.noteStatsMap.get(ans.expectedNote)!
    stat.attempts++
    if (ans.isCorrect) stat.correct++
  }

  return acc
}

/**
 * Proyección directa de pares tipados (remediación F23): sin split ni
 * re-parseo; el orden de inserción de primera aparición se preserva en
 * empates (sort estable).
 */
function projectTopConfusions(confusionMap: Map<string, ConfusionPair>): ConfusionPair[] {
  return Array.from(confusionMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

/**
 * Rankings por nota (remediación F23): más difíciles (`accuracy < 80`) y más
 * fuertes (`accuracy >= 80`), ambos con piso de 2 intentos y límite de 5.
 */
function projectNoteRankings(
  noteStatsMap: Map<number, NoteStatAccumulator>
): Pick<AnalyticsMetrics, 'mostDifficultNotes' | 'strongestNotes'> {
  const notesArray = Array.from(noteStatsMap.entries()).map(([noteNumber, stat]) => ({
    noteName: midiNoteToName(noteNumber),
    accuracy: Math.round((stat.correct / stat.attempts) * 100),
    attempts: stat.attempts
  }))

  return {
    mostDifficultNotes: [...notesArray]
      .filter((n) => n.attempts >= 2 && n.accuracy < 80)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5),
    strongestNotes: [...notesArray]
      .filter((n) => n.attempts >= 2 && n.accuracy >= 80)
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5)
  }
}

/** Promedios de entropía y precisión normalizada sobre las sesiones analizadas. */
function computeSessionAverages(
  sessionPsychometricsList: DetailedSessionAnalysis[]
): Pick<AnalyticsMetrics, 'avgEntropyBits' | 'normalizedOverallAccuracy'> {
  if (sessionPsychometricsList.length === 0) {
    return { avgEntropyBits: 0, normalizedOverallAccuracy: 0 }
  }
  return {
    avgEntropyBits: Number(
      (
        sessionPsychometricsList.reduce((acc, s) => acc + s.entropyBits, 0) /
        sessionPsychometricsList.length
      ).toFixed(2)
    ),
    normalizedOverallAccuracy: Math.round(
      sessionPsychometricsList.reduce((acc, s) => acc + s.normalizedAccuracy, 0) /
        sessionPsychometricsList.length
    )
  }
}

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
  const answersBySessionId = buildAnswersBySession(filteredAnswers)

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

  // Contexto de latencia por sesión (remediación F23): modalidad y umbrales
  // resueltos una única vez por sesión y reutilizados en ambos bloques.
  const latencyContexts = buildSessionLatencyContexts(filteredSessions)

  const sessionPsychometricsList = filteredSessions.map((session) =>
    analyzeSessionPsychometrics(
      session,
      answersBySessionId.get(session.id) ?? [],
      gapMap.get(session.id) || { gapMs: null, label: 'Inicio' },
      latencyContexts.get(session.id)
    )
  )

  const acc = aggregateAnswerStats(filteredAnswers, latencyContexts)
  const averages = computeSessionAverages(sessionPsychometricsList)
  const noteRankings = projectNoteRankings(acc.noteStatsMap)

  return {
    modeFilter,
    filteredSessionsCount: filteredSessions.length,
    totalAnswers,
    totalCorrect: acc.totalCorrect,
    overallAccuracy: Math.round((acc.totalCorrect / totalAnswers) * 100),
    normalizedOverallAccuracy: averages.normalizedOverallAccuracy,
    avgEntropyBits: averages.avgEntropyBits,
    avgResponseTimeMs: Math.round(acc.totalTime / totalAnswers),
    fastResponsesCount: acc.fastCount,
    mediumResponsesCount: acc.medCount,
    slowResponsesCount: acc.slowCount,
    sharpBiasCount: acc.sharpBias,
    flatBiasCount: acc.flatBias,
    topConfusions: projectTopConfusions(acc.confusionMap),
    mostDifficultNotes: noteRankings.mostDifficultNotes,
    strongestNotes: noteRankings.strongestNotes,
    sessionPsychometricsList,
    longitudinalComparisons: computeLongitudinalComparisons(sessionPsychometricsList)
  }
}
