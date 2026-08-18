import { DbAnswerRecord, DbSessionRecord, DatabaseSummary } from './types'

const DB_NAME = 'MusicalEarTrainerDB'
const DB_VERSION = 1
const SESSIONS_STORE = 'sessions'
const ANSWERS_STORE = 'exercise_answers'

export class DatabaseEngine {
  private db: IDBDatabase | null = null

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (): void => {
        const db = request.result

        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains(ANSWERS_STORE)) {
          const answersStore = db.createObjectStore(ANSWERS_STORE, { keyPath: 'id' })
          answersStore.createIndex('sessionId', 'sessionId', { unique: false })
          answersStore.createIndex('expectedNote', 'expectedNote', { unique: false })
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

  async saveSession(session: DbSessionRecord, answers: DbAnswerRecord[]): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

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

  async getAllSessions(): Promise<DbSessionRecord[]> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(SESSIONS_STORE, 'readonly')
      const store = tx.objectStore(SESSIONS_STORE)
      const request = store.getAll()

      request.onsuccess = (): void => {
        const sessions: DbSessionRecord[] = request.result || []
        // Ordenadas de más reciente a más antigua
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
            overallAvgTimeMs: 0
          })
          return
        }

        const totalExercises = sessions.reduce((acc, s) => acc + s.totalQuestions, 0)
        const totalAccuracy = sessions.reduce((acc, s) => acc + s.accuracyPercentage, 0)
        const totalTime = sessions.reduce((acc, s) => acc + s.avgResponseTimeMs, 0)

        resolve({
          totalSessions,
          totalExercises,
          overallAccuracy: Math.round(totalAccuracy / totalSessions),
          overallAvgTimeMs: Math.round(totalTime / totalSessions)
        })
      }

      request.onerror = (): void => reject(request.error)
    })
  }

  async clearDatabase(): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada.')

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([SESSIONS_STORE, ANSWERS_STORE], 'readwrite')
      tx.objectStore(SESSIONS_STORE).clear()
      tx.objectStore(ANSWERS_STORE).clear()

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
