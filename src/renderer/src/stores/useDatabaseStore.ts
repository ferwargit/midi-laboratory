import { create } from 'zustand'
import { DatabaseEngine } from '../domain/database/databaseEngine'
import {
  DatabaseSummary,
  DbAnswerRecord,
  DbSessionRecord,
  DbAiReportRecord
} from '../domain/database/types'
import { useAiStore } from './useAiStore'

interface DatabaseState {
  engine: DatabaseEngine | null
  summary: DatabaseSummary
  sessions: DbSessionRecord[]
  answers: DbAnswerRecord[]
  aiReports: DbAiReportRecord[]
  isInitialized: boolean
  initialize: () => Promise<void>
  saveSession: (session: DbSessionRecord, answers: DbAnswerRecord[]) => Promise<void>
  saveAiReport: (report: DbAiReportRecord) => Promise<void>
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

    set({ summary, sessions, answers, aiReports })
  },

  saveSession: async (session: DbSessionRecord, answers: DbAnswerRecord[]): Promise<void> => {
    const { engine, reloadAllData } = get()
    if (!engine) return
    await engine.saveSession(session, answers)
    await reloadAllData()
  },

  saveAiReport: async (report: DbAiReportRecord): Promise<void> => {
    const { engine, reloadAllData } = get()
    if (!engine) return
    await engine.saveAiReport(report)
    await reloadAllData()
  },

  clearDatabase: async (): Promise<void> => {
    const { engine } = get()
    if (!engine) return
    await engine.clearDatabase()

    // 1. Limpia el estado de la base de datos
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
      aiReports: []
    })

    // 2. Purga inmediatamente la memoria residual del store de IA
    useAiStore.getState().resetAiMemory()
  }
}))
