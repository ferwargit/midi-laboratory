import { useState, useCallback, useMemo, useRef } from 'react'
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
import { resolveNotePresetName } from '../domain/music/presets'
import { TonalContextMode, getTotalContextDurationMs } from '../domain/music/tonalContext'
import { DbAnswerRecord, DbSessionRecord } from '../domain/database/types'
import { useTrainerCore, CoreStartSessionOptions } from './useTrainerCore'

interface TrainerOptions {
  onPlayStimulus: (noteNumber: number, decision: SelectionDecision) => void
  onInstrumentChanged: (programNumber: number) => void
  onPlayTonalContext?: (mode: TonalContextMode, rootNote: number) => void
  onTelemetryLog?: (type: 'AI' | 'EVAL', message: string) => void
}

export interface SingleNoteSessionOptions extends CoreStartSessionOptions {
  notes?: number[]
  tonalContextMode?: TonalContextMode
  instrumentId?: string
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
  tonalContextMode: TonalContextMode
  setTonalContextMode: (mode: TonalContextMode) => void
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
  startSession: (overrideConfigOrNotes?: unknown) => void
  stopSession: () => void
  advanceToNextQuestion: () => void
  repeatCurrentNote: () => void
  handleUserNotePlayed: (playedNoteNumber: number, source?: 'midi_hardware' | 'virtual_ui') => void
  trainWeakNotesOnly: () => void
  resetToConfig: () => void
}

export function useSingleNoteTrainer({
  onPlayStimulus,
  onInstrumentChanged,
  onPlayTonalContext,
  onTelemetryLog
}: TrainerOptions): UseSingleNoteTrainerReturn {
  const defaultNotes = [60, 62, 64, 65, 67, 69, 71, 72]

  const [activeNotes, setActiveNotesState] = useState<number[]>(defaultNotes)
  const activeNotesBufferRef = useRef<number[]>(defaultNotes)

  const [tonalContextMode, setTonalContextModeState] = useState<TonalContextMode>('none')
  const tonalContextModeRef = useRef<TonalContextMode>('none')

  const [selectedStrategyId, setSelectedStrategyIdState] = useState<StrategyId>('adaptive_v1')
  const selectedStrategyIdRef = useRef<StrategyId>('adaptive_v1')

  const [selectedInstrumentId, setSelectedInstrumentIdState] =
    useState<string>('acoustic_grand_piano')
  const selectedInstrumentRef = useRef<InstrumentProfile>(getInstrumentById('acoustic_grand_piano'))

  const currentExpectedNoteRef = useRef<number | null>(null)
  const [currentExpectedNote, setCurrentExpectedNoteState] = useState<number | null>(null)
  const lastDecisionRef = useRef<SelectionDecision | null>(null)
  const stimulusStartTimeRef = useRef<number>(0)
  const preRollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const strategy = useMemo(() => createStrategy(selectedStrategyId), [selectedStrategyId])

  const selectedInstrument = useMemo(
    () => getInstrumentById(selectedInstrumentId),
    [selectedInstrumentId]
  )

  const onBuildSessionRecord = useCallback(
    ({
      sessionId,
      totalSeconds,
      answers,
      history,
      limitType,
      durationMinutes
    }: {
      sessionId: string
      totalSeconds: number
      answers: DbAnswerRecord[]
      history: ExerciseResult[]
      limitType: SessionLimitType
      durationMinutes: number
    }): DbSessionRecord => {
      const calculatedStats = calculateSessionStats(history)
      const contentName = resolveNotePresetName(activeNotesBufferRef.current)

      const formatTag =
        limitType === 'time'
          ? `Cronometrado ${durationMinutes}m`
          : limitType === 'mastery'
            ? 'Modo Maestría'
            : `Bloque ${answers.length} preguntas`

      return {
        id: sessionId,
        createdAt: new Date().toISOString(),
        strategyId: selectedStrategyIdRef.current,
        instrumentId: selectedInstrumentRef.current.id,
        presetName: `${contentName} • ${formatTag}`,
        totalQuestions: answers.length,
        correctAnswers: calculatedStats.correctAnswers,
        accuracyPercentage: calculatedStats.accuracyPercentage,
        avgResponseTimeMs: calculatedStats.avgResponseTimeMs,
        durationSeconds: totalSeconds,
        targetMode: 'single_note' // 👈 CANÓNICO
      }
    },
    []
  )

  const checkIsMasteryCompleted = useCallback(
    (history: ExerciseResult[]): boolean => {
      const currentPerformances = strategy.getNotePerformances(
        activeNotesBufferRef.current,
        history
      )
      return activeNotesBufferRef.current.every((note) => {
        const perf = currentPerformances.get(note)
        return perf && perf.attempts >= 2 && perf.accuracyPercentage >= 85
      })
    },
    [strategy]
  )

  const core = useTrainerCore<ExerciseResult>({
    defaultLimitType: 'questions',
    defaultQuestionsCount: 10,
    defaultDurationMinutes: 5,
    defaultAdvanceMode: 'smart',
    autoAdvanceFastDelayMs: 1400,
    autoAdvanceSlowDelayMs: 3500,
    onBuildSessionRecord,
    checkIsMasteryCompleted
  })

  const { sessionHistory } = core

  const setActiveNotes = useCallback((notes: number[]): void => {
    activeNotesBufferRef.current = notes
    setActiveNotesState(notes)
  }, [])

  const setTonalContextMode = useCallback((mode: TonalContextMode): void => {
    tonalContextModeRef.current = mode
    setTonalContextModeState(mode)
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

  const triggerNextQuestion = useCallback(
    (notesPool?: number[]): void => {
      const pool = notesPool || activeNotesBufferRef.current
      if (pool.length < 2) return

      core.generateQuestionToken('token_single')

      const decision = strategy.selectNextNote({
        activeNotes: pool,
        history: core.sessionHistory,
        lastPlayedNote: currentExpectedNoteRef.current
      })

      currentExpectedNoteRef.current = decision.selectedNote
      setCurrentExpectedNoteState(decision.selectedNote)
      lastDecisionRef.current = decision
      stimulusStartTimeRef.current = Date.now()

      core.setLastResult(null)
      core.setIsWaitingAnswer(true)

      onPlayStimulus(decision.selectedNote, decision)
    },
    [core, strategy, onPlayStimulus]
  )

  const startSession = useCallback(
    (overrideConfigOrNotes?: unknown): void => {
      if (preRollTimerRef.current) {
        clearTimeout(preRollTimerRef.current)
        preRollTimerRef.current = null
      }

      let notesToUse = activeNotesBufferRef.current
      let coreOptions: CoreStartSessionOptions | undefined = undefined

      if (Array.isArray(overrideConfigOrNotes) && overrideConfigOrNotes.length > 0) {
        notesToUse = overrideConfigOrNotes as number[]
      } else if (overrideConfigOrNotes && typeof overrideConfigOrNotes === 'object') {
        const opts = overrideConfigOrNotes as SingleNoteSessionOptions
        if (Array.isArray(opts.notes) && opts.notes.length >= 2) {
          notesToUse = opts.notes
        }
        if (opts.tonalContextMode) {
          setTonalContextMode(opts.tonalContextMode)
        }
        if (opts.instrumentId) {
          setSelectedInstrumentId(opts.instrumentId)
        }
        coreOptions = opts
      }

      if (notesToUse.length < 2) return

      activeNotesBufferRef.current = notesToUse
      setActiveNotesState(notesToUse)

      currentExpectedNoteRef.current = null
      setCurrentExpectedNoteState(null)
      lastDecisionRef.current = null

      onInstrumentChanged(selectedInstrumentRef.current.programNumber)

      const currentMode = tonalContextModeRef.current
      const rootNote = notesToUse[0] || 60

      if (currentMode !== 'none' && onPlayTonalContext) {
        core.startCoreSession(coreOptions)
        onPlayTonalContext(currentMode, rootNote)
        const preRollDuration = getTotalContextDurationMs(currentMode, rootNote)

        preRollTimerRef.current = setTimeout(() => {
          triggerNextQuestion(notesToUse)
        }, preRollDuration)
      } else {
        core.startCoreSession(coreOptions, () => {
          triggerNextQuestion(notesToUse)
        })
      }
    },
    [
      core,
      onInstrumentChanged,
      onPlayTonalContext,
      setTonalContextMode,
      setSelectedInstrumentId,
      triggerNextQuestion
    ]
  )

  const advanceToNextQuestion = useCallback((): void => {
    core.advanceToNextQuestion(() => {
      triggerNextQuestion()
    })
  }, [core, triggerNextQuestion])

  const stopSession = useCallback((): void => {
    if (preRollTimerRef.current) {
      clearTimeout(preRollTimerRef.current)
      preRollTimerRef.current = null
    }
    currentExpectedNoteRef.current = null
    setCurrentExpectedNoteState(null)
    core.stopCoreSession()
  }, [core])

  const resetToConfig = useCallback((): void => {
    if (preRollTimerRef.current) {
      clearTimeout(preRollTimerRef.current)
      preRollTimerRef.current = null
    }
    currentExpectedNoteRef.current = null
    setCurrentExpectedNoteState(null)
    core.resetCoreToConfig()
  }, [core])

  const repeatCurrentNote = useCallback((): void => {
    const expected = currentExpectedNoteRef.current
    const decision = lastDecisionRef.current
    if (expected !== null && decision !== null) {
      onPlayStimulus(expected, decision)
    }
  }, [onPlayStimulus])

  const handleUserNotePlayed = useCallback(
    (playedNoteNumber: number, source: 'midi_hardware' | 'virtual_ui' = 'midi_hardware'): void => {
      if (
        !core.isSessionActive ||
        !core.isWaitingAnswer ||
        currentExpectedNoteRef.current === null ||
        !core.questionToken
      ) {
        return
      }

      const responseTimeMs = Date.now() - stimulusStartTimeRef.current
      const expected = currentExpectedNoteRef.current
      const result = evaluateSingleNoteAnswer(expected, playedNoteNumber, responseTimeMs)

      const answerRecord: DbAnswerRecord = {
        id: `ans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sessionId: core.sessionId,
        questionIndex: core.currentQuestionIndex,
        expectedNote: expected,
        playedNote: playedNoteNumber,
        isCorrect: result.correct,
        semitoneDistance: result.semitoneDistance,
        responseTimeMs,
        velocity: 90,
        reasonTelemetry: lastDecisionRef.current?.reason || '',
        createdAt: new Date().toISOString(),
        inputSource: source
      }

      if (onTelemetryLog) {
        const evalMsg = result.correct
          ? `✅ Acierto (0 st) | Tiempo: ${(responseTimeMs / 1000).toFixed(2)}s`
          : `❌ Fallo (${result.semitoneDistance > 0 ? `+${result.semitoneDistance}` : result.semitoneDistance} st) | Tiempo: ${(responseTimeMs / 1000).toFixed(2)}s`
        onTelemetryLog('EVAL', evalMsg)
      }

      core.recordAnswer(result, answerRecord, result.correct, () => {
        advanceToNextQuestion()
      })
    },
    [core, onTelemetryLog, advanceToNextQuestion]
  )

  const toggleNote = useCallback(
    (note: number): void => {
      const previous = activeNotesBufferRef.current
      const next = previous.includes(note)
        ? previous.filter((n) => n !== note)
        : [...previous, note].sort((a, b) => a - b)
      setActiveNotes(next)
    },
    [setActiveNotes]
  )

  const stats: SessionStats = useMemo(() => calculateSessionStats(sessionHistory), [sessionHistory])

  const performances = useMemo(
    () => strategy.getNotePerformances(activeNotes, sessionHistory),
    [strategy, activeNotes, sessionHistory]
  )

  const trainWeakNotesOnly = useCallback((): void => {
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
  }, [performances, startSession])

  return {
    activeNotes,
    setActiveNotes,
    toggleNote,
    sessionLimitType: core.sessionLimitType,
    setSessionLimitType: core.setSessionLimitType,
    sessionQuestionsCount: core.sessionQuestionsCount,
    setSessionQuestionsCount: core.setSessionQuestionsCount,
    sessionDurationMinutes: core.sessionDurationMinutes,
    setSessionDurationMinutes: core.setSessionDurationMinutes,
    timeRemainingSeconds: core.timeRemainingSeconds,
    sessionElapsedSeconds: core.sessionElapsedSeconds,
    advanceMode: core.advanceMode,
    setAdvanceMode: core.setAdvanceMode,
    tonalContextMode,
    setTonalContextMode,
    selectedStrategyId,
    setSelectedStrategyId,
    selectedInstrument,
    setSelectedInstrumentId,
    isSessionActive: core.isSessionActive,
    isSessionFinished: core.isSessionFinished,
    isWaitingManualAdvance: core.isWaitingManualAdvance,
    currentQuestionIndex: core.currentQuestionIndex,
    currentExpectedNote,
    isWaitingAnswer: core.isWaitingAnswer,
    lastResult: core.lastResult,
    sessionHistory: core.sessionHistory,
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
