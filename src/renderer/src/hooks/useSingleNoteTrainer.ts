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
  currentExpectedNote: number | null
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
  const defaultNotes = [60, 62, 64, 65, 67, 69, 71, 72]

  const [activeNotes, setActiveNotesState] = useState<number[]>(defaultNotes)
  const [sessionLimitType, setSessionLimitTypeState] = useState<SessionLimitType>('questions')
  const [sessionQuestionsCount, setSessionQuestionsCountState] = useState<number>(10)
  const [sessionDurationMinutes, setSessionDurationMinutesState] = useState<number>(5)
  const [timeRemainingSeconds, setTimeRemainingSecondsState] = useState<number>(300)
  const [sessionElapsedSeconds, setSessionElapsedSecondsState] = useState<number>(0)
  const [advanceMode, setAdvanceModeState] = useState<AdvanceMode>('smart')
  const [selectedStrategyId, setSelectedStrategyIdState] = useState<StrategyId>('adaptive_v1')
  const [selectedInstrumentId, setSelectedInstrumentIdState] =
    useState<string>('acoustic_grand_piano')

  const [isSessionActive, setIsSessionActiveState] = useState<boolean>(false)
  const [isSessionFinished, setIsSessionFinishedState] = useState<boolean>(false)
  const [isWaitingManualAdvance, setIsWaitingManualAdvanceState] = useState<boolean>(false)
  const [currentQuestionIndex, setCurrentQuestionIndexState] = useState<number>(0)
  const [currentExpectedNote, setCurrentExpectedNoteState] = useState<number | null>(null)
  const [lastDecision, setLastDecisionState] = useState<SelectionDecision | null>(null)
  const [stimulusStartTime, setStimulusStartTimeState] = useState<number>(0)
  const [isWaitingAnswer, setIsWaitingAnswerState] = useState<boolean>(false)
  const [lastResult, setLastResultState] = useState<ExerciseResult | null>(null)
  const [sessionHistory, setSessionHistoryState] = useState<ExerciseResult[]>([])

  const saveSessionToDb = useDatabaseStore((state) => state.saveSession)

  const selectedInstrument = useMemo(
    () => getInstrumentById(selectedInstrumentId),
    [selectedInstrumentId]
  )

  const strategy = useMemo(() => createStrategy(selectedStrategyId), [selectedStrategyId])

  const sessionIdRef = useRef<string>('')
  const sessionStartTimeRef = useRef<number>(0)
  const questionTokenRef = useRef<string | null>(null)
  const isAdvancingRef = useRef<boolean>(false)

  const activeNotesBufferRef = useRef<number[]>(defaultNotes)
  const sessionLimitTypeRef = useRef<SessionLimitType>('questions')
  const sessionQuestionsCountRef = useRef<number>(10)
  const sessionDurationMinutesBufferRef = useRef<number>(5)
  const timeRemainingRef = useRef<number>(300)
  const sessionElapsedSecondsRef = useRef<number>(0)
  const advanceModeRef = useRef<AdvanceMode>('smart')
  const selectedStrategyIdRef = useRef<StrategyId>('adaptive_v1')
  const selectedInstrumentRef = useRef<InstrumentProfile>(getInstrumentById('acoustic_grand_piano'))

  const isSessionActiveRef = useRef<boolean>(false)
  const isSessionFinishedRef = useRef<boolean>(false)
  const isWaitingManualAdvanceRef = useRef<boolean>(false)
  const currentQuestionIndexRef = useRef<number>(0)
  const currentExpectedNoteRef = useRef<number | null>(null)
  const lastDecisionRef = useRef<SelectionDecision | null>(null)
  const stimulusStartTimeRef = useRef<number>(0)
  const isWaitingAnswerRef = useRef<boolean>(false)
  const lastResultRef = useRef<ExerciseResult | null>(null)

  const answersBufferRef = useRef<DbAnswerRecord[]>([])
  const historyBufferRef = useRef<ExerciseResult[]>([])

  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const finalizingSessionsRef = useRef<Set<string>>(new Set())
  const finalizeAndSaveSessionRef = useRef<() => Promise<void>>(async () => {})

  const activeSessionLimitTypeRef = useRef<SessionLimitType>('questions')
  const activeSessionDurationMinutesRef = useRef<number>(5)
  const activeSessionStrategyIdRef = useRef<StrategyId>('adaptive_v1')
  const activeSessionInstrumentRef = useRef<InstrumentProfile>(
    getInstrumentById('acoustic_grand_piano')
  )

  const setIsSessionActive = (value: boolean): void => {
    isSessionActiveRef.current = value
    setIsSessionActiveState(value)
  }

  const setIsSessionFinished = (value: boolean): void => {
    isSessionFinishedRef.current = value
    setIsSessionFinishedState(value)
  }

  const setIsWaitingManualAdvance = (value: boolean): void => {
    isWaitingManualAdvanceRef.current = value
    setIsWaitingManualAdvanceState(value)
  }

  const setCurrentQuestionIndex = (value: number | ((prev: number) => number)): void => {
    const next =
      typeof value === 'function'
        ? (value as (prev: number) => number)(currentQuestionIndexRef.current)
        : value

    currentQuestionIndexRef.current = next
    setCurrentQuestionIndexState(next)
  }

  const setCurrentExpectedNote = (value: number | null): void => {
    currentExpectedNoteRef.current = value
    setCurrentExpectedNoteState(value)
  }

  const setLastDecision = (value: SelectionDecision | null): void => {
    lastDecisionRef.current = value
    setLastDecisionState(value)
  }

  const setStimulusStartTime = (value: number): void => {
    stimulusStartTimeRef.current = value
    setStimulusStartTimeState(value)
  }

  const setIsWaitingAnswer = (value: boolean): void => {
    isWaitingAnswerRef.current = value
    setIsWaitingAnswerState(value)
  }

  const setLastResult = (value: ExerciseResult | null): void => {
    lastResultRef.current = value
    setLastResultState(value)
  }

  const setTimeRemainingSeconds = (value: number): void => {
    timeRemainingRef.current = value
    setTimeRemainingSecondsState(value)
  }

  const setSessionElapsedSeconds = (value: number): void => {
    sessionElapsedSecondsRef.current = value
    setSessionElapsedSecondsState(value)
  }

  const setActiveNotes = useCallback((notes: number[]): void => {
    activeNotesBufferRef.current = notes
    setActiveNotesState(notes)
  }, [])

  const setSessionLimitType = useCallback((type: SessionLimitType): void => {
    sessionLimitTypeRef.current = type
    setSessionLimitTypeState(type)
  }, [])

  const setSessionQuestionsCount = useCallback((count: number): void => {
    sessionQuestionsCountRef.current = count
    setSessionQuestionsCountState(count)
  }, [])

  const setSessionDurationMinutes = useCallback((minutes: number): void => {
    sessionDurationMinutesBufferRef.current = minutes
    setSessionDurationMinutesState(minutes)
  }, [])

  const setAdvanceMode = useCallback((mode: AdvanceMode): void => {
    advanceModeRef.current = mode
    setAdvanceModeState(mode)
  }, [])

  const setSelectedStrategyId = useCallback((id: StrategyId): void => {
    selectedStrategyIdRef.current = id
    setSelectedStrategyIdState(id)
  }, [])

  const setSelectedInstrumentId = useCallback(
    (id: string): void => {
      const inst = getInstrumentById(id)

      selectedInstrumentRef.current = inst
      setSelectedInstrumentIdState(id)
      onInstrumentChanged(inst.programNumber)
    },
    [onInstrumentChanged]
  )

  useEffect(() => {
    activeNotesBufferRef.current = activeNotes
  }, [activeNotes])

  useEffect(() => {
    sessionLimitTypeRef.current = sessionLimitType
  }, [sessionLimitType])

  useEffect(() => {
    sessionQuestionsCountRef.current = sessionQuestionsCount
  }, [sessionQuestionsCount])

  useEffect(() => {
    sessionDurationMinutesBufferRef.current = sessionDurationMinutes
  }, [sessionDurationMinutes])

  useEffect(() => {
    timeRemainingRef.current = timeRemainingSeconds
  }, [timeRemainingSeconds])

  useEffect(() => {
    sessionElapsedSecondsRef.current = sessionElapsedSeconds
  }, [sessionElapsedSeconds])

  useEffect(() => {
    advanceModeRef.current = advanceMode
  }, [advanceMode])

  useEffect(() => {
    selectedStrategyIdRef.current = selectedStrategyId
  }, [selectedStrategyId])

  useEffect(() => {
    selectedInstrumentRef.current = selectedInstrument
  }, [selectedInstrument])

  useEffect(() => {
    isSessionActiveRef.current = isSessionActive
  }, [isSessionActive])

  useEffect(() => {
    isSessionFinishedRef.current = isSessionFinished
  }, [isSessionFinished])

  useEffect(() => {
    isWaitingManualAdvanceRef.current = isWaitingManualAdvance
  }, [isWaitingManualAdvance])

  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex
  }, [currentQuestionIndex])

  useEffect(() => {
    currentExpectedNoteRef.current = currentExpectedNote
  }, [currentExpectedNote])

  useEffect(() => {
    lastDecisionRef.current = lastDecision
  }, [lastDecision])

  useEffect(() => {
    stimulusStartTimeRef.current = stimulusStartTime
  }, [stimulusStartTime])

  useEffect(() => {
    isWaitingAnswerRef.current = isWaitingAnswer
  }, [isWaitingAnswer])

  useEffect(() => {
    lastResultRef.current = lastResult
  }, [lastResult])

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

  const triggerNextQuestion = useCallback(
    (notesPool?: number[]): void => {
      const currentPool = notesPool || activeNotesBufferRef.current

      // FIX: se resetea siempre, incluso si la función corta más abajo por
      // pool insuficiente. Antes quedaba en `true` para siempre si el pool
      // bajaba de 2 notas justo al momento de avanzar, trabando la sesión.
      isAdvancingRef.current = false

      if (currentPool.length < 2) return

      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
        autoAdvanceTimerRef.current = null
      }

      const token = `token_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      questionTokenRef.current = token

      const decision = strategy.selectNextNote({
        activeNotes: currentPool,
        history: historyBufferRef.current,
        lastPlayedNote: currentExpectedNoteRef.current
      })

      setCurrentExpectedNote(decision.selectedNote)
      setLastDecision(decision)
      setLastResult(null)
      setIsWaitingManualAdvance(false)
      setIsWaitingAnswer(true)
      setStimulusStartTime(Date.now())

      onPlayStimulus(decision.selectedNote, decision)
    },
    [strategy, onPlayStimulus]
  )

  const finalizeAndSaveSession = useCallback(async (): Promise<void> => {
    const finishedSessionId = sessionIdRef.current

    if (!finishedSessionId) return
    if (finalizingSessionsRef.current.has(finishedSessionId)) return

    finalizingSessionsRef.current.add(finishedSessionId)

    if (sessionIdRef.current === finishedSessionId) {
      cleanupSessionTimers()
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
    const finalHistory = [...historyBufferRef.current]

    if (allAnswers.length === 0) {
      finalizingSessionsRef.current.delete(finishedSessionId)

      if (sessionIdRef.current === finishedSessionId) {
        sessionIdRef.current = ''
      }

      return
    }

    const finalStats = calculateSessionStats(finalHistory)

    const finalLimitType = activeSessionLimitTypeRef.current
    const finalDurationMinutes = activeSessionDurationMinutesRef.current
    const finalStrategyId = activeSessionStrategyIdRef.current
    const finalInstrument = activeSessionInstrumentRef.current

    // Identificar si coincide con algún preset formal o es selección libre
    const activePool = activeNotesBufferRef.current
    let contentName = `Notas Personalizadas (${activePool.length})`

    // Si tenemos los presets importados o por cantidad de notas
    if (
      activePool.length === 3 &&
      activePool.includes(60) &&
      activePool.includes(62) &&
      activePool.includes(64)
    ) {
      contentName = 'Nivel 1 (C, D, E)'
    } else if (activePool.length === 5 && activePool.includes(60) && activePool.includes(67)) {
      contentName = 'Nivel 2 (C a G)'
    } else if (activePool.length === 8 && activePool.includes(60) && activePool.includes(72)) {
      contentName = 'Nivel 3 (Octava Diatónica)'
    } else if (activePool.length === 13) {
      contentName = 'Nivel 4 (Cromático C4-C5)'
    }

    const formatTag =
      finalLimitType === 'time'
        ? `Cronometrado ${finalDurationMinutes}m`
        : finalLimitType === 'mastery'
          ? 'Modo Maestría'
          : `Bloque ${allAnswers.length} preguntas`

    const presetLabel = `${contentName} • ${formatTag}`

    const sessionRecord: DbSessionRecord = {
      id: finishedSessionId,
      createdAt: new Date().toISOString(),
      strategyId: finalStrategyId,
      instrumentId: finalInstrument.id,
      presetName: presetLabel,
      totalQuestions: allAnswers.length,
      correctAnswers: finalStats.correctAnswers,
      accuracyPercentage: finalStats.accuracyPercentage,
      avgResponseTimeMs: finalStats.avgResponseTimeMs,
      durationSeconds: totalSeconds
    }

    try {
      await saveSessionToDb(sessionRecord, allAnswers)
    } catch (error) {
      console.error('[useSingleNoteTrainer] Error saving session:', error)
    } finally {
      finalizingSessionsRef.current.delete(finishedSessionId)

      if (sessionIdRef.current === finishedSessionId) {
        sessionIdRef.current = ''
      }
    }
  }, [cleanupSessionTimers, saveSessionToDb])

  useEffect(() => {
    finalizeAndSaveSessionRef.current = finalizeAndSaveSession
  }, [finalizeAndSaveSession])

  useEffect(() => {
    return () => {
      cleanupSessionTimers()
    }
  }, [cleanupSessionTimers])

  const startSession = (overrideNotes?: unknown): void => {
    cleanupSessionTimers()

    const validOverride =
      Array.isArray(overrideNotes) && overrideNotes.length > 0 ? (overrideNotes as number[]) : null

    const notesToUse = validOverride || activeNotesBufferRef.current

    if (notesToUse.length < 2) return

    if (validOverride) {
      activeNotesBufferRef.current = validOverride
      setActiveNotesState(validOverride)
    }

    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    sessionIdRef.current = newSessionId
    sessionStartTimeRef.current = Date.now()

    activeSessionLimitTypeRef.current = sessionLimitTypeRef.current
    activeSessionDurationMinutesRef.current = sessionDurationMinutesBufferRef.current
    activeSessionStrategyIdRef.current = selectedStrategyIdRef.current
    activeSessionInstrumentRef.current = selectedInstrumentRef.current

    answersBufferRef.current = []
    historyBufferRef.current = []

    setSessionHistoryState([])
    setLastResult(null)
    setCurrentQuestionIndex(1)
    setCurrentExpectedNote(null)
    setSessionElapsedSeconds(0)
    setIsSessionFinished(false)
    setIsSessionActive(true)
    setIsWaitingManualAdvance(false)

    if (sessionLimitTypeRef.current === 'time') {
      const initialSeconds = sessionDurationMinutesBufferRef.current * 60

      setTimeRemainingSeconds(initialSeconds)

      const scheduledSessionId = newSessionId

      const interval = setInterval(() => {
        if (sessionIdRef.current !== scheduledSessionId) {
          clearInterval(interval)

          if (sessionCountdownTimerRef.current === interval) {
            sessionCountdownTimerRef.current = null
          }

          return
        }

        const next = Math.max(0, timeRemainingRef.current - 1)
        setTimeRemainingSeconds(next)

        if (next <= 0) {
          clearInterval(interval)

          if (sessionCountdownTimerRef.current === interval) {
            sessionCountdownTimerRef.current = null
          }

          void finalizeAndSaveSessionRef.current()
        }
      }, 1000)

      sessionCountdownTimerRef.current = interval
    }

    onInstrumentChanged(selectedInstrumentRef.current.programNumber)
    triggerNextQuestion(notesToUse)
  }

  const advanceToNextQuestion = useCallback((): void => {
    if (!isSessionActiveRef.current || isAdvancingRef.current || isWaitingAnswerRef.current) {
      return
    }

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

    const isMasteryCompleted = sessionLimitTypeRef.current === 'mastery' && allMastered

    const isFixedQuestionsCompleted =
      sessionLimitTypeRef.current === 'questions' &&
      currentQuestionIndexRef.current >= sessionQuestionsCountRef.current

    if (isMasteryCompleted || isFixedQuestionsCompleted) {
      void finalizeAndSaveSessionRef.current()
    } else {
      setCurrentQuestionIndex((prev) => prev + 1)
      triggerNextQuestion()
    }
  }, [strategy, triggerNextQuestion])

  const stopSession = useCallback((): void => {
    cleanupSessionTimers()

    if (answersBufferRef.current.length > 0) {
      void finalizeAndSaveSessionRef.current()
    } else {
      questionTokenRef.current = null
      sessionIdRef.current = ''
      isAdvancingRef.current = false

      setIsSessionActive(false)
      setIsSessionFinished(false)
      setIsWaitingAnswer(false)
      setIsWaitingManualAdvance(false)
      setCurrentExpectedNote(null)
    }
  }, [cleanupSessionTimers])

  const resetToConfig = (): void => {
    cleanupSessionTimers()

    questionTokenRef.current = null
    sessionIdRef.current = ''
    isAdvancingRef.current = false

    setIsSessionActive(false)
    setIsSessionFinished(false)
    setIsWaitingAnswer(false)
    setIsWaitingManualAdvance(false)
    setCurrentExpectedNote(null)
  }

  const repeatCurrentNote = (): void => {
    const expected = currentExpectedNoteRef.current
    const decision = lastDecisionRef.current

    if (expected !== null && decision !== null) {
      onPlayStimulus(expected, decision)
    }
  }

  const handleUserNotePlayed = useCallback(
    (playedNoteNumber: number): void => {
      if (
        !isSessionActiveRef.current ||
        !isWaitingAnswerRef.current ||
        currentExpectedNoteRef.current === null ||
        !questionTokenRef.current
      ) {
        return
      }

      const responseTimeMs = Date.now() - stimulusStartTimeRef.current
      const expected = currentExpectedNoteRef.current
      const result = evaluateSingleNoteAnswer(expected, playedNoteNumber, responseTimeMs)

      const answerRecord: DbAnswerRecord = {
        id: `ans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sessionId: sessionIdRef.current,
        questionIndex: currentQuestionIndexRef.current,
        expectedNote: expected,
        playedNote: playedNoteNumber,
        isCorrect: result.correct,
        semitoneDistance: result.semitoneDistance,
        responseTimeMs,
        velocity: 90,
        reasonTelemetry: lastDecisionRef.current?.reason || '',
        createdAt: new Date().toISOString()
      }

      answersBufferRef.current.push(answerRecord)
      historyBufferRef.current.push(result)

      setLastResult(result)
      setSessionHistoryState([...historyBufferRef.current])
      setIsWaitingAnswer(false)

      if (onTelemetryLog) {
        const evalMsg = result.correct
          ? `✅ Acierto (0 st) | Tiempo: ${(responseTimeMs / 1000).toFixed(2)}s`
          : `❌ Fallo (${result.semitoneDistance > 0 ? `+${result.semitoneDistance}` : result.semitoneDistance} st) | Tiempo: ${(responseTimeMs / 1000).toFixed(2)}s`

        onTelemetryLog('EVAL', evalMsg)
      }

      const currentAdvanceMode = advanceModeRef.current

      const shouldWaitManual =
        currentAdvanceMode === 'manual' || (currentAdvanceMode === 'smart' && !result.correct)

      if (shouldWaitManual) {
        setIsWaitingManualAdvance(true)
      } else {
        const delay = currentAdvanceMode === 'auto_slow' ? 3500 : 1400
        const scheduledSessionId = sessionIdRef.current

        autoAdvanceTimerRef.current = setTimeout(() => {
          if (sessionIdRef.current !== scheduledSessionId) return
          advanceToNextQuestion()
        }, delay)
      }
    },
    [advanceToNextQuestion, onTelemetryLog]
  )

  const toggleNote = (note: number): void => {
    const previous = activeNotesBufferRef.current

    const next = previous.includes(note)
      ? previous.filter((n) => n !== note)
      : [...previous, note].sort((a, b) => a - b)

    setActiveNotes(next)
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

    if (weakNotes.length === 0) return

    const poolToTrain =
      weakNotes.length === 1
        ? [weakNotes[0], weakNotes[0] >= 60 ? weakNotes[0] - 2 : weakNotes[0] + 2]
        : weakNotes

    startSession(poolToTrain.sort((a, b) => a - b))
  }

  return {
    get activeNotes() {
      return activeNotesBufferRef.current
    },
    setActiveNotes,
    toggleNote,

    get sessionLimitType() {
      return sessionLimitTypeRef.current
    },
    setSessionLimitType,

    get sessionQuestionsCount() {
      return sessionQuestionsCountRef.current
    },
    setSessionQuestionsCount,

    get sessionDurationMinutes() {
      return sessionDurationMinutesBufferRef.current
    },
    setSessionDurationMinutes,

    get timeRemainingSeconds() {
      return timeRemainingRef.current
    },

    get advanceMode() {
      return advanceModeRef.current
    },
    setAdvanceMode,

    get selectedStrategyId() {
      return selectedStrategyIdRef.current
    },
    setSelectedStrategyId,

    selectedInstrument,
    setSelectedInstrumentId,

    get isSessionActive() {
      return isSessionActiveRef.current
    },
    get isSessionFinished() {
      return isSessionFinishedRef.current
    },
    get isWaitingManualAdvance() {
      return isWaitingManualAdvanceRef.current
    },
    get currentQuestionIndex() {
      return currentQuestionIndexRef.current
    },
    get currentExpectedNote() {
      return currentExpectedNoteRef.current
    },
    get isWaitingAnswer() {
      return isWaitingAnswerRef.current
    },
    get lastResult() {
      return lastResultRef.current
    },
    get sessionHistory() {
      return historyBufferRef.current
    },
    get sessionElapsedSeconds() {
      return sessionElapsedSecondsRef.current
    },

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
