export interface LatencyThresholdConfig {
  FAST_MAX_MS: number
  MEDIUM_MAX_MS: number
  FAST_LABEL: string
  MEDIUM_LABEL: string
  SLOW_LABEL: string
}

export type ModalityKey = 'single_note' | 'intervals' | 'sequences' | 'repertoire'

export const COGNITIVE_LATENCY_THRESHOLDS_BY_MODE: Record<ModalityKey, LatencyThresholdConfig> = {
  single_note: {
    FAST_MAX_MS: 1400,
    MEDIUM_MAX_MS: 2800,
    FAST_LABEL: '< 1.4s',
    MEDIUM_LABEL: '1.4s - 2.8s',
    SLOW_LABEL: '> 2.8s'
  },
  intervals: {
    FAST_MAX_MS: 2400,
    MEDIUM_MAX_MS: 3800,
    FAST_LABEL: '< 2.4s',
    MEDIUM_LABEL: '2.4s - 3.8s',
    SLOW_LABEL: '> 3.8s'
  },
  sequences: {
    FAST_MAX_MS: 3500,
    MEDIUM_MAX_MS: 5000,
    FAST_LABEL: '< 3.5s',
    MEDIUM_LABEL: '3.5s - 5.0s',
    SLOW_LABEL: '> 5.0s'
  },
  repertoire: {
    FAST_MAX_MS: 2500,
    MEDIUM_MAX_MS: 4000,
    FAST_LABEL: '< 2.5s',
    MEDIUM_LABEL: '2.5s - 4.0s',
    SLOW_LABEL: '> 4.0s'
  }
} as const

/**
 * Resuelve la configuración de umbrales de latencia para una modalidad dada.
 * Hace fallback a 'single_note' si el modo no es reconocido.
 * Inmune a espacios en blanco y case-insensitive.
 */
export function getLatencyThresholds(mode?: string): LatencyThresholdConfig {
  if (!mode) return COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note
  const normalized = mode.trim().toLowerCase() as ModalityKey
  return (
    COGNITIVE_LATENCY_THRESHOLDS_BY_MODE[normalized] ??
    COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note
  )
}

export const MASTERY_THRESHOLDS = {
  MASTERED_MIN: 85,
  LEARNING_MIN: 60,
  CRITICAL_MAX: 60
} as const

export const ISI_THRESHOLDS = {
  MASSED_MAX_MS: 900000,
  OPTIMAL_MIN_MS: 43200000,
  OPTIMAL_MAX_MS: 172800000
} as const

export const BIAS_DOMINANCE_RATIO = 1.4 as const

/**
 * Configuración canónica para la normalización del Score CPI por modalidad.
 * Cada modalidad define su propia línea base de velocidad refleja (latencia objetivo + cadencia objetivo),
 * eliminando la penalización artificial de comparar todas las modalidades contra la base de Nota Individual.
 */
export interface CPIModalityConfig {
  targetLatencySec: number
  targetRpm: number
}

export type CPIModalityKey = ModalityKey | 'global'

export const CPI_CONFIG_BY_MODE: Record<CPIModalityKey, CPIModalityConfig> = {
  single_note: {
    targetLatencySec: 1.5,
    targetRpm: 15.0
  },
  intervals: {
    targetLatencySec: 2.4,
    targetRpm: 10.0
  },
  sequences: {
    targetLatencySec: 3.5,
    targetRpm: 7.0
  },
  repertoire: {
    targetLatencySec: 2.5,
    targetRpm: 8.0
  },
  global: {
    targetLatencySec: 1.5,
    targetRpm: 15.0
  }
} as const
