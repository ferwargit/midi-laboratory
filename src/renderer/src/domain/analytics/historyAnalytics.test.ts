import { describe, it, expect } from 'vitest'
import { computeAnalyticsMetrics, filterSessionsByMode } from './historyAnalytics'
import { generateDiagnosticReport } from './diagnosticReportGenerator'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'

describe('historyAnalytics - Motor de Diagnóstico Psicoacústico y Filtrado', () => {
  const sNote: DbSessionRecord = {
    id: 's_note',
    createdAt: new Date().toISOString(),
    strategyId: 'adaptive_v1',
    instrumentId: 'piano',
    presetName: 'Notas (3)',
    totalQuestions: 2,
    correctAnswers: 2,
    accuracyPercentage: 100,
    avgResponseTimeMs: 1000
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
    avgResponseTimeMs: 2000
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

  it('filterSessionsByMode debe segmentar correctamente según la modalidad', () => {
    const all = filterSessionsByMode([sNote, sInterval], 'all')
    expect(all.length).toBe(2)

    const onlyNotes = filterSessionsByMode([sNote, sInterval], 'single_note')
    expect(onlyNotes.length).toBe(1)
    expect(onlyNotes[0].id).toBe('s_note')

    const onlyIntervals = filterSessionsByMode([sNote, sInterval], 'intervals')
    expect(onlyIntervals.length).toBe(1)
    expect(onlyIntervals[0].id).toBe('s_int')
  })

  it('computeAnalyticsMetrics debe calcular métricas aisladas para la modalidad filtrada', () => {
    const noteMetrics = computeAnalyticsMetrics([sNote, sInterval], answers, 'single_note')
    expect(noteMetrics.totalAnswers).toBe(1)
    expect(noteMetrics.overallAccuracy).toBe(100)

    const intMetrics = computeAnalyticsMetrics([sNote, sInterval], answers, 'intervals')
    expect(intMetrics.totalAnswers).toBe(1)
    expect(intMetrics.overallAccuracy).toBe(0)
    expect(intMetrics.sharpBiasCount).toBe(1)
  })

  it('generateDiagnosticReport debe generar el informe clínico correctamente', () => {
    const metrics = computeAnalyticsMetrics([sNote], [answers[0]], 'single_note')
    const report = generateDiagnosticReport(metrics)
    expect(report.title).toBeDefined()
    expect(report.concreteActionPlan.length).toBeGreaterThan(0)
  })
})
