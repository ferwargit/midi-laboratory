import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  COGNITIVE_LATENCY_THRESHOLDS,
  MASTERY_THRESHOLDS,
  computeAnalyticsMetrics
} from './historyAnalytics'
import { ConfusionMatrixTab } from '../../components/views/analytics/ConfusionMatrixTab'
import { LatencySpectrumDiagram } from '../../components/views/guide/LatencySpectrumDiagram'
import { generateDiagnosticReport } from './diagnosticReportGenerator'
import { buildUserPrompt } from '../ai/promptBuilder'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'

describe('thresholdsConsistency - Certificación de Constantes y Umbrales Psicométricos', () => {
  const mockSession: DbSessionRecord = {
    id: 's_thresh_1',
    createdAt: new Date().toISOString(),
    strategyId: 'adaptive_v1',
    instrumentId: 'piano',
    presetName: 'Test',
    totalQuestions: 3,
    correctAnswers: 3,
    accuracyPercentage: 100,
    avgResponseTimeMs: 1500,
    durationSeconds: 30
  }

  const mockAnswers: DbAnswerRecord[] = [
    {
      id: 'a1',
      sessionId: 's_thresh_1',
      questionIndex: 1,
      expectedNote: 60,
      playedNote: 60,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 1350, // < 1400ms (Debe ser FAST)
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'a2',
      sessionId: 's_thresh_1',
      questionIndex: 2,
      expectedNote: 62,
      playedNote: 62,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 2100, // 1400ms - 2800ms (Debe ser MEDIUM)
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'a3',
      sessionId: 's_thresh_1',
      questionIndex: 3,
      expectedNote: 64,
      playedNote: 64,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 3200, // > 2800ms (Debe ser SLOW)
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    }
  ]

  it('las constantes canónicas deben estar fijadas en 1400ms y 2800ms', () => {
    expect(COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS).toBe(1400)
    expect(COGNITIVE_LATENCY_THRESHOLDS.MEDIUM_MAX_MS).toBe(2800)
    expect(COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL).toBe('< 1.4s')
    expect(COGNITIVE_LATENCY_THRESHOLDS.MEDIUM_LABEL).toBe('1.4s - 2.8s')
    expect(MASTERY_THRESHOLDS.MASTERED_MIN).toBe(85)
  })

  it('computeAnalyticsMetrics debe clasificar exactamente en base al umbral de 1400ms', () => {
    const metrics = computeAnalyticsMetrics([mockSession], mockAnswers, 'all')

    expect(metrics.fastResponsesCount).toBe(1) // 1350ms < 1400ms
    expect(metrics.mediumResponsesCount).toBe(1) // 2100ms
    expect(metrics.slowResponsesCount).toBe(1) // 3200ms
  })

  it('ConfusionMatrixTab debe renderizar estrictamente < 1.4s y 1.4s - 2.8s', () => {
    const metrics = computeAnalyticsMetrics([mockSession], mockAnswers, 'all')
    render(<ConfusionMatrixTab modeFilter="single_note" metrics={metrics} />)

    expect(screen.getByText(/Reflejo Inmediato \(< 1.4s\)/i)).toBeDefined()
    expect(screen.getByText(/Deducción Activa \(1.4s - 2.8s\)/i)).toBeDefined()
    expect(screen.queryByText(/< 1.2s/i)).toBeNull()
  })

  it('LatencySpectrumDiagram debe renderizar las etiquetas calibradas a 1.4s', () => {
    render(<LatencySpectrumDiagram />)

    expect(screen.getByText(/1.4s \(Umbral de Reflejo\)/i)).toBeDefined()
    expect(screen.getByText(/Zona 1 \(< 1.4s\)/i)).toBeDefined()
    expect(screen.queryByText(/1.2s/i)).toBeNull()
  })

  it('diagnosticReportGenerator y promptBuilder deben contener < 1.4s', () => {
    const metrics = computeAnalyticsMetrics([mockSession], [mockAnswers[0]], 'all')
    const report = generateDiagnosticReport(metrics)
    expect(report.cognitiveLatencyAnalysis).toContain('< 1.4s')

    const prompt = buildUserPrompt(metrics)
    expect(prompt).toContain('Respuestas Rápidas (<1.4s)')
  })
})
