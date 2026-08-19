import { AiExercisePrescription } from '../ai/types'

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
}

export interface DbAiReportRecord {
  id: string
  createdAt: string
  modelName: string
  modeFilter: string
  analysisText: string
  prescription: AiExercisePrescription
}

export interface DatabaseSummary {
  totalSessions: number
  totalExercises: number
  overallAccuracy: number
  overallAvgTimeMs: number
}
