import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { useDatabaseStore } from './useDatabaseStore'
import { DbSessionRecord } from '../domain/database/types'

describe('useDatabaseStore - Store Global de Persistencia con Zustand', () => {
  beforeEach(async () => {
    // Resetear el estado del store antes de cada test
    await useDatabaseStore.getState().initialize()
    await useDatabaseStore.getState().clearDatabase()
  })

  it('debe inicializarse con contadores en 0', () => {
    const summary = useDatabaseStore.getState().summary
    expect(summary.totalSessions).toBe(0)
    expect(summary.totalExercises).toBe(0)
  })

  it('debe actualizar el resumen global de forma reactiva al guardar una sesión', async () => {
    const mockSession: DbSessionRecord = {
      id: 'session_zustand_test',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Nivel 1',
      totalQuestions: 5,
      correctAnswers: 4,
      accuracyPercentage: 80,
      avgResponseTimeMs: 1400
    }

    await useDatabaseStore.getState().saveSession(mockSession, [])

    const summary = useDatabaseStore.getState().summary
    expect(summary.totalSessions).toBe(1)
    expect(summary.totalExercises).toBe(5)
    expect(summary.overallAccuracy).toBe(80)
  })

  it('debe resetear de forma atómica e inmediata a 0 al llamar a clearDatabase', async () => {
    const mockSession: DbSessionRecord = {
      id: 'session_temp',
      createdAt: new Date().toISOString(),
      strategyId: 'random',
      instrumentId: 'piano',
      presetName: 'Test',
      totalQuestions: 10,
      correctAnswers: 10,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000
    }

    await useDatabaseStore.getState().saveSession(mockSession, [])
    expect(useDatabaseStore.getState().summary.totalSessions).toBe(1)

    await useDatabaseStore.getState().clearDatabase()

    const summary = useDatabaseStore.getState().summary
    expect(summary.totalSessions).toBe(0)
    expect(summary.totalExercises).toBe(0)
    expect(summary.overallAccuracy).toBe(0)
  })
})
