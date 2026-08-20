import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DatabaseEngine, DB_VERSION } from './databaseEngine'
import { DbAnswerRecord, DbSessionRecord, DbAiReportRecord } from './types'

describe('s3-db-validation - Validación de Integridad de Persistencia en IndexedDB', () => {
  let engine: DatabaseEngine

  beforeEach(async () => {
    engine = new DatabaseEngine()
    await engine.initialize()
  })

  afterEach(async () => {
    await engine.clearDatabase()
    engine.close()
  })

  it('initialize creates schema version: la base de datos se inicializa con la versión de esquema canónica', () => {
    expect(engine.getVersion()).toBe(DB_VERSION)
  })

  it('saveSession rejects invalid answer: debe rechazar y abortar si una respuesta tiene datos corruptos', async () => {
    const validSession: DbSessionRecord = {
      id: 'valid_sess',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Notas (3)',
      totalQuestions: 1,
      correctAnswers: 1,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1200,
      durationSeconds: 15
    }

    const corruptAnswer = {
      id: 'ans_corrupt',
      sessionId: 'valid_sess',
      questionIndex: 1,
      expectedNote: -99, // Nota MIDI fuera de rango
      playedNote: 60,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: -500, // Tiempo negativo corrupto
      velocity: 90,
      reasonTelemetry: '',
      createdAt: 'invalid_date'
    } as unknown as DbAnswerRecord

    await expect(engine.saveSession(validSession, [corruptAnswer])).rejects.toThrow(
      /inválido o corrupto/i
    )

    // Comprobamos que no se haya guardado la sesión corrupta
    const sessions = await engine.getAllSessions()
    expect(sessions.length).toBe(0)
  })

  it('saveSession rejects invalid session: debe rechazar si la cabecera de sesión es corrupta', async () => {
    const invalidSession = {
      id: '',
      totalQuestions: -5
    } as unknown as DbSessionRecord

    await expect(engine.saveSession(invalidSession, [])).rejects.toThrow(/inválido/i)
  })

  it('clearDatabase removes all stores: elimina atómicamente sesiones, respuestas e informes de IA', async () => {
    const session: DbSessionRecord = {
      id: 's_test',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Test',
      totalQuestions: 1,
      correctAnswers: 1,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 10
    }
    const report: DbAiReportRecord = {
      id: 'rep_test',
      createdAt: new Date().toISOString(),
      modelName: 'qwen',
      modeFilter: 'all',
      analysisText: 'Reporte',
      prescription: {
        title: 'T',
        rationale: 'R',
        targetMode: 'single_note',
        instrumentId: 'acoustic_grand_piano',
        recommendedNotes: [60, 62],
        limitType: 'questions',
        questionsCount: 5,
        durationMinutes: 3,
        advanceMode: 'smart'
      }
    }

    await engine.saveSession(session, [])
    await engine.saveAiReport(report)

    expect((await engine.getAllSessions()).length).toBe(1)
    expect((await engine.getAllAiReports()).length).toBe(1)

    // Ejecutamos limpieza completa
    await engine.clearDatabase()

    expect((await engine.getAllSessions()).length).toBe(0)
    expect((await engine.getAllAnswers()).length).toBe(0)
    expect((await engine.getAllAiReports()).length).toBe(0)
  })
})
