import { create } from 'zustand'
import { DatabaseEngine } from '../domain/database/databaseEngine'
import {
  DatabaseSummary,
  DbAnswerRecord,
  DbSessionRecord,
  DbAiReportRecord,
  DbAiConsultationRecord,
  DatabaseBackupPayload,
  ImportResult
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
  exportBackupJson: () => Promise<string>
  importBackupJson: (jsonContent: string, mode?: 'merge' | 'replace') => Promise<ImportResult>
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

  exportBackupJson: async (): Promise<string> => {
    const { engine } = get()
    if (!engine) throw new Error('Base de datos no inicializada.')
    const backup = await engine.exportDatabase()
    return JSON.stringify(backup, null, 2)
  },

  importBackupJson: async (
    jsonContent: string,
    mode: 'merge' | 'replace' = 'merge'
  ): Promise<ImportResult> => {
    const { engine, reloadAllData } = get()
    if (!engine) throw new Error('Base de datos no inicializada.')

    try {
      const parsed = JSON.parse(jsonContent) as DatabaseBackupPayload
      const result = await engine.importDatabase(parsed, mode)
      await reloadAllData()
      return result
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        sessionsImported: 0,
        answersImported: 0,
        aiReportsImported: 0,
        aiConsultationsImported: 0,
        error: errMsg
      }
    }
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
