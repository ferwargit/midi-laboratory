import { useState, useCallback, useRef, useEffect } from 'react'
import {
  INTERVAL_PRESETS,
  IntervalPreset,
  IntervalDirection,
  DirectionSelection
} from '../domain/music/intervals'
import {
  IntervalExerciseStimulus,
  IntervalExerciseResult,
  evaluateIntervalAnswer
} from '../domain/exercise/intervalEvaluator'
import { AdvanceMode, SessionLimitType } from '../domain/exercise/types'
import { generateValidInterval } from '../domain/exercise/exerciseGeneratorRules'
import { DbAnswerRecord, DbSessionRecord } from '../domain/database/types'
import { useDatabaseStore } from '../stores/useDatabaseStore'

interface IntervalTrainerOptions {
  onPlayInterval: (root: number, target: number, direction: IntervalDirection) => void
  onTelemetryLog?: (type: 'AI' | 'EVAL', message: string) => void
}

export interface UseIntervalTrainerReturn {
  presets: IntervalPreset[]
  selectedPresetId: string
  setSelectedPresetId: (id: string) => void
  activeIntervals: number[]
  setActiveIntervals: (st: number[]) => void
  toggleInterval: (semitone: number) => void
  directionMode: DirectionSelection
  setDirectionMode: (dir: DirectionSelection) => void
  rootRangeNotes: number[]
  setRootRangeNotes: (notes: number[]) => void
  toggleRootNote: (note: number) => void
  sessionLimitType: SessionLimitType
  setSessionLimitType: (type: SessionLimitType) => void
  sessionQuestionsCount: number
  setSessionQuestionsCount: (count: number) => void
  sessionDurationMinutes: number
  setSessionDurationMinutes: (minutes: number) => void
  timeRemainingSeconds: number
  advanceMode: AdvanceMode
  setAdvanceMode: (mode: AdvanceMode) => void
  isSessionActive: boolean
  isSessionFinished: boolean
  isWaitingManualAdvance: boolean
  currentQuestionIndex: number
  currentStimulus: IntervalExerciseStimulus | null
  waitingNoteStep: 1 | 2
  firstNotePlayed: number | null
  lastResult: IntervalExerciseResult | null
  sessionHistory: IntervalExerciseResult[]
  startSession: (overrideIntervals?: unknown, overrideRoots?: unknown) => void
  stopSession: () => void
  advanceToNextInterval: () => void
  repeatCurrentInterval: () => void
  handleUserNotePlayed: (noteNumber: number, source?: 'midi_hardware' | 'virtual_ui') => void
  trainWeakIntervalsOnly: () => void
  resetToConfig: () => void
}

export function useIntervalTrainer({
  onPlayInterval,
  onTelemetryLog
}: IntervalTrainerOptions): UseIntervalTrainerReturn {
  const [selectedPresetId, setSelectedPresetIdState] = useState<string>('level_1_1_reference')
  const [activeIntervals, setActiveIntervals] = useState<number[]>([2, 4, 5, 7, 12])
  const [directionMode, setDirectionMode] = useState<DirectionSelection>('ascending')
  const [rootRangeNotes, setRootRangeNotes] = useState<number[]>([60])
  const [sessionLimitType, setSessionLimitType] = useState<SessionLimitType>('questions')
  const [sessionQuestionsCount, setSessionQuestionsCount] = useState<number>(10)
  const [sessionDurationMinutes, setSessionDurationMinutesState] = useState<number>(5)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(300)
  const [advanceMode, setAdvanceMode] = useState<AdvanceMode>('smart')
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false)
  const [isSessionFinished, setIsSessionFinished] = useState<boolean>(false)
  const [isWaitingManualAdvance, setIsWaitingManualAdvance] = useState<boolean>(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [currentStimulus, setCurrentStimulus] = useState<IntervalExerciseStimulus | null>(null)
  const [waitingNoteStep, setWaitingNoteStep] = useState<1 | 2>(1)
  const [firstNotePlayed, setFirstNotePlayed] = useState<number | null>(null)
  const [stimulusStartTime, setStimulusStartTime] = useState<number>(0)
  const [lastResult, setLastResult] = useState<IntervalExerciseResult | null>(null)
  const [sessionHistory, setSessionHistory] = useState<IntervalExerciseResult[]>([])

  const saveSessionToDb = useDatabaseStore((state) => state.saveSession)

  const sessionIdRef = useRef<string>('')
  const sessionStartTimeRef = useRef<number>(0)
  const questionTokenRef = useRef<string | null>(null)
  const isAdvancingRef = useRef<boolean>(false)
  const isWaitingAnswerRef = useRef<boolean>(false)

  const activeIntervalsBufferRef = useRef<number[]>([2, 4, 5, 7, 12])
  const rootRangeNotesBufferRef = useRef<number[]>([60])
  const sessionDurationMinutesBufferRef = useRef<number>(5)
  const answersBufferRef = useRef<DbAnswerRecord[]>([])
  const historyBufferRef = useRef<IntervalExerciseResult[]>([])
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionCountdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  const setSessionDurationMinutes = useCallback((minutes: number): void => {
    sessionDurationMinutesBufferRef.current = minutes
    setSessionDurationMinutesState(minutes)
  }, [])

  const cleanupSessionTimers = useCallback((): void => {
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
      cleanupSessionTimers()
    }
  }, [cleanupSessionTimers])

  useEffect(() => {
    activeIntervalsBufferRef.current = activeIntervals
  }, [activeIntervals])

  useEffect(() => {
    rootRangeNotesBufferRef.current = rootRangeNotes
  }, [rootRangeNotes])

  const setSelectedPresetId = (id: string): void => {
    setSelectedPresetIdState(id)
    const preset = INTERVAL_PRESETS.find((p) => p.id === id)
    if (preset) {
      setActiveIntervals([...preset.intervalSemitones])
      activeIntervalsBufferRef.current = [...preset.intervalSemitones]
      setDirectionMode(preset.defaultDirection)
      if (preset.fixedRootNote !== null) {
        setRootRangeNotes([preset.fixedRootNote])
        rootRangeNotesBufferRef.current = [preset.fixedRootNote]
      } else {
        const roots = Array.from({ length: 25 }, (_, i) => 48 + i)
        setRootRangeNotes(roots)
        rootRangeNotesBufferRef.current = roots
      }
    }
  }

  const toggleInterval = (semitone: number): void => {
    setActiveIntervals((prev) =>
      prev.includes(semitone)
        ? prev.filter((st) => st !== semitone)
        : [...prev, semitone].sort((a, b) => a - b)
    )
  }

  const toggleRootNote = (note: number): void => {
    setRootRangeNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note].sort((a, b) => a - b)
    )
  }

  const triggerNextInterval = useCallback(
    (intervalsPool?: number[], rootsPool?: number[]): void => {
      const currentIntervals = intervalsPool || activeIntervalsBufferRef.current
      const currentRoots = rootsPool || rootRangeNotesBufferRef.current

      isAdvancingRef.current = false

      if (currentIntervals.length === 0 || currentRoots.length === 0) return

      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
        autoAdvanceTimerRef.current = null
      }

      const token = `token_int_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      questionTokenRef.current = token

      const lastSt = currentStimulus ? currentStimulus.semitones : null
      const intervalData = generateValidInterval(
        currentIntervals,
        currentRoots,
        directionMode,
        lastSt
      )

      const stimulus: IntervalExerciseStimulus = {
        rootNote: intervalData.rootNote,
        targetNote: intervalData.targetNote,
        semitones: intervalData.semitones,
        direction: intervalData.direction
      }

      setCurrentStimulus(stimulus)
      setWaitingNoteStep(1)
      setFirstNotePlayed(null)
      setLastResult(null)
      setIsWaitingManualAdvance(false)
      isWaitingAnswerRef.current = true
      setStimulusStartTime(Date.now())

      onPlayInterval(stimulus.rootNote, stimulus.targetNote, stimulus.direction)
    },
    [currentStimulus, directionMode, onPlayInterval]
  )

  const finalizeAndSaveSession = useCallback(async (): Promise<void> => {
    cleanupSessionTimers()

    questionTokenRef.current = null
    isAdvancingRef.current = false
    isWaitingAnswerRef.current = false

    const totalSeconds = Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000))

    setIsSessionActive(false)
    setIsSessionFinished(true)
    setIsWaitingManualAdvance(false)
    setWaitingNoteStep(1)
    setFirstNotePlayed(null)

    const allAnswers = [...answersBufferRef.current]
    if (allAnswers.length === 0) return

    const correctCount = historyBufferRef.current.filter((r) => r.isIntervalCorrect).length
    const accPercent = Math.round((correctCount / allAnswers.length) * 100)
    const avgTime = Math.round(
      historyBufferRef.current.reduce((acc, r) => acc + r.responseTimeMs, 0) / allAnswers.length
    )

    const presetLabel =
      sessionLimitType === 'time'
        ? `Intervalos (${activeIntervalsBufferRef.current.length} activos) • Cronometrado ${sessionDurationMinutesBufferRef.current}m`
        : `Intervalos (${activeIntervalsBufferRef.current.length} activos) • Bloque ${allAnswers.length} preguntas`

    const sessionRecord: DbSessionRecord = {
      id: sessionIdRef.current,
      createdAt: new Date().toISOString(),
      strategyId: 'intervals_v1',
      instrumentId: 'piano_intervals',
      presetName: presetLabel,
      totalQuestions: allAnswers.length,
      correctAnswers: correctCount,
      accuracyPercentage: accPercent,
      avgResponseTimeMs: avgTime,
      durationSeconds: totalSeconds
    }

    await saveSessionToDb(sessionRecord, allAnswers)
    sessionIdRef.current = ''
  }, [cleanupSessionTimers, sessionLimitType, saveSessionToDb])

  useEffect(() => {
    if (!isSessionActive || sessionLimitType !== 'time') return

    const interval = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          sessionCountdownTimerRef.current = null
          setIsSessionActive(false)
          setIsSessionFinished(true)
          setIsWaitingManualAdvance(false)
          setWaitingNoteStep(1)
          setFirstNotePlayed(null)
          void finalizeAndSaveSession()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    sessionCountdownTimerRef.current = interval

    return (): void => {
      clearInterval(interval)
      sessionCountdownTimerRef.current = null
    }
  }, [isSessionActive, sessionLimitType, finalizeAndSaveSession])

  const startSession = (overrideIntervals?: unknown, overrideRoots?: unknown): void => {
    cleanupSessionTimers()

    const validIntervals =
      Array.isArray(overrideIntervals) && overrideIntervals.length > 0
        ? (overrideIntervals as number[])
        : activeIntervalsBufferRef.current
    const validRoots =
      Array.isArray(overrideRoots) && overrideRoots.length > 0
        ? (overrideRoots as number[])
        : rootRangeNotesBufferRef.current

    if (validIntervals.length === 0 || validRoots.length === 0) return

    if (Array.isArray(overrideIntervals) && overrideIntervals.length > 0) {
      setActiveIntervals(overrideIntervals as number[])
      activeIntervalsBufferRef.current = overrideIntervals as number[]
    }
    if (Array.isArray(overrideRoots) && overrideRoots.length > 0) {
      setRootRangeNotes(overrideRoots as number[])
      rootRangeNotesBufferRef.current = overrideRoots as number[]
    }

    sessionIdRef.current = `session_int_${Date.now()}`
    sessionStartTimeRef.current = Date.now()
    answersBufferRef.current = []
    historyBufferRef.current = []
    setSessionHistory([])
    setCurrentQuestionIndex(1)
    setIsSessionFinished(false)

    if (sessionLimitType === 'time') {
      setTimeRemainingSeconds(sessionDurationMinutesBufferRef.current * 60)
    }

    setIsSessionActive(true)
    triggerNextInterval(validIntervals, validRoots)
  }

  const advanceToNextInterval = useCallback((): void => {
    if (!isSessionActive || isAdvancingRef.current || isWaitingAnswerRef.current) return
    isAdvancingRef.current = true

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    const isFixedQuestionsCompleted =
      sessionLimitType === 'questions' && currentQuestionIndex >= sessionQuestionsCount

    if (isFixedQuestionsCompleted) {
      finalizeAndSaveSession()
    } else {
      setCurrentQuestionIndex((prev) => prev + 1)
      triggerNextInterval()
    }
  }, [
    currentQuestionIndex,
    finalizeAndSaveSession,
    isSessionActive,
    sessionLimitType,
    sessionQuestionsCount,
    triggerNextInterval
  ])

  const stopSession = useCallback((): void => {
    cleanupSessionTimers()
    if (answersBufferRef.current.length > 0) {
      finalizeAndSaveSession()
    } else {
      questionTokenRef.current = null
      isWaitingAnswerRef.current = false
      setIsSessionActive(false)
      setIsSessionFinished(false)
      setIsWaitingManualAdvance(false)
      setCurrentStimulus(null)
      setFirstNotePlayed(null)
    }
  }, [cleanupSessionTimers, finalizeAndSaveSession])

  const resetToConfig = (): void => {
    cleanupSessionTimers()
    questionTokenRef.current = null
    isWaitingAnswerRef.current = false
    setIsSessionActive(false)
    setIsSessionFinished(false)
    setIsWaitingManualAdvance(false)
    setCurrentStimulus(null)
    setFirstNotePlayed(null)
  }

  const repeatCurrentInterval = (): void => {
    if (currentStimulus) {
      onPlayInterval(
        currentStimulus.rootNote,
        currentStimulus.targetNote,
        currentStimulus.direction
      )
    }
  }

  const handleUserNotePlayed = useCallback(
    (playedNoteNumber: number, source: 'midi_hardware' | 'virtual_ui' = 'midi_hardware'): void => {
      if (!isSessionActive || !currentStimulus || !questionTokenRef.current) return

      if (waitingNoteStep === 1) {
        setFirstNotePlayed(playedNoteNumber)
        setWaitingNoteStep(2)
        if (onTelemetryLog) {
          onTelemetryLog('EVAL', `1ª Nota registrada: ${playedNoteNumber} | Tocá la 2ª nota...`)
        }
        return
      }

      if (waitingNoteStep === 2 && firstNotePlayed !== null) {
        const responseTimeMs = Date.now() - stimulusStartTime
        const playedPair: [number, number] = [firstNotePlayed, playedNoteNumber]
        const result = evaluateIntervalAnswer(currentStimulus, playedPair, responseTimeMs)

        const answerRecord: DbAnswerRecord = {
          id: `ans_int_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          sessionId: sessionIdRef.current,
          questionIndex: currentQuestionIndex,
          expectedNote: currentStimulus.targetNote,
          playedNote: playedNoteNumber,
          isCorrect: result.isIntervalCorrect,
          semitoneDistance: result.semitoneDistanceError,
          responseTimeMs,
          velocity: 90,
          reasonTelemetry: `${result.expectedStimulus.semitones} st (${result.expectedStimulus.direction})`,
          createdAt: new Date().toISOString(),
          inputSource: source
        }

        answersBufferRef.current.push(answerRecord)
        historyBufferRef.current.push(result)

        setLastResult(result)
        setSessionHistory([...historyBufferRef.current])
        isWaitingAnswerRef.current = false
        setWaitingNoteStep(1)
        setFirstNotePlayed(null)

        if (onTelemetryLog) {
          onTelemetryLog('EVAL', result.feedbackMessage)
        }

        const shouldWaitManual =
          advanceMode === 'manual' || (advanceMode === 'smart' && !result.isIntervalCorrect)

        if (shouldWaitManual) {
          setIsWaitingManualAdvance(true)
        } else {
          const delay = advanceMode === 'auto_slow' ? 3500 : 1600
          const scheduledSessionId = sessionIdRef.current
          autoAdvanceTimerRef.current = setTimeout(() => {
            if (sessionIdRef.current !== scheduledSessionId) return
            advanceToNextInterval()
          }, delay)
        }
      }
    },
    [
      isSessionActive,
      currentStimulus,
      waitingNoteStep,
      firstNotePlayed,
      stimulusStartTime,
      currentQuestionIndex,
      onTelemetryLog,
      advanceMode,
      advanceToNextInterval
    ]
  )

  const trainWeakIntervalsOnly = (): void => {
    const weakIntervals: number[] = []
    activeIntervalsBufferRef.current.forEach((st) => {
      const attempts = historyBufferRef.current.filter((h) => h.expectedStimulus.semitones === st)
      if (attempts.length > 0) {
        const correct = attempts.filter((h) => h.isIntervalCorrect).length
        if (correct / attempts.length < 0.85) {
          weakIntervals.push(st)
        }
      }
    })

    if (weakIntervals.length === 0) return

    startSession(weakIntervals)
  }

  return {
    presets: INTERVAL_PRESETS,
    selectedPresetId,
    setSelectedPresetId,
    activeIntervals,
    setActiveIntervals,
    toggleInterval,
    directionMode,
    setDirectionMode,
    rootRangeNotes,
    setRootRangeNotes,
    toggleRootNote,
    sessionLimitType,
    setSessionLimitType,
    sessionQuestionsCount,
    setSessionQuestionsCount,
    sessionDurationMinutes,
    setSessionDurationMinutes,
    timeRemainingSeconds,
    advanceMode,
    setAdvanceMode,
    isSessionActive,
    isSessionFinished,
    isWaitingManualAdvance,
    currentQuestionIndex,
    currentStimulus,
    waitingNoteStep,
    firstNotePlayed,
    lastResult,
    sessionHistory,
    startSession,
    stopSession,
    advanceToNextInterval,
    repeatCurrentInterval,
    handleUserNotePlayed,
    trainWeakIntervalsOnly,
    resetToConfig
  }
}
