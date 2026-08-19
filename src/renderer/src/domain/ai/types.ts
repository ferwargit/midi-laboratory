import { AdvanceMode, SessionLimitType } from '../exercise/types'

export type TonalAnchorMode = 'none' | 'drone_c' | 'cadence_preview'
export type ArticulationMode = 'normal' | 'staccato' | 'legato'
export type OctaveRegisterRange = 'low' | 'mid' | 'high' | 'full'

export interface AiExercisePrescription {
  title: string
  rationale: string
  targetMode: 'single_note' | 'intervals' | 'sequences'
  instrumentId: 'acoustic_grand_piano' | 'flute' | 'violin' | 'clarinet' | 'acoustic_bass'
  recommendedNotes: number[] // Números MIDI exactos (ej: [60, 62, 64])
  recommendedIntervals?: number[] // Semitonos 1 a 12 (ej: [1, 2, 4])
  sequenceLength?: number // 3 a 6 notas
  limitType: SessionLimitType // 'questions' | 'time' | 'mastery' | 'infinite'
  questionsCount: number
  durationMinutes: number
  advanceMode: AdvanceMode // 'smart' | 'manual' | 'auto_fast' | 'auto_slow'
  // Nuevos parámetros pedagógicos avanzados
  tonalAnchorMode?: TonalAnchorMode
  articulation?: ArticulationMode
  registerRange?: OctaveRegisterRange
  noteDurationMs?: number // 200ms (rápido) a 800ms (largo)
}

export interface AiAnalysisResponse {
  source: 'lm_studio_ai' | 'algorithmic_fallback'
  modelName: string
  analysisText: string
  prescription: AiExercisePrescription
}
