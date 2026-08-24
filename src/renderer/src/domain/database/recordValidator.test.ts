import { describe, it, expect } from 'vitest'
import {
  isValidSessionRecord,
  isValidAnswerRecord,
  isValidAiReportRecord,
  isValidAiConsultationRecord
} from './recordValidator'
import { DbAnswerRecord, DbSessionRecord, DbAiReportRecord, DbAiConsultationRecord } from './types'

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
    createdAt: new Date().toISOString(),
    inputSource: 'midi_hardware'
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

  const validConsultation: DbAiConsultationRecord = {
    id: 'consult_val_1',
    createdAt: new Date().toISOString(),
    modelName: 'qwen3.5-9b',
    modeFilter: 'single_note',
    topicConceptId: 'irt_normalized_accuracy',
    userQuery: '¿Cómo se calcula el oído real?',
    aiResponse: 'Se calcula descontando el factor azar...',
    associatedMetricsSnapshot: {
      overallAccuracy: 80,
      normalizedAccuracy: 75,
      avgLatencyMs: 1300,
      poolEntropyBits: 2.3
    }
  }

  it('isValidSessionRecord debe aceptar sesiones válidas y rechazar datos corruptos o fuera de rango', () => {
    expect(isValidSessionRecord(validSession)).toBe(true)
    expect(isValidSessionRecord(null)).toBe(false)
    expect(isValidSessionRecord('no objeto')).toBe(false)
    expect(isValidSessionRecord({ ...validSession, id: '' })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, strategyId: '' })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, instrumentId: '' })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, presetName: '' })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, totalQuestions: -5 })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, totalQuestions: 3.5 })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, correctAnswers: 15 })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, accuracyPercentage: 120 })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, accuracyPercentage: -10 })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, avgResponseTimeMs: -100 })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, durationSeconds: -10 })).toBe(false)
    expect(isValidSessionRecord({ ...validSession, createdAt: 'fecha_invalida' })).toBe(false)
  })

  it('isValidAnswerRecord debe aceptar respuestas válidas y rechazar notas o parámetros corruptos', () => {
    expect(isValidAnswerRecord(validAnswer)).toBe(true)
    expect(isValidAnswerRecord(null)).toBe(false)
    expect(isValidAnswerRecord({ ...validAnswer, id: '' })).toBe(false)
    expect(isValidAnswerRecord({ ...validAnswer, sessionId: '' })).toBe(false)
    expect(isValidAnswerRecord({ ...validAnswer, questionIndex: -1 })).toBe(false)
    expect(isValidAnswerRecord({ ...validAnswer, expectedNote: -1 })).toBe(false)
    expect(isValidAnswerRecord({ ...validAnswer, playedNote: 130 })).toBe(false)
    expect(isValidAnswerRecord({ ...validAnswer, isCorrect: 'true' as unknown as boolean })).toBe(
      false
    )
    expect(isValidAnswerRecord({ ...validAnswer, semitoneDistance: 1.5 })).toBe(false)
    expect(isValidAnswerRecord({ ...validAnswer, responseTimeMs: -100 })).toBe(false)
    expect(isValidAnswerRecord({ ...validAnswer, velocity: 150 })).toBe(false)
    expect(isValidAnswerRecord({ ...validAnswer, velocity: -5 })).toBe(false)
    expect(isValidAnswerRecord({ ...validAnswer, createdAt: 'fecha_invalida' })).toBe(false)
    expect(
      isValidAnswerRecord({ ...validAnswer, inputSource: 'invalido' as unknown as 'midi_hardware' })
    ).toBe(false)
  })

  it('isValidAiReportRecord debe validar reportes de IA y rechazar objetos vacíos', () => {
    expect(isValidAiReportRecord(validReport)).toBe(true)
    expect(isValidAiReportRecord(null)).toBe(false)
    expect(isValidAiReportRecord({ ...validReport, id: '' })).toBe(false)
    expect(isValidAiReportRecord({ ...validReport, modelName: '' })).toBe(false)
    expect(isValidAiReportRecord({ ...validReport, modeFilter: '' })).toBe(false)
    expect(isValidAiReportRecord({ ...validReport, analysisText: '' })).toBe(false)
    expect(
      isValidAiReportRecord({
        ...validReport,
        prescription: null as unknown as Record<string, unknown>
      })
    ).toBe(false)
    expect(isValidAiReportRecord({ ...validReport, createdAt: 'fecha_invalida' })).toBe(false)
  })

  it('isValidAiConsultationRecord debe validar consultas del tutor IA y rechazar campos vacíos', () => {
    expect(isValidAiConsultationRecord(validConsultation)).toBe(true)
    expect(isValidAiConsultationRecord(null)).toBe(false)
    expect(isValidAiConsultationRecord({ ...validConsultation, id: '' })).toBe(false)
    expect(isValidAiConsultationRecord({ ...validConsultation, modelName: '' })).toBe(false)
    expect(isValidAiConsultationRecord({ ...validConsultation, modeFilter: '' })).toBe(false)
    expect(isValidAiConsultationRecord({ ...validConsultation, userQuery: '' })).toBe(false)
    expect(isValidAiConsultationRecord({ ...validConsultation, aiResponse: '' })).toBe(false)
    expect(isValidAiConsultationRecord({ ...validConsultation, createdAt: 'fecha_invalida' })).toBe(
      false
    )
  })

  it('isValidSessionRecord debe validar targetMode canónico si está presente', () => {
    expect(isValidSessionRecord({ ...validSession, targetMode: 'single_note' })).toBe(true)
    expect(isValidSessionRecord({ ...validSession, targetMode: 'intervals' })).toBe(true)
    expect(isValidSessionRecord({ ...validSession, targetMode: 'sequences' })).toBe(true)
    expect(
      isValidSessionRecord({ ...validSession, targetMode: 'invalido' as unknown as 'single_note' })
    ).toBe(false)
  })
})
