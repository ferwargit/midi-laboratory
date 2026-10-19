import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { BIAS_DOMINANCE_RATIO } from './thresholds'
import { InterSessionGapInfo, SessionFormatInfo } from './types'
import {
  resolveNominalPoolSize as resolveNominalPoolSizeSSOT,
  resolveSessionMode
} from './sessionModality'

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
 * Delegador del SSOT `sessionModality.ts` (remediación F21, Auditoría V9):
 * la cadena canónico → heurístico → empírico vive exclusivamente allí. La
 * firma acepta las respuestas de la sesión (`answers?`) en lugar del conteo
 * empírico precalculado; el piso `poolSize >= 2` se garantiza en el SSOT.
 * Se conserva el export para no romper la superficie pública del barrel
 * `historyAnalytics.ts` (OLA 4.3, Decisión 1).
 */
export function resolveNominalPoolSize(
  session: DbSessionRecord,
  answers?: DbAnswerRecord[]
): number {
  return resolveNominalPoolSizeSSOT(session, answers)
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

/**
 * Predicados de modalidad delegados en el SSOT `resolveSessionMode`
 * (remediación F21): la prioridad `targetMode` canónico y las heurísticas
 * históricas de fallback viven exclusivamente en `sessionModality.ts`. Con
 * el resolvedor los predicados son mutuamente excluyentes y una sesión sin
 * señales clasificables (`null`) no es aceptada por ninguno. Se conservan
 * los exports para no romper la superficie pública del barrel
 * `historyAnalytics.ts` (OLA 4.3, Decisión 1).
 */
export function isRepertoireSession(s: DbSessionRecord): boolean {
  return resolveSessionMode(s) === 'repertoire'
}

export function isSequenceSession(s: DbSessionRecord): boolean {
  return resolveSessionMode(s) === 'sequences'
}

export function isIntervalSession(s: DbSessionRecord): boolean {
  return resolveSessionMode(s) === 'intervals'
}

export function isSingleNoteSession(s: DbSessionRecord): boolean {
  return resolveSessionMode(s) === 'single_note'
}
