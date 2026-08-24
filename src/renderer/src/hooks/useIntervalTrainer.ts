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
import { AdvanceMode, SessionLimitType } from '../domain/exercise/types'
import { generateValidInterval } from '../domain/exercise/exerciseGeneratorRules'
import { DbAnswerRecord, DbSessionRecord } from '../domain/database/types'
import { useTrainerCore, CoreStartSessionOptions } from './useTrainerCore'

interface IntervalTrainerOptions {
  onPlayInterval: (root: number, target: number, direction: IntervalDirection) => void
  onTelemetryLog?: (type: 'AI' | 'EVAL', message: string) => void
}

export interface IntervalSessionOptions extends CoreStartSessionOptions {
  intervals?: number[]
  roots?: number[]
  directionMode?: DirectionSelection
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
  startSession: (overrideConfigOrIntervals?: unknown, overrideRoots?: unknown) => void
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
  const [activeIntervals, setActiveIntervalsState] = useState<number[]>([2, 4, 5, 7, 12])
  const activeIntervalsBufferRef = useRef<number[]>([2, 4, 5, 7, 12])

  const [directionMode, setDirectionModeState] = useState<DirectionSelection>('ascending')
  const directionModeRef = useRef<DirectionSelection>('ascending')

  const [rootRangeNotes, setRootRangeNotesState] = useState<number[]>([60])
  const rootRangeNotesBufferRef = useRef<number[]>([60])

  const [currentStimulus, setCurrentStimulus] = useState<IntervalExerciseStimulus | null>(null)
  const currentStimulusRef = useRef<IntervalExerciseStimulus | null>(null)

  const [waitingNoteStep, setWaitingNoteStep] = useState<1 | 2>(1)
  const [firstNotePlayed, setFirstNotePlayed] = useState<number | null>(null)
  const stimulusStartTimeRef = useRef<number>(0)

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
      history: IntervalExerciseResult[]
      limitType: SessionLimitType
      durationMinutes: number
    }): DbSessionRecord => {
      const correctCount = history.filter((r) => r.isIntervalCorrect).length
      const accPercent = Math.round((correctCount / answers.length) * 100)
      const avgTime = Math.round(
        history.reduce((acc, r) => acc + r.responseTimeMs, 0) / answers.length
      )

      const presetLabel =
        limitType === 'time'
          ? `Intervalos (${activeIntervalsBufferRef.current.length} activos) • Cronometrado ${durationMinutes}m`
          : `Intervalos (${activeIntervalsBufferRef.current.length} activos) • Bloque ${answers.length} preguntas`

      return {
        id: sessionId,
        createdAt: new Date().toISOString(),
        strategyId: 'intervals_v1',
        instrumentId: 'piano_intervals',
        presetName: presetLabel,
        totalQuestions: answers.length,
        correctAnswers: correctCount,
        accuracyPercentage: accPercent,
        avgResponseTimeMs: avgTime,
        durationSeconds: totalSeconds,
        targetMode: 'intervals' // 👈 CANÓNICO
      }
    },
    []
  )

  const core = useTrainerCore<IntervalExerciseResult>({
    defaultLimitType: 'questions',
    defaultQuestionsCount: 10,
    defaultDurationMinutes: 5,
    defaultAdvanceMode: 'smart',
    autoAdvanceFastDelayMs: 1600,
    autoAdvanceSlowDelayMs: 3500,
    onBuildSessionRecord
  })

  const { sessionHistory } = core

  const setActiveIntervals = useCallback((st: number[]): void => {
    activeIntervalsBufferRef.current = st
    setActiveIntervalsState(st)
  }, [])

  const setRootRangeNotes = useCallback((notes: number[]): void => {
    rootRangeNotesBufferRef.current = notes
    setRootRangeNotesState(notes)
  }, [])

  const setDirectionMode = useCallback((dir: DirectionSelection): void => {
    directionModeRef.current = dir
    setDirectionModeState(dir)
  }, [])

  const setSelectedPresetId = useCallback(
    (id: string): void => {
      setSelectedPresetIdState(id)
      const preset = INTERVAL_PRESETS.find((p) => p.id === id)
      if (preset) {
        setActiveIntervals([...preset.intervalSemitones])
        setDirectionMode(preset.defaultDirection)
        if (preset.fixedRootNote !== null) {
          setRootRangeNotes([preset.fixedRootNote])
        } else {
          const roots = Array.from({ length: 25 }, (_, i) => 48 + i)
          setRootRangeNotes(roots)
        }
      }
    },
    [setActiveIntervals, setDirectionMode, setRootRangeNotes]
  )

  const toggleInterval = useCallback(
    (semitone: number): void => {
      const prev = activeIntervalsBufferRef.current
      const next = prev.includes(semitone)
        ? prev.filter((st) => st !== semitone)
        : [...prev, semitone].sort((a, b) => a - b)
      setActiveIntervals(next)
    },
    [setActiveIntervals]
  )

  const toggleRootNote = useCallback(
    (note: number): void => {
      const prev = rootRangeNotesBufferRef.current
      const next = prev.includes(note)
        ? prev.filter((n) => n !== note)
        : [...prev, note].sort((a, b) => a - b)
      setRootRangeNotes(next)
    },
    [setRootRangeNotes]
  )

  const triggerNextInterval = useCallback(
    (intervalsPool?: number[], rootsPool?: number[]): void => {
      const currentIntervals = intervalsPool || activeIntervalsBufferRef.current
      const currentRoots = rootsPool || rootRangeNotesBufferRef.current
      if (currentIntervals.length === 0 || currentRoots.length === 0) return

      core.generateQuestionToken('token_int')

      const lastSt = currentStimulusRef.current ? currentStimulusRef.current.semitones : null
      const intervalData = generateValidInterval(
        currentIntervals,
        currentRoots,
        directionModeRef.current,
        lastSt
      )

      const stimulus: IntervalExerciseStimulus = {
        rootNote: intervalData.rootNote,
        targetNote: intervalData.targetNote,
        semitones: intervalData.semitones,
        direction: intervalData.direction
      }

      currentStimulusRef.current = stimulus
      setCurrentStimulus(stimulus)
      setWaitingNoteStep(1)
      setFirstNotePlayed(null)
      stimulusStartTimeRef.current = Date.now()

      core.setLastResult(null)
      core.setIsWaitingAnswer(true)

      onPlayInterval(stimulus.rootNote, stimulus.targetNote, stimulus.direction)
    },
    [core, onPlayInterval]
  )

  const startSession = useCallback(
    (overrideConfigOrIntervals?: unknown, overrideRoots?: unknown): void => {
      let intervalsToUse = activeIntervalsBufferRef.current
      let rootsToUse = rootRangeNotesBufferRef.current
      let coreOptions: CoreStartSessionOptions | undefined = undefined

      if (Array.isArray(overrideConfigOrIntervals) && overrideConfigOrIntervals.length > 0) {
        intervalsToUse = overrideConfigOrIntervals as number[]
        if (Array.isArray(overrideRoots) && overrideRoots.length > 0) {
          rootsToUse = overrideRoots as number[]
        }
      } else if (overrideConfigOrIntervals && typeof overrideConfigOrIntervals === 'object') {
        const opts = overrideConfigOrIntervals as IntervalSessionOptions
        if (Array.isArray(opts.intervals) && opts.intervals.length > 0) {
          intervalsToUse = opts.intervals
        }
        if (Array.isArray(opts.roots) && opts.roots.length > 0) {
          rootsToUse = opts.roots
        }
        if (opts.directionMode) {
          setDirectionMode(opts.directionMode)
        }
        coreOptions = opts
      }

      if (intervalsToUse.length === 0 || rootsToUse.length === 0) return

      setActiveIntervals(intervalsToUse)
      setRootRangeNotes(rootsToUse)

      setWaitingNoteStep(1)
      setFirstNotePlayed(null)

      core.startCoreSession(coreOptions, () => {
        triggerNextInterval(intervalsToUse, rootsToUse)
      })
    },
    [core, setActiveIntervals, setRootRangeNotes, setDirectionMode, triggerNextInterval]
  )

  const advanceToNextInterval = useCallback((): void => {
    core.advanceToNextQuestion(() => {
      triggerNextInterval()
    })
  }, [core, triggerNextInterval])

  const stopSession = useCallback((): void => {
    setCurrentStimulus(null)
    currentStimulusRef.current = null
    setFirstNotePlayed(null)
    setWaitingNoteStep(1)
    core.stopCoreSession()
  }, [core])

  const resetToConfig = useCallback((): void => {
    setCurrentStimulus(null)
    currentStimulusRef.current = null
    setFirstNotePlayed(null)
    setWaitingNoteStep(1)
    core.resetCoreToConfig()
  }, [core])

  const repeatCurrentInterval = useCallback((): void => {
    const stim = currentStimulusRef.current
    if (stim) {
      onPlayInterval(stim.rootNote, stim.targetNote, stim.direction)
    }
  }, [onPlayInterval])

  const handleUserNotePlayed = useCallback(
    (playedNoteNumber: number, source: 'midi_hardware' | 'virtual_ui' = 'midi_hardware'): void => {
      const stim = currentStimulusRef.current
      if (!core.isSessionActive || !stim || !core.questionToken) return

      if (waitingNoteStep === 1) {
        setFirstNotePlayed(playedNoteNumber)
        setWaitingNoteStep(2)
        if (onTelemetryLog) {
          onTelemetryLog('EVAL', `1ª Nota registrada: ${playedNoteNumber} | Tocá la 2ª nota...`)
        }
        return
      }

      if (waitingNoteStep === 2 && firstNotePlayed !== null) {
        const responseTimeMs = Date.now() - stimulusStartTimeRef.current
        const playedPair: [number, number] = [firstNotePlayed, playedNoteNumber]
        const result = evaluateIntervalAnswer(stim, playedPair, responseTimeMs)

        const answerRecord: DbAnswerRecord = {
          id: `ans_int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sessionId: core.sessionId,
          questionIndex: core.currentQuestionIndex,
          expectedNote: stim.targetNote,
          playedNote: playedNoteNumber,
          isCorrect: result.isIntervalCorrect,
          semitoneDistance: result.semitoneDistanceError,
          responseTimeMs,
          velocity: 90,
          reasonTelemetry: `${result.expectedStimulus.semitones} st (${result.expectedStimulus.direction})`,
          createdAt: new Date().toISOString(),
          inputSource: source
        }

        setWaitingNoteStep(1)
        setFirstNotePlayed(null)

        if (onTelemetryLog) {
          onTelemetryLog('EVAL', result.feedbackMessage)
        }

        core.recordAnswer(result, answerRecord, result.isIntervalCorrect, () => {
          advanceToNextInterval()
        })
      }
    },
    [core, waitingNoteStep, firstNotePlayed, onTelemetryLog, advanceToNextInterval]
  )

  const trainWeakIntervalsOnly = useCallback((): void => {
    const weakIntervals: number[] = []
    activeIntervalsBufferRef.current.forEach((st) => {
      const attempts = sessionHistory.filter((h) => h.expectedStimulus.semitones === st)
      if (attempts.length > 0) {
        const correct = attempts.filter((h) => h.isIntervalCorrect).length
        if (correct / attempts.length < 0.85) {
          weakIntervals.push(st)
        }
      }
    })

    if (weakIntervals.length === 0) return
    startSession(weakIntervals)
  }, [sessionHistory, startSession])

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
    sessionLimitType: core.sessionLimitType,
    setSessionLimitType: core.setSessionLimitType,
    sessionQuestionsCount: core.sessionQuestionsCount,
    setSessionQuestionsCount: core.setSessionQuestionsCount,
    sessionDurationMinutes: core.sessionDurationMinutes,
    setSessionDurationMinutes: core.setSessionDurationMinutes,
    timeRemainingSeconds: core.timeRemainingSeconds,
    advanceMode: core.advanceMode,
    setAdvanceMode: core.setAdvanceMode,
    isSessionActive: core.isSessionActive,
    isSessionFinished: core.isSessionFinished,
    isWaitingManualAdvance: core.isWaitingManualAdvance,
    currentQuestionIndex: core.currentQuestionIndex,
    currentStimulus,
    waitingNoteStep,
    firstNotePlayed,
    lastResult: core.lastResult,
    sessionHistory: core.sessionHistory,
    startSession,
    stopSession,
    advanceToNextInterval,
    repeatCurrentInterval,
    handleUserNotePlayed,
    trainWeakIntervalsOnly,
    resetToConfig
  }
}
