import { AiExercisePrescription } from '../ai/types'

export type SessionTargetMode = 'single_note' | 'intervals' | 'sequences'

export interface DbSessionRecord {
  id: string
  createdAt: string
  strategyId: string
  instrumentId: string
  presetName: string
  totalQuestions: number
  correctAnswers: number
  accuracyPercentage: number
  avgResponseTimeMs: number
  durationSeconds: number
  targetMode?: SessionTargetMode
}

export interface DbAnswerRecord {
  id: string
  sessionId: string
  questionIndex: number
  expectedNote: number
  playedNote: number
  isCorrect: boolean
  semitoneDistance: number
  responseTimeMs: number
  velocity: number
  reasonTelemetry: string
  createdAt: string
  inputSource?: 'midi_hardware' | 'virtual_ui'
}

export interface DbAiReportRecord {
  id: string
  createdAt: string
  modelName: string
  modeFilter: string
  analysisText: string
  prescription: AiExercisePrescription
}

export interface DbAiConsultationRecord {
  id: string
  createdAt: string
  modelName: string
  modeFilter: string
  topicConceptId?: string
  userQuery: string
  aiResponse: string
  associatedMetricsSnapshot?: {
    overallAccuracy: number
    normalizedAccuracy: number
    avgLatencyMs: number
    poolEntropyBits: number
  }
}

export interface DatabaseSummary {
  totalSessions: number
  totalExercises: number
  overallAccuracy: number
  overallAvgTimeMs: number
  totalDurationSeconds: number
}

// NUEVO: Respaldo estructurado e importación
export interface DatabaseBackupPayload {
  version: number
  exportedAt: string
  summary: DatabaseSummary
  sessions: DbSessionRecord[]
  answers: DbAnswerRecord[]
  aiReports: DbAiReportRecord[]
  aiConsultations: DbAiConsultationRecord[]
}

export interface ImportResult {
  success: boolean
  sessionsImported: number
  answersImported: number
  aiReportsImported: number
  aiConsultationsImported: number
  error?: string
}
