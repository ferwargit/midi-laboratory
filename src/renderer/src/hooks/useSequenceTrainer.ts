import { useState, useCallback, useRef } from 'react'
import {
  SEQUENCE_PRESETS,
  SequencePreset,
  generateMelodicSequence
} from '../domain/music/sequences'
import {
  SequenceExerciseResult,
  evaluateSequenceAnswer
} from '../domain/exercise/sequenceEvaluator'
import { AdvanceMode } from '../domain/exercise/types'
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
  sessionLength: number
  setSessionLength: (len: number) => void
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
  const [sessionLength, setSessionLength] = useState<number>(10)
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
  const answersBufferRef = useRef<DbAnswerRecord[]>([])
  const historyBufferRef = useRef<SequenceExerciseResult[]>([])
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)

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

    onPlaySequence(sequence)
  }, [customCandidateNotes, selectedPresetId, sequenceLength, onPlaySequence])

  const startSession = (): void => {
    if (customCandidateNotes.length < 2) {
      alert('Debes seleccionar al menos 2 notas candidatas en el teclado.')
      return
    }

    sessionIdRef.current = `session_seq_${Date.now()}`
    answersBufferRef.current = []
    historyBufferRef.current = []
    setSessionHistory([])
    setCurrentQuestionIndex(1)
    setIsSessionFinished(false)
    setIsSessionActive(true)
    triggerNextSequence()
  }

  const finalizeAndSaveSession = useCallback(async (): Promise<void> => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

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

    const sessionRecord: DbSessionRecord = {
      id: sessionIdRef.current,
      createdAt: new Date().toISOString(),
      strategyId: 'sequences_v1',
      instrumentId: 'piano_sequences',
      presetName: `Secuencias (${sequenceLength} notas)`,
      totalQuestions: allAnswers.length,
      correctAnswers: exactCount,
      accuracyPercentage: avgScore,
      avgResponseTimeMs: avgTime
    }

    await saveSessionToDb(sessionRecord, allAnswers)
  }, [sequenceLength, saveSessionToDb])

  const advanceToNextSequence = useCallback((): void => {
    if (sessionLength > 0 && currentQuestionIndex >= sessionLength) {
      finalizeAndSaveSession()
    } else {
      setCurrentQuestionIndex((prev) => prev + 1)
      triggerNextSequence()
    }
  }, [currentQuestionIndex, finalizeAndSaveSession, sessionLength, triggerNextSequence])

  const stopSession = useCallback((): void => {
    if (answersBufferRef.current.length > 0) {
      finalizeAndSaveSession()
    } else {
      setIsSessionActive(false)
      setIsSessionFinished(false)
      setIsWaitingManualAdvance(false)
      setCurrentSequence([])
      setCapturedNotes([])
    }
  }, [finalizeAndSaveSession])

  const resetToConfig = (): void => {
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
      if (!isSessionActive || currentSequence.length === 0) return

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
    sessionLength,
    setSessionLength,
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
