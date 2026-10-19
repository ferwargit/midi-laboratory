import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest'
import 'fake-indexeddb/auto'
import { computeSummaryFromSessions, useDatabaseStore } from './useDatabaseStore'
import { useAiStore } from './useAiStore'
import { DatabaseEngine } from '../domain/database/databaseEngine'
import {
  DbSessionRecord,
  DbAiReportRecord,
  DbAiConsultationRecord,
  DbAnswerRecord
} from '../domain/database/types'

const makeSession = (overrides: Partial<DbSessionRecord> & { id: string }): DbSessionRecord => ({
  createdAt: new Date('2026-01-01T10:00:00Z').toISOString(),
  strategyId: 'adaptive_v1',
  instrumentId: 'piano',
  presetName: 'Test',
  totalQuestions: 10,
  correctAnswers: 8,
  accuracyPercentage: 80,
  avgResponseTimeMs: 1000,
  durationSeconds: 60,
  ...overrides
})

const makeAnswer = (id: string, sessionId: string): DbAnswerRecord => ({
  id,
  sessionId,
  questionIndex: 1,
  expectedNote: 60,
  playedNote: 60,
  isCorrect: true,
  semitoneDistance: 0,
  responseTimeMs: 900,
  velocity: 90,
  reasonTelemetry: '',
  createdAt: new Date('2026-01-01T10:00:00Z').toISOString()
})

interface EngineReadSpies {
  getSummary: MockInstance
  getAllSessions: MockInstance
  getAllAnswers: MockInstance
  getAllAiReports: MockInstance
  getAllAiConsultations: MockInstance
}

function spyFullReads(): EngineReadSpies {
  return {
    getSummary: vi.spyOn(DatabaseEngine.prototype, 'getSummary'),
    getAllSessions: vi.spyOn(DatabaseEngine.prototype, 'getAllSessions'),
    getAllAnswers: vi.spyOn(DatabaseEngine.prototype, 'getAllAnswers'),
    getAllAiReports: vi.spyOn(DatabaseEngine.prototype, 'getAllAiReports'),
    getAllAiConsultations: vi.spyOn(DatabaseEngine.prototype, 'getAllAiConsultations')
  }
}

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

describe('computeSummaryFromSessions - Helper puro de resumen ponderado', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    useDatabaseStore.setState({ isInitialized: false, engine: null })
    await useDatabaseStore.getState().initialize()
    await useDatabaseStore.getState().clearDatabase()
  })

  it('con 0 sesiones produce el resumen canónico en ceros, igual que engine.getSummary()', async () => {
    const engine = useDatabaseStore.getState().engine!
    const engineSummary = await engine.getSummary()
    expect(engineSummary).toEqual({
      totalSessions: 0,
      totalExercises: 0,
      overallAccuracy: 0,
      overallAvgTimeMs: 0,
      totalDurationSeconds: 0
    })
    expect(computeSummaryFromSessions([])).toEqual(engineSummary)
  })

  it('con 1 sesión produce exactamente el mismo resumen que engine.getSummary()', async () => {
    const session = makeSession({ id: 'sum_single' })
    const engine = useDatabaseStore.getState().engine!
    await engine.saveSession(session, [])

    const engineSummary = await engine.getSummary()
    expect(computeSummaryFromSessions([session])).toEqual(engineSummary)
  })

  it('con múltiples sesiones produce exactamente el mismo resumen que engine.getSummary()', async () => {
    const sessions = [
      makeSession({
        id: 'sum_multi_1',
        totalQuestions: 4,
        correctAnswers: 3,
        avgResponseTimeMs: 1500,
        durationSeconds: 30
      }),
      makeSession({
        id: 'sum_multi_2',
        totalQuestions: 6,
        correctAnswers: 6,
        avgResponseTimeMs: 500,
        durationSeconds: 90
      }),
      makeSession({
        id: 'sum_multi_3',
        totalQuestions: 2,
        correctAnswers: 1,
        avgResponseTimeMs: 2000,
        durationSeconds: 15
      })
    ]
    const engine = useDatabaseStore.getState().engine!
    for (const session of sessions) {
      await engine.saveSession(session, [])
    }

    const engineSummary = await engine.getSummary()
    expect(computeSummaryFromSessions(sessions)).toEqual(engineSummary)
  })

  it('tolera durationSeconds ausente contribuyendo 0 a la duración total (durationSeconds || 0)', () => {
    const sessions = [
      makeSession({
        id: 'sum_missing_1',
        totalQuestions: 4,
        correctAnswers: 4,
        avgResponseTimeMs: 1000,
        durationSeconds: undefined as unknown as number
      }),
      makeSession({
        id: 'sum_missing_2',
        totalQuestions: 6,
        correctAnswers: 3,
        avgResponseTimeMs: 3000,
        durationSeconds: 120
      })
    ]

    expect(computeSummaryFromSessions(sessions)).toEqual({
      totalSessions: 2,
      totalExercises: 10,
      overallAccuracy: 70, // round((4 + 3) / 10 * 100)
      overallAvgTimeMs: 2200, // round((1000*4 + 3000*6) / 10)
      totalDurationSeconds: 120 // (undefined || 0) + 120
    })
  })
})

describe('useDatabaseStore - Escritura incremental sin recarga completa', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    useDatabaseStore.setState({ isInitialized: false, engine: null })
    await useDatabaseStore.getState().initialize()
    await useDatabaseStore.getState().clearDatabase()
  })

  it('saveSession persiste y actualiza el estado sin lecturas completas de IndexedDB', async () => {
    const spies = spyFullReads()
    const session = makeSession({
      id: 'inc_save_1',
      totalQuestions: 5,
      correctAnswers: 4,
      avgResponseTimeMs: 1400,
      durationSeconds: 45
    })
    const answers = [makeAnswer('inc_ans_1', 'inc_save_1')]

    await useDatabaseStore.getState().saveSession(session, answers)

    expect(spies.getSummary).not.toHaveBeenCalled()
    expect(spies.getAllSessions).not.toHaveBeenCalled()
    expect(spies.getAllAnswers).not.toHaveBeenCalled()
    expect(spies.getAllAiReports).not.toHaveBeenCalled()
    expect(spies.getAllAiConsultations).not.toHaveBeenCalled()

    const state = useDatabaseStore.getState()
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].id).toBe('inc_save_1')
    expect(state.answers).toHaveLength(1)
    expect(state.answers[0].id).toBe('inc_ans_1')
    expect(state.summary.totalSessions).toBe(1)
    expect(state.summary.totalExercises).toBe(5)
    expect(state.summary.totalDurationSeconds).toBe(45)
  })

  it('saveSession mantiene el orden canónico por createdAt descendente', async () => {
    const newer = makeSession({
      id: 'inc_newer',
      createdAt: new Date('2026-01-02T10:00:00Z').toISOString()
    })
    const older = makeSession({
      id: 'inc_older',
      createdAt: new Date('2026-01-01T10:00:00Z').toISOString()
    })

    await useDatabaseStore.getState().saveSession(newer, [])
    await useDatabaseStore.getState().saveSession(older, [])

    expect(useDatabaseStore.getState().sessions.map((s) => s.id)).toEqual([
      'inc_newer',
      'inc_older'
    ])
  })

  it('saveSession con id existente reemplaza sin duplicados y recalcula el summary', async () => {
    const original = makeSession({
      id: 'inc_upsert',
      totalQuestions: 2,
      correctAnswers: 1,
      avgResponseTimeMs: 1000,
      durationSeconds: 20
    })
    await useDatabaseStore.getState().saveSession(original, [])

    const updated = makeSession({
      id: 'inc_upsert',
      totalQuestions: 4,
      correctAnswers: 4,
      avgResponseTimeMs: 500,
      durationSeconds: 40
    })
    await useDatabaseStore.getState().saveSession(updated, [])

    const state = useDatabaseStore.getState()
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].totalQuestions).toBe(4)
    expect(state.summary).toEqual({
      totalSessions: 1,
      totalExercises: 4,
      overallAccuracy: 100,
      overallAvgTimeMs: 500,
      totalDurationSeconds: 40
    })
  })

  it('el summary incremental coincide con el engine.getSummary() canónico', async () => {
    const s1 = makeSession({
      id: 'inc_eq_1',
      totalQuestions: 4,
      correctAnswers: 3,
      avgResponseTimeMs: 1500,
      durationSeconds: 30
    })
    const s2 = makeSession({
      id: 'inc_eq_2',
      totalQuestions: 6,
      correctAnswers: 6,
      avgResponseTimeMs: 500,
      durationSeconds: 90
    })

    await useDatabaseStore.getState().saveSession(s1, [])
    await useDatabaseStore.getState().saveSession(s2, [])

    const state = useDatabaseStore.getState()
    const engineSummary = await state.engine!.getSummary()
    expect(state.summary).toEqual(engineSummary)
  })

  it('saveSession reemplaza respuestas con id idéntico sin duplicar (upsert por id)', async () => {
    const session = makeSession({ id: 'inc_ans_upsert' })
    const originalAnswer = makeAnswer('inc_ans_upsert_1', 'inc_ans_upsert')

    await useDatabaseStore.getState().saveSession(session, [originalAnswer])
    expect(useDatabaseStore.getState().answers).toHaveLength(1)

    const updatedAnswer: DbAnswerRecord = {
      ...makeAnswer('inc_ans_upsert_1', 'inc_ans_upsert'),
      responseTimeMs: 2500,
      isCorrect: false
    }
    await useDatabaseStore.getState().saveSession(session, [updatedAnswer])

    const state = useDatabaseStore.getState()
    expect(state.answers).toHaveLength(1)
    expect(state.answers[0].id).toBe('inc_ans_upsert_1')
    expect(state.answers[0].responseTimeMs).toBe(2500)
    expect(state.answers[0].isCorrect).toBe(false)
  })

  it('un fallo de persistencia rechaza y deja el estado en memoria estrictamente inalterado', async () => {
    const session = makeSession({
      id: 'inc_fail_1',
      totalQuestions: 5,
      correctAnswers: 4,
      avgResponseTimeMs: 1400,
      durationSeconds: 45
    })
    const answers = [makeAnswer('inc_fail_ans_1', 'inc_fail_1')]

    vi.spyOn(DatabaseEngine.prototype, 'saveSession').mockRejectedValueOnce(
      new Error('Fallo de I/O')
    )

    const stateBefore = useDatabaseStore.getState()
    const snapshot = {
      sessions: stateBefore.sessions,
      answers: stateBefore.answers,
      summary: stateBefore.summary
    }

    await expect(useDatabaseStore.getState().saveSession(session, answers)).rejects.toThrow(
      'Fallo de I/O'
    )

    const stateAfter = useDatabaseStore.getState()
    expect(stateAfter.sessions).toBe(snapshot.sessions)
    expect(stateAfter.answers).toBe(snapshot.answers)
    expect(stateAfter.summary).toBe(snapshot.summary)
    expect(stateAfter.sessions).toHaveLength(0)
    expect(stateAfter.answers).toHaveLength(0)
    expect(stateAfter.summary.totalSessions).toBe(0)
  })
})

describe('useDatabaseStore - Borrado incremental sin recarga completa', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    useDatabaseStore.setState({ isInitialized: false, engine: null })
    await useDatabaseStore.getState().initialize()
    await useDatabaseStore.getState().clearDatabase()
  })

  it('deleteSession elimina la sesión y sus respuestas hijas del estado sin lecturas completas', async () => {
    const sessionA = makeSession({
      id: 'del_a',
      totalQuestions: 2,
      correctAnswers: 2,
      avgResponseTimeMs: 1000,
      durationSeconds: 20
    })
    const sessionB = makeSession({
      id: 'del_b',
      totalQuestions: 3,
      correctAnswers: 1,
      avgResponseTimeMs: 2000,
      durationSeconds: 30
    })
    await useDatabaseStore
      .getState()
      .saveSession(sessionA, [makeAnswer('del_ans_a1', 'del_a'), makeAnswer('del_ans_a2', 'del_a')])
    await useDatabaseStore.getState().saveSession(sessionB, [makeAnswer('del_ans_b1', 'del_b')])

    const spies = spyFullReads()
    await useDatabaseStore.getState().deleteSession('del_a')

    expect(spies.getSummary).not.toHaveBeenCalled()
    expect(spies.getAllSessions).not.toHaveBeenCalled()
    expect(spies.getAllAnswers).not.toHaveBeenCalled()
    expect(spies.getAllAiReports).not.toHaveBeenCalled()
    expect(spies.getAllAiConsultations).not.toHaveBeenCalled()

    const state = useDatabaseStore.getState()
    expect(state.sessions.map((s) => s.id)).toEqual(['del_b'])
    expect(state.answers.map((a) => a.id)).toEqual(['del_ans_b1'])
    expect(state.summary).toEqual({
      totalSessions: 1,
      totalExercises: 3,
      overallAccuracy: 33, // round(1/3 * 100)
      overallAvgTimeMs: 2000,
      totalDurationSeconds: 30
    })
  })

  it('deleteSessions elimina el lote y sus respuestas hijas del estado sin lecturas completas', async () => {
    const sessionA = makeSession({
      id: 'batch_a',
      totalQuestions: 2,
      correctAnswers: 2,
      avgResponseTimeMs: 1000,
      durationSeconds: 20
    })
    const sessionB = makeSession({
      id: 'batch_b',
      totalQuestions: 3,
      correctAnswers: 1,
      avgResponseTimeMs: 2000,
      durationSeconds: 30
    })
    const sessionC = makeSession({
      id: 'batch_c',
      totalQuestions: 5,
      correctAnswers: 5,
      avgResponseTimeMs: 800,
      durationSeconds: 50
    })
    await useDatabaseStore.getState().saveSession(sessionA, [makeAnswer('batch_ans_a', 'batch_a')])
    await useDatabaseStore.getState().saveSession(sessionB, [makeAnswer('batch_ans_b', 'batch_b')])
    await useDatabaseStore.getState().saveSession(sessionC, [makeAnswer('batch_ans_c', 'batch_c')])

    const spies = spyFullReads()
    await useDatabaseStore.getState().deleteSessions(['batch_a', 'batch_b'])

    expect(spies.getSummary).not.toHaveBeenCalled()
    expect(spies.getAllSessions).not.toHaveBeenCalled()
    expect(spies.getAllAnswers).not.toHaveBeenCalled()
    expect(spies.getAllAiReports).not.toHaveBeenCalled()
    expect(spies.getAllAiConsultations).not.toHaveBeenCalled()

    const state = useDatabaseStore.getState()
    expect(state.sessions.map((s) => s.id)).toEqual(['batch_c'])
    expect(state.answers.map((a) => a.id)).toEqual(['batch_ans_c'])
    expect(state.summary).toEqual({
      totalSessions: 1,
      totalExercises: 5,
      overallAccuracy: 100,
      overallAvgTimeMs: 800,
      totalDurationSeconds: 50
    })
  })
})

describe('useDatabaseStore - Escritura incremental de registros de IA', () => {
  const makeReport = (
    overrides: Partial<DbAiReportRecord> & { id: string; createdAt: string }
  ): DbAiReportRecord => ({
    modelName: 'qwen3.5-9b',
    modeFilter: 'single_note',
    analysisText: 'Diagnóstico incremental.',
    prescription: {
      title: 'Prescripción',
      rationale: 'Test',
      targetMode: 'single_note',
      instrumentId: 'acoustic_grand_piano',
      recommendedNotes: [60],
      limitType: 'questions',
      questionsCount: 10,
      durationMinutes: 5,
      advanceMode: 'smart'
    },
    ...overrides
  })

  const makeConsultation = (
    overrides: Partial<DbAiConsultationRecord> & { id: string; createdAt: string }
  ): DbAiConsultationRecord => ({
    modelName: 'qwen3.5-9b',
    modeFilter: 'single_note',
    userQuery: '¿Consulta?',
    aiResponse: 'Respuesta.',
    ...overrides
  })

  beforeEach(async () => {
    vi.restoreAllMocks()
    useDatabaseStore.setState({ isInitialized: false, engine: null })
    await useDatabaseStore.getState().initialize()
    await useDatabaseStore.getState().clearDatabase()
  })

  it('saveAiReport incorpora el informe con upsert y orden createdAt descendente sin lecturas completas', async () => {
    const newer = makeReport({
      id: 'rep_newer',
      createdAt: new Date('2026-01-02T10:00:00Z').toISOString()
    })
    const older = makeReport({
      id: 'rep_older',
      createdAt: new Date('2026-01-01T10:00:00Z').toISOString()
    })

    await useDatabaseStore.getState().saveAiReport(newer)
    const spies = spyFullReads()
    await useDatabaseStore.getState().saveAiReport(older)

    expect(spies.getSummary).not.toHaveBeenCalled()
    expect(spies.getAllSessions).not.toHaveBeenCalled()
    expect(spies.getAllAnswers).not.toHaveBeenCalled()
    expect(spies.getAllAiReports).not.toHaveBeenCalled()
    expect(spies.getAllAiConsultations).not.toHaveBeenCalled()

    const state = useDatabaseStore.getState()
    expect(state.aiReports.map((r) => r.id)).toEqual(['rep_newer', 'rep_older'])
    expect(state.summary.totalSessions).toBe(0)
  })

  it('saveAiReport con id existente reemplaza sin duplicados', async () => {
    const original = makeReport({
      id: 'rep_upsert',
      createdAt: new Date('2026-01-01T10:00:00Z').toISOString(),
      analysisText: 'Original'
    })
    await useDatabaseStore.getState().saveAiReport(original)

    const updated = makeReport({
      id: 'rep_upsert',
      createdAt: new Date('2026-01-01T10:00:00Z').toISOString(),
      analysisText: 'Actualizado'
    })
    await useDatabaseStore.getState().saveAiReport(updated)

    const state = useDatabaseStore.getState()
    expect(state.aiReports).toHaveLength(1)
    expect(state.aiReports[0].analysisText).toBe('Actualizado')
  })

  it('saveAiConsultation incorpora la consulta con upsert y orden createdAt descendente sin lecturas completas', async () => {
    const newer = makeConsultation({
      id: 'cons_newer',
      createdAt: new Date('2026-01-02T10:00:00Z').toISOString()
    })
    const older = makeConsultation({
      id: 'cons_older',
      createdAt: new Date('2026-01-01T10:00:00Z').toISOString()
    })

    await useDatabaseStore.getState().saveAiConsultation(newer)
    const spies = spyFullReads()
    await useDatabaseStore.getState().saveAiConsultation(older)

    expect(spies.getSummary).not.toHaveBeenCalled()
    expect(spies.getAllSessions).not.toHaveBeenCalled()
    expect(spies.getAllAnswers).not.toHaveBeenCalled()
    expect(spies.getAllAiReports).not.toHaveBeenCalled()
    expect(spies.getAllAiConsultations).not.toHaveBeenCalled()

    const state = useDatabaseStore.getState()
    expect(state.aiConsultations.map((c) => c.id)).toEqual(['cons_newer', 'cons_older'])
    expect(state.summary.totalSessions).toBe(0)
  })

  it('saveAiConsultation con id existente reemplaza sin duplicados', async () => {
    const original = makeConsultation({
      id: 'cons_upsert',
      createdAt: new Date('2026-01-01T10:00:00Z').toISOString(),
      aiResponse: 'Original'
    })
    await useDatabaseStore.getState().saveAiConsultation(original)

    const updated = makeConsultation({
      id: 'cons_upsert',
      createdAt: new Date('2026-01-01T10:00:00Z').toISOString(),
      aiResponse: 'Actualizado'
    })
    await useDatabaseStore.getState().saveAiConsultation(updated)

    const state = useDatabaseStore.getState()
    expect(state.aiConsultations).toHaveLength(1)
    expect(state.aiConsultations[0].aiResponse).toBe('Actualizado')
  })
})

describe('useDatabaseStore - Reserva de la recarga completa (reloadAllData)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    useDatabaseStore.setState({ isInitialized: false, engine: null })
    await useDatabaseStore.getState().initialize()
    await useDatabaseStore.getState().clearDatabase()
  })

  it('initialize realiza la recarga completa canónica (una lectura por tabla)', async () => {
    useDatabaseStore.setState({ isInitialized: false, engine: null })
    const spies = spyFullReads()

    await useDatabaseStore.getState().initialize()

    expect(spies.getSummary).toHaveBeenCalledTimes(1)
    expect(spies.getAllSessions).toHaveBeenCalledTimes(1)
    expect(spies.getAllAnswers).toHaveBeenCalledTimes(1)
    expect(spies.getAllAiReports).toHaveBeenCalledTimes(1)
    expect(spies.getAllAiConsultations).toHaveBeenCalledTimes(1)
    expect(useDatabaseStore.getState().isInitialized).toBe(true)
  })

  it('importBackupJson realiza la recarga completa canónica tras importar', async () => {
    const backupPayload = {
      version: 6,
      exportedAt: new Date().toISOString(),
      summary: {
        totalSessions: 1,
        totalExercises: 2,
        overallAccuracy: 100,
        overallAvgTimeMs: 1000,
        totalDurationSeconds: 20
      },
      sessions: [
        makeSession({
          id: 'backup_init_1',
          totalQuestions: 2,
          correctAnswers: 2,
          avgResponseTimeMs: 1000,
          durationSeconds: 20
        })
      ],
      answers: [],
      aiReports: [],
      aiConsultations: []
    }

    const spies = spyFullReads()
    const result = await useDatabaseStore
      .getState()
      .importBackupJson(JSON.stringify(backupPayload), 'replace')

    expect(result.success).toBe(true)
    expect(spies.getSummary).toHaveBeenCalledTimes(1)
    expect(spies.getAllSessions).toHaveBeenCalledTimes(1)
    expect(spies.getAllAnswers).toHaveBeenCalledTimes(1)
    expect(spies.getAllAiReports).toHaveBeenCalledTimes(1)
    expect(spies.getAllAiConsultations).toHaveBeenCalledTimes(1)
    expect(useDatabaseStore.getState().sessions.map((s) => s.id)).toEqual(['backup_init_1'])
  })

  it('clearDatabase no realiza lecturas completas del motor', async () => {
    const spies = spyFullReads()

    await useDatabaseStore.getState().clearDatabase()

    expect(spies.getSummary).not.toHaveBeenCalled()
    expect(spies.getAllSessions).not.toHaveBeenCalled()
    expect(spies.getAllAnswers).not.toHaveBeenCalled()
    expect(spies.getAllAiReports).not.toHaveBeenCalled()
    expect(spies.getAllAiConsultations).not.toHaveBeenCalled()
  })
})
