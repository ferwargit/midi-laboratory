import { useState, useCallback, useRef, useEffect } from 'react'
import {
  SEQUENCE_PRESETS,
  SequencePreset,
  generateMelodicSequence
} from '../domain/music/sequences'
import {
  SequenceExerciseResult,
  evaluateSequenceAnswer
} from '../domain/exercise/sequenceEvaluator'
import { AdvanceMode, SessionLimitType } from '../domain/exercise/types'
import { DbAnswerRecord, DbSessionRecord } from '../domain/database/types'
import { useDatabaseStore } from '../stores/useDatabaseStore'

interface SequenceTrainerOptions {
  onPlaySequence: (notes: number[]) => void
  onTelemetryLog?: (type: 'AI' | 'EVAL', message: string) => void
}

export interface UseSequenceTrainerReturn {
  presets: SequencePreset[]
  selectedPresetId: string
  setSelectedPresetId: (id: string) => void
  sequenceLength: number
  setSequenceLength: (len: number) => void
  customCandidateNotes: number[]
  setCustomCandidateNotes: (notes: number[]) => void
  toggleCustomNote: (note: number) => void
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
  currentSequence: number[]
  capturedNotes: number[]
  lastResult: SequenceExerciseResult | null
  sessionHistory: SequenceExerciseResult[]
  startSession: (overrideNotes?: unknown, overrideLength?: unknown) => void
  stopSession: () => void
  advanceToNextSequence: () => void
  repeatCurrentSequence: () => void
  handleUserNotePlayed: (noteNumber: number) => void
  trainWeakMotifsOnly: () => void
  resetToConfig: () => void
}

export function useSequenceTrainer({
  onPlaySequence,
  onTelemetryLog
}: SequenceTrainerOptions): UseSequenceTrainerReturn {
  const [selectedPresetId, setSelectedPresetIdState] = useState<string>(
    'level_2_0_diatonic_stepwise'
  )
  const [sequenceLength, setSequenceLength] = useState<number>(3)
  const [customCandidateNotes, setCustomCandidateNotes] = useState<number[]>([60, 62, 64, 65, 67])
  const [sessionLimitType, setSessionLimitType] = useState<SessionLimitType>('questions')
  const [sessionQuestionsCount, setSessionQuestionsCount] = useState<number>(10)
  const [sessionDurationMinutes, setSessionDurationMinutesState] = useState<number>(5)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(300)
  const [advanceMode, setAdvanceMode] = useState<AdvanceMode>('smart')
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false)
  const [isSessionFinished, setIsSessionFinished] = useState<boolean>(false)
  const [isWaitingManualAdvance, setIsWaitingManualAdvance] = useState<boolean>(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [currentSequence, setCurrentSequence] = useState<number[]>([])
  const [capturedNotes, setCapturedNotes] = useState<number[]>([])
  const [stimulusStartTime, setStimulusStartTime] = useState<number>(0)
  const [lastResult, setLastResult] = useState<SequenceExerciseResult | null>(null)
  const [sessionHistory, setSessionHistory] = useState<SequenceExerciseResult[]>([])

  const saveSessionToDb = useDatabaseStore((state) => state.saveSession)

  const sessionIdRef = useRef<string>('')
  const sessionStartTimeRef = useRef<number>(0)
  const questionTokenRef = useRef<string | null>(null)
  const isAdvancingRef = useRef<boolean>(false)
  const isWaitingAnswerRef = useRef<boolean>(false)

  const customCandidateNotesBufferRef = useRef<number[]>([60, 62, 64, 65, 67])
  const sequenceLengthBufferRef = useRef<number>(3)
  const sessionDurationMinutesBufferRef = useRef<number>(5)
  const answersBufferRef = useRef<DbAnswerRecord[]>([])
  const historyBufferRef = useRef<SequenceExerciseResult[]>([])

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
    customCandidateNotesBufferRef.current = customCandidateNotes
  }, [customCandidateNotes])

  useEffect(() => {
    sequenceLengthBufferRef.current = sequenceLength
  }, [sequenceLength])

  const setSelectedPresetId = (id: string): void => {
    setSelectedPresetIdState(id)
    const preset = SEQUENCE_PRESETS.find((p) => p.id === id)
    if (preset) {
      setSequenceLength(preset.length)
      sequenceLengthBufferRef.current = preset.length
      setCustomCandidateNotes([...preset.candidateNotes])
      customCandidateNotesBufferRef.current = [...preset.candidateNotes]
    }
  }

  const toggleCustomNote = (note: number): void => {
    setCustomCandidateNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note].sort((a, b) => a - b)
    )
  }

  const triggerNextSequence = useCallback(
    (notesPool?: number[], lengthToUse?: number): void => {
      const currentPool = notesPool || customCandidateNotesBufferRef.current
      const currentLen = lengthToUse || sequenceLengthBufferRef.current

      if (currentPool.length < 2) return

      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
        autoAdvanceTimerRef.current = null
      }

      const token = `token_seq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      questionTokenRef.current = token

      const preset = SEQUENCE_PRESETS.find((p) => p.id === selectedPresetId)
      const maxJump = preset ? preset.maxJumpSemitones : 12
      const allowRepeat = preset ? preset.allowRepeatedConsecutive : true

      const sequence = generateMelodicSequence(currentPool, currentLen, maxJump, allowRepeat)

      setCurrentSequence(sequence)
      setCapturedNotes([])
      setLastResult(null)
      setIsWaitingManualAdvance(false)
      isWaitingAnswerRef.current = true
      setStimulusStartTime(Date.now())

      isAdvancingRef.current = false

      onPlaySequence(sequence)
    },
    [selectedPresetId, onPlaySequence]
  )

  const finalizeAndSaveSession = useCallback(async (): Promise<void> => {
    console.debug('[useSequenceTrainer] finalizeAndSaveSession called for sessionId=', sessionIdRef.current)
    cleanupSessionTimers()

    questionTokenRef.current = null
    isAdvancingRef.current = false
    isWaitingAnswerRef.current = false

    const totalSeconds = Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000))

    setIsSessionActive(false)
    setIsSessionFinished(true)
    setIsWaitingManualAdvance(false)
    setCapturedNotes([])

    const allAnswers = [...answersBufferRef.current]
    if (allAnswers.length === 0) return

    const exactCount = historyBufferRef.current.filter((r) => r.isExactMatch).length
    const avgScore = Math.round(
      historyBufferRef.current.reduce((acc, r) => acc + r.similarityScorePercentage, 0) /
        allAnswers.length
    )
    const avgTime = Math.round(
      historyBufferRef.current.reduce((acc, r) => acc + r.responseTimeMs, 0) / allAnswers.length
    )

    const presetLabel =
      sessionLimitType === 'time'
        ? `Secuencias Tiempo (${sessionDurationMinutesBufferRef.current}m)`
        : `Secuencias (${sequenceLengthBufferRef.current} notas)`

    const sessionRecord: DbSessionRecord = {
      id: sessionIdRef.current,
      createdAt: new Date().toISOString(),
      strategyId: 'sequences_v1',
      instrumentId: 'piano_sequences',
      presetName: presetLabel,
      totalQuestions: allAnswers.length,
      correctAnswers: exactCount,
      accuracyPercentage: avgScore,
      avgResponseTimeMs: avgTime,
      durationSeconds: totalSeconds
    }

    await saveSessionToDb(sessionRecord, allAnswers)
    // clear session id so pending timers won't act on the finished session
    sessionIdRef.current = ''
  }, [cleanupSessionTimers, sessionLimitType, saveSessionToDb])

  // Temporizador regresivo para sesiones por tiempo
  useEffect(() => {
    if (!isSessionActive || sessionLimitType !== 'time') return

    const interval = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          sessionCountdownTimerRef.current = null
          // apply immediate UI state changes synchronously so tests see the finished state
          const totalSeconds = Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000))
          setIsSessionActive(false)
          setIsSessionFinished(true)
          setIsWaitingManualAdvance(false)
          setCapturedNotes([])
          // persist asynchronously
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

  const startSession = (overrideNotes?: unknown, overrideLength?: unknown): void => {
    cleanupSessionTimers()

    const validNotes =
      Array.isArray(overrideNotes) && overrideNotes.length > 0
        ? (overrideNotes as number[])
        : customCandidateNotesBufferRef.current
    const validLength =
      typeof overrideLength === 'number' && overrideLength >= 3
        ? overrideLength
        : sequenceLengthBufferRef.current

    if (validNotes.length < 2) return

    if (Array.isArray(overrideNotes) && overrideNotes.length > 0) {
      setCustomCandidateNotes(overrideNotes as number[])
      customCandidateNotesBufferRef.current = overrideNotes as number[]
    }
    if (typeof overrideLength === 'number' && overrideLength >= 3) {
      setSequenceLength(overrideLength)
      sequenceLengthBufferRef.current = overrideLength
    }

    sessionIdRef.current = `session_seq_${Date.now()}`
    sessionStartTimeRef.current = Date.now()
    answersBufferRef.current = []
    historyBufferRef.current = []
    setSessionHistory([])
    setCurrentQuestionIndex(1)
    setIsSessionFinished(false)
    setIsSessionActive(true)

    if (sessionLimitType === 'time') {
      setTimeRemainingSeconds(sessionDurationMinutesBufferRef.current * 60)
      // recreate countdown interval for the newly started session (ensure previous timers were cleaned)
      if (sessionCountdownTimerRef.current) {
        clearInterval(sessionCountdownTimerRef.current)
        sessionCountdownTimerRef.current = null
      }
      const interval = setInterval(() => {
        setTimeRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            sessionCountdownTimerRef.current = null
            const totalSeconds = Math.max(1, Math.round((Date.now() - sessionStartTimeRef.current) / 1000))
            setIsSessionActive(false)
            setIsSessionFinished(true)
            setIsWaitingManualAdvance(false)
            setCapturedNotes([])
            // persist asynchronously
            void finalizeAndSaveSession()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      sessionCountdownTimerRef.current = interval
      // debug: indicate interval created for this session (tests use fake timers)
      // console.debug('[useSequenceTrainer] countdown interval created, sessionId=', sessionIdRef.current)
    }

    triggerNextSequence(validNotes, validLength)
  }

  const advanceToNextSequence = useCallback((): void => {
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
      triggerNextSequence()
    }
  }, [
    currentQuestionIndex,
    finalizeAndSaveSession,
    isSessionActive,
    sessionLimitType,
    sessionQuestionsCount,
    triggerNextSequence
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
      setCurrentSequence([])
      setCapturedNotes([])
    }
  }, [cleanupSessionTimers, finalizeAndSaveSession])

  const resetToConfig = (): void => {
    cleanupSessionTimers()
    questionTokenRef.current = null
    setIsSessionActive(false)
    setIsSessionFinished(false)
    setIsWaitingManualAdvance(false)
    setCurrentSequence([])
    setCapturedNotes([])
  }

  const repeatCurrentSequence = (): void => {
    if (currentSequence.length > 0) {
      onPlaySequence(currentSequence)
    }
  }

  const handleUserNotePlayed = useCallback(
    (playedNoteNumber: number): void => {
      if (!isSessionActive || currentSequence.length === 0 || !questionTokenRef.current) return

      const updatedCaptured = [...capturedNotes, playedNoteNumber]
      setCapturedNotes(updatedCaptured)

      if (onTelemetryLog) {
        onTelemetryLog(
          'EVAL',
          `Nota ${updatedCaptured.length}/${currentSequence.length}: ${playedNoteNumber}`
        )
      }

      if (updatedCaptured.length >= currentSequence.length) {
        const responseTimeMs = Date.now() - stimulusStartTime
        const result = evaluateSequenceAnswer(currentSequence, updatedCaptured, responseTimeMs)

        const answerRecord: DbAnswerRecord = {
          id: `ans_seq_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          sessionId: sessionIdRef.current,
          questionIndex: currentQuestionIndex,
          expectedNote: currentSequence[0],
          playedNote: playedNoteNumber,
          isCorrect: result.isExactMatch,
          semitoneDistance: result.levenshteinDistance,
          responseTimeMs,
          velocity: 90,
          reasonTelemetry: `Secuencia: [${currentSequence.join(', ')}]`,
          createdAt: new Date().toISOString()
        }

        answersBufferRef.current.push(answerRecord)
        historyBufferRef.current.push(result)

        setLastResult(result)
        setSessionHistory([...historyBufferRef.current])
        isWaitingAnswerRef.current = false

        if (onTelemetryLog) {
          onTelemetryLog('EVAL', result.feedbackMessage)
        }

        const shouldWaitManual =
          advanceMode === 'manual' || (advanceMode === 'smart' && !result.isExactMatch)

        if (shouldWaitManual) {
          setIsWaitingManualAdvance(true)
        } else {
          const delay = advanceMode === 'auto_slow' ? 3500 : 1800
          {
            const scheduledSessionId = sessionIdRef.current
            autoAdvanceTimerRef.current = setTimeout(() => {
              if (sessionIdRef.current !== scheduledSessionId) return
              advanceToNextSequence()
            }, delay)
          }
        }
      }
    },
    [
      isSessionActive,
      currentSequence,
      capturedNotes,
      stimulusStartTime,
      currentQuestionIndex,
      onTelemetryLog,
      advanceMode,
      advanceToNextSequence
    ]
  )

  const trainWeakMotifsOnly = (): void => {
    const weakPool = Array.from(
      new Set(
        historyBufferRef.current.filter((h) => !h.isExactMatch).flatMap((h) => h.expectedNotes)
      )
    )

    if (weakPool.length === 0) return

    const poolToTrain =
      weakPool.length === 1
        ? [weakPool[0], weakPool[0] >= 60 ? weakPool[0] - 2 : weakPool[0] + 2]
        : weakPool

    startSession(poolToTrain.sort((a, b) => a - b))
  }

  return {
    presets: SEQUENCE_PRESETS,
    selectedPresetId,
    setSelectedPresetId,
    sequenceLength,
    setSequenceLength,
    customCandidateNotes,
    setCustomCandidateNotes,
    toggleCustomNote,
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
    currentSequence,
    capturedNotes,
    lastResult,
    sessionHistory,
    startSession,
    stopSession,
    advanceToNextSequence,
    repeatCurrentSequence,
    handleUserNotePlayed,
    trainWeakMotifsOnly,
    resetToConfig
  }
}
