import { describe, it, expect } from 'vitest'
import { isValidSessionRecord, isValidAnswerRecord, isValidAiReportRecord } from './recordValidator'
import { DbAnswerRecord, DbSessionRecord, DbAiReportRecord } from './types'

describe('recordValidator - Validación Pura de Integridad de Registros', () => {
  const validSession: DbSessionRecord = {
    id: 's_val_1',
    createdAt: new Date().toISOString(),
    strategyId: 'adaptive_v1',
    instrumentId: 'piano',
    presetName: 'Notas (3)',
    totalQuestions: 10,
    correctAnswers: 8,
    accuracyPercentage: 80,
    avgResponseTimeMs: 1200,
    durationSeconds: 45
  }

  const validAnswer: DbAnswerRecord = {
    id: 'a_val_1',
    sessionId: 's_val_1',
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

  const validReport: DbAiReportRecord = {
    id: 'rep_val_1',
    createdAt: new Date().toISOString(),
    modelName: 'qwen3.5-9b',
    modeFilter: 'single_note',
    analysisText: 'Análisis válido.',
    prescription: {
      title: 'Prescripción Válida',
      rationale: 'Foco en debilidades',
      targetMode: 'single_note',
      instrumentId: 'acoustic_grand_piano',
      recommendedNotes: [60, 62],
      limitType: 'questions',
      questionsCount: 10,
      durationMinutes: 5,
      advanceMode: 'smart'
    }
  }

  it('isValidSessionRecord debe aceptar sesiones válidas y rechazar datos corruptos', () => {
    expect(isValidSessionRecord(validSession)).toBe(true)

    // Rechaza si correctAnswers supera a totalQuestions
    expect(isValidSessionRecord({ ...validSession, correctAnswers: 15 })).toBe(false)

    // Rechaza si accuracyPercentage es mayor a 100 o menor a 0
    expect(isValidSessionRecord({ ...validSession, accuracyPercentage: 120 })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, accuracyPercentage: -10 })).toBe(false)

    // Rechaza fechas inválidas
    expect(isValidSessionRecord({ ...validSession, createdAt: 'fecha_invalida' })).toBe(false)
  })

  it('isValidAnswerRecord debe aceptar respuestas válidas y rechazar notas fuera de rango MIDI', () => {
    expect(isValidAnswerRecord(validAnswer)).toBe(true)

    // Rechaza notas MIDI negativas o > 127
    expect(isValidAnswerRecord({ ...validAnswer, expectedNote: -1 })).toBe(false)
    expect(isValidAnswerRecord({ ...validAnswer, playedNote: 130 })).toBe(false)

    // Rechaza tiempos de respuesta negativos
    expect(isValidAnswerRecord({ ...validAnswer, responseTimeMs: -100 })).toBe(false)
  })

  it('isValidAiReportRecord debe validar reportes de IA y rechazar objetos vacíos', () => {
    expect(isValidAiReportRecord(validReport)).toBe(true)
    expect(isValidAiReportRecord(null)).toBe(false)
    expect(isValidAiReportRecord({ ...validReport, analysisText: '' })).toBe(false)
  })
})
