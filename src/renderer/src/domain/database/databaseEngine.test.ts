import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DatabaseEngine } from './databaseEngine'
import { DbAnswerRecord, DbSessionRecord, DbAiReportRecord } from './types'

describe('databaseEngine - Persistencia IndexedDB Nativa', () => {
  let engine: DatabaseEngine

  beforeEach(async () => {
    engine = new DatabaseEngine()
    await engine.initialize()
  })

  afterEach(async () => {
    await engine.clearDatabase()
    engine.close()
  })

  it('debe inicializarse y devolver resumen en 0', async () => {
    const summary = await engine.getSummary()
    expect(summary.totalSessions).toBe(0)
    expect(summary.totalExercises).toBe(0)
    expect(summary.totalDurationSeconds).toBe(0)
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
})
