import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { DatabaseEngine } from './databaseEngine'
import { DbAnswerRecord, DbSessionRecord } from './types'

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
  })

  it('debe guardar sesión incluyendo el ID del instrumento y actualizar estadísticas', async () => {
    const mockSession: DbSessionRecord = {
      id: 'session_flute_1',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'flute',
      presetName: 'Rango C4 a C6',
      totalQuestions: 2,
      correctAnswers: 2,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1200
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
    expect(summary.overallAccuracy).toBe(100)
    expect(summary.overallAvgTimeMs).toBe(1200)
  })

  it('debe acumular múltiples sesiones calculando el promedio histórico correcto', async () => {
    const s1: DbSessionRecord = {
      id: 's1',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Nivel 1',
      totalQuestions: 10,
      correctAnswers: 10,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000
    }
    const s2: DbSessionRecord = {
      id: 's2',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'violin',
      presetName: 'Nivel 1',
      totalQuestions: 10,
      correctAnswers: 6,
      accuracyPercentage: 60,
      avgResponseTimeMs: 2000
    }

    await engine.saveSession(s1, [])
    await engine.saveSession(s2, [])

    const summary = await engine.getSummary()
    expect(summary.totalSessions).toBe(2)
    expect(summary.totalExercises).toBe(20)
    expect(summary.overallAccuracy).toBe(80) // (100 + 60) / 2
    expect(summary.overallAvgTimeMs).toBe(1500) // (1000 + 2000) / 2
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
        avgResponseTimeMs: 1000
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
