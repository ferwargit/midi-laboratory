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
  sessionElapsedSeconds: number
  stats: SessionStats
  performances: Map<number, NotePerformance>
  startSession: (overrideNotes?: unknown) => void
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
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState<number>(0)
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
  const sessionStartTimeRef = useRef<number>(0)
  const questionTokenRef = useRef<string | null>(null)
  const isAdvancingRef = useRef<boolean>(false)
  const activeNotesBufferRef = useRef<number[]>([60, 62, 64, 65, 67, 69, 71, 72])
  const answersBufferRef = useRef<DbAnswerRecord[]>([])
  const historyBufferRef = useRef<ExerciseResult[]>([])
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionCountdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isWaitingAnswerRef = useRef<boolean>(false)

  useEffect(() => {
    activeNotesBufferRef.current = activeNotes
  }, [activeNotes])

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

  const triggerNextQuestion = useCallback(
    (notesPool?: number[]): void => {
      const currentPool = notesPool || activeNotesBufferRef.current
      if (currentPool.length < 2) return

      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
        autoAdvanceTimerRef.current = null
      }

      const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      questionTokenRef.current = token

      // Si la estrategia es adaptativa, usa los pesos; si es aleatoria, usa la regla anti-repetición pura
      const decision = strategy.selectNextNote({
        activeNotes: currentPool,
        history: historyBufferRef.current,
        lastPlayedNote: currentExpectedNote
      })

      setCurrentExpectedNote(decision.selectedNote)
      setLastDecision(decision)
      setLastResult(null)
      setIsWaitingManualAdvance(false)
      isWaitingAnswerRef.current = true
      setIsWaitingAnswer(true)
      setStimulusStartTime(Date.now())

      isAdvancingRef.current = false

      onPlayStimulus(decision.selectedNote, decision)
    },
    [currentExpectedNote, strategy, onPlayStimulus]
  )

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
    setSessionElapsedSeconds(totalSeconds)

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
          : `Notas (${activeNotesBufferRef.current.length})`

    const sessionRecord: DbSessionRecord = {
      id: sessionIdRef.current,
      createdAt: new Date().toISOString(),
      strategyId: selectedStrategyId,
      instrumentId: selectedInstrument.id,
      presetName: presetLabel,
      totalQuestions: allAnswers.length,
      correctAnswers: finalStats.correctAnswers,
      accuracyPercentage: finalStats.accuracyPercentage,
      avgResponseTimeMs: finalStats.avgResponseTimeMs,
      durationSeconds: totalSeconds
    }

    await saveSessionToDb(sessionRecord, allAnswers)
  }, [
    sessionLimitType,
    sessionDurationMinutes,
    selectedStrategyId,
    selectedInstrument.id,
    saveSessionToDb
  ])

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

  const startSession = (overrideNotes?: unknown): void => {
    const validOverride =
      Array.isArray(overrideNotes) && overrideNotes.length > 0 ? (overrideNotes as number[]) : null
    const notesToUse = validOverride || activeNotes

    if (notesToUse.length < 2) {
      alert('Debes seleccionar al menos 2 notas para entrenar.')
      return
    }

    if (validOverride) {
      setActiveNotes(validOverride)
      activeNotesBufferRef.current = validOverride
    }

    sessionIdRef.current = `session_${Date.now()}`
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

    onInstrumentChanged(selectedInstrument.programNumber)
    triggerNextQuestion(notesToUse)
  }

  const advanceToNextQuestion = useCallback((): void => {
    // Si ya estamos esperando respuesta de la nueva pregunta o no está activa la sesión, ignorar avances espurios
    if (!isSessionActive || isAdvancingRef.current || isWaitingAnswerRef.current) return
    isAdvancingRef.current = true

    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    const currentPerformances = strategy.getNotePerformances(
      activeNotesBufferRef.current,
      historyBufferRef.current
    )
    const allMastered = activeNotesBufferRef.current.every((note) => {
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
    isSessionActive,
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
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)
      questionTokenRef.current = null
      setIsSessionActive(false)
      setIsSessionFinished(false)
      setIsWaitingAnswer(false)
      setIsWaitingManualAdvance(false)
      setCurrentExpectedNote(null)
    }
  }, [finalizeAndSaveSession])

  const resetToConfig = (): void => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)
    questionTokenRef.current = null
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
      if (
        !isSessionActive ||
        !isWaitingAnswer ||
        currentExpectedNote === null ||
        !questionTokenRef.current
      )
        return

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
      isWaitingAnswerRef.current = false
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

    if (weakNotes.length === 0) {
      return
    }

    // Si solo hay 1 nota débil, añadimos una nota ancla vecina para permitir contraste perceptual
    const poolToTrain =
      weakNotes.length === 1
        ? [weakNotes[0], weakNotes[0] >= 60 ? weakNotes[0] - 2 : weakNotes[0] + 2]
        : weakNotes

    startSession(poolToTrain.sort((a, b) => a - b))
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
    sessionElapsedSeconds,
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
