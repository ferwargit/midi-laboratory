import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTrainerCore } from './useTrainerCore'
import { useDatabaseStore } from '../stores/useDatabaseStore'

describe('useTrainerCore - Kernel Unificado del Ciclo de Vida de Sesión', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe inicializarse en reposo con límites por defecto', () => {
    const { result } = renderHook(() =>
      useTrainerCore({
        onBuildSessionRecord: vi.fn()
      })
    )

    expect(result.current.isSessionActive).toBe(false)
    expect(result.current.isSessionFinished).toBe(false)
    expect(result.current.currentQuestionIndex).toBe(0)
    expect(result.current.sessionLimitType).toBe('questions')
    expect(result.current.advanceMode).toBe('smart')
  })

  it('startCoreSession activa la sesión e inicializa contadores síncronamente', () => {
    const onTrigger = vi.fn()
    const { result } = renderHook(() =>
      useTrainerCore({
        onBuildSessionRecord: vi.fn()
      })
    )

    act(() => {
      result.current.startCoreSession(
        {
          limitType: 'time',
          durationMinutes: 3,
          advanceMode: 'manual'
        },
        onTrigger
      )
    })

    expect(result.current.isSessionActive).toBe(true)
    expect(result.current.sessionLimitType).toBe('time')
    expect(result.current.timeRemainingSeconds).toBe(180)
    expect(result.current.advanceMode).toBe('manual')
    expect(result.current.currentQuestionIndex).toBe(1)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('recordAnswer en modo smart con error activa pausa manual', () => {
    const onAdvance = vi.fn()
    const { result } = renderHook(() =>
      useTrainerCore({
        defaultAdvanceMode: 'smart',
        onBuildSessionRecord: vi.fn()
      })
    )

    act(() => {
      result.current.startCoreSession()
      result.current.generateQuestionToken()
    })

    act(() => {
      result.current.recordAnswer(
        { correct: false },
        {
          id: 'a1',
          sessionId: result.current.sessionId,
          questionIndex: 1,
          expectedNote: 60,
          playedNote: 62,
          isCorrect: false,
          semitoneDistance: 2,
          responseTimeMs: 1200,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: new Date().toISOString()
        },
        false,
        onAdvance
      )
    })

    expect(result.current.isWaitingManualAdvance).toBe(true)
    expect(result.current.sessionHistory.length).toBe(1)
  })

  it('advanceToNextQuestion en modo mastery finaliza y guarda la sesión cuando checkIsMasteryCompleted es true', async () => {
    const saveSpy = vi
      .spyOn(useDatabaseStore.getState(), 'saveSession')
      .mockResolvedValue(undefined)
    const checkIsMasteryCompleted = vi.fn().mockReturnValue(true)

    const onBuildSessionRecord = vi.fn().mockReturnValue({
      id: 'sess_mastery_1',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Maestría',
      totalQuestions: 2,
      correctAnswers: 2,
      accuracyPercentage: 100,
      avgResponseTimeMs: 900,
      durationSeconds: 15
    })

    const { result } = renderHook(() =>
      useTrainerCore({
        onBuildSessionRecord,
        checkIsMasteryCompleted
      })
    )

    act(() => {
      result.current.startCoreSession({ limitType: 'mastery' })
      result.current.generateQuestionToken()
    })

    act(() => {
      result.current.recordAnswer(
        { correct: true },
        {
          id: 'a1',
          sessionId: result.current.sessionId,
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
        true,
        vi.fn()
      )
    })

    const onTriggerNext = vi.fn()
    await act(async () => {
      result.current.advanceToNextQuestion(onTriggerNext)
    })

    expect(result.current.isSessionActive).toBe(false)
    expect(result.current.isSessionFinished).toBe(true)
    expect(onTriggerNext).not.toHaveBeenCalled()
    expect(saveSpy).toHaveBeenCalledTimes(1)

    saveSpy.mockRestore()
  })

  it('recordAnswer en modo auto_slow programa el avance automático con el delay de 3500ms', () => {
    vi.useFakeTimers()
    const onAdvance = vi.fn()

    const { result } = renderHook(() =>
      useTrainerCore({
        defaultAdvanceMode: 'auto_slow',
        autoAdvanceSlowDelayMs: 3500,
        onBuildSessionRecord: vi.fn()
      })
    )

    act(() => {
      result.current.startCoreSession()
      result.current.generateQuestionToken()
    })

    act(() => {
      result.current.recordAnswer(
        { correct: true },
        {
          id: 'a1',
          sessionId: result.current.sessionId,
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
        true,
        onAdvance
      )
    })

    expect(onAdvance).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onAdvance).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(onAdvance).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('stopCoreSession y resetCoreToConfig invalidan el token y limpian los temporizadores', () => {
    const { result } = renderHook(() =>
      useTrainerCore({
        onBuildSessionRecord: vi.fn()
      })
    )

    act(() => {
      result.current.startCoreSession()
      result.current.generateQuestionToken()
    })

    expect(result.current.isSessionActive).toBe(true)
    expect(result.current.questionToken).not.toBeNull()

    act(() => {
      result.current.resetCoreToConfig()
    })

    expect(result.current.isSessionActive).toBe(false)
    expect(result.current.questionToken).toBeNull()
  })

  it('cuenta regresiva por tiempo finaliza y persiste en base de datos al llegar a 0', async () => {
    vi.useFakeTimers()
    const saveSpy = vi
      .spyOn(useDatabaseStore.getState(), 'saveSession')
      .mockResolvedValue(undefined)

    const onBuildSessionRecord = vi.fn().mockReturnValue({
      id: 'sess_1',
      createdAt: new Date().toISOString(),
      strategyId: 'test',
      instrumentId: 'piano',
      presetName: 'Test',
      totalQuestions: 1,
      correctAnswers: 1,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 60
    })

    const { result } = renderHook(() =>
      useTrainerCore({
        onBuildSessionRecord
      })
    )

    act(() => {
      result.current.startCoreSession({
        limitType: 'time',
        durationMinutes: 1
      })
      result.current.generateQuestionToken()
    })

    act(() => {
      result.current.recordAnswer(
        { correct: true },
        {
          id: 'a1',
          sessionId: result.current.sessionId,
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
        true,
        vi.fn()
      )
    })

    await act(async () => {
      vi.advanceTimersByTime(60000)
    })

    expect(result.current.isSessionActive).toBe(false)
    expect(result.current.isSessionFinished).toBe(true)
    expect(saveSpy).toHaveBeenCalledTimes(1)

    saveSpy.mockRestore()
    vi.useRealTimers()
  })

  it('registra saveError si saveSession de IndexedDB falla al finalizar la sesión', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const saveSpy = vi
      .spyOn(useDatabaseStore.getState(), 'saveSession')
      .mockRejectedValueOnce(new Error('QuotaExceededError: Disco lleno'))

    const onBuildSessionRecord = vi.fn().mockReturnValue({
      id: 'sess_quota_err',
      createdAt: new Date().toISOString(),
      strategyId: 'test',
      instrumentId: 'piano',
      presetName: 'Test',
      totalQuestions: 1,
      correctAnswers: 1,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 10
    })

    const { result } = renderHook(() =>
      useTrainerCore({
        onBuildSessionRecord
      })
    )

    act(() => {
      result.current.startCoreSession()
      result.current.generateQuestionToken()
    })

    act(() => {
      result.current.recordAnswer(
        { correct: true },
        {
          id: 'a1',
          sessionId: result.current.sessionId,
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
        true,
        vi.fn()
      )
    })

    await act(async () => {
      await result.current.finalizeAndSaveSession()
    })

    expect(result.current.saveError).toContain('QuotaExceededError')

    act(() => {
      result.current.clearSaveError()
    })
    expect(result.current.saveError).toBeNull()

    saveSpy.mockRestore()
    consoleSpy.mockRestore()
  })
})
