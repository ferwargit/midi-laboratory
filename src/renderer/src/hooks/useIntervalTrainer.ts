import { useState, useCallback, useRef } from 'react'
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
import { AdvanceMode } from '../domain/exercise/types'
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
  sessionLength: number
  setSessionLength: (len: number) => void
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
  startSession: () => void
  stopSession: () => void
  advanceToNextInterval: () => void
  repeatCurrentInterval: () => void
  handleUserNotePlayed: (noteNumber: number) => void
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
  const [sessionLength, setSessionLength] = useState<number>(10)
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
  const answersBufferRef = useRef<DbAnswerRecord[]>([])
  const historyBufferRef = useRef<IntervalExerciseResult[]>([])
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const setSelectedPresetId = (id: string): void => {
    setSelectedPresetIdState(id)
    const preset = INTERVAL_PRESETS.find((p) => p.id === id)
    if (preset) {
      setActiveIntervals([...preset.intervalSemitones])
      setDirectionMode(preset.defaultDirection)
      if (preset.fixedRootNote !== null) {
        setRootRangeNotes([preset.fixedRootNote])
      } else {
        setRootRangeNotes(Array.from({ length: 25 }, (_, i) => 48 + i))
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

  const triggerNextInterval = useCallback((): void => {
    if (activeIntervals.length === 0 || rootRangeNotes.length === 0) return

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    const chosenSemitones = activeIntervals[Math.floor(Math.random() * activeIntervals.length)]

    let finalDirection: IntervalDirection = 'ascending'
    if (directionMode === 'both') {
      finalDirection = Math.random() > 0.5 ? 'ascending' : 'descending'
    } else {
      finalDirection = directionMode
    }

    const chosenRoot = rootRangeNotes[Math.floor(Math.random() * rootRangeNotes.length)]
    const targetNote =
      finalDirection === 'ascending' ? chosenRoot + chosenSemitones : chosenRoot - chosenSemitones

    const stimulus: IntervalExerciseStimulus = {
      rootNote: chosenRoot,
      targetNote,
      semitones: chosenSemitones,
      direction: finalDirection
    }

    setCurrentStimulus(stimulus)
    setWaitingNoteStep(1)
    setFirstNotePlayed(null)
    setLastResult(null)
    setIsWaitingManualAdvance(false)
    setStimulusStartTime(Date.now())

    onPlayInterval(chosenRoot, targetNote, finalDirection)
  }, [activeIntervals, directionMode, rootRangeNotes, onPlayInterval])

  const startSession = (): void => {
    if (activeIntervals.length === 0) {
      alert('Debes seleccionar al menos 1 intervalo.')
      return
    }
    if (rootRangeNotes.length === 0) {
      alert('Debes seleccionar al menos 1 nota raíz en el teclado.')
      return
    }

    sessionIdRef.current = `session_int_${Date.now()}`
    answersBufferRef.current = []
    historyBufferRef.current = []
    setSessionHistory([])
    setCurrentQuestionIndex(1)
    setIsSessionFinished(false)
    setIsSessionActive(true)
    triggerNextInterval()
  }

  const finalizeAndSaveSession = useCallback(async (): Promise<void> => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

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

    const sessionRecord: DbSessionRecord = {
      id: sessionIdRef.current,
      createdAt: new Date().toISOString(),
      strategyId: 'intervals_v1',
      instrumentId: 'piano_intervals',
      presetName: `Intervalos (${activeIntervals.length})`,
      totalQuestions: allAnswers.length,
      correctAnswers: correctCount,
      accuracyPercentage: accPercent,
      avgResponseTimeMs: avgTime
    }

    await saveSessionToDb(sessionRecord, allAnswers)
  }, [activeIntervals.length, saveSessionToDb])

  const advanceToNextInterval = useCallback((): void => {
    if (sessionLength > 0 && currentQuestionIndex >= sessionLength) {
      finalizeAndSaveSession()
    } else {
      setCurrentQuestionIndex((prev) => prev + 1)
      triggerNextInterval()
    }
  }, [currentQuestionIndex, finalizeAndSaveSession, sessionLength, triggerNextInterval])

  const stopSession = useCallback((): void => {
    if (answersBufferRef.current.length > 0) {
      finalizeAndSaveSession()
    } else {
      setIsSessionActive(false)
      setIsSessionFinished(false)
      setIsWaitingManualAdvance(false)
      setCurrentStimulus(null)
      setFirstNotePlayed(null)
    }
  }, [finalizeAndSaveSession])

  const resetToConfig = (): void => {
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
    (playedNoteNumber: number): void => {
      if (!isSessionActive || !currentStimulus) return

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
          createdAt: new Date().toISOString()
        }

        answersBufferRef.current.push(answerRecord)
        historyBufferRef.current.push(result)

        setLastResult(result)
        setSessionHistory([...historyBufferRef.current])
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
          autoAdvanceTimerRef.current = setTimeout(() => {
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
    activeIntervals.forEach((st) => {
      const attempts = historyBufferRef.current.filter((h) => h.expectedStimulus.semitones === st)
      if (attempts.length > 0) {
        const correct = attempts.filter((h) => h.isIntervalCorrect).length
        if (correct / attempts.length < 0.85) {
          weakIntervals.push(st)
        }
      }
    })

    if (weakIntervals.length === 0) {
      alert('¡Felicitaciones! No tienes intervalos débiles en esta sesión.')
      return
    }

    setActiveIntervals(weakIntervals)
    sessionIdRef.current = `session_int_${Date.now()}`
    answersBufferRef.current = []
    historyBufferRef.current = []
    setSessionHistory([])
    setCurrentQuestionIndex(1)
    setIsSessionFinished(false)
    setIsSessionActive(true)
    triggerNextInterval()
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
    sessionLength,
    setSessionLength,
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
