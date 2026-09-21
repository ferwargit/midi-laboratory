import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { BIAS_DOMINANCE_RATIO } from './thresholds'
import { InterSessionGapInfo, SessionFormatInfo } from './types'

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

/**
 * Resuelve el tamaño nominal del pool de notas activas de una sesión.
 *
 * Corrección F-06/F-14 (Auditoría Frente 3): la cadena histórica de
 * `name.includes('nivel 1')` colisionaba con niveles de dos dígitos
 * ("nivel 10" contiene "nivel 1"), y la rama regex de notas personalizadas
 * no aplicaba piso. Se unifica la resolución por regex numérica exacta y se
 * aplica `Math.max(2, ...)` a toda rama derivada, garantizando
 * `poolSize >= 2` (y por tanto `chanceBaseline <= 0.5`) aguas abajo.
 */
export function resolveNominalPoolSize(
  session: DbSessionRecord,
  empiricalUniqueCount: number
): number {
  const name = (session.presetName || '').toLowerCase()

  const match = name.match(/nivel\s*(\d+)/i)
  if (match) {
    const level = parseInt(match[1], 10)
    if (level === 1) return 3
    if (level === 2) return 5
    if (level === 3 || name.includes('octava diatónica')) return 8
    if (level === 4 || name.includes('cromático')) return 13
  }

  if (name.includes('pentatónica')) return 6

  const custom = name.match(/notas\s*(?:personalizadas)?\s*\((\d+)\)/i)
  if (custom) {
    return Math.max(2, parseInt(custom[1], 10))
  }

  return Math.max(2, empiricalUniqueCount)
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

/**
 * Construye el mapa de intervalos entre sesiones (ISI) sobre la cronología
 * del conjunto recibido. La primera sesión cronológica recibe `gapMs === null`.
 */
export function computeInterSessionGapMap(
  sessions: DbSessionRecord[]
): Map<string, InterSessionGapInfo> {
  const gapMap = new Map<string, InterSessionGapInfo>()
  const chronological = [...sessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  for (let i = 0; i < chronological.length; i++) {
    const current = chronological[i]
    if (i === 0) {
      gapMap.set(current.id, { gapMs: null, label: 'Inicio' })
    } else {
      const prev = chronological[i - 1]
      const diffMs = Math.max(
        0,
        new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime()
      )
      gapMap.set(current.id, { gapMs: diffMs, label: formatInterSessionGap(diffMs) })
    }
  }

  return gapMap
}

/**
 * Resuelve el método de entrada efectivo de una sesión a partir de sus respuestas.
 */
export function resolveSessionInputMethod(
  session: DbSessionRecord,
  answers: DbAnswerRecord[]
): 'hardware' | 'virtual' | 'mixed' {
  let hardwareCount = 0
  let virtualCount = 0

  for (const ans of answers) {
    if (ans.sessionId !== session.id) continue
    if (ans.inputSource === 'virtual_ui') {
      virtualCount++
    } else {
      hardwareCount++
    }
  }

  return virtualCount === 0 ? 'hardware' : hardwareCount === 0 ? 'virtual' : 'mixed'
}

/**
 * Resuelve el sesgo direccional dominante de una sesión según `BIAS_DOMINANCE_RATIO`.
 */
export function resolveSessionDominantBias(
  session: DbSessionRecord,
  answers: DbAnswerRecord[]
): 'sharp' | 'flat' | 'balanced' {
  let sharp = 0
  let flat = 0

  for (const ans of answers) {
    if (ans.sessionId !== session.id || ans.isCorrect) continue
    if (ans.semitoneDistance > 0) sharp++
    else if (ans.semitoneDistance < 0) flat++
  }

  return sharp > flat * BIAS_DOMINANCE_RATIO
    ? 'sharp'
    : flat > sharp * BIAS_DOMINANCE_RATIO
      ? 'flat'
      : 'balanced'
}

export function isRepertoireSession(s: DbSessionRecord): boolean {
  if (s.targetMode) return s.targetMode === 'repertoire'
  const name = (s.presetName || '').toLowerCase()
  return (
    s.strategyId.includes('repertoire') ||
    s.instrumentId.includes('repertoire') ||
    name.includes('partitura') ||
    name.includes('repertorio')
  )
}

export function isSequenceSession(s: DbSessionRecord): boolean {
  if (s.targetMode) return s.targetMode === 'sequences'
  if (isRepertoireSession(s)) return false
  const name = (s.presetName || '').toLowerCase()
  return (
    s.strategyId.includes('sequences') ||
    s.instrumentId === 'piano_sequences' ||
    name.includes('secuencia')
  )
}

export function isIntervalSession(s: DbSessionRecord): boolean {
  if (s.targetMode) return s.targetMode === 'intervals'
  if (isRepertoireSession(s)) return false
  const name = (s.presetName || '').toLowerCase()
  return (
    s.strategyId.includes('intervals') ||
    s.instrumentId === 'piano_intervals' ||
    name.includes('intervalo')
  )
}

export function isSingleNoteSession(s: DbSessionRecord): boolean {
  if (s.targetMode) return s.targetMode === 'single_note'
  if (isSequenceSession(s) || isIntervalSession(s) || isRepertoireSession(s)) return false
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
