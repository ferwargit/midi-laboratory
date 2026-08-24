import {
  DbAnswerRecord,
  DbSessionRecord,
  DbAiReportRecord,
  DbAiConsultationRecord,
  DatabaseSummary
} from './types'
import {
  isValidSessionRecord,
  isValidAnswerRecord,
  isValidAiReportRecord,
  isValidAiConsultationRecord
} from './recordValidator'

export const DB_NAME = 'MusicalEarTrainerDB'
export const DB_VERSION = 5
export const SESSIONS_STORE = 'sessions'
export const ANSWERS_STORE = 'exercise_answers'
export const AI_REPORTS_STORE = 'ai_diagnostics'
export const AI_CONSULTATIONS_STORE = 'ai_consultations'

export class DatabaseEngine {
  private db: IDBDatabase | null = null

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event): void => {
        const db = request.result
        const transaction = (event.target as IDBOpenDBRequest).transaction!

        let sessionsStore: IDBObjectStore
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' })
        } else {
          sessionsStore = transaction.objectStore(SESSIONS_STORE)
        }

        if (!sessionsStore.indexNames.contains('targetMode')) {
          sessionsStore.createIndex('targetMode', 'targetMode', { unique: false })
        }

        if (!db.objectStoreNames.contains(ANSWERS_STORE)) {
          const answersStore = db.createObjectStore(ANSWERS_STORE, { keyPath: 'id' })
          answersStore.createIndex('sessionId', 'sessionId', { unique: false })
          answersStore.createIndex('expectedNote', 'expectedNote', { unique: false })
        }

        if (!db.objectStoreNames.contains(AI_REPORTS_STORE)) {
          db.createObjectStore(AI_REPORTS_STORE, { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains(AI_CONSULTATIONS_STORE)) {
          db.createObjectStore(AI_CONSULTATIONS_STORE, { keyPath: 'id' })
        }
      }

      request.onsuccess = (): void => {
        this.db = request.result
        resolve()
      }

      request.onerror = (): void => {
        reject(new Error(`Error al abrir IndexedDB: ${request.error?.message}`))
      }
    })
  }

  getVersion(): number {
    return this.db ? this.db.version : 0
  }

  async saveSession(session: DbSessionRecord, answers: DbAnswerRecord[]): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

    if (!isValidSessionRecord(session)) {
      throw new Error('Registro de sesión inválido o corrupto.')
    }

    for (let i = 0; i < answers.length; i++) {
      const currentAns = answers[i]
      if (!isValidAnswerRecord(currentAns)) {
        throw new Error(`Registro de respuesta inválido o corrupto en el índice ${i + 1}.`)
      }
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([SESSIONS_STORE, ANSWERS_STORE], 'readwrite')
      const sessionsStore = tx.objectStore(SESSIONS_STORE)
      const answersStore = tx.objectStore(ANSWERS_STORE)

      sessionsStore.put(session)

      for (const answer of answers) {
        answersStore.put(answer)
      }

      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error)
    })
  }

  async deleteSession(sessionId: string): Promise<void> {
    return this.deleteSessions([sessionId])
  }

  async deleteSessions(sessionIds: string[]): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada.')
    if (sessionIds.length === 0) return

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([SESSIONS_STORE, ANSWERS_STORE], 'readwrite')
      const sessionsStore = tx.objectStore(SESSIONS_STORE)
      const answersStore = tx.objectStore(ANSWERS_STORE)
      const index = answersStore.index('sessionId')

      const idSet = new Set(sessionIds)

      // 1. Eliminar las sesiones de la tabla principal
      sessionIds.forEach((id) => {
        sessionsStore.delete(id)
      })

      // 2. Borrado en cascada de las respuestas asociadas en exercise_answers
      const cursorRequest = index.openKeyCursor()
      cursorRequest.onsuccess = (): void => {
        const cursor = cursorRequest.result
        if (cursor) {
          const currentSessionId = cursor.key as string
          if (idSet.has(currentSessionId)) {
            answersStore.delete(cursor.primaryKey)
          }
          cursor.continue()
        }
      }

      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error)
    })
  }

  async saveAiReport(report: DbAiReportRecord): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

    if (!isValidAiReportRecord(report)) {
      throw new Error('Registro de informe de IA inválido o corrupto.')
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(AI_REPORTS_STORE, 'readwrite')
      const store = tx.objectStore(AI_REPORTS_STORE)
      store.put(report)
      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error)
    })
  }

  async saveAiConsultation(consultation: DbAiConsultationRecord): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

    if (!isValidAiConsultationRecord(consultation)) {
      throw new Error('Registro de consulta de IA inválido o corrupto.')
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(AI_CONSULTATIONS_STORE, 'readwrite')
      const store = tx.objectStore(AI_CONSULTATIONS_STORE)
      store.put(consultation)
      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error)
    })
  }

  async getAllAiConsultations(): Promise<DbAiConsultationRecord[]> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(AI_CONSULTATIONS_STORE, 'readonly')
      const store = tx.objectStore(AI_CONSULTATIONS_STORE)
      const request = store.getAll()

      request.onsuccess = (): void => {
        const consultations: DbAiConsultationRecord[] = request.result || []
        consultations.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        resolve(consultations)
      }
      request.onerror = (): void => reject(request.error)
    })
  }

  async getAllAiReports(): Promise<DbAiReportRecord[]> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(AI_REPORTS_STORE, 'readonly')
      const store = tx.objectStore(AI_REPORTS_STORE)
      const request = store.getAll()

      request.onsuccess = (): void => {
        const reports: DbAiReportRecord[] = request.result || []
        reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        resolve(reports)
      }
      request.onerror = (): void => reject(request.error)
    })
  }

  async getAllSessions(): Promise<DbSessionRecord[]> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(SESSIONS_STORE, 'readonly')
      const store = tx.objectStore(SESSIONS_STORE)
      const request = store.getAll()

      request.onsuccess = (): void => {
        const sessions: DbSessionRecord[] = request.result || []
        sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        resolve(sessions)
      }
      request.onerror = (): void => reject(request.error)
    })
  }

  async getAllAnswers(): Promise<DbAnswerRecord[]> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(ANSWERS_STORE, 'readonly')
      const store = tx.objectStore(ANSWERS_STORE)
      const request = store.getAll()

      request.onsuccess = (): void => {
        resolve(request.result || [])
      }
      request.onerror = (): void => reject(request.error)
    })
  }

  async getSummary(): Promise<DatabaseSummary> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(SESSIONS_STORE, 'readonly')
      const store = tx.objectStore(SESSIONS_STORE)
      const request = store.getAll()

      request.onsuccess = (): void => {
        const sessions: DbSessionRecord[] = request.result || []
        const totalSessions = sessions.length

        if (totalSessions === 0) {
          resolve({
            totalSessions: 0,
            totalExercises: 0,
            overallAccuracy: 0,
            overallAvgTimeMs: 0,
            totalDurationSeconds: 0
          })
          return
        }

        const totalExercises = sessions.reduce((acc, s) => acc + s.totalQuestions, 0)
        const totalCorrect = sessions.reduce((acc, s) => acc + s.correctAnswers, 0)
        const totalDuration = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0)

        const overallAccuracy =
          totalExercises > 0 ? Math.round((totalCorrect / totalExercises) * 100) : 0

        const weightedTimeSum = sessions.reduce(
          (acc, s) => acc + s.avgResponseTimeMs * s.totalQuestions,
          0
        )
        const overallAvgTimeMs =
          totalExercises > 0 ? Math.round(weightedTimeSum / totalExercises) : 0

        resolve({
          totalSessions,
          totalExercises,
          overallAccuracy,
          overallAvgTimeMs,
          totalDurationSeconds: totalDuration
        })
      }

      request.onerror = (): void => reject(request.error)
    })
  }

  async clearDatabase(): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        [SESSIONS_STORE, ANSWERS_STORE, AI_REPORTS_STORE, AI_CONSULTATIONS_STORE],
        'readwrite'
      )
      tx.objectStore(SESSIONS_STORE).clear()
      tx.objectStore(ANSWERS_STORE).clear()
      tx.objectStore(AI_REPORTS_STORE).clear()
      tx.objectStore(AI_CONSULTATIONS_STORE).clear()

      tx.oncomplete = (): void => resolve()
      tx.onerror = (): void => reject(tx.error)
    })
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
