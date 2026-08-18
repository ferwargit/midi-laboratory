export type AdvanceMode = 'smart' | 'manual' | 'auto_fast' | 'auto_slow'
export type SessionLimitType = 'questions' | 'time' | 'mastery' | 'infinite'

export interface AdvanceModeOption {
  id: AdvanceMode
  name: string
  description: string
}

export const ADVANCE_MODE_OPTIONS: AdvanceModeOption[] = [
  {
    id: 'smart',
    name: '🧠 Inteligente (Pausa al fallar, avanza al acertar)',
    description: 'Avanza solo si aciertas; se detiene si fallas para que analices el error.'
  },
  {
    id: 'manual',
    name: '⏸️ Manual (Esperar botón "Siguiente" o Espacio)',
    description: 'Siempre se detiene tras responder para darte control total.'
  },
  {
    id: 'auto_fast',
    name: '⏱️ Automático Rápido (1.5s)',
    description: 'Avanza automáticamente tras 1.5 segundos.'
  },
  {
    id: 'auto_slow',
    name: '⏱️ Automático Relajado (3.5s)',
    description: 'Avanza automáticamente tras 3.5 segundos de pausa.'
  }
]

export interface SessionLimitConfig {
  type: SessionLimitType
  questionsCount: number // ej: 5, 10, 20
  durationMinutes: number // ej: 3, 5, 10 o custom
}

export interface ExerciseResult {
  expectedNote: number
  playedNote: number
  correct: boolean
  semitoneDistance: number
  responseTimeMs: number
}

export interface SessionStats {
  totalAnswers: number
  correctAnswers: number
  accuracyPercentage: number
  avgResponseTimeMs: number
}
