import { useState, useCallback, useRef, useMemo } from 'react'
import { ScoreDataModel, ScorePlaybackEvent, HandSelection } from '../domain/music/scoreTypes'
import {
  RepertoireExerciseResult,
  RawPlayedMidiNote,
  RhythmEvaluationMode,
  RepertoireEvaluationConfig,
  DEFAULT_REPERTOIRE_CONFIG,
  evaluateRepertoireAttempt
} from '../domain/exercise/repertoireEvaluator'
import { AdvanceMode, SessionLimitType } from '../domain/exercise/types'
import { DbAnswerRecord, DbSessionRecord } from '../domain/database/types'
import { useTrainerCore, CoreStartSessionOptions } from './useTrainerCore'
import { midiNoteToName } from '../domain/music/noteUtils'

export type ChainingDirection = 'forward' | 'backward'
export type ChainingStepGranularity = '1_event' | '2_events' | '1_measure'

export interface RepertoireSessionOptions extends CoreStartSessionOptions {
  score?: ScoreDataModel
  hand?: HandSelection
  startMeasure?: number
  endMeasure?: number
  chainingDirection?: ChainingDirection
  streakTarget?: number
  rhythmMode?: RhythmEvaluationMode
  rhythmTolerancePercent?: number
  studyBpm?: number
  autoSpeedRamp?: boolean
}

export interface UseRepertoireTrainerReturn {
  currentScore: ScoreDataModel | null
  setCurrentScore: (score: ScoreDataModel | null) => void
  selectedHand: HandSelection
  setSelectedHand: (hand: HandSelection) => void
  startMeasure: number
  setStartMeasure: (m: number) => void
  endMeasure: number
  setEndMeasure: (m: number) => void
  chainingDirection: ChainingDirection
  setChainingDirection: (dir: ChainingDirection) => void
  streakTarget: number
  setStreakTarget: (target: number) => void
  currentStreak: number
  activeEventsSlice: ScorePlaybackEvent[]
  activeSliceLength: number
  rhythmMode: RhythmEvaluationMode
  setRhythmMode: (mode: RhythmEvaluationMode) => void
  rhythmTolerancePercent: number
  setRhythmTolerancePercent: (tol: number) => void
  studyBpm: number
  setStudyBpm: (bpm: number) => void
  autoSpeedRamp: boolean
  setAutoSpeedRamp: (ramp: boolean) => void
  sessionLimitType: SessionLimitType
  setSessionLimitType: (type: SessionLimitType) => void
  advanceMode: AdvanceMode
  setAdvanceMode: (mode: AdvanceMode) => void
  isSessionActive: boolean
  isSessionFinished: boolean
  isWaitingManualAdvance: boolean
  currentQuestionIndex: number
  lastResult: RepertoireExerciseResult | null
  sessionHistory: RepertoireExerciseResult[]
  saveError: string | null
  clearSaveError: () => void
  startSession: (options?: RepertoireSessionOptions) => void
  stopSession: () => void
  advanceToNextStep: () => void
  repeatCurrentSlice: () => void
  handleUserNotePlayed: (
    noteNumber: number,
    velocity?: number,
    source?: 'midi_hardware' | 'virtual_ui'
  ) => void
  resetToConfig: () => void
}

interface RepertoireTrainerProps {
  onPlaySlice: (events: ScorePlaybackEvent[], bpm: number, beatsPerMeasure?: number) => void
  onTelemetryLog?: (type: 'AI' | 'EVAL', message: string) => void
}

function computeSliceEvents(
  score: ScoreDataModel | null,
  hand: HandSelection,
  startM: number,
  endM: number,
  direction: ChainingDirection,
  sliceLen: number
): ScorePlaybackEvent[] {
  if (!score) return []
  const filtered = score.events.filter((e) => {
    const withinMeasure = e.measureNumber >= startM && e.measureNumber <= endM
    const matchesHand =
      hand === 'both' || (hand === 'RH' && e.hand === 'RH') || (hand === 'LH' && e.hand === 'LH')
    const isPlayable = !e.isRest && e.midiNotes.length > 0
    return withinMeasure && matchesHand && isPlayable
  })

  const len = Math.min(sliceLen, filtered.length)
  return direction === 'forward' ? filtered.slice(0, len) : filtered.slice(filtered.length - len)
}

export function useRepertoireTrainer({
  onPlaySlice,
  onTelemetryLog
}: RepertoireTrainerProps): UseRepertoireTrainerReturn {
  const [currentScore, setCurrentScoreState] = useState<ScoreDataModel | null>(null)
  const currentScoreRef = useRef<ScoreDataModel | null>(null)

  const [selectedHand, setSelectedHandState] = useState<HandSelection>('RH')
  const [startMeasure, setStartMeasureState] = useState<number>(1)
  const [endMeasure, setEndMeasureState] = useState<number>(4)
  const [chainingDirection, setChainingDirectionState] = useState<ChainingDirection>('forward')
  const [streakTarget, setStreakTargetState] = useState<number>(3)
  const [currentStreak, setCurrentStreakState] = useState<number>(0)

  const currentStreakRef = useRef<number>(0)
  const streakTargetRef = useRef<number>(3)

  const [rhythmMode, setRhythmModeState] = useState<RhythmEvaluationMode>('free_rubato')
  const [rhythmTolerancePercent, setRhythmTolerancePercentState] = useState<number>(20)
  const [studyBpm, setStudyBpmState] = useState<number>(86)
  const [autoSpeedRamp, setAutoSpeedRampState] = useState<boolean>(false)

  const [activeSliceLength, setActiveSliceLengthState] = useState<number>(1)
  const activeSliceLengthBufferRef = useRef<number>(1)
  const playedNotesBufferRef = useRef<RawPlayedMidiNote[]>([])

  const selectedHandRef = useRef<HandSelection>('RH')
  const startMeasureRef = useRef<number>(1)
  const endMeasureRef = useRef<number>(4)
  const chainingDirectionRef = useRef<ChainingDirection>('forward')
  const studyBpmRef = useRef<number>(86)

  const setCurrentScore = useCallback((score: ScoreDataModel | null): void => {
    currentScoreRef.current = score
    setCurrentScoreState(score)
  }, [])

  const setStreak = useCallback((val: number): void => {
    currentStreakRef.current = val
    setCurrentStreakState(val)
  }, [])

  const getActiveSlice = useCallback((): ScorePlaybackEvent[] => {
    const score = currentScoreRef.current || currentScore
    return computeSliceEvents(
      score,
      selectedHandRef.current,
      startMeasureRef.current,
      endMeasureRef.current,
      chainingDirectionRef.current,
      activeSliceLengthBufferRef.current
    )
  }, [currentScore])

  const activeEventsSlice = useMemo(() => {
    return computeSliceEvents(
      currentScore,
      selectedHand,
      startMeasure,
      endMeasure,
      chainingDirection,
      activeSliceLength
    )
  }, [currentScore, selectedHand, startMeasure, endMeasure, chainingDirection, activeSliceLength])

  const onBuildSessionRecord = useCallback(
    ({
      sessionId,
      totalSeconds,
      answers,
      history
    }: {
      sessionId: string
      totalSeconds: number
      answers: DbAnswerRecord[]
      history: RepertoireExerciseResult[]
      limitType: SessionLimitType
      durationMinutes: number
    }): DbSessionRecord => {
      const successfulCount = history.filter((r) => r.isCompleteSuccess).length
      const avgScore =
        history.length > 0
          ? Math.round(history.reduce((acc, r) => acc + r.overallScorePercent, 0) / history.length)
          : 0

      const avgTime =
        answers.length > 0
          ? Math.round(answers.reduce((acc, a) => acc + a.responseTimeMs, 0) / answers.length)
          : 0

      const title = currentScoreRef.current?.title || 'Repertorio'
      const handLabel =
        selectedHandRef.current === 'RH' ? 'MD' : selectedHandRef.current === 'LH' ? 'MI' : 'Ambas'

      return {
        id: sessionId,
        createdAt: new Date().toISOString(),
        strategyId: 'repertoire_audiomotor_v1',
        instrumentId: 'piano_repertoire',
        presetName: `${title} (${handLabel}) • C.${startMeasureRef.current}-C.${endMeasureRef.current}`,
        totalQuestions: answers.length,
        correctAnswers: successfulCount,
        accuracyPercentage: avgScore,
        avgResponseTimeMs: avgTime,
        durationSeconds: totalSeconds,
        targetMode: 'repertoire'
      }
    },
    []
  )

  const core = useTrainerCore<RepertoireExerciseResult>({
    defaultLimitType: 'questions',
    defaultQuestionsCount: 20,
    defaultDurationMinutes: 10,
    defaultAdvanceMode: 'smart',
    autoAdvanceFastDelayMs: 900,
    onBuildSessionRecord
  })

  const setSelectedHand = useCallback((hand: HandSelection): void => {
    selectedHandRef.current = hand
    setSelectedHandState(hand)
  }, [])

  const setStartMeasure = useCallback((m: number): void => {
    startMeasureRef.current = m
    setStartMeasureState(m)
  }, [])

  const setEndMeasure = useCallback((m: number): void => {
    endMeasureRef.current = m
    setEndMeasureState(m)
  }, [])

  const setChainingDirection = useCallback((dir: ChainingDirection): void => {
    chainingDirectionRef.current = dir
    setChainingDirectionState(dir)
  }, [])

  const setStreakTarget = useCallback((target: number): void => {
    streakTargetRef.current = target
    setStreakTargetState(target)
  }, [])

  const setRhythmMode = useCallback((mode: RhythmEvaluationMode): void => {
    setRhythmModeState(mode)
  }, [])

  const setRhythmTolerancePercent = useCallback((tol: number): void => {
    setRhythmTolerancePercentState(tol)
  }, [])

  const setStudyBpm = useCallback((bpm: number): void => {
    studyBpmRef.current = bpm
    setStudyBpmState(bpm)
  }, [])

  const setAutoSpeedRamp = useCallback((ramp: boolean): void => {
    setAutoSpeedRampState(ramp)
  }, [])

  const setActiveSliceLength = useCallback((len: number): void => {
    activeSliceLengthBufferRef.current = len
    setActiveSliceLengthState(len)
  }, [])

  const triggerPlayCurrentSlice = useCallback(
    (sliceOverride?: ScorePlaybackEvent[]): void => {
      const slice = sliceOverride || getActiveSlice()
      if (slice.length === 0) return

      core.generateQuestionToken('token_rep')
      playedNotesBufferRef.current = []

      core.setLastResult(null)
      core.setIsWaitingAnswer(true)

      const beats = currentScoreRef.current?.timeSignature.beats || 2
      onPlaySlice(slice, studyBpmRef.current, beats)
    },
    [core, getActiveSlice, onPlaySlice]
  )

  const startSession = useCallback(
    (options?: RepertoireSessionOptions): void => {
      let scoreToUse = options?.score || currentScoreRef.current || currentScore
      let handToUse = selectedHandRef.current
      let startM = startMeasureRef.current
      let endM = endMeasureRef.current
      let dirToUse = chainingDirectionRef.current

      if (options?.score) {
        scoreToUse = options.score
        currentScoreRef.current = options.score
        setCurrentScoreState(options.score)
        if (options.score.baseBpm) {
          setStudyBpm(options.score.baseBpm)
        }
      }
      if (options?.hand) {
        handToUse = options.hand
        setSelectedHand(options.hand)
      }
      if (options?.startMeasure) {
        startM = options.startMeasure
        setStartMeasure(options.startMeasure)
      }
      if (options?.endMeasure) {
        endM = options.endMeasure
        setEndMeasure(options.endMeasure)
      }
      if (options?.chainingDirection) {
        dirToUse = options.chainingDirection
        setChainingDirection(options.chainingDirection)
      }
      if (options?.streakTarget) {
        setStreakTarget(options.streakTarget)
      }
      if (options?.rhythmMode) setRhythmMode(options.rhythmMode)
      if (options?.rhythmTolerancePercent) setRhythmTolerancePercent(options.rhythmTolerancePercent)
      if (options?.studyBpm) {
        setStudyBpm(options.studyBpm)
      }
      if (options?.autoSpeedRamp !== undefined) setAutoSpeedRamp(options.autoSpeedRamp)

      setActiveSliceLength(1)
      setStreak(0)
      playedNotesBufferRef.current = []

      const initialSlice = computeSliceEvents(scoreToUse, handToUse, startM, endM, dirToUse, 1)

      core.startCoreSession(options, () => {
        triggerPlayCurrentSlice(initialSlice)
      })
    },
    [
      core,
      currentScore,
      setSelectedHand,
      setStartMeasure,
      setEndMeasure,
      setChainingDirection,
      setStreakTarget,
      setRhythmMode,
      setRhythmTolerancePercent,
      setStudyBpm,
      setAutoSpeedRamp,
      setActiveSliceLength,
      setStreak,
      triggerPlayCurrentSlice
    ]
  )

  const advanceToNextStep = useCallback((): void => {
    core.advanceToNextQuestion(() => {
      triggerPlayCurrentSlice()
    })
  }, [core, triggerPlayCurrentSlice])

  const stopSession = useCallback((): void => {
    playedNotesBufferRef.current = []
    core.stopCoreSession()
  }, [core])

  const resetToConfig = useCallback((): void => {
    playedNotesBufferRef.current = []
    setActiveSliceLength(1)
    setStreak(0)
    core.resetCoreToConfig()
  }, [core, setActiveSliceLength, setStreak])

  const repeatCurrentSlice = useCallback((): void => {
    triggerPlayCurrentSlice()
  }, [triggerPlayCurrentSlice])

  const handleUserNotePlayed = useCallback(
    (
      noteNumber: number,
      velocity = 90,
      source: 'midi_hardware' | 'virtual_ui' = 'midi_hardware'
    ): void => {
      const slice = getActiveSlice()
      const noteName = midiNoteToName(noteNumber)

      // 🔍 LOG DIAGNÓSTICO EN VIVO
      if (onTelemetryLog) {
        onTelemetryLog(
          'EVAL',
          `🎹 Pulsada: ${noteName} (${noteNumber}) | Sesión: ${core.isSessionActive ? 'Activa' : 'Inactiva'}`
        )
      }

      if (!core.isSessionActive || slice.length === 0) return

      const now = Date.now()
      playedNotesBufferRef.current.push({
        noteNumber,
        velocity,
        timestampMs: now
      })

      const totalExpectedMidiNotesCount = slice.reduce((acc, e) => acc + e.midiNotes.length, 0)
      const currentBufferCount = playedNotesBufferRef.current.length

      if (currentBufferCount >= totalExpectedMidiNotesCount) {
        const evalConfig: RepertoireEvaluationConfig = {
          ...DEFAULT_REPERTOIRE_CONFIG,
          rhythmMode,
          rhythmTolerancePercent,
          baseBpm: studyBpmRef.current
        }

        const result = evaluateRepertoireAttempt(slice, playedNotesBufferRef.current, evalConfig)

        const firstExpectedNote = slice[0]?.midiNotes[0] ?? 60
        const answerRecord: DbAnswerRecord = {
          id: `ans_rep_${crypto.randomUUID()}`,
          sessionId: core.sessionId,
          questionIndex: core.currentQuestionIndex,
          expectedNote: firstExpectedNote,
          playedNote: noteNumber,
          isCorrect: result.isCompleteSuccess,
          semitoneDistance: result.pitchAccuracyPercent === 100 ? 0 : 1,
          responseTimeMs: 1000,
          velocity,
          reasonTelemetry: `Rebanada: ${slice.length} evento(s) | Afinación: ${result.pitchAccuracyPercent}% | Ritmo: ${result.rhythmAccuracyPercent}%`,
          createdAt: new Date().toISOString(),
          inputSource: source
        }

        // Lógica de Streak y Expansión
        if (result.isCompleteSuccess) {
          const nextStreak = currentStreakRef.current + 1
          if (onTelemetryLog) {
            onTelemetryLog(
              'EVAL',
              `✅ ¡Acierto! ${result.feedbackMessage} (Streak: ${nextStreak}/${streakTargetRef.current} ⭐)`
            )
          }

          if (nextStreak >= streakTargetRef.current) {
            setStreak(0)
            const nextLen = activeSliceLengthBufferRef.current + 1
            setActiveSliceLength(nextLen)

            if (onTelemetryLog) {
              onTelemetryLog('AI', `🎉 Meta alcanzada -> Expandiendo frase a ${nextLen} nota(s)`)
            }

            if (autoSpeedRamp) {
              const nextBpm = Math.min(
                currentScoreRef.current?.baseBpm || 120,
                studyBpmRef.current + 5
              )
              setStudyBpm(nextBpm)
            }
          } else {
            setStreak(nextStreak)
          }
        } else {
          setStreak(0)
          if (onTelemetryLog) {
            onTelemetryLog('EVAL', `❌ Fallo: ${result.feedbackMessage} (Streak reiniciado a 0)`)
          }
        }

        core.recordAnswer(result, answerRecord, result.isCompleteSuccess, () => {
          advanceToNextStep()
        })
      }
    },
    [
      core,
      getActiveSlice,
      rhythmMode,
      rhythmTolerancePercent,
      autoSpeedRamp,
      setActiveSliceLength,
      setStudyBpm,
      setStreak,
      onTelemetryLog,
      advanceToNextStep
    ]
  )

  return {
    currentScore,
    setCurrentScore,
    selectedHand,
    setSelectedHand,
    startMeasure,
    setStartMeasure,
    endMeasure,
    setEndMeasure,
    chainingDirection,
    setChainingDirection,
    streakTarget,
    setStreakTarget,
    currentStreak,
    activeEventsSlice,
    activeSliceLength,
    rhythmMode,
    setRhythmMode,
    rhythmTolerancePercent,
    setRhythmTolerancePercent,
    studyBpm,
    setStudyBpm,
    autoSpeedRamp,
    setAutoSpeedRamp,
    sessionLimitType: core.sessionLimitType,
    setSessionLimitType: core.setSessionLimitType,
    advanceMode: core.advanceMode,
    setAdvanceMode: core.setAdvanceMode,
    isSessionActive: core.isSessionActive,
    isSessionFinished: core.isSessionFinished,
    isWaitingManualAdvance: core.isWaitingManualAdvance,
    currentQuestionIndex: core.currentQuestionIndex,
    lastResult: core.lastResult,
    sessionHistory: core.sessionHistory,
    saveError: core.saveError,
    clearSaveError: core.clearSaveError,
    startSession,
    stopSession,
    advanceToNextStep,
    repeatCurrentSlice,
    handleUserNotePlayed,
    resetToConfig
  }
}
