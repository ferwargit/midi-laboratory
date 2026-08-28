import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { useDatabaseStore } from './useDatabaseStore'
import { useAnalyticsStore } from './useAnalyticsStore'
import { useAiStore } from './useAiStore'
import { DbAnswerRecord, DbSessionRecord } from '../domain/database/types'

describe('s3-store-segmentation - Segmentación de Responsabilidades en Stores', () => {
  const mockSession: DbSessionRecord = {
    id: 's1',
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

  const mockAnswers: DbAnswerRecord[] = [
    {
      id: 'a1',
      sessionId: 's1',
      questionIndex: 1,
      expectedNote: 60,
      playedNote: 60,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 900,
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    }
  ]

  beforeEach(async () => {
    await useDatabaseStore.getState().initialize()
    await useDatabaseStore.getState().clearDatabase()
    useAiStore.setState({
      aiResponsesByMode: {
        all: null,
        single_note: null,
        intervals: null,
        sequences: null,
        repertoire: null
      },
      isAiAnalyzing: false,
      isLmStudioOnline: false
    })
  })

  it('analytics store recomputes on data change: el store analítico recalcula métricas al recibir nuevos datos', () => {
    const analyticsStore = useAnalyticsStore.getState()

    analyticsStore.recomputeMetrics([], [])
    expect(analyticsStore.metrics.totalAnswers).toBe(0)

    analyticsStore.recomputeMetrics([mockSession], mockAnswers)
    const updated = useAnalyticsStore.getState().metrics

    expect(updated.totalAnswers).toBe(1)
    expect(updated.overallAccuracy).toBe(100)
  })

  it('AI store isolated from practice state: el store de IA opera de forma aislada sin contaminar DB ni analítica', () => {
    const aiStore = useAiStore.getState()

    expect(aiStore.isAiAnalyzing).toBe(false)
    expect(aiStore.aiResponsesByMode.single_note).toBeNull()

    // Modificar estado de IA no altera la base de datos ni los contadores
    aiStore.setAiResponseForMode('single_note', {
      source: 'algorithmic_fallback',
      modelName: 'MockModel',
      analysisText: 'Análisis aislado',
      prescription: {
        title: 'Test Prescripción',
        rationale: 'Aislamiento de estado',
        targetMode: 'single_note',
        instrumentId: 'acoustic_grand_piano',
        recommendedNotes: [60, 62],
        limitType: 'questions',
        questionsCount: 10,
        durationMinutes: 5,
        advanceMode: 'smart'
      }
    })

    expect(useAiStore.getState().aiResponsesByMode.single_note?.modelName).toBe('MockModel')
    expect(useDatabaseStore.getState().summary.totalSessions).toBe(0) // DB permanece intacta en 0
  })
})
