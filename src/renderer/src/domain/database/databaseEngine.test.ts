import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import {
  DatabaseEngine,
  DB_VERSION,
  DB_NAME,
  AI_REPORTS_STORE,
  AI_CONSULTATIONS_STORE
} from './databaseEngine'
import {
  DbSessionRecord,
  DbAnswerRecord,
  DbAiReportRecord,
  DbAiConsultationRecord,
  DatabaseBackupPayload
} from './types'

function openRawDatabase(
  name: string,
  version: number,
  onUpgrade: (db: IDBDatabase) => void
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)
    request.onupgradeneeded = (): void => onUpgrade(request.result)
    request.onsuccess = (): void => resolve(request.result)
    request.onerror = (): void => reject(request.error)
  })
}

function deleteRawDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = (): void => resolve()
    request.onerror = (): void => reject(request.error)
  })
}

function putRawRecords<T>(db: IDBDatabase, storeName: string, records: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    records.forEach((record) => store.put(record))
    tx.oncomplete = (): void => resolve()
    tx.onerror = (): void => reject(tx.error)
  })
}

async function probeStoreIndexes(storeNames: string[]): Promise<Record<string, string[]>> {
  const db = await openRawDatabase(DB_NAME, DB_VERSION, (): void => {})
  const indexes: Record<string, string[]> = {}
  storeNames.forEach((name) => {
    const names = db.transaction(name, 'readonly').objectStore(name).indexNames
    const list: string[] = []
    for (let i = 0; i < names.length; i++) {
      list.push(names.item(i) as string)
    }
    indexes[name] = list
  })
  db.close()
  return indexes
}

describe('databaseEngine - Persistencia IndexedDB Nativa y Multistore', () => {
  let engine: DatabaseEngine

  beforeEach(async () => {
    engine = new DatabaseEngine()
    await engine.initialize()
  })

  afterEach(async () => {
    await engine.clearDatabase()
    engine.close()
  })

  it('debe inicializarse con la versión canónica y resumen en 0', async () => {
    expect(engine.getVersion()).toBe(DB_VERSION)
    expect(DB_VERSION).toBe(6)
    const summary = await engine.getSummary()
    expect(summary.totalSessions).toBe(0)
    expect(summary.totalExercises).toBe(0)
    expect(summary.totalDurationSeconds).toBe(0)
  })

  it('getVersion debe retornar 0 si la base de datos no fue abierta', () => {
    const uninitEngine = new DatabaseEngine()
    expect(uninitEngine.getVersion()).toBe(0)
  })

  it('debe lanzar error en métodos si la base de datos no fue inicializada', async () => {
    const closedEngine = new DatabaseEngine()

    await expect(closedEngine.saveSession({} as DbSessionRecord, [])).rejects.toThrow(
      /no inicializada/i
    )
    await expect(closedEngine.deleteSessions(['1'])).rejects.toThrow(/no inicializada/i)
    await expect(closedEngine.saveAiReport({} as DbAiReportRecord)).rejects.toThrow(
      /no inicializada/i
    )
    await expect(closedEngine.saveAiConsultation({} as DbAiConsultationRecord)).rejects.toThrow(
      /no inicializada/i
    )
    await expect(closedEngine.getAllAiConsultations()).rejects.toThrow(/no inicializada/i)
    await expect(closedEngine.getAllAiReports()).rejects.toThrow(/no inicializada/i)
    await expect(closedEngine.getAllSessions()).rejects.toThrow(/no inicializada/i)
    await expect(closedEngine.getAllAnswers()).rejects.toThrow(/no inicializada/i)
    await expect(closedEngine.getSummary()).rejects.toThrow(/no inicializada/i)
    await expect(closedEngine.exportDatabase()).rejects.toThrow(/no inicializada/i)
    await expect(closedEngine.importDatabase({} as DatabaseBackupPayload)).rejects.toThrow(
      /no inicializada/i
    )
    await expect(closedEngine.clearDatabase()).rejects.toThrow(/no inicializada/i)
  })

  it('debe persistir targetMode canónico en los registros de sesión', async () => {
    const s: DbSessionRecord = {
      id: 'session_target_mode_test',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'violin',
      presetName: 'Test Canónico',
      totalQuestions: 5,
      correctAnswers: 5,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 30,
      targetMode: 'intervals'
    }

    await engine.saveSession(s, [])
    const sessions = await engine.getAllSessions()
    expect(sessions.length).toBe(1)
    expect(sessions[0].targetMode).toBe('intervals')
  })

  it('debe calcular el promedio ponderado exacto por volumen de preguntas', async () => {
    const s1: DbSessionRecord = {
      id: 's1',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Nivel 1',
      totalQuestions: 10,
      correctAnswers: 10,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 20
    }

    const s2: DbSessionRecord = {
      id: 's2',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Nivel 3',
      totalQuestions: 90,
      correctAnswers: 45,
      accuracyPercentage: 50,
      avgResponseTimeMs: 2000,
      durationSeconds: 180
    }

    await engine.saveSession(s1, [])
    await engine.saveSession(s2, [])

    const summary = await engine.getSummary()
    expect(summary.totalSessions).toBe(2)
    expect(summary.totalExercises).toBe(100)
    expect(summary.overallAccuracy).toBe(55)
    expect(summary.overallAvgTimeMs).toBe(1900)
    expect(summary.totalDurationSeconds).toBe(200)
  })

  it('debe guardar y recuperar informes de IA', async () => {
    const mockReport: DbAiReportRecord = {
      id: 'ai_1',
      createdAt: new Date().toISOString(),
      modelName: 'qwen3.5',
      modeFilter: 'single_note',
      analysisText: 'Excelente progreso.',
      prescription: {
        title: 'Ejercicio Test',
        rationale: 'Refuerzo',
        targetMode: 'single_note',
        instrumentId: 'acoustic_grand_piano',
        recommendedNotes: [60, 62],
        limitType: 'questions',
        questionsCount: 10,
        durationMinutes: 5,
        advanceMode: 'smart'
      }
    }

    await engine.saveAiReport(mockReport)
    const reports = await engine.getAllAiReports()
    expect(reports.length).toBe(1)
    expect(reports[0].prescription.title).toBe('Ejercicio Test')
  })

  it('debe guardar y recuperar consultas del tutor IA de forma persistente', async () => {
    const mockConsultation: DbAiConsultationRecord = {
      id: 'consult_test_1',
      createdAt: new Date().toISOString(),
      modelName: 'qwen3.5-9b',
      modeFilter: 'single_note',
      userQuery: '¿Por qué aumenta mi latencia en notas agudas?',
      aiResponse: 'Explicación clínica detallada sobre fatiga y armónicos...',
      associatedMetricsSnapshot: {
        overallAccuracy: 85,
        normalizedAccuracy: 82,
        avgLatencyMs: 1450,
        poolEntropyBits: 2.5
      }
    }

    await engine.saveAiConsultation(mockConsultation)
    const consultations = await engine.getAllAiConsultations()

    expect(consultations.length).toBe(1)
    expect(consultations[0].userQuery).toBe('¿Por qué aumenta mi latencia en notas agudas?')
  })

  it('deleteSessions no debe fallar si se pasa un array vacío', async () => {
    await expect(engine.deleteSessions([])).resolves.toBeUndefined()
  })

  it('deleteSession individual debe invocar deleteSessions', async () => {
    const deleteSpy = vi.spyOn(engine, 'deleteSessions')
    await engine.deleteSession('s_single_del')
    expect(deleteSpy).toHaveBeenCalledWith(['s_single_del'])
  })

  it('exportDatabase e importDatabase deben manejar respaldos completos y validar errores de formato', async () => {
    const session: DbSessionRecord = {
      id: 'sess_export_test',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Backup Test',
      totalQuestions: 2,
      correctAnswers: 2,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 15
    }

    await engine.saveSession(session, [])
    const backup = await engine.exportDatabase()
    expect(backup.sessions.length).toBe(1)
    expect(backup.version).toBe(6)

    // Sesión previa ajena al backup: debe desaparecer tras un replace exitoso
    const sesionPrevia: DbSessionRecord = {
      id: 'session_previa_a_borrar',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Sesión Prevía',
      totalQuestions: 3,
      correctAnswers: 1,
      accuracyPercentage: 33,
      avgResponseTimeMs: 800,
      durationSeconds: 10
    }
    await engine.saveSession(sesionPrevia, [])

    // Rechazar payloads corruptos
    await expect(engine.importDatabase(null as unknown as DatabaseBackupPayload)).rejects.toThrow(
      /inválido/i
    )
    await expect(engine.importDatabase({} as DatabaseBackupPayload)).rejects.toThrow(
      /colecciones válidas/i
    )

    // Importar en modo replace
    const result = await engine.importDatabase(backup, 'replace')
    expect(result.success).toBe(true)
    expect(result.sessionsImported).toBe(1)

    // El vaciado (.clear()) previo a la inserción debe haber eliminado la sesión ajena al backup
    const sesionesTrasReplace = await engine.getAllSessions()
    expect(sesionesTrasReplace.map((s) => s.id)).not.toContain('session_previa_a_borrar')
    expect(sesionesTrasReplace.map((s) => s.id)).toContain('sess_export_test')
  })

  it('replace: un aborto en la fase de inserción preserva los datos previos (rollback atómico)', async () => {
    // Siembra de datos previos: sesión con respuesta hija y reporte de IA
    const session: DbSessionRecord = {
      id: 'session_previa_rollback',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Datos Previos',
      totalQuestions: 4,
      correctAnswers: 3,
      accuracyPercentage: 75,
      avgResponseTimeMs: 1200,
      durationSeconds: 40
    }

    const answer: DbAnswerRecord = {
      id: 'answer_previa_rollback',
      sessionId: session.id,
      questionIndex: 1,
      expectedNote: 60,
      playedNote: 62,
      isCorrect: true,
      semitoneDistance: 2,
      responseTimeMs: 900,
      velocity: 80,
      reasonTelemetry: 'stable_recall',
      createdAt: new Date().toISOString()
    }

    const report: DbAiReportRecord = {
      id: 'report_previo_rollback',
      createdAt: new Date().toISOString(),
      modelName: 'qwen3.5',
      modeFilter: 'single_note',
      analysisText: 'Informe previo a la importación fallida.',
      prescription: {
        title: 'Ejercicio Previo',
        rationale: 'Refuerzo histórico',
        targetMode: 'single_note',
        instrumentId: 'acoustic_grand_piano',
        recommendedNotes: [60, 62],
        limitType: 'questions',
        questionsCount: 10,
        durationMinutes: 5,
        advanceMode: 'smart'
      }
    }

    await engine.saveSession(session, [answer])
    await engine.saveAiReport(report)

    expect((await engine.getAllSessions()).length).toBe(1)
    expect((await engine.getAllAnswers()).length).toBe(1)
    expect((await engine.getAllAiReports()).length).toBe(1)
    const summaryPrevio = await engine.getSummary()

    // Intercepción del handle interno: abortar la primera transacción readwrite
    // que emita un put (la fase de inserción), simulando un QuotaExceededError.
    const engineWithDb = engine as unknown as { db: IDBDatabase }
    const db = engineWithDb.db
    const realTransaction = db.transaction.bind(db)
    let importTxAbortada = false

    db.transaction = ((
      storeNames: string | string[],
      mode?: IDBTransactionMode
    ): IDBTransaction => {
      const tx = realTransaction(storeNames, mode)
      if (mode === 'readwrite' && !importTxAbortada) {
        const realObjectStore = tx.objectStore.bind(tx)
        tx.objectStore = ((name: string): IDBObjectStore => {
          const store = realObjectStore(name)
          if (!importTxAbortada) {
            const realPut = store.put.bind(store)
            store.put = ((value: unknown): IDBRequest => {
              importTxAbortada = true
              queueMicrotask(() => tx.abort())
              return realPut(value)
            }) as typeof store.put
          }
          return store
        }) as typeof tx.objectStore
      }
      return tx
    }) as typeof db.transaction

    const backup: DatabaseBackupPayload = {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      summary: summaryPrevio,
      sessions: [
        {
          id: 'session_nueva_reemplazo',
          createdAt: new Date().toISOString(),
          strategyId: 'adaptive_v1',
          instrumentId: 'violin',
          presetName: 'Reemplazo Fallido',
          totalQuestions: 10,
          correctAnswers: 10,
          accuracyPercentage: 100,
          avgResponseTimeMs: 500,
          durationSeconds: 60
        }
      ],
      answers: [],
      aiReports: [],
      aiConsultations: []
    }

    // La importación abortada debe rechazarse...
    await expect(engine.importDatabase(backup, 'replace')).rejects.toThrow()

    // ...y los datos previos deben seguir íntegros: el vaciado se revirtió atómicamente
    const sessionsTrasFallo = await engine.getAllSessions()
    const answersTrasFallo = await engine.getAllAnswers()
    const reportsTrasFallo = await engine.getAllAiReports()

    expect(sessionsTrasFallo.length).toBe(1)
    expect(sessionsTrasFallo[0].id).toBe(session.id)
    expect(answersTrasFallo.length).toBe(1)
    expect(answersTrasFallo[0].id).toBe(answer.id)
    expect(reportsTrasFallo.length).toBe(1)
    expect(reportsTrasFallo[0].id).toBe(report.id)
    expect(await engine.getSummary()).toEqual(summaryPrevio)
  })

  it('debe rechazar guardar sesiones o respuestas inválidas', async () => {
    await expect(engine.saveSession({ id: '' } as DbSessionRecord, [])).rejects.toThrow(/inválido/i)
    await expect(engine.saveAiReport({ id: '' } as DbAiReportRecord)).rejects.toThrow(/inválido/i)
    await expect(engine.saveAiConsultation({ id: '' } as DbAiConsultationRecord)).rejects.toThrow(
      /inválido/i
    )
  })

  it('debe crear los índices secundarios de IA en el esquema v6', async () => {
    const indexes = await probeStoreIndexes([AI_REPORTS_STORE, AI_CONSULTATIONS_STORE])

    expect(indexes[AI_REPORTS_STORE]).toContain('createdAt')
    expect(indexes[AI_REPORTS_STORE]).toContain('modeFilter')
    expect(indexes[AI_CONSULTATIONS_STORE]).toContain('createdAt')
    expect(indexes[AI_CONSULTATIONS_STORE]).toContain('modeFilter')
  })

  it('debe migrar bases v5 existentes sin pérdida de datos', async () => {
    const legacyReport: DbAiReportRecord = {
      id: 'report_v5_legacy',
      createdAt: new Date().toISOString(),
      modelName: 'qwen3.5',
      modeFilter: 'intervals',
      analysisText: 'Informe heredado de la versión 5.',
      prescription: {
        title: 'Ejercicio Heredado',
        rationale: 'Refuerzo histórico',
        targetMode: 'intervals',
        instrumentId: 'acoustic_grand_piano',
        recommendedNotes: [60, 65],
        limitType: 'questions',
        questionsCount: 8,
        durationMinutes: 4,
        advanceMode: 'smart'
      }
    }

    const legacyConsultation: DbAiConsultationRecord = {
      id: 'consultation_v5_legacy',
      createdAt: new Date().toISOString(),
      modelName: 'qwen3.5-9b',
      modeFilter: 'sequences',
      userQuery: '¿Cómo mejoro mi precisión en secuencias largas?',
      aiResponse: 'Respuesta heredada de la versión 5.'
    }

    engine.close()
    await deleteRawDatabase(DB_NAME)

    // Simular una base v5 existente: almacenes de IA sin índices secundarios
    const v5Db = await openRawDatabase(DB_NAME, 5, (db) => {
      db.createObjectStore(AI_REPORTS_STORE, { keyPath: 'id' })
      db.createObjectStore(AI_CONSULTATIONS_STORE, { keyPath: 'id' })
    })
    await putRawRecords(v5Db, AI_REPORTS_STORE, [legacyReport])
    await putRawRecords(v5Db, AI_CONSULTATIONS_STORE, [legacyConsultation])
    v5Db.close()

    // Reapertura con el motor v6: onupgradeneeded crea los índices sobre los stores
    await engine.initialize()
    expect(engine.getVersion()).toBe(6)

    const migratedReports = await engine.getAllAiReports()
    const migratedConsultations = await engine.getAllAiConsultations()
    expect(migratedReports.length).toBe(1)
    expect(migratedReports[0].id).toBe('report_v5_legacy')
    expect(migratedConsultations.length).toBe(1)
    expect(migratedConsultations[0].id).toBe('consultation_v5_legacy')

    const indexes = await probeStoreIndexes([AI_REPORTS_STORE, AI_CONSULTATIONS_STORE])
    expect(indexes[AI_REPORTS_STORE]).toContain('createdAt')
    expect(indexes[AI_REPORTS_STORE]).toContain('modeFilter')
    expect(indexes[AI_CONSULTATIONS_STORE]).toContain('createdAt')
    expect(indexes[AI_CONSULTATIONS_STORE]).toContain('modeFilter')
  })

  it('la creación de índices de IA es idempotente y no falla si ya existen', async () => {
    engine.close()
    await deleteRawDatabase(DB_NAME)

    // Base v5 que ya contiene los índices (p. ej., migración parcial previa)
    const partialDb = await openRawDatabase(DB_NAME, 5, (db) => {
      const reports = db.createObjectStore(AI_REPORTS_STORE, { keyPath: 'id' })
      reports.createIndex('createdAt', 'createdAt', { unique: false })
      reports.createIndex('modeFilter', 'modeFilter', { unique: false })
      const consultations = db.createObjectStore(AI_CONSULTATIONS_STORE, { keyPath: 'id' })
      consultations.createIndex('createdAt', 'createdAt', { unique: false })
      consultations.createIndex('modeFilter', 'modeFilter', { unique: false })
    })
    partialDb.close()

    await expect(engine.initialize()).resolves.toBeUndefined()
    expect(engine.getVersion()).toBe(6)

    const indexes = await probeStoreIndexes([AI_REPORTS_STORE, AI_CONSULTATIONS_STORE])
    expect(indexes[AI_REPORTS_STORE]).toContain('createdAt')
    expect(indexes[AI_CONSULTATIONS_STORE]).toContain('modeFilter')
  })
})
