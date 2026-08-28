import { useState, useRef, useCallback, useEffect } from 'react'
import { AdvanceMode, SessionLimitType } from '../domain/exercise/types'
import { DbAnswerRecord, DbSessionRecord } from '../domain/database/types'
import { useDatabaseStore } from '../stores/useDatabaseStore'
import { DEFAULT_APP_CONFIG } from '../domain/ai/appConfig'

export interface TrainerCoreOptions<TResult> {
  defaultLimitType?: SessionLimitType
  defaultQuestionsCount?: number
  defaultDurationMinutes?: number
  defaultAdvanceMode?: AdvanceMode
  autoAdvanceFastDelayMs?: number
  autoAdvanceSlowDelayMs?: number
  onBuildSessionRecord: (ctx: {
    sessionId: string
    totalSeconds: number
    answers: DbAnswerRecord[]
    history: TResult[]
    limitType: SessionLimitType
    durationMinutes: number
  }) => DbSessionRecord
  checkIsMasteryCompleted?: (history: TResult[]) => boolean
}

export interface CoreStartSessionOptions {
  limitType?: SessionLimitType
  questionsCount?: number
  durationMinutes?: number
  advanceMode?: AdvanceMode
}

export interface UseTrainerCoreReturn<TResult> {
  sessionLimitType: SessionLimitType
  setSessionLimitType: (type: SessionLimitType) => void
  sessionQuestionsCount: number
  setSessionQuestionsCount: (count: number) => void
  sessionDurationMinutes: number
  setSessionDurationMinutes: (minutes: number) => void
  timeRemainingSeconds: number
  setTimeRemainingSeconds: (seconds: number) => void
  sessionElapsedSeconds: number
  advanceMode: AdvanceMode
  setAdvanceMode: (mode: AdvanceMode) => void
  isSessionActive: boolean
  isSessionFinished: boolean
  isWaitingManualAdvance: boolean
  isWaitingAnswer: boolean
  setIsWaitingAnswer: (waiting: boolean) => void
  currentQuestionIndex: number
  sessionId: string
  lastResult: TResult | null
  setLastResult: (result: TResult | null) => void
  sessionHistory: TResult[]
  setSessionHistory: (history: TResult[]) => void
  answersBuffer: DbAnswerRecord[]
  questionToken: string | null
  saveError: string | null
  clearSaveError: () => void
  generateQuestionToken: (prefix?: string) => string
  recordPreAnswerRepeat: () => void
  recordPostErrorRepeat: () => void
  startCoreSession: (
    options?: CoreStartSessionOptions,
    onTriggerFirstStimulus?: () => void
  ) => { sessionId: string; limitType: SessionLimitType; durationMinutes: number }
  advanceToNextQuestion: (
    onTriggerNextStimulus: () => void,
    onCustomCompletionCheck?: (history: TResult[]) => boolean
  ) => void
  recordAnswer: (
    result: TResult,
    answerRecord: DbAnswerRecord,
    isCorrectForSmartAdvance: boolean,
    onAdvanceTrigger: () => void
  ) => void
  stopCoreSession: () => void
  resetCoreToConfig: () => void
  cleanupTimers: () => void
  finalizeAndSaveSession: () => Promise<void>
}

export function useTrainerCore<TResult>({
  defaultLimitType = 'questions',
  defaultQuestionsCount = 10,
  defaultDurationMinutes = 5,
  defaultAdvanceMode = 'smart',
  autoAdvanceFastDelayMs = DEFAULT_APP_CONFIG.midi.autoAdvanceFastDelayMs,
  autoAdvanceSlowDelayMs = DEFAULT_APP_CONFIG.midi.autoAdvanceSlowDelayMs,
  onBuildSessionRecord,
  checkIsMasteryCompleted
}: TrainerCoreOptions<TResult>): UseTrainerCoreReturn<TResult> {
  const [sessionLimitType, setSessionLimitTypeState] = useState<SessionLimitType>(defaultLimitType)
  const [sessionQuestionsCount, setSessionQuestionsCountState] =
    useState<number>(defaultQuestionsCount)
  const [sessionDurationMinutes, setSessionDurationMinutesState] =
    useState<number>(defaultDurationMinutes)
  const [timeRemainingSeconds, setTimeRemainingSecondsState] = useState<number>(
    defaultDurationMinutes * 60
  )
  const [sessionElapsedSeconds, setSessionElapsedSecondsState] = useState<number>(0)
  const [advanceMode, setAdvanceModeState] = useState<AdvanceMode>(defaultAdvanceMode)

  const [isSessionActive, setIsSessionActiveState] = useState<boolean>(false)
  const [isSessionFinished, setIsSessionFinishedState] = useState<boolean>(false)
  const [isWaitingManualAdvance, setIsWaitingManualAdvanceState] = useState<boolean>(false)
  const [isWaitingAnswer, setIsWaitingAnswerState] = useState<boolean>(false)
  const [currentQuestionIndex, setCurrentQuestionIndexState] = useState<number>(0)
  const [lastResult, setLastResultState] = useState<TResult | null>(null)
  const [sessionHistory, setSessionHistoryState] = useState<TResult[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  const saveSessionToDb = useDatabaseStore((state) => state.saveSession)

  const sessionIdRef = useRef<string>('')
  const sessionStartTimeRef = useRef<number>(0)
  const questionTokenRef = useRef<string | null>(null)
  const isAdvancingRef = useRef<boolean>(false)
  const isWaitingAnswerRef = useRef<boolean>(false)

  // 🔬 Tracking Metacognitivo
  const preAnswerListensRef = useRef<number>(1)
  const postErrorListensRef = useRef<number>(0)
  const errorPauseStartTimeRef = useRef<number>(0)

  const sessionLimitTypeRef = useRef<SessionLimitType>(defaultLimitType)
  const sessionQuestionsCountRef = useRef<number>(defaultQuestionsCount)
  const sessionDurationMinutesRef = useRef<number>(defaultDurationMinutes)
  const timeRemainingRef = useRef<number>(defaultDurationMinutes * 60)
  const advanceModeRef = useRef<AdvanceMode>(defaultAdvanceMode)

  const isSessionActiveRef = useRef<boolean>(false)
  const currentQuestionIndexRef = useRef<number>(0)

  const answersBufferRef = useRef<DbAnswerRecord[]>([])
  const historyBufferRef = useRef<TResult[]>([])

  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finalizingSessionsRef = useRef<Set<string>>(new Set())

  const setSessionLimitType = useCallback((type: SessionLimitType): void => {
    sessionLimitTypeRef.current = type
    setSessionLimitTypeState(type)
  }, [])

  const setSessionQuestionsCount = useCallback((count: number): void => {
    sessionQuestionsCountRef.current = count
    setSessionQuestionsCountState(count)
  }, [])

  const setSessionDurationMinutes = useCallback((minutes: number): void => {
    sessionDurationMinutesRef.current = minutes
    setSessionDurationMinutesState(minutes)
  }, [])

  const setTimeRemainingSeconds = useCallback((seconds: number): void => {
    timeRemainingRef.current = seconds
    setTimeRemainingSecondsState(seconds)
  }, [])

  const setAdvanceMode = useCallback((mode: AdvanceMode): void => {
    advanceModeRef.current = mode
    setAdvanceModeState(mode)
  }, [])

  const setIsWaitingAnswer = useCallback((waiting: boolean): void => {
    isWaitingAnswerRef.current = waiting
    setIsWaitingAnswerState(waiting)
  }, [])

  const setLastResult = useCallback((res: TResult | null): void => {
    setLastResultState(res)
  }, [])

  const setSessionHistory = useCallback((hist: TResult[]): void => {
    historyBufferRef.current = hist
    setSessionHistoryState(hist)
  }, [])

  const clearSaveError = useCallback((): void => {
    setSaveError(null)
  }, [])

  const recordPreAnswerRepeat = useCallback((): void => {
    preAnswerListensRef.current += 1
  }, [])

  const recordPostErrorRepeat = useCallback((): void => {
    postErrorListensRef.current += 1
  }, [])

  const cleanupTimers = useCallback((): void => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
    if (sessionCountdownTimerRef.current) {
      clearInterval(sessionCountdownTimerRef.current)
      sessionCountdownTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return (): void => {
      cleanupTimers()
    }
  }, [cleanupTimers])

  const generateQuestionToken = useCallback((prefix = 'token'): string => {
    const token = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    questionTokenRef.current = token
    preAnswerListensRef.current = 1
    postErrorListensRef.current = 0
    errorPauseStartTimeRef.current = 0
    return token
  }, [])

  const finalizeAndSaveSession = useCallback(async (): Promise<void> => {
    const currentSessionId = sessionIdRef.current
    if (!currentSessionId || finalizingSessionsRef.current.has(currentSessionId)) return

    finalizingSessionsRef.current.add(currentSessionId)
    cleanupTimers()

    // Consolidar tiempo de reflexión de la última respuesta si fue error
    if (answersBufferRef.current.length > 0) {
      const lastAns = answersBufferRef.current[answersBufferRef.current.length - 1]
      if (!lastAns.isCorrect && errorPauseStartTimeRef.current > 0) {
        lastAns.postErrorListens = postErrorListensRef.current
        lastAns.postErrorDwellTimeMs = Math.round(Date.now() - errorPauseStartTimeRef.current)
      }
    }

    questionTokenRef.current = null
    isAdvancingRef.current = false
    isWaitingAnswerRef.current = false

    const totalSeconds = Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000))
    setSessionElapsedSecondsState(totalSeconds)

    isSessionActiveRef.current = false
    setIsSessionActiveState(false)

    setIsSessionFinishedState(true)

    setIsWaitingManualAdvanceState(false)
    setIsWaitingAnswer(false)

    const allAnswers = [...answersBufferRef.current]
    const finalHistory = [...historyBufferRef.current]

    if (allAnswers.length === 0) {
      finalizingSessionsRef.current.delete(currentSessionId)
      sessionIdRef.current = ''
      return
    }

    const sessionRecord = onBuildSessionRecord({
      sessionId: currentSessionId,
      totalSeconds,
      answers: allAnswers,
      history: finalHistory,
      limitType: sessionLimitTypeRef.current,
      durationMinutes: sessionDurationMinutesRef.current
    })

    try {
      await saveSessionToDb(sessionRecord, allAnswers)
      setSaveError(null)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[useTrainerCore] Error saving session to database:', err)
      setSaveError(
        `No se pudo guardar la sesión en la base de datos local (${errMsg}). Verifique el espacio disponible.`
      )
    } finally {
      finalizingSessionsRef.current.delete(currentSessionId)
      sessionIdRef.current = ''
    }
  }, [cleanupTimers, onBuildSessionRecord, saveSessionToDb, setIsWaitingAnswer])

  const startCoreSession = useCallback(
    (
      options?: CoreStartSessionOptions,
      onTriggerFirstStimulus?: () => void
    ): { sessionId: string; limitType: SessionLimitType; durationMinutes: number } => {
      cleanupTimers()
      setSaveError(null)

      let limitType = sessionLimitTypeRef.current
      let questionsCount = sessionQuestionsCountRef.current
      let durationMinutes = sessionDurationMinutesRef.current
      let currentAdvanceMode = advanceModeRef.current

      if (options) {
        if (options.limitType) {
          limitType = options.limitType
          setSessionLimitType(limitType)
        }
        if (typeof options.questionsCount === 'number') {
          questionsCount = options.questionsCount
          setSessionQuestionsCount(questionsCount)
        }
        if (typeof options.durationMinutes === 'number') {
          durationMinutes = options.durationMinutes
          setSessionDurationMinutes(durationMinutes)
        }
        if (options.advanceMode) {
          currentAdvanceMode = options.advanceMode
          setAdvanceMode(currentAdvanceMode)
        }
      }

      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      sessionIdRef.current = newSessionId
      sessionStartTimeRef.current = Date.now()

      answersBufferRef.current = []
      historyBufferRef.current = []
      preAnswerListensRef.current = 1
      postErrorListensRef.current = 0
      errorPauseStartTimeRef.current = 0

      setSessionHistoryState([])
      setLastResultState(null)
      setSessionElapsedSecondsState(0)

      currentQuestionIndexRef.current = 1
      setCurrentQuestionIndexState(1)

      setIsSessionFinishedState(false)
      setIsWaitingManualAdvanceState(false)

      isSessionActiveRef.current = true
      setIsSessionActiveState(true)

      if (limitType === 'time') {
        const initialSeconds = durationMinutes * 60
        setTimeRemainingSeconds(initialSeconds)

        const scheduledId = newSessionId
        const interval = setInterval(() => {
          if (sessionIdRef.current !== scheduledId) {
            clearInterval(interval)
            return
          }

          const next = Math.max(0, timeRemainingRef.current - 1)
          setTimeRemainingSeconds(next)

          if (next <= 0) {
            clearInterval(interval)
            sessionCountdownTimerRef.current = null
            void finalizeAndSaveSession()
          }
        }, 1000)

        sessionCountdownTimerRef.current = interval
      }

      if (onTriggerFirstStimulus) {
        onTriggerFirstStimulus()
      }

      return { sessionId: newSessionId, limitType, durationMinutes }
    },
    [
      cleanupTimers,
      finalizeAndSaveSession,
      setAdvanceMode,
      setSessionDurationMinutes,
      setSessionLimitType,
      setSessionQuestionsCount,
      setTimeRemainingSeconds
    ]
  )

  const advanceToNextQuestion = useCallback(
    (
      onTriggerNextStimulus: () => void,
      onCustomCompletionCheck?: (history: TResult[]) => boolean
    ): void => {
      if (!isSessionActiveRef.current || isAdvancingRef.current || isWaitingAnswerRef.current)
        return
      isAdvancingRef.current = true

      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
        autoAdvanceTimerRef.current = null
      }

      // Consolidar tiempo de reflexión y re-escuchas en la respuesta previa
      if (answersBufferRef.current.length > 0) {
        const lastAns = answersBufferRef.current[answersBufferRef.current.length - 1]
        if (!lastAns.isCorrect && errorPauseStartTimeRef.current > 0) {
          lastAns.postErrorListens = postErrorListensRef.current
          lastAns.postErrorDwellTimeMs = Math.round(Date.now() - errorPauseStartTimeRef.current)
        }
      }

      const isMasteryCompleted =
        sessionLimitTypeRef.current === 'mastery' &&
        (onCustomCompletionCheck
          ? onCustomCompletionCheck(historyBufferRef.current)
          : checkIsMasteryCompleted
            ? checkIsMasteryCompleted(historyBufferRef.current)
            : false)

      const isQuestionsCompleted =
        sessionLimitTypeRef.current === 'questions' &&
        currentQuestionIndexRef.current >= sessionQuestionsCountRef.current

      if (isMasteryCompleted || isQuestionsCompleted) {
        void finalizeAndSaveSession()
      } else {
        currentQuestionIndexRef.current += 1
        setCurrentQuestionIndexState((prev) => prev + 1)
        preAnswerListensRef.current = 1
        postErrorListensRef.current = 0
        errorPauseStartTimeRef.current = 0
        onTriggerNextStimulus()
        isAdvancingRef.current = false
      }
    },
    [checkIsMasteryCompleted, finalizeAndSaveSession]
  )

  const recordAnswer = useCallback(
    (
      result: TResult,
      answerRecord: DbAnswerRecord,
      isCorrectForSmartAdvance: boolean,
      onAdvanceTrigger: () => void
    ): void => {
      if (!isSessionActiveRef.current || !questionTokenRef.current) return

      // Estampar telemetría de escuchas previas
      answerRecord.preAnswerListens = preAnswerListensRef.current
      answerRecord.postErrorListens = 0
      answerRecord.postErrorDwellTimeMs = 0

      answersBufferRef.current.push(answerRecord)
      historyBufferRef.current.push(result)

      setLastResultState(result)
      setSessionHistoryState([...historyBufferRef.current])
      setIsWaitingAnswer(false)

      const mode = advanceModeRef.current
      const shouldWaitManual = mode === 'manual' || (mode === 'smart' && !isCorrectForSmartAdvance)

      if (shouldWaitManual) {
        setIsWaitingManualAdvanceState(true)
        if (!isCorrectForSmartAdvance) {
          errorPauseStartTimeRef.current = Date.now()
          postErrorListensRef.current = 0
        }
      } else {
        const delay = mode === 'auto_slow' ? autoAdvanceSlowDelayMs : autoAdvanceFastDelayMs
        const currentId = sessionIdRef.current

        autoAdvanceTimerRef.current = setTimeout(() => {
          if (sessionIdRef.current !== currentId) return
          onAdvanceTrigger()
        }, delay)
      }
    },
    [autoAdvanceFastDelayMs, autoAdvanceSlowDelayMs, setIsWaitingAnswer]
  )

  const stopCoreSession = useCallback((): void => {
    cleanupTimers()
    if (answersBufferRef.current.length > 0) {
      void finalizeAndSaveSession()
    } else {
      questionTokenRef.current = null
      sessionIdRef.current = ''
      isAdvancingRef.current = false
      isWaitingAnswerRef.current = false

      setIsSessionActiveState(false)
      setIsSessionFinishedState(false)
      setIsWaitingAnswerState(false)
      setIsWaitingManualAdvanceState(false)
    }
  }, [cleanupTimers, finalizeAndSaveSession])

  const resetCoreToConfig = useCallback((): void => {
    cleanupTimers()
    questionTokenRef.current = null
    sessionIdRef.current = ''
    isAdvancingRef.current = false
    isWaitingAnswerRef.current = false
    setSaveError(null)

    setIsSessionActiveState(false)
    setIsSessionFinishedState(false)
    setIsWaitingAnswerState(false)
    setIsWaitingManualAdvanceState(false)
  }, [cleanupTimers])

  return {
    sessionLimitType,
    setSessionLimitType,
    sessionQuestionsCount,
    setSessionQuestionsCount,
    sessionDurationMinutes,
    setSessionDurationMinutes,
    timeRemainingSeconds,
    setTimeRemainingSeconds,
    sessionElapsedSeconds,
    advanceMode,
    setAdvanceMode,
    isSessionActive,
    isSessionFinished,
    isWaitingManualAdvance,
    isWaitingAnswer,
    setIsWaitingAnswer,
    currentQuestionIndex,
    get sessionId() {
      return sessionIdRef.current
    },
    lastResult,
    setLastResult,
    sessionHistory,
    setSessionHistory,
    get answersBuffer() {
      return answersBufferRef.current
    },
    get questionToken() {
      return questionTokenRef.current
    },
    saveError,
    clearSaveError,
    generateQuestionToken,
    recordPreAnswerRepeat,
    recordPostErrorRepeat,
    startCoreSession,
    advanceToNextQuestion,
    recordAnswer,
    stopCoreSession,
    resetCoreToConfig,
    cleanupTimers,
    finalizeAndSaveSession
  }
}
