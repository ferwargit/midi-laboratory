import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { ISI_THRESHOLDS, MASTERY_THRESHOLDS } from './thresholds'
import { AnalyticsFilterOptions, AnalyticsModeFilter } from './types'
import {
  computeInterSessionGapMap,
  isIntervalSession,
  isRepertoireSession,
  isSequenceSession,
  isSingleNoteSession,
  resolveSessionDominantBias,
  resolveSessionFormat,
  resolveSessionInputMethod
} from './sessionClassification'
import { matchesSessionPreset, resolveNominalPoolSize } from './sessionModality'

/**
 * Extrae la dirección del estímulo grabada en la telemetría de una respuesta
 * de intervalos. El entrenador persiste `reasonTelemetry` con el formato
 * `"N st (ascending|descending|harmonic)"` (useIntervalTrainer), la misma
 * convención de parseo que canonicaliza la spec 05 para `longitudinal.ts`.
 * Devuelve `null` cuando la telemetría no contiene dirección parseable
 * (respuestas legacy o de otras modalidades).
 */
function parseStimulusDirection(
  reasonTelemetry: string
): 'ascending' | 'descending' | 'harmonic' | null {
  const match = reasonTelemetry.match(/\((ascending|descending|harmonic)\)/i)
  return match ? (match[1].toLowerCase() as 'ascending' | 'descending' | 'harmonic') : null
}

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

  // Respuestas agrupadas por sesión para el fallback empírico del resolvedor
  // SSOT de pool (remediación F21). Se construye una sola vez en O(n) solo
  // cuando el filtro de pool está activo; el conteo de notas únicas esperadas
  // vive dentro del SSOT, alineado con la columna visual CARGA (que consume
  // el poolSize de historyAnalytics, también basado en notas esperadas).
  const needsPoolFilter = !!filters.poolSizeFilter && filters.poolSizeFilter !== 'all'
  const sessionAnswersMap = new Map<string, DbAnswerRecord[]>()
  if (needsPoolFilter && hasAnswers) {
    for (const ans of answers) {
      const list = sessionAnswersMap.get(ans.sessionId) || []
      list.push(ans)
      sessionAnswersMap.set(ans.sessionId, list)
    }
  }

  // Mapa de direcciones de estímulo por sesión (derivadas de reasonTelemetry),
  // precomputado fuera del bucle en O(n) con el mismo patrón de agrupación
  // por sesión que el mapa de respuestas del filtro de pool.
  // Solo las sesiones de Intervalos registran dirección en su telemetría.
  const needsDirectionFilter = !!filters.directionFilter && filters.directionFilter !== 'all'
  const directionTarget = needsDirectionFilter ? filters.directionFilter : undefined
  const sessionDirectionsMap = new Map<string, Set<string>>()
  if (needsDirectionFilter && hasAnswers) {
    for (const ans of answers) {
      const direction = parseStimulusDirection(ans.reasonTelemetry)
      if (!direction) continue
      const set = sessionDirectionsMap.get(ans.sessionId) || new Set<string>()
      set.add(direction)
      sessionDirectionsMap.set(ans.sessionId, set)
    }
  }

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

    // 4. Preset / Contenido Musical — matching canónico-primero del SSOT
    // (remediación F21), con la matriz heurística histórica como fallback.
    if (filters.presetFilter && filters.presetFilter !== 'all') {
      if (!matchesSessionPreset(s, filters.presetFilter)) return false
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

    // 6. Carga / Tamaño de Pool — resolución SSOT (canónico → heurístico →
    // empírico con piso 2), consistente con la columna visual CARGA.
    if (filters.poolSizeFilter && filters.poolSizeFilter !== 'all') {
      const targetPool = parseInt(filters.poolSizeFilter, 10)
      const nominalPool = resolveNominalPoolSize(s, sessionAnswersMap.get(s.id))
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

    // 12. Dirección del Intervalo (estímulo puro, semántica de uniformidad)
    // Sin respuestas no hay telemetría de dirección: no-op seguro. Una sesión
    // coincide con una dirección X solo si es de Intervalos, tiene al menos
    // una respuesta con dirección parseable y TODAS las parseables son X;
    // una sesión en modo 'both' (mixta) no coincide con ninguna dirección.
    if (directionTarget && hasAnswers) {
      const directions = sessionDirectionsMap.get(s.id)
      if (
        !isIntervalSession(s) ||
        !directions ||
        directions.size !== 1 ||
        !directions.has(directionTarget)
      ) {
        return false
      }
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
