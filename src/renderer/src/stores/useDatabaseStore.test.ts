import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { useDatabaseStore } from './useDatabaseStore'
import { useAiStore } from './useAiStore'
import { DatabaseEngine } from '../domain/database/databaseEngine'
import {
  DbSessionRecord,
  DbAiReportRecord,
  DbAiConsultationRecord,
  DbAnswerRecord
} from '../domain/database/types'

describe('useDatabaseStore - Store de Persistencia IndexedDB y Limpieza en Cascada', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    useDatabaseStore.setState({ isInitialized: false, engine: null })
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

  it('si initialize se llama cuando isInitialized es true, debe retornar inmediatamente', async () => {
    const initSpy = vi.spyOn(DatabaseEngine.prototype, 'initialize')
    await useDatabaseStore.getState().initialize()
    expect(initSpy).not.toHaveBeenCalled()
  })

  it('debe capturar errores en initialize si DatabaseEngine falla', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(DatabaseEngine.prototype, 'initialize').mockRejectedValueOnce(
      new Error('IndexedDB blocked / permission denied')
    )

    useDatabaseStore.setState({ isInitialized: false, engine: null })
    await useDatabaseStore.getState().initialize()

    expect(consoleSpy).toHaveBeenCalledWith('Error al inicializar IndexedDB:', expect.any(Error))
    consoleSpy.mockRestore()
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

    await useDatabaseStore.getState().deleteSession('session_to_delete')

    expect(useDatabaseStore.getState().sessions.length).toBe(0)
    expect(useDatabaseStore.getState().answers.length).toBe(0)
    expect(useDatabaseStore.getState().summary.totalSessions).toBe(0)
  })

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

  it('exportBackupJson e importBackupJson deben exportar y restaurar el backup JSON con éxito', async () => {
    const mockSession: DbSessionRecord = {
      id: 'session_backup_1',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'flute',
      presetName: 'Nivel 1',
      totalQuestions: 1,
      correctAnswers: 1,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1200,
      durationSeconds: 30
    }

    const mockAnswer: DbAnswerRecord = {
      id: 'ans_backup_1',
      sessionId: 'session_backup_1',
      questionIndex: 1,
      expectedNote: 60,
      playedNote: 60,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 1200,
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    }

    await useDatabaseStore.getState().saveSession(mockSession, [mockAnswer])

    // Exportar
    const jsonString = await useDatabaseStore.getState().exportBackupJson()
    expect(typeof jsonString).toBe('string')
    expect(jsonString).toContain('session_backup_1')

    // Limpiar
    await useDatabaseStore.getState().clearDatabase()
    expect(useDatabaseStore.getState().sessions.length).toBe(0)

    // Importar
    const result = await useDatabaseStore.getState().importBackupJson(jsonString, 'replace')
    expect(result.success).toBe(true)
    expect(result.sessionsImported).toBe(1)
    expect(result.answersImported).toBe(1)
    expect(useDatabaseStore.getState().sessions.length).toBe(1)
  })

  it('importBackupJson debe capturar y devolver error cuando el contenido no es un JSON válido', async () => {
    const result = await useDatabaseStore.getState().importBackupJson('{ json_invalido_corrupto ')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.sessionsImported).toBe(0)
  })

  it('exportBackupJson e importBackupJson deben lanzar error si el motor de DB es null', async () => {
    useDatabaseStore.setState({ engine: null })

    await expect(useDatabaseStore.getState().exportBackupJson()).rejects.toThrow(
      'Base de datos no inicializada.'
    )
    await expect(useDatabaseStore.getState().importBackupJson('{}')).rejects.toThrow(
      'Base de datos no inicializada.'
    )
  })

  it('los métodos CRUD deben retornar limpiamente sin fallar si engine es null', async () => {
    useDatabaseStore.setState({ engine: null })

    await expect(useDatabaseStore.getState().reloadAllData()).resolves.toBeUndefined()
    await expect(
      useDatabaseStore.getState().saveSession({} as DbSessionRecord, [])
    ).resolves.toBeUndefined()
    await expect(useDatabaseStore.getState().deleteSession('id')).resolves.toBeUndefined()
    await expect(useDatabaseStore.getState().deleteSessions(['id'])).resolves.toBeUndefined()
    await expect(
      useDatabaseStore.getState().saveAiReport({} as DbAiReportRecord)
    ).resolves.toBeUndefined()
    await expect(
      useDatabaseStore.getState().saveAiConsultation({} as DbAiConsultationRecord)
    ).resolves.toBeUndefined()
    await expect(useDatabaseStore.getState().clearDatabase()).resolves.toBeUndefined()
  })

  it('clearDatabase debe vaciar las tablas y purgar la memoria de IA en cascada', async () => {
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

    await useDatabaseStore.getState().clearDatabase()

    expect(useDatabaseStore.getState().summary.totalSessions).toBe(0)
    expect(useDatabaseStore.getState().sessions).toEqual([])
    expect(useDatabaseStore.getState().aiReports).toEqual([])
    expect(useDatabaseStore.getState().aiConsultations).toEqual([])
    expect(useAiStore.getState().aiResponsesByMode.single_note).toBeNull()
  })
})
