import { describe, it, expect } from 'vitest'
import { computeAnalyticsMetrics } from './historyAnalytics'
import { generateDiagnosticReport } from './diagnosticReportGenerator'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'

describe('historyAnalytics - Motor de Diagnóstico Psicoacústico', () => {
  it('debe devolver métricas en 0 cuando no hay respuestas', () => {
    const metrics = computeAnalyticsMetrics([], [])
    expect(metrics.totalAnswers).toBe(0)
    expect(metrics.overallAccuracy).toBe(0)
  })

  it('debe calcular correctamente sesgos de semitono, confusiones y velocidades', () => {
    const mockSession: DbSessionRecord = {
      id: 's1',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Test',
      totalQuestions: 3,
      correctAnswers: 1,
      accuracyPercentage: 33,
      avgResponseTimeMs: 1500
    }

    const mockAnswers: DbAnswerRecord[] = [
      {
        id: 'a1',
        sessionId: 's1',
        questionIndex: 1,
        expectedNote: 60, // C4
        playedNote: 60, // C4
        isCorrect: true,
        semitoneDistance: 0,
        responseTimeMs: 900, // Rápido (<1200ms)
        velocity: 90,
        reasonTelemetry: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'a2',
        sessionId: 's1',
        questionIndex: 2,
        expectedNote: 61, // C#4
        playedNote: 62, // D4 (+1 st -> Sesgo agudo)
        isCorrect: false,
        semitoneDistance: 1,
        responseTimeMs: 3100, // Lento (>2800ms)
        velocity: 90,
        reasonTelemetry: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'a3',
        sessionId: 's1',
        questionIndex: 3,
        expectedNote: 61, // C#4
        playedNote: 62, // D4 (+1 st)
        isCorrect: false,
        semitoneDistance: 1,
        responseTimeMs: 1800, // Medio
        velocity: 90,
        reasonTelemetry: '',
        createdAt: new Date().toISOString()
      }
    ]

    const metrics = computeAnalyticsMetrics([mockSession], mockAnswers)

    expect(metrics.totalAnswers).toBe(3)
    expect(metrics.totalCorrect).toBe(1)
    expect(metrics.overallAccuracy).toBe(33)
    expect(metrics.fastResponsesCount).toBe(1)
    expect(metrics.slowResponsesCount).toBe(1)
    expect(metrics.sharpBiasCount).toBe(2)
    expect(metrics.flatBiasCount).toBe(0)
    expect(metrics.topConfusions[0].expected).toBe('C#4')
    expect(metrics.topConfusions[0].played).toBe('D4')

    const report = generateDiagnosticReport(metrics)
    expect(report.title).toBeDefined()
    expect(report.directionalBiasAnalysis).toContain('AGUDO')
    expect(report.concreteActionPlan.length).toBeGreaterThan(0)
  })
})
