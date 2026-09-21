import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { ISI_THRESHOLDS, MASTERY_THRESHOLDS } from './thresholds'
import { AnalyticsFilterOptions, AnalyticsModeFilter } from './types'
import {
  computeInterSessionGapMap,
  isIntervalSession,
  isRepertoireSession,
  isSequenceSession,
  isSingleNoteSession,
  resolveNominalPoolSize,
  resolveSessionDominantBias,
  resolveSessionFormat,
  resolveSessionInputMethod
} from './sessionClassification'

export function filterSessionsAdvanced(
  sessions: DbSessionRecord[],
  filters: AnalyticsFilterOptions,
  answers: DbAnswerRecord[] = []
): DbSessionRecord[] {
  // El mapa de intervalos se construye sobre la cronología del input completo,
  // antes de filtrar, de modo que gap === null identifique solo a la primera
  // sesión de la historia recibida.
  const needsIsiFilter = !!filters.isiFilter && filters.isiFilter !== 'all'
  const gapMap = needsIsiFilter ? computeInterSessionGapMap(sessions) : null
  // Los filtros que requieren respuestas (inputSource / biasFilter) son no-op
  // cuando estas no se proporcionan, según la Decisión 2 de design.md.
  const hasAnswers = answers.length > 0

  return sessions.filter((s) => {
    // 1. Modalidad Estricta
    if (filters.mode === 'single_note' && !isSingleNoteSession(s)) return false
    if (filters.mode === 'intervals' && !isIntervalSession(s)) return false
    if (filters.mode === 'sequences' && !isSequenceSession(s)) return false
    if (filters.mode === 'repertoire' && !isRepertoireSession(s)) return false

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
    if (filters.mastery === 'mastered' && s.accuracyPercentage < MASTERY_THRESHOLDS.MASTERED_MIN)
      return false
    if (
      filters.mastery === 'learning' &&
      (s.accuracyPercentage < MASTERY_THRESHOLDS.LEARNING_MIN ||
        s.accuracyPercentage >= MASTERY_THRESHOLDS.MASTERED_MIN)
    )
      return false
    if (filters.mastery === 'critical' && s.accuracyPercentage >= MASTERY_THRESHOLDS.CRITICAL_MAX)
      return false

    // 8. Búsqueda por texto
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.toLowerCase()
      const matchName = (s.presetName || '').toLowerCase().includes(q)
      const matchInst = (s.instrumentId || '').toLowerCase().includes(q)
      const matchStrat = (s.strategyId || '').toLowerCase().includes(q)
      if (!matchName && !matchInst && !matchStrat) return false
    }

    // 9. Fuente de Entrada (hardware / virtual / mixed)
    // Sin respuestas no hay forma de derivar el método de entrada: no-op seguro.
    if (hasAnswers && filters.inputSource && filters.inputSource !== 'all') {
      if (resolveSessionInputMethod(s, answers) !== filters.inputSource) return false
    }

    // 10. Sesgo Direccional Dominante
    // Sin respuestas no hay forma de derivar el sesgo: no-op seguro.
    if (hasAnswers && filters.biasFilter && filters.biasFilter !== 'all') {
      if (resolveSessionDominantBias(s, answers) !== filters.biasFilter) return false
    }

    // 11. Banda de Intervalo Entre Sesiones (ISI)
    if (needsIsiFilter && gapMap) {
      const gap = gapMap.get(s.id)?.gapMs ?? null
      // La primera sesión de la cronología (gap === null) no pertenece a
      // ninguna banda de intervalo; solo coincide con isiFilter === 'all'.
      if (gap === null) return false
      if (filters.isiFilter === 'massed' && !(gap < ISI_THRESHOLDS.MASSED_MAX_MS)) return false
      if (
        filters.isiFilter === 'optimal' &&
        !(gap >= ISI_THRESHOLDS.OPTIMAL_MIN_MS && gap <= ISI_THRESHOLDS.OPTIMAL_MAX_MS)
      )
        return false
      if (filters.isiFilter === 'spaced' && !(gap > ISI_THRESHOLDS.OPTIMAL_MAX_MS)) return false
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
