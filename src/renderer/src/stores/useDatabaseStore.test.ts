import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { useDatabaseStore } from './useDatabaseStore'
import { useAiStore } from './useAiStore'
import {
  DbSessionRecord,
  DbAiReportRecord,
  DbAiConsultationRecord,
  DbAnswerRecord
} from '../domain/database/types'

describe('useDatabaseStore - Store de Persistencia IndexedDB y Limpieza en Cascada', () => {
  beforeEach(async () => {
    await useDatabaseStore.getState().initialize()
    await useDatabaseStore.getState().clearDatabase()
  })

  it('debe inicializarse con contadores en 0 y colecciones vacías (incluyendo aiConsultations)', () => {
    const state = useDatabaseStore.getState()
    expect(state.summary.totalSessions).toBe(0)
    expect(state.summary.totalExercises).toBe(0)
    expect(state.summary.totalDurationSeconds).toBe(0)
    expect(state.sessions).toEqual([])
    expect(state.answers).toEqual([])
    expect(state.aiReports).toEqual([])
    expect(state.aiConsultations).toEqual([])
  })

  it('debe guardar y recargar sesiones en el estado reactivo con duración calculada', async () => {
    const mockSession: DbSessionRecord = {
      id: 'session_db_test',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Notas (3)',
      totalQuestions: 5,
      correctAnswers: 4,
      accuracyPercentage: 80,
      avgResponseTimeMs: 1400,
      durationSeconds: 45
    }

    await useDatabaseStore.getState().saveSession(mockSession, [])

    const state = useDatabaseStore.getState()
    expect(state.summary.totalSessions).toBe(1)
    expect(state.summary.totalDurationSeconds).toBe(45)
    expect(state.sessions.length).toBe(1)
    expect(state.sessions[0].id).toBe('session_db_test')
  })

  // NUEVO TEST DE BORRADO INDIVIDUAL REACTIVO EN STORE
  it('deleteSession debe eliminar una sesión y actualizar el estado reactivo y resumen', async () => {
    const session: DbSessionRecord = {
      id: 'session_to_delete',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Test',
      totalQuestions: 2,
      correctAnswers: 2,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 20
    }

    const answers: DbAnswerRecord[] = [
      {
        id: 'ans_1',
        sessionId: 'session_to_delete',
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

    await useDatabaseStore.getState().saveSession(session, answers)
    expect(useDatabaseStore.getState().sessions.length).toBe(1)
    expect(useDatabaseStore.getState().answers.length).toBe(1)

    // Eliminación individual
    await useDatabaseStore.getState().deleteSession('session_to_delete')

    expect(useDatabaseStore.getState().sessions.length).toBe(0)
    expect(useDatabaseStore.getState().answers.length).toBe(0)
    expect(useDatabaseStore.getState().summary.totalSessions).toBe(0)
  })

  // NUEVO TEST DE BORRADO POR LOTE REACTIVO EN STORE
  it('deleteSessions debe eliminar múltiples sesiones en lote y actualizar el estado', async () => {
    const s1: DbSessionRecord = {
      id: 's_batch_1',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'T1',
      totalQuestions: 1,
      correctAnswers: 1,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 10
    }
    const s2: DbSessionRecord = {
      id: 's_batch_2',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'T2',
      totalQuestions: 1,
      correctAnswers: 1,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 10
    }

    await useDatabaseStore.getState().saveSession(s1, [])
    await useDatabaseStore.getState().saveSession(s2, [])
    expect(useDatabaseStore.getState().sessions.length).toBe(2)

    // Eliminación por lote
    await useDatabaseStore.getState().deleteSessions(['s_batch_1', 's_batch_2'])

    expect(useDatabaseStore.getState().sessions.length).toBe(0)
    expect(useDatabaseStore.getState().summary.totalSessions).toBe(0)
  })

  it('debe guardar y recuperar informes de IA en la colección persistente', async () => {
    const mockReport: DbAiReportRecord = {
      id: 'ai_rep_1',
      createdAt: new Date().toISOString(),
      modelName: 'qwen3.5-9b',
      modeFilter: 'single_note',
      analysisText: 'Diagnóstico guardado en store.',
      prescription: {
        title: 'Prescripción de Prueba',
        rationale: 'Aislamiento',
        targetMode: 'single_note',
        instrumentId: 'acoustic_grand_piano',
        recommendedNotes: [60, 62],
        limitType: 'questions',
        questionsCount: 10,
        durationMinutes: 5,
        advanceMode: 'smart'
      }
    }

    await useDatabaseStore.getState().saveAiReport(mockReport)

    const state = useDatabaseStore.getState()
    expect(state.aiReports.length).toBe(1)
    expect(state.aiReports[0].modelName).toBe('qwen3.5-9b')
  })

  it('debe guardar y recuperar consultas del tutor IA en la colección reactiva (saveAiConsultation)', async () => {
    const mockConsultation: DbAiConsultationRecord = {
      id: 'consult_store_1',
      createdAt: new Date().toISOString(),
      modelName: 'qwen3.5-9b',
      modeFilter: 'single_note',
      topicConceptId: 'irt_normalized_accuracy',
      userQuery: '¿Por qué aumenta mi latencia en notas agudas?',
      aiResponse: 'La latencia se incrementa por búsqueda interválica en registros altos...',
      associatedMetricsSnapshot: {
        overallAccuracy: 88,
        normalizedAccuracy: 84,
        avgLatencyMs: 1750,
        poolEntropyBits: 2.57
      }
    }

    await useDatabaseStore.getState().saveAiConsultation(mockConsultation)

    const state = useDatabaseStore.getState()
    expect(state.aiConsultations.length).toBe(1)
    expect(state.aiConsultations[0].id).toBe('consult_store_1')
    expect(state.aiConsultations[0].userQuery).toBe('¿Por qué aumenta mi latencia en notas agudas?')
    expect(state.aiConsultations[0].associatedMetricsSnapshot?.normalizedAccuracy).toBe(84)
  })

  it('clearDatabase debe vaciar las tablas y purgar la memoria de IA en cascada (incluyendo aiConsultations)', async () => {
    const mockSession: DbSessionRecord = {
      id: 'session_temp',
      createdAt: new Date().toISOString(),
      strategyId: 'random',
      instrumentId: 'piano',
      presetName: 'Test',
      totalQuestions: 2,
      correctAnswers: 2,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 20
    }
    await useDatabaseStore.getState().saveSession(mockSession, [])

    const mockConsultation: DbAiConsultationRecord = {
      id: 'consult_temp_1',
      createdAt: new Date().toISOString(),
      modelName: 'qwen3.5',
      modeFilter: 'all',
      userQuery: 'Duda temporal',
      aiResponse: 'Respuesta temporal'
    }
    await useDatabaseStore.getState().saveAiConsultation(mockConsultation)

    expect(useDatabaseStore.getState().summary.totalSessions).toBe(1)
    expect(useDatabaseStore.getState().aiConsultations.length).toBe(1)

    // Limpieza completa
    await useDatabaseStore.getState().clearDatabase()

    expect(useDatabaseStore.getState().summary.totalSessions).toBe(0)
    expect(useDatabaseStore.getState().sessions).toEqual([])
    expect(useDatabaseStore.getState().aiReports).toEqual([])
    expect(useDatabaseStore.getState().aiConsultations).toEqual([])
    expect(useAiStore.getState().aiResponsesByMode.single_note).toBeNull()
  })
})
