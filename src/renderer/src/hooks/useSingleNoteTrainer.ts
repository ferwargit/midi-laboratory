import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  ExerciseResult,
  SessionStats,
  AdvanceMode,
  SessionLimitType
} from '../domain/exercise/types'
import { evaluateSingleNoteAnswer, calculateSessionStats } from '../domain/exercise/evaluator'
import { StrategyId, NotePerformance, SelectionDecision } from '../domain/adaptation/types'
import { createStrategy } from '../domain/adaptation/adaptiveEngine'
import { InstrumentProfile, getInstrumentById } from '../domain/music/instruments'
import { DbAnswerRecord, DbSessionRecord } from '../domain/database/types'
import { useDatabaseStore } from '../stores/useDatabaseStore'

interface TrainerOptions {
  onPlayStimulus: (noteNumber: number, decision: SelectionDecision) => void
  onInstrumentChanged: (programNumber: number) => void
  onTelemetryLog?: (type: 'AI' | 'EVAL', message: string) => void
}

export interface UseSingleNoteTrainerReturn {
  activeNotes: number[]
  setActiveNotes: (notes: number[]) => void
  toggleNote: (note: number) => void
  sessionLimitType: SessionLimitType
  setSessionLimitType: (type: SessionLimitType) => void
  sessionQuestionsCount: number
  setSessionQuestionsCount: (count: number) => void
  sessionDurationMinutes: number
  setSessionDurationMinutes: (minutes: number) => void
  timeRemainingSeconds: number
  advanceMode: AdvanceMode
  setAdvanceMode: (mode: AdvanceMode) => void
  selectedStrategyId: StrategyId
  setSelectedStrategyId: (id: StrategyId) => void
  selectedInstrument: InstrumentProfile
  setSelectedInstrumentId: (id: string) => void
  isSessionActive: boolean
  isSessionFinished: boolean
  isWaitingManualAdvance: boolean
  currentQuestionIndex: number
  isWaitingAnswer: boolean
  lastResult: ExerciseResult | null
  sessionHistory: ExerciseResult[]
  stats: SessionStats
  performances: Map<number, NotePerformance>
  startSession: () => void
  stopSession: () => void
  advanceToNextQuestion: () => void
  repeatCurrentNote: () => void
  handleUserNotePlayed: (playedNoteNumber: number) => void
  trainWeakNotesOnly: () => void
  resetToConfig: () => void
}

export function useSingleNoteTrainer({
  onPlayStimulus,
  onInstrumentChanged,
  onTelemetryLog
}: TrainerOptions): UseSingleNoteTrainerReturn {
  const [activeNotes, setActiveNotes] = useState<number[]>([60, 62, 64, 65, 67, 69, 71, 72])
  const [sessionLimitType, setSessionLimitType] = useState<SessionLimitType>('questions')
  const [sessionQuestionsCount, setSessionQuestionsCount] = useState<number>(10)
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(5)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(300)
  const [advanceMode, setAdvanceMode] = useState<AdvanceMode>('smart')
  const [selectedStrategyId, setSelectedStrategyId] = useState<StrategyId>('adaptive_v1')
  const [selectedInstrumentId, setSelectedInstrumentIdState] =
    useState<string>('acoustic_grand_piano')
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false)
  const [isSessionFinished, setIsSessionFinished] = useState<boolean>(false)
  const [isWaitingManualAdvance, setIsWaitingManualAdvance] = useState<boolean>(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [currentExpectedNote, setCurrentExpectedNote] = useState<number | null>(null)
  const [lastDecision, setLastDecision] = useState<SelectionDecision | null>(null)
  const [stimulusStartTime, setStimulusStartTime] = useState<number>(0)
  const [isWaitingAnswer, setIsWaitingAnswer] = useState<boolean>(false)
  const [lastResult, setLastResult] = useState<ExerciseResult | null>(null)
  const [sessionHistory, setSessionHistory] = useState<ExerciseResult[]>([])

  const saveSessionToDb = useDatabaseStore((state) => state.saveSession)

  const sessionIdRef = useRef<string>('')
  const answersBufferRef = useRef<DbAnswerRecord[]>([])
  const historyBufferRef = useRef<ExerciseResult[]>([])
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionCountdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  const selectedInstrument = useMemo(
    () => getInstrumentById(selectedInstrumentId),
    [selectedInstrumentId]
  )

  const setSelectedInstrumentId = (id: string): void => {
    setSelectedInstrumentIdState(id)
    const inst = getInstrumentById(id)
    onInstrumentChanged(inst.programNumber)
  }

  const strategy = useMemo(() => createStrategy(selectedStrategyId), [selectedStrategyId])

  const triggerNextQuestion = useCallback((): void => {
    if (activeNotes.length < 2) return

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    const decision = strategy.selectNextNote({
      activeNotes,
      history: historyBufferRef.current,
      lastPlayedNote: currentExpectedNote
    })

    setCurrentExpectedNote(decision.selectedNote)
    setLastDecision(decision)
    setLastResult(null)
    setIsWaitingManualAdvance(false)
    setIsWaitingAnswer(true)
    setStimulusStartTime(Date.now())

    onPlayStimulus(decision.selectedNote, decision)
  }, [activeNotes, currentExpectedNote, strategy, onPlayStimulus])

  const finalizeAndSaveSession = useCallback(async (): Promise<void> => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
    if (sessionCountdownTimerRef.current) {
      clearInterval(sessionCountdownTimerRef.current)
      sessionCountdownTimerRef.current = null
    }

    setIsSessionActive(false)
    setIsSessionFinished(true)
    setIsWaitingAnswer(false)
    setIsWaitingManualAdvance(false)

    const allAnswers = [...answersBufferRef.current]
    if (allAnswers.length === 0) return

    const finalStats = calculateSessionStats(historyBufferRef.current)
    const presetLabel =
      sessionLimitType === 'time'
        ? `Tiempo (${sessionDurationMinutes}m)`
        : sessionLimitType === 'mastery'
          ? 'Maestría'
          : `Notas (${activeNotes.length})`

    const sessionRecord: DbSessionRecord = {
      id: sessionIdRef.current,
      createdAt: new Date().toISOString(),
      strategyId: selectedStrategyId,
      instrumentId: selectedInstrument.id,
      presetName: presetLabel,
      totalQuestions: allAnswers.length,
      correctAnswers: finalStats.correctAnswers,
      accuracyPercentage: finalStats.accuracyPercentage,
      avgResponseTimeMs: finalStats.avgResponseTimeMs
    }

    await saveSessionToDb(sessionRecord, allAnswers)
  }, [
    sessionLimitType,
    sessionDurationMinutes,
    activeNotes.length,
    selectedStrategyId,
    selectedInstrument.id,
    saveSessionToDb
  ])

  // Temporizador regresivo para sesiones por tiempo
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
    if (activeNotes.length < 2) {
      alert('Debes seleccionar al menos 2 notas para entrenar.')
      return
    }
    sessionIdRef.current = `session_${Date.now()}`
    answersBufferRef.current = []
    historyBufferRef.current = []
    setSessionHistory([])
    setCurrentQuestionIndex(1)
    setIsSessionFinished(false)
    setIsSessionActive(true)

    if (sessionLimitType === 'time') {
      setTimeRemainingSeconds(sessionDurationMinutes * 60)
    }

    onInstrumentChanged(selectedInstrument.programNumber)
    triggerNextQuestion()
  }

  const advanceToNextQuestion = useCallback((): void => {
    const currentPerformances = strategy.getNotePerformances(activeNotes, historyBufferRef.current)
    const allMastered = activeNotes.every((note) => {
      const perf = currentPerformances.get(note)
      return perf && perf.attempts >= 2 && perf.accuracyPercentage >= 85
    })

    const isMasteryCompleted = sessionLimitType === 'mastery' && allMastered
    const isFixedQuestionsCompleted =
      sessionLimitType === 'questions' && currentQuestionIndex >= sessionQuestionsCount

    if (isMasteryCompleted || isFixedQuestionsCompleted) {
      finalizeAndSaveSession()
    } else {
      setCurrentQuestionIndex((prev) => prev + 1)
      triggerNextQuestion()
    }
  }, [
    activeNotes,
    currentQuestionIndex,
    finalizeAndSaveSession,
    sessionLimitType,
    sessionQuestionsCount,
    strategy,
    triggerNextQuestion
  ])

  const stopSession = useCallback((): void => {
    if (answersBufferRef.current.length > 0) {
      finalizeAndSaveSession()
    } else {
      setIsSessionActive(false)
      setIsSessionFinished(false)
      setIsWaitingAnswer(false)
      setIsWaitingManualAdvance(false)
      setCurrentExpectedNote(null)
    }
  }, [finalizeAndSaveSession])

  const resetToConfig = (): void => {
    setIsSessionActive(false)
    setIsSessionFinished(false)
    setIsWaitingAnswer(false)
    setIsWaitingManualAdvance(false)
    setCurrentExpectedNote(null)
  }

  const repeatCurrentNote = (): void => {
    if (currentExpectedNote !== null && lastDecision !== null) {
      onPlayStimulus(currentExpectedNote, lastDecision)
    }
  }

  const handleUserNotePlayed = useCallback(
    (playedNoteNumber: number): void => {
      if (!isSessionActive || !isWaitingAnswer || currentExpectedNote === null) return

      const responseTimeMs = Date.now() - stimulusStartTime
      const result = evaluateSingleNoteAnswer(currentExpectedNote, playedNoteNumber, responseTimeMs)

      const answerRecord: DbAnswerRecord = {
        id: `ans_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sessionId: sessionIdRef.current,
        questionIndex: currentQuestionIndex,
        expectedNote: currentExpectedNote,
        playedNote: playedNoteNumber,
        isCorrect: result.correct,
        semitoneDistance: result.semitoneDistance,
        responseTimeMs,
        velocity: 90,
        reasonTelemetry: lastDecision?.reason || '',
        createdAt: new Date().toISOString()
      }

      answersBufferRef.current.push(answerRecord)
      historyBufferRef.current.push(result)

      setLastResult(result)
      setSessionHistory([...historyBufferRef.current])
      setIsWaitingAnswer(false)

      if (onTelemetryLog) {
        const evalMsg = result.correct
          ? `✅ Acierto (0 st) | Tiempo: ${(responseTimeMs / 1000).toFixed(2)}s`
          : `❌ Fallo (${result.semitoneDistance > 0 ? `+${result.semitoneDistance}` : result.semitoneDistance} st) | Tiempo: ${(responseTimeMs / 1000).toFixed(2)}s`
        onTelemetryLog('EVAL', evalMsg)
      }

      const shouldWaitManual =
        advanceMode === 'manual' || (advanceMode === 'smart' && !result.correct)

      if (shouldWaitManual) {
        setIsWaitingManualAdvance(true)
      } else {
        const delay = advanceMode === 'auto_slow' ? 3500 : 1400
        autoAdvanceTimerRef.current = setTimeout(() => {
          advanceToNextQuestion()
        }, delay)
      }
    },
    [
      isSessionActive,
      isWaitingAnswer,
      currentExpectedNote,
      stimulusStartTime,
      currentQuestionIndex,
      lastDecision,
      onTelemetryLog,
      advanceMode,
      advanceToNextQuestion
    ]
  )

  const toggleNote = (note: number): void => {
    setActiveNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note].sort((a, b) => a - b)
    )
  }

  const stats: SessionStats = calculateSessionStats(sessionHistory)
  const performances = useMemo(
    () => strategy.getNotePerformances(activeNotes, sessionHistory),
    [strategy, activeNotes, sessionHistory]
  )

  const trainWeakNotesOnly = (): void => {
    const weakNotes: number[] = []
    performances.forEach((perf, note) => {
      if (perf.attempts > 0 && perf.accuracyPercentage < 85) {
        weakNotes.push(note)
      }
    })

    if (weakNotes.length < 2) {
      alert(
        '¡Felicitaciones! Tienes menos de 2 notas débiles. Puedes continuar con la selección actual.'
      )
      return
    }

    setActiveNotes(weakNotes.sort((a, b) => a - b))
    sessionIdRef.current = `session_${Date.now()}`
    answersBufferRef.current = []
    historyBufferRef.current = []
    setSessionHistory([])
    setCurrentQuestionIndex(1)
    setIsSessionFinished(false)
    setIsSessionActive(true)
    triggerNextQuestion()
  }

  return {
    activeNotes,
    setActiveNotes,
    toggleNote,
    sessionLimitType,
    setSessionLimitType,
    sessionQuestionsCount,
    setSessionQuestionsCount,
    sessionDurationMinutes,
    setSessionDurationMinutes,
    timeRemainingSeconds,
    advanceMode,
    setAdvanceMode,
    selectedStrategyId,
    setSelectedStrategyId,
    selectedInstrument,
    setSelectedInstrumentId,
    isSessionActive,
    isSessionFinished,
    isWaitingManualAdvance,
    currentQuestionIndex,
    isWaitingAnswer,
    lastResult,
    sessionHistory,
    stats,
    performances,
    startSession,
    stopSession,
    advanceToNextQuestion,
    repeatCurrentNote,
    handleUserNotePlayed,
    trainWeakNotesOnly,
    resetToConfig
  }
}
