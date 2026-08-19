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
  startSession: () => void
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
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(5)
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
  const answersBufferRef = useRef<DbAnswerRecord[]>([])
  const historyBufferRef = useRef<SequenceExerciseResult[]>([])
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionCountdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  const setSelectedPresetId = (id: string): void => {
    setSelectedPresetIdState(id)
    const preset = SEQUENCE_PRESETS.find((p) => p.id === id)
    if (preset) {
      setSequenceLength(preset.length)
      setCustomCandidateNotes([...preset.candidateNotes])
    }
  }

  const toggleCustomNote = (note: number): void => {
    setCustomCandidateNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note].sort((a, b) => a - b)
    )
  }

  const triggerNextSequence = useCallback((): void => {
    if (customCandidateNotes.length < 2) return

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    const token = `token_seq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    questionTokenRef.current = token
    isAdvancingRef.current = false

    const preset = SEQUENCE_PRESETS.find((p) => p.id === selectedPresetId)
    const maxJump = preset ? preset.maxJumpSemitones : 12
    const allowRepeat = preset ? preset.allowRepeatedConsecutive : true

    const sequence = generateMelodicSequence(
      customCandidateNotes,
      sequenceLength,
      maxJump,
      allowRepeat
    )

    setCurrentSequence(sequence)
    setCapturedNotes([])
    setLastResult(null)
    setIsWaitingManualAdvance(false)
    setStimulusStartTime(Date.now())

    isAdvancingRef.current = false // Liberar candado aquí

    onPlaySequence(sequence)
  }, [customCandidateNotes, selectedPresetId, sequenceLength, onPlaySequence])

  const finalizeAndSaveSession = useCallback(async (): Promise<void> => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
    if (sessionCountdownTimerRef.current) {
      clearInterval(sessionCountdownTimerRef.current)
      sessionCountdownTimerRef.current = null
    }

    questionTokenRef.current = null
    isAdvancingRef.current = false

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
        ? `Secuencias Tiempo (${sessionDurationMinutes}m)`
        : `Secuencias (${sequenceLength} notas)`

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
  }, [sessionLimitType, sessionDurationMinutes, sequenceLength, saveSessionToDb])

  useEffect(() => {
    if (isSessionActive && sessionLimitType === 'time') {
      sessionCountdownTimerRef.current = setInterval(() => {
        setTimeRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(sessionCountdownTimerRef.current!)
            finalizeAndSaveSession()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return (): void => {
      if (sessionCountdownTimerRef.current) {
        clearInterval(sessionCountdownTimerRef.current)
      }
    }
  }, [isSessionActive, sessionLimitType, finalizeAndSaveSession])

  const startSession = (): void => {
    if (!Array.isArray(customCandidateNotes) || customCandidateNotes.length < 2) {
      alert('Debes seleccionar al menos 2 notas candidatas en el teclado.')
      return
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
      setTimeRemainingSeconds(sessionDurationMinutes * 60)
    }

    triggerNextSequence()
  }

  const advanceToNextSequence = useCallback((): void => {
    if (!isSessionActive || isAdvancingRef.current) return
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
    isSessionActive,
    currentQuestionIndex,
    finalizeAndSaveSession,
    sessionLimitType,
    sessionQuestionsCount,
    triggerNextSequence
  ])

  const stopSession = useCallback((): void => {
    if (answersBufferRef.current.length > 0) {
      finalizeAndSaveSession()
    } else {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)
      questionTokenRef.current = null
      setIsSessionActive(false)
      setIsSessionFinished(false)
      setIsWaitingManualAdvance(false)
      setCurrentSequence([])
      setCapturedNotes([])
    }
  }, [finalizeAndSaveSession])

  const resetToConfig = (): void => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)
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

        if (onTelemetryLog) {
          onTelemetryLog('EVAL', result.feedbackMessage)
        }

        const shouldWaitManual =
          advanceMode === 'manual' || (advanceMode === 'smart' && !result.isExactMatch)

        if (shouldWaitManual) {
          setIsWaitingManualAdvance(true)
        } else {
          const delay = advanceMode === 'auto_slow' ? 3500 : 1800
          autoAdvanceTimerRef.current = setTimeout(() => {
            advanceToNextSequence()
          }, delay)
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

    if (weakPool.length < 2) {
      alert('¡Felicitaciones! No tienes suficientes notas débiles para aislar.')
      return
    }

    setCustomCandidateNotes(weakPool.sort((a, b) => a - b))
    sessionIdRef.current = `session_seq_${Date.now()}`
    sessionStartTimeRef.current = Date.now()
    answersBufferRef.current = []
    historyBufferRef.current = []
    setSessionHistory([])
    setCurrentQuestionIndex(1)
    setIsSessionFinished(false)
    setIsSessionActive(true)
    triggerNextSequence()
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
