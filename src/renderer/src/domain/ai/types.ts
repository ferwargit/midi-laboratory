import { AdvanceMode, SessionLimitType } from '../exercise/types'

export interface AiExercisePrescription {
  title: string
  rationale: string // Por qué la IA diseñó este ejercicio específico
  targetMode: 'single_note' | 'intervals' | 'sequences'
  instrumentId: string
  recommendedNotes: number[] // Notas MIDI específicas para aislar
  recommendedIntervals?: number[] // Semitonos si es modalidad de intervalos
  sequenceLength?: number // Longitud si es secuencia
  limitType: SessionLimitType
  questionsCount: number
  durationMinutes: number
  advanceMode: AdvanceMode
}

export interface AiAnalysisResponse {
  source: 'lm_studio_ai' | 'algorithmic_fallback'
  modelName: string
  analysisText: string
  prescription: AiExercisePrescription
}
