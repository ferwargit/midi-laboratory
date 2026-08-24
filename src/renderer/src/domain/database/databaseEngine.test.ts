import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DatabaseEngine, DB_VERSION } from './databaseEngine'
import { DbAnswerRecord, DbSessionRecord, DbAiReportRecord, DbAiConsultationRecord } from './types'

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
    expect(DB_VERSION).toBe(5)
    const summary = await engine.getSummary()
    expect(summary.totalSessions).toBe(0)
    expect(summary.totalExercises).toBe(0)
    expect(summary.totalDurationSeconds).toBe(0)
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
    // Sesión 1: 10 preguntas, 10 aciertos (100% de precisión, tiempo 1000ms)
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

    // Sesión 2: 90 preguntas, 45 aciertos (50% de precisión, tiempo 2000ms)
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

    // Total aciertos: 10 + 45 = 55 de 100 -> Precisión ponderada = exactamente 55% (no 75%)
    expect(summary.overallAccuracy).toBe(55)

    // Tiempo medio ponderado: (10*1000 + 90*2000) / 100 = 1900ms
    expect(summary.overallAvgTimeMs).toBe(1900)
    expect(summary.totalDurationSeconds).toBe(200)
  })

  it('debe guardar sesión incluyendo duración en segundos', async () => {
    const mockSession: DbSessionRecord = {
      id: 'session_flute_1',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'flute',
      presetName: 'Rango C4 a C6',
      totalQuestions: 2,
      correctAnswers: 2,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1200,
      durationSeconds: 45
    }

    const mockAnswers: DbAnswerRecord[] = [
      {
        id: 'ans_1',
        sessionId: 'session_flute_1',
        questionIndex: 1,
        expectedNote: 60,
        playedNote: 60,
        isCorrect: true,
        semitoneDistance: 0,
        responseTimeMs: 1100,
        velocity: 90,
        reasonTelemetry: 'Exploración',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ans_2',
        sessionId: 'session_flute_1',
        questionIndex: 2,
        expectedNote: 64,
        playedNote: 64,
        isCorrect: true,
        semitoneDistance: 0,
        responseTimeMs: 1300,
        velocity: 90,
        reasonTelemetry: 'Exploración',
        createdAt: new Date().toISOString()
      }
    ]

    await engine.saveSession(mockSession, mockAnswers)

    const summary = await engine.getSummary()
    expect(summary.totalSessions).toBe(1)
    expect(summary.totalExercises).toBe(2)
    expect(summary.totalDurationSeconds).toBe(45)
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

  it('debe permitir resetear la base de datos limpiamente', async () => {
    await engine.saveSession(
      {
        id: 'session_temp',
        createdAt: new Date().toISOString(),
        strategyId: 'random',
        instrumentId: 'acoustic_grand_piano',
        presetName: 'Test',
        totalQuestions: 1,
        correctAnswers: 1,
        accuracyPercentage: 100,
        avgResponseTimeMs: 1000,
        durationSeconds: 30
      },
      []
    )

    const summaryBefore = await engine.getSummary()
    expect(summaryBefore.totalSessions).toBe(1)

    await engine.clearDatabase()
    const summaryAfter = await engine.getSummary()
    expect(summaryAfter.totalSessions).toBe(0)
    expect(summaryAfter.totalExercises).toBe(0)
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
    expect(consultations[0].associatedMetricsSnapshot?.normalizedAccuracy).toBe(82)
  })

  it('deleteSession debe eliminar la sesión y todas sus respuestas en cascada', async () => {
    const session: DbSessionRecord = {
      id: 'session_to_delete',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Test',
      totalQuestions: 2,
      correctAnswers: 2,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 10
    }

    const answers: DbAnswerRecord[] = [
      {
        id: 'ans_del_1',
        sessionId: 'session_to_delete',
        questionIndex: 1,
        expectedNote: 60,
        playedNote: 60,
        isCorrect: true,
        semitoneDistance: 0,
        responseTimeMs: 900,
        velocity: 90,
        reasonTelemetry: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ans_del_2',
        sessionId: 'session_to_delete',
        questionIndex: 2,
        expectedNote: 62,
        playedNote: 62,
        isCorrect: true,
        semitoneDistance: 0,
        responseTimeMs: 1100,
        velocity: 90,
        reasonTelemetry: '',
        createdAt: new Date().toISOString()
      }
    ]

    await engine.saveSession(session, answers)
    expect((await engine.getAllSessions()).length).toBe(1)
    expect((await engine.getAllAnswers()).length).toBe(2)

    // Borrado individual en cascada
    await engine.deleteSession('session_to_delete')

    expect((await engine.getAllSessions()).length).toBe(0)
    expect((await engine.getAllAnswers()).length).toBe(0)
  })

  it('deleteSessions debe eliminar múltiples sesiones y sus respuestas por lote', async () => {
    const s1: DbSessionRecord = {
      id: 's_batch_1',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'T1',
      totalQuestions: 1,
      correctAnswers: 1,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 10
    }
    const s2: DbSessionRecord = {
      id: 's_batch_2',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'T2',
      totalQuestions: 1,
      correctAnswers: 1,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 10
    }

    await engine.saveSession(s1, [])
    await engine.saveSession(s2, [])
    expect((await engine.getAllSessions()).length).toBe(2)

    // Borrado por lote
    await engine.deleteSessions(['s_batch_1', 's_batch_2'])
    expect((await engine.getAllSessions()).length).toBe(0)
  })

  it('exportDatabase e importDatabase deben serializar y restaurar fielmente la base de datos', async () => {
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

    const answer: DbAnswerRecord = {
      id: 'ans_export_test',
      sessionId: 'sess_export_test',
      questionIndex: 1,
      expectedNote: 60,
      playedNote: 60,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 950,
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    }

    await engine.saveSession(session, [answer])

    const backup = await engine.exportDatabase()
    expect(backup.sessions.length).toBe(1)
    expect(backup.answers.length).toBe(1)
    expect(backup.sessions[0].id).toBe('sess_export_test')

    // Limpiamos la base
    await engine.clearDatabase()
    expect((await engine.getAllSessions()).length).toBe(0)

    // Importamos el backup
    const importResult = await engine.importDatabase(backup, 'replace')
    expect(importResult.success).toBe(true)
    expect(importResult.sessionsImported).toBe(1)
    expect(importResult.answersImported).toBe(1)

    const restoredSessions = await engine.getAllSessions()
    expect(restoredSessions.length).toBe(1)
    expect(restoredSessions[0].id).toBe('sess_export_test')
  })
})
