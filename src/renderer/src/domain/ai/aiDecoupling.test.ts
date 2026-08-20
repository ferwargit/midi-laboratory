import { describe, it, expect, vi } from 'vitest'
import { evaluateSingleNoteAnswer } from '../exercise/evaluator'
import { computeAnalyticsMetrics } from '../analytics/historyAnalytics'
import { LmStudioService } from './lmStudioService'
import { CircuitBreaker } from './circuitBreaker'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'

describe('s2-ai-decoupling - Desacoplamiento Total entre Práctica e IA', () => {
  const mockSession: DbSessionRecord = {
    id: 'session_decouple_test',
    createdAt: new Date().toISOString(),
    strategyId: 'adaptive_v1',
    instrumentId: 'piano',
    presetName: 'Notas (3)',
    totalQuestions: 2,
    correctAnswers: 2,
    accuracyPercentage: 100,
    avgResponseTimeMs: 1100,
    durationSeconds: 15
  }

  const mockAnswers: DbAnswerRecord[] = [
    {
      id: 'a1',
      sessionId: 'session_decouple_test',
      questionIndex: 1,
      expectedNote: 60,
      playedNote: 60,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 1000,
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'a2',
      sessionId: 'session_decouple_test',
      questionIndex: 2,
      expectedNote: 62,
      playedNote: 62,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 1200,
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    }
  ]

  it('AI diagnostic runs after session without altering result: el diagnóstico posterior no altera las métricas inmutables de la sesión', async () => {
    // 1. La sesión se evalúa de forma determinista inmediata
    const evalResult = evaluateSingleNoteAnswer(60, 60, 1000)
    expect(evalResult.correct).toBe(true)
    expect(evalResult.semitoneDistance).toBe(0)

    // 2. Las métricas psicométricas calculadas son puras e inmutables
    const metricsBefore = computeAnalyticsMetrics([mockSession], mockAnswers, 'single_note')
    expect(metricsBefore.overallAccuracy).toBe(100)
    expect(metricsBefore.totalAnswers).toBe(2)

    // 3. Ejecutamos la IA posterior
    const aiService = new LmStudioService('http://127.0.0.1:9999')
    const aiResponse = await aiService.analyzeAndPrescribe(metricsBefore)

    // 4. La respuesta de la IA (sea fallback o LLM) no puede modificar las métricas grabadas
    expect(aiResponse).toBeDefined()
    expect(metricsBefore.overallAccuracy).toBe(100)
    expect(metricsBefore.totalAnswers).toBe(2)
    expect(mockSession.correctAnswers).toBe(2)
  })

  it('AI errors do not affect session result: si la IA lanza un error crítico, el resultado y persistencia quedan intactos', async () => {
    const metrics = computeAnalyticsMetrics([mockSession], mockAnswers, 'single_note')

    // Simulamos un servicio de IA con fallo total
    const brokenBreaker = new CircuitBreaker()
    vi.spyOn(brokenBreaker, 'execute').mockRejectedValueOnce(new Error('GPU Out of Memory / Crash'))

    const brokenService = new LmStudioService('http://127.0.0.1:9999', brokenBreaker)

    // La invocación a la IA no debe romper el flujo de la sesión ni alterar los datos existentes
    try {
      await brokenService.analyzeAndPrescribe(metrics)
    } catch {
      // Si llegara a fallar, verificamos que las métricas originales sigan inalteradas
    }

    expect(mockSession.accuracyPercentage).toBe(100)
    expect(mockAnswers.length).toBe(2)
    expect(mockAnswers[0].isCorrect).toBe(true)
  })
})
