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
      result.current.setIsWaitingAnswer(true)
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
        onAdvance,
        result.current.questionToken!
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
      result.current.setIsWaitingAnswer(true)
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
        vi.fn(),
        result.current.questionToken!
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
      result.current.setIsWaitingAnswer(true)
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
        onAdvance,
        result.current.questionToken!
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

  it('recordAnswer en modo smart con delay por defecto programa el avance a los 1500ms', () => {
    vi.useFakeTimers()
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
      result.current.setIsWaitingAnswer(true)
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
        onAdvance,
        result.current.questionToken!
      )
    })

    expect(onAdvance).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1400)
    })
    expect(onAdvance).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onAdvance).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('recordAnswer en modo smart respeta el override de autoAdvanceSmartDelayMs (1200ms)', () => {
    vi.useFakeTimers()
    const onAdvance = vi.fn()

    const { result } = renderHook(() =>
      useTrainerCore({
        defaultAdvanceMode: 'smart',
        autoAdvanceSmartDelayMs: 1200,
        onBuildSessionRecord: vi.fn()
      })
    )

    act(() => {
      result.current.startCoreSession()
      result.current.generateQuestionToken()
      result.current.setIsWaitingAnswer(true)
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
        onAdvance,
        result.current.questionToken!
      )
    })

    expect(onAdvance).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1100)
    })
    expect(onAdvance).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onAdvance).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('el override de autoAdvanceSmartDelayMs no altera el retardo del modo auto_fast', () => {
    vi.useFakeTimers()
    const onAdvance = vi.fn()

    const { result } = renderHook(() =>
      useTrainerCore({
        defaultAdvanceMode: 'auto_fast',
        autoAdvanceSmartDelayMs: 1200,
        onBuildSessionRecord: vi.fn()
      })
    )

    act(() => {
      result.current.startCoreSession()
      result.current.generateQuestionToken()
      result.current.setIsWaitingAnswer(true)
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
        onAdvance,
        result.current.questionToken!
      )
    })

    expect(onAdvance).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1300)
    })
    expect(onAdvance).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
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
      result.current.setIsWaitingAnswer(true)
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
        vi.fn(),
        result.current.questionToken!
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
      result.current.setIsWaitingAnswer(true)
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
        vi.fn(),
        result.current.questionToken!
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

  it('genera sessionId y questionToken con entropía UUIDv4 (crypto.randomUUID)', () => {
    const { result } = renderHook(() =>
      useTrainerCore({
        onBuildSessionRecord: vi.fn()
      })
    )

    const uuidV4 = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'

    act(() => {
      result.current.startCoreSession()
      result.current.generateQuestionToken('token')
    })

    expect(result.current.sessionId).toMatch(new RegExp(`^session_${uuidV4}$`))
    expect(result.current.questionToken).toMatch(new RegExp(`^token_${uuidV4}$`))
  })

  it('invocaciones consecutivas producen identificadores distintos (unicidad)', () => {
    const { result } = renderHook(() =>
      useTrainerCore({
        onBuildSessionRecord: vi.fn()
      })
    )

    act(() => {
      result.current.startCoreSession()
    })
    const firstSessionId = result.current.sessionId

    act(() => {
      result.current.generateQuestionToken('token')
    })
    const firstToken = result.current.questionToken

    act(() => {
      result.current.startCoreSession()
      result.current.generateQuestionToken('token')
    })

    expect(result.current.sessionId).not.toBe(firstSessionId)
    expect(result.current.questionToken).not.toBe(firstToken)
  })

  it('F01: respuesta duplicada con el mismo token es ignorada', () => {
    vi.useFakeTimers()
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
      result.current.setIsWaitingAnswer(true)
    })

    const token = result.current.questionToken!

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
        onAdvance,
        token
      )
    })

    expect(result.current.sessionHistory.length).toBe(1)
    expect(result.current.answersBuffer.length).toBe(1)

    act(() => {
      result.current.recordAnswer(
        { correct: true },
        {
          id: 'a2',
          sessionId: result.current.sessionId,
          questionIndex: 1,
          expectedNote: 60,
          playedNote: 62,
          isCorrect: true,
          semitoneDistance: 2,
          responseTimeMs: 500,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: new Date().toISOString()
        },
        true,
        onAdvance,
        token
      )
    })

    expect(result.current.sessionHistory.length).toBe(1)
    expect(result.current.answersBuffer.length).toBe(1)

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(onAdvance).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('F01: respuesta con token desfasado es descartada', () => {
    vi.useFakeTimers()
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
      result.current.setIsWaitingAnswer(true)
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
        onAdvance,
        'token_stale_de_pregunta_anterior'
      )
    })

    expect(result.current.sessionHistory.length).toBe(0)
    expect(result.current.answersBuffer.length).toBe(0)

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onAdvance).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('F01: autoAdvanceTimerRef limpia el temporizador previo al reprogramar', () => {
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
      result.current.setIsWaitingAnswer(true)
    })
    const firstToken = result.current.questionToken!

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
        onAdvance,
        firstToken
      )
    })

    act(() => {
      result.current.generateQuestionToken()
      result.current.setIsWaitingAnswer(true)
    })
    const secondToken = result.current.questionToken!

    act(() => {
      result.current.recordAnswer(
        { correct: true },
        {
          id: 'a2',
          sessionId: result.current.sessionId,
          questionIndex: 2,
          expectedNote: 62,
          playedNote: 62,
          isCorrect: true,
          semitoneDistance: 0,
          responseTimeMs: 800,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: new Date().toISOString()
        },
        true,
        onAdvance,
        secondToken
      )
    })

    act(() => {
      vi.advanceTimersByTime(3600)
    })

    expect(onAdvance).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('F07: isWaitingManualAdvance se resetea a false tras un acierto en modo smart', () => {
    const { result } = renderHook(() =>
      useTrainerCore({
        defaultAdvanceMode: 'smart',
        onBuildSessionRecord: vi.fn()
      })
    )

    act(() => {
      result.current.startCoreSession()
      result.current.generateQuestionToken()
      result.current.setIsWaitingAnswer(true)
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
        vi.fn(),
        result.current.questionToken!
      )
    })

    expect(result.current.isWaitingManualAdvance).toBe(true)

    act(() => {
      result.current.advanceToNextQuestion(() => {})
    })

    act(() => {
      result.current.generateQuestionToken()
      result.current.setIsWaitingAnswer(true)
    })

    act(() => {
      result.current.recordAnswer(
        { correct: true },
        {
          id: 'a2',
          sessionId: result.current.sessionId,
          questionIndex: 2,
          expectedNote: 62,
          playedNote: 62,
          isCorrect: true,
          semitoneDistance: 0,
          responseTimeMs: 700,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: new Date().toISOString()
        },
        true,
        vi.fn(),
        result.current.questionToken!
      )
    })

    expect(result.current.isWaitingManualAdvance).toBe(false)
    expect(result.current.sessionHistory.length).toBe(2)
  })

  it('F01: auto-avance desfasado abortado por rotación de token en vuelo', () => {
    vi.useFakeTimers()
    const onAdvance = vi.fn()

    const { result } = renderHook(() =>
      useTrainerCore({
        defaultAdvanceMode: 'auto_fast',
        autoAdvanceFastDelayMs: 1500,
        onBuildSessionRecord: vi.fn()
      })
    )

    act(() => {
      result.current.startCoreSession()
      result.current.generateQuestionToken()
      result.current.setIsWaitingAnswer(true)
    })
    const scheduledToken = result.current.questionToken

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
        onAdvance,
        scheduledToken!
      )
    })

    expect(result.current.currentQuestionIndex).toBe(1)

    // Rotación de token en vuelo: la pregunta programada ya no es la vigente
    act(() => {
      result.current.generateQuestionToken()
    })
    expect(result.current.questionToken).not.toBe(scheduledToken)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(onAdvance).not.toHaveBeenCalled()
    expect(result.current.currentQuestionIndex).toBe(1)

    vi.useRealTimers()
  })

  it('F01: token nulo o inválido rechazado silenciosamente sin alterar el historial', () => {
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
      result.current.setIsWaitingAnswer(true)
    })

    const tokenBefore = result.current.questionToken

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
        onAdvance,
        null as unknown as string
      )
    })

    expect(result.current.sessionHistory.length).toBe(0)
    expect(result.current.answersBuffer.length).toBe(0)
    expect(result.current.lastResult).toBeNull()
    expect(result.current.questionToken).toBe(tokenBefore)
    expect(result.current.isWaitingAnswer).toBe(true)
  })
})
