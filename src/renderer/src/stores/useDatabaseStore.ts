import { create } from 'zustand'
import { DatabaseEngine } from '../domain/database/databaseEngine'
import { DatabaseSummary, DbAnswerRecord, DbSessionRecord } from '../domain/database/types'

interface DatabaseState {
  engine: DatabaseEngine | null
  summary: DatabaseSummary
  isInitialized: boolean
  initialize: () => Promise<void>
  saveSession: (session: DbSessionRecord, answers: DbAnswerRecord[]) => Promise<void>
  clearDatabase: () => Promise<void>
  reloadSummary: () => Promise<void>
}

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  engine: null,
  summary: {
    totalSessions: 0,
    totalExercises: 0,
    overallAccuracy: 0,
    overallAvgTimeMs: 0
  },
  isInitialized: false,

  initialize: async (): Promise<void> => {
    if (get().isInitialized) return

    const engine = new DatabaseEngine()
    try {
      await engine.initialize()
      const summary = await engine.getSummary()
      set({ engine, summary, isInitialized: true })
    } catch (err) {
      console.error('Error al inicializar la base de datos en Zustand Store:', err)
    }
  },

  reloadSummary: async (): Promise<void> => {
    const { engine } = get()
    if (!engine) return
    const summary = await engine.getSummary()
    set({ summary })
  },

  saveSession: async (session: DbSessionRecord, answers: DbAnswerRecord[]): Promise<void> => {
    const { engine, reloadSummary } = get()
    if (!engine) return
    await engine.saveSession(session, answers)
    await reloadSummary()
  },

  clearDatabase: async (): Promise<void> => {
    const { engine } = get()
    if (!engine) return
    await engine.clearDatabase()
    // Forzamos de forma atómica e inmediata el resumen global a 0
    set({
      summary: {
        totalSessions: 0,
        totalExercises: 0,
        overallAccuracy: 0,
        overallAvgTimeMs: 0
      }
    })
  }
}))
