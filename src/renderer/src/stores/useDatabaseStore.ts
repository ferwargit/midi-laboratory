import { create } from 'zustand'
import { DatabaseEngine } from '../domain/database/databaseEngine'
import {
  DatabaseSummary,
  DbAnswerRecord,
  DbSessionRecord,
  DbAiReportRecord,
  DbAiConsultationRecord
} from '../domain/database/types'
import { useAiStore } from './useAiStore'

interface DatabaseState {
  engine: DatabaseEngine | null
  summary: DatabaseSummary
  sessions: DbSessionRecord[]
  answers: DbAnswerRecord[]
  aiReports: DbAiReportRecord[]
  aiConsultations: DbAiConsultationRecord[]
  isInitialized: boolean
  initialize: () => Promise<void>
  saveSession: (session: DbSessionRecord, answers: DbAnswerRecord[]) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  deleteSessions: (sessionIds: string[]) => Promise<void>
  saveAiReport: (report: DbAiReportRecord) => Promise<void>
  saveAiConsultation: (consultation: DbAiConsultationRecord) => Promise<void>
  clearDatabase: () => Promise<void>
  reloadAllData: () => Promise<void>
}

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  engine: null,
  summary: {
    totalSessions: 0,
    totalExercises: 0,
    overallAccuracy: 0,
    overallAvgTimeMs: 0,
    totalDurationSeconds: 0
  },
  sessions: [],
  answers: [],
  aiReports: [],
  aiConsultations: [],
  isInitialized: false,

  initialize: async (): Promise<void> => {
    if (get().isInitialized) return

    const engine = new DatabaseEngine()
    try {
      await engine.initialize()
      set({ engine, isInitialized: true })
      await get().reloadAllData()
    } catch (err) {
      console.error('Error al inicializar IndexedDB:', err)
    }
  },

  reloadAllData: async (): Promise<void> => {
    const { engine } = get()
    if (!engine) return

    const summary = await engine.getSummary()
    const sessions = await engine.getAllSessions()
    const answers = await engine.getAllAnswers()
    const aiReports = await engine.getAllAiReports()
    const aiConsultations = await engine.getAllAiConsultations()

    set({ summary, sessions, answers, aiReports, aiConsultations })
  },

  saveSession: async (session: DbSessionRecord, answers: DbAnswerRecord[]): Promise<void> => {
    const { engine, reloadAllData } = get()
    if (!engine) return
    await engine.saveSession(session, answers)
    await reloadAllData()
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    const { engine, reloadAllData } = get()
    if (!engine) return
    await engine.deleteSession(sessionId)
    await reloadAllData()
  },

  deleteSessions: async (sessionIds: string[]): Promise<void> => {
    const { engine, reloadAllData } = get()
    if (!engine) return
    await engine.deleteSessions(sessionIds)
    await reloadAllData()
  },

  saveAiReport: async (report: DbAiReportRecord): Promise<void> => {
    const { engine, reloadAllData } = get()
    if (!engine) return
    await engine.saveAiReport(report)
    await reloadAllData()
  },

  saveAiConsultation: async (consultation: DbAiConsultationRecord): Promise<void> => {
    const { engine, reloadAllData } = get()
    if (!engine) return
    await engine.saveAiConsultation(consultation)
    await reloadAllData()
  },

  clearDatabase: async (): Promise<void> => {
    const { engine } = get()
    if (!engine) return
    await engine.clearDatabase()

    set({
      summary: {
        totalSessions: 0,
        totalExercises: 0,
        overallAccuracy: 0,
        overallAvgTimeMs: 0,
        totalDurationSeconds: 0
      },
      sessions: [],
      answers: [],
      aiReports: [],
      aiConsultations: []
    })

    useAiStore.getState().resetAiMemory()
  }
}))
