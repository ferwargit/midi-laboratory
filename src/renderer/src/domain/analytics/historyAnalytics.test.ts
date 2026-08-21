import { describe, it, expect } from 'vitest'
import { computeAnalyticsMetrics, filterSessionsByMode } from './historyAnalytics'
import { generateDiagnosticReport } from './diagnosticReportGenerator'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'

describe('historyAnalytics - Psicometría y Corrección por Azar', () => {
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

  const sSequenceWithWordNotas: DbSessionRecord = {
    id: 's_seq',
    createdAt: new Date().toISOString(),
    strategyId: 'sequences_v1',
    instrumentId: 'piano_sequences',
    presetName: 'Secuencias (3 notas)', // Caso crítico del bug
    totalQuestions: 3,
    correctAnswers: 2,
    accuracyPercentage: 66,
    avgResponseTimeMs: 3000,
    durationSeconds: 30
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
    }
  ]

  it('filterSessionsByMode debe segmentar correctamente y evitar colisiones por la palabra "notas"', () => {
    const allSessions = [sNote, sInterval, sSequenceWithWordNotas]

    // 1. Filtro Global
    const all = filterSessionsByMode(allSessions, 'all')
    expect(all.length).toBe(3)

    // 2. Filtro Single Note: solo debe contener sNote (1 sesión, NO sSequenceWithWordNotas)
    const onlyNotes = filterSessionsByMode(allSessions, 'single_note')
    expect(onlyNotes.length).toBe(1)
    expect(onlyNotes[0].id).toBe('s_note')

    // 3. Filtro Secuencias: debe capturar sSequenceWithWordNotas
    const onlySequences = filterSessionsByMode(allSessions, 'sequences')
    expect(onlySequences.length).toBe(1)
    expect(onlySequences[0].id).toBe('s_seq')

    // 4. Filtro Intervalos
    const onlyIntervals = filterSessionsByMode(allSessions, 'intervals')
    expect(onlyIntervals.length).toBe(1)
    expect(onlyIntervals[0].id).toBe('s_int')
  })

  it('computeAnalyticsMetrics debe calcular la precisión corregida por azar y entropía', () => {
    const noteMetrics = computeAnalyticsMetrics([sNote], [answers[0]], 'single_note')
    expect(noteMetrics.totalAnswers).toBe(1)
    expect(noteMetrics.normalizedOverallAccuracy).toBeDefined()
    expect(noteMetrics.avgEntropyBits).toBeGreaterThan(0)
  })

  it('generateDiagnosticReport debe redactar el informe con base científica', () => {
    const metrics = computeAnalyticsMetrics([sNote], [answers[0]], 'single_note')
    const report = generateDiagnosticReport(metrics)
    expect(report.title).toBeDefined()
    expect(report.concreteActionPlan.length).toBeGreaterThan(0)
  })
})
