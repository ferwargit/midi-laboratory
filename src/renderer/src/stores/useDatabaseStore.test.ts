import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { useDatabaseStore } from './useDatabaseStore'
import { useAiStore } from './useAiStore'
import { DbSessionRecord, DbAiReportRecord } from '../domain/database/types'

describe('useDatabaseStore - Store de Persistencia IndexedDB y Limpieza en Cascada', () => {
  beforeEach(async () => {
    await useDatabaseStore.getState().initialize()
    await useDatabaseStore.getState().clearDatabase()
  })

  it('debe inicializarse con contadores en 0 (incluyendo totalDurationSeconds) y arrays vacíos', () => {
    const state = useDatabaseStore.getState()
    expect(state.summary.totalSessions).toBe(0)
    expect(state.summary.totalExercises).toBe(0)
    expect(state.summary.totalDurationSeconds).toBe(0)
    expect(state.sessions).toEqual([])
    expect(state.answers).toEqual([])
    expect(state.aiReports).toEqual([])
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

  it('clearDatabase debe vaciar las tablas y purgar la memoria de IA en cascada', async () => {
    // 1. Cargamos una sesión y un informe de IA
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

    useAiStore.getState().setAiResponseForMode('single_note', {
      source: 'lm_studio_ai',
      modelName: 'Qwen',
      analysisText: 'Memoria previa',
      prescription: {
        title: 'T',
        rationale: 'R',
        targetMode: 'single_note',
        instrumentId: 'acoustic_grand_piano',
        recommendedNotes: [60, 62],
        limitType: 'questions',
        questionsCount: 5,
        durationMinutes: 3,
        advanceMode: 'smart'
      }
    })

    expect(useDatabaseStore.getState().summary.totalSessions).toBe(1)
    expect(useAiStore.getState().aiResponsesByMode.single_note).not.toBeNull()

    // 2. Ejecutamos reseteo total
    await useDatabaseStore.getState().clearDatabase()

    // 3. Todo debe quedar en 0 y la memoria de IA purgada
    expect(useDatabaseStore.getState().summary.totalSessions).toBe(0)
    expect(useDatabaseStore.getState().sessions).toEqual([])
    expect(useDatabaseStore.getState().aiReports).toEqual([])
    expect(useAiStore.getState().aiResponsesByMode.single_note).toBeNull()
  })
})
