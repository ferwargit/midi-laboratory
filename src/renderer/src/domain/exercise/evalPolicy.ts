export interface EvaluationPolicy {
  strictOctave: boolean
  acceptEnharmonics: boolean
  clampResponseTime: {
    minMs: number
    maxMs: number
  }
}

export const DEFAULT_EVALUATION_POLICY: EvaluationPolicy = {
  strictOctave: true,
  acceptEnharmonics: true,
  clampResponseTime: {
    minMs: 50,
    maxMs: 30000
  }
}

/**
 * Sanitiza y acota el tiempo de respuesta según los límites fisiológicos de la política.
 */
export function sanitizeResponseTime(
  rawTimeMs: number,
  policy = DEFAULT_EVALUATION_POLICY
): number {
  if (Number.isNaN(rawTimeMs)) {
    return policy.clampResponseTime.minMs
  }
  if (!Number.isFinite(rawTimeMs) || rawTimeMs >= policy.clampResponseTime.maxMs) {
    return policy.clampResponseTime.maxMs
  }
  return Math.max(policy.clampResponseTime.minMs, Math.round(rawTimeMs))
}

/**
 * Normaliza la distancia en semitonos entre la nota esperada y la nota tocada.
 */
export function calculateNormalizedDistance(
  expectedNote: number,
  playedNote: number
): { rawDistance: number; pitchClassDistance: number } {
  const rawDistance = playedNote - expectedNote
  let pitchClassDistance = (playedNote % 12) - (expectedNote % 12)
  if (pitchClassDistance > 6) pitchClassDistance -= 12
  if (pitchClassDistance < -6) pitchClassDistance += 12

  return {
    rawDistance,
    pitchClassDistance
  }
}

/**
 * Valida la correspondencia de notas según la política musical unificada.
 */
export function checkNoteMatch(
  expectedNote: number,
  playedNote: number,
  policy = DEFAULT_EVALUATION_POLICY
): boolean {
  if (policy.strictOctave) {
    return expectedNote === playedNote
  }
  return expectedNote % 12 === playedNote % 12
}

/**
 * Valida enarmonía teórica por nombre de texto.
 */
export function checkEnharmonicTextMatch(
  expectedName: string,
  playedName: string,
  policy = DEFAULT_EVALUATION_POLICY
): boolean {
  if (!policy.acceptEnharmonics) {
    return expectedName.trim().toUpperCase() === playedName.trim().toUpperCase()
  }

  const enharmonicMap: Record<string, string> = {
    'C#': 'DB',
    DB: 'C#',
    'D#': 'EB',
    EB: 'D#',
    'F#': 'GB',
    GB: 'F#',
    'G#': 'AB',
    AB: 'G#',
    'A#': 'BB',
    BB: 'A#'
  }

  const cleanExp = expectedName.replace(/[0-9]/g, '').trim().toUpperCase()
  const cleanPlay = playedName.replace(/[0-9]/g, '').trim().toUpperCase()

  if (cleanExp === cleanPlay) return true
  return enharmonicMap[cleanExp] === cleanPlay
}
