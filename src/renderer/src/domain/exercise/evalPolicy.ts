export interface EvaluationPolicy {
  strictOctave: boolean // true = debe ser exactamente C4 (60); false = cualquier C vale
  clampResponseTime: {
    minMs: number // Respuestas menores a esto se consideran rebote involuntario
    maxMs: number // Techo máximo de latencia
  }
  normalizedDistance: (expected: number, played: number) => number
}

export const DEFAULT_EVALUATION_POLICY: EvaluationPolicy = {
  strictOctave: true,
  clampResponseTime: {
    minMs: 50,
    maxMs: 30000
  },
  normalizedDistance: (expected: number, played: number): number => {
    return played - expected
  }
}

/**
 * Valida y normaliza el tiempo de respuesta según la política clínica.
 */
export function sanitizeResponseTime(rawTimeMs: number, policy = DEFAULT_EVALUATION_POLICY): number {
  if (Number.isNaN(rawTimeMs) || !Number.isFinite(rawTimeMs)) {
    return policy.clampResponseTime.minMs
  }
  return Math.min(
    policy.clampResponseTime.maxMs,
    Math.max(policy.clampResponseTime.minMs, Math.round(rawTimeMs))
  )
}

/**
 * Determina si una nota tocada cumple el criterio de acierto según la política estricta o flexible.
 */
export function checkNoteMatch(
  expectedNote: number,
  playedNote: number,
  policy = DEFAULT_EVALUATION_POLICY
): boolean {
  if (policy.strictOctave) {
    return expectedNote === playedNote
  }
  // Equivalencia de clase de altura (pitch class mod 12)
  return (expectedNote % 12) === (playedNote % 12)
}
