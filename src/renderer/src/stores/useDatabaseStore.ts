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

/**
 * Recalcula el `DatabaseSummary` a partir de la lista de sesiones en memoria,
 * replicando exactamente la matemática ponderada de `DatabaseEngine.getSummary`
 * (medias ponderadas por `totalQuestions`, `Math.round`, `durationSeconds || 0`).
 * Evita re-leer IndexedDB tras cada escritura incremental (hallazgo F14.2).
 */
export function computeSummaryFromSessions(sessions: DbSessionRecord[]): DatabaseSummary {
  const totalSessions = sessions.length

  if (totalSessions === 0) {
    return {
      totalSessions: 0,
      totalExercises: 0,
      overallAccuracy: 0,
      overallAvgTimeMs: 0,
      totalDurationSeconds: 0
    }
  }

  const totalExercises = sessions.reduce((acc, s) => acc + s.totalQuestions, 0)
  const totalCorrect = sessions.reduce((acc, s) => acc + s.correctAnswers, 0)
  const totalDuration = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0)

  const overallAccuracy = totalExercises > 0 ? Math.round((totalCorrect / totalExercises) * 100) : 0

  const weightedTimeSum = sessions.reduce(
    (acc, s) => acc + s.avgResponseTimeMs * s.totalQuestions,
    0
  )
  const overallAvgTimeMs = totalExercises > 0 ? Math.round(weightedTimeSum / totalExercises) : 0

  return {
    totalSessions,
    totalExercises,
    overallAccuracy,
    overallAvgTimeMs,
    totalDurationSeconds: totalDuration
  }
}

/**
 * Borrado incremental (F14.2): filtra de las colecciones en memoria las sesiones
 * eliminadas y sus respuestas hijas, y recalcula el resumen, sin re-leer IndexedDB.
 */
function applySessionDeletion(
  sessionIds: string[],
  set: (partial: Partial<DatabaseState>) => void,
  get: () => DatabaseState
): void {
  const deletedIds = new Set(sessionIds)
  const { sessions, answers } = get()

  const nextSessions = sessions.filter((s) => !deletedIds.has(s.id))
  const nextAnswers = answers.filter((a) => !deletedIds.has(a.sessionId))

  set({
    sessions: nextSessions,
    answers: nextAnswers,
    summary: computeSummaryFromSessions(nextSessions)
  })
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
    const { engine } = get()
    if (!engine) return
    await engine.saveSession(session, answers)

    // Actualización incremental (F14.2): upsert en memoria + resumen recalculado,
    // sin re-leer las tablas de IndexedDB.
    const { sessions, answers: currentAnswers } = get()
    const nextSessions = [...sessions.filter((s) => s.id !== session.id), session].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    const nextAnswers = [
      ...currentAnswers.filter((a) => !answers.some((na) => na.id === a.id)),
      ...answers
    ]

    set({
      sessions: nextSessions,
      answers: nextAnswers,
      summary: computeSummaryFromSessions(nextSessions)
    })
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    const { engine } = get()
    if (!engine) return
    await engine.deleteSession(sessionId)
    applySessionDeletion([sessionId], set, get)
  },

  deleteSessions: async (sessionIds: string[]): Promise<void> => {
    const { engine } = get()
    if (!engine) return
    await engine.deleteSessions(sessionIds)
    applySessionDeletion(sessionIds, set, get)
  },

  saveAiReport: async (report: DbAiReportRecord): Promise<void> => {
    const { engine } = get()
    if (!engine) return
    await engine.saveAiReport(report)

    // Actualización incremental (F14.2): upsert en memoria con orden canónico,
    // sin re-leer las tablas de IndexedDB.
    const nextReports = [...get().aiReports.filter((r) => r.id !== report.id), report].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    set({ aiReports: nextReports })
  },

  saveAiConsultation: async (consultation: DbAiConsultationRecord): Promise<void> => {
    const { engine } = get()
    if (!engine) return
    await engine.saveAiConsultation(consultation)

    // Actualización incremental (F14.2): upsert en memoria con orden canónico,
    // sin re-leer las tablas de IndexedDB.
    const nextConsultations = [
      ...get().aiConsultations.filter((c) => c.id !== consultation.id),
      consultation
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    set({ aiConsultations: nextConsultations })
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
