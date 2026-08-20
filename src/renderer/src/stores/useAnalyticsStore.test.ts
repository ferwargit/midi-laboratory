import { describe, it, expect } from 'vitest'
import { useAnalyticsStore } from './useAnalyticsStore'
import { DbAnswerRecord, DbSessionRecord } from '../domain/database/types'

describe('useAnalyticsStore - Store de Analítica y Segmentación por Modalidad', () => {
  const sNote: DbSessionRecord = {
    id: 's_note',
    createdAt: new Date().toISOString(),
    strategyId: 'adaptive_v1',
    instrumentId: 'piano',
    presetName: 'Notas (3)',
    totalQuestions: 2,
    correctAnswers: 2,
    accuracyPercentage: 100,
    avgResponseTimeMs: 1000,
    durationSeconds: 10
  }

  const sInterval: DbSessionRecord = {
    id: 's_int',
    createdAt: new Date().toISOString(),
    strategyId: 'intervals_v1',
    instrumentId: 'piano_intervals',
    presetName: 'Intervalos (4)',
    totalQuestions: 4,
    correctAnswers: 2,
    accuracyPercentage: 50,
    avgResponseTimeMs: 2000,
    durationSeconds: 20
  }

  const answers: DbAnswerRecord[] = [
    {
      id: 'a1',
      sessionId: 's_note',
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
      id: 'a2',
      sessionId: 's_int',
      questionIndex: 1,
      expectedNote: 64,
      playedNote: 65,
      isCorrect: false,
      semitoneDistance: 1,
      responseTimeMs: 2200,
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    }
  ]

  it('debe recalcular métricas correctamente al cambiar de filtro de modalidad', () => {
    const store = useAnalyticsStore.getState()

    // Filtro Global
    store.setModeFilter('all', [sNote, sInterval], answers)
    expect(useAnalyticsStore.getState().metrics.totalAnswers).toBe(2)

    // Filtro Solo Notas
    store.setModeFilter('single_note', [sNote, sInterval], answers)
    const noteMetrics = useAnalyticsStore.getState().metrics
    expect(noteMetrics.totalAnswers).toBe(1)
    expect(noteMetrics.overallAccuracy).toBe(100)

    // Filtro Solo Intervalos
    store.setModeFilter('intervals', [sNote, sInterval], answers)
    const intMetrics = useAnalyticsStore.getState().metrics
    expect(intMetrics.totalAnswers).toBe(1)
    expect(intMetrics.overallAccuracy).toBe(0)
  })
})
