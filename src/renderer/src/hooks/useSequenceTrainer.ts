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
import { AdvanceMode, SessionLimitType } from '../domain/exercise/types'
import { DbAnswerRecord, DbSessionRecord } from '../domain/database/types'
import { useTrainerCore, CoreStartSessionOptions } from './useTrainerCore'

interface SequenceTrainerOptions {
  onPlaySequence: (notes: number[]) => void
  onTelemetryLog?: (type: 'AI' | 'EVAL', message: string) => void
}

export interface SequenceSessionOptions extends CoreStartSessionOptions {
  notes?: number[]
  length?: number
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
  startSession: (overrideConfigOrNotes?: unknown, overrideLength?: unknown) => void
  stopSession: () => void
  advanceToNextSequence: () => void
  repeatCurrentSequence: () => void
  handleUserNotePlayed: (noteNumber: number, source?: 'midi_hardware' | 'virtual_ui') => void
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
  const [sequenceLength, setSequenceLengthState] = useState<number>(3)
  const sequenceLengthBufferRef = useRef<number>(3)

  const [customCandidateNotes, setCustomCandidateNotesState] = useState<number[]>([
    60, 62, 64, 65, 67
  ])
  const customCandidateNotesBufferRef = useRef<number[]>([60, 62, 64, 65, 67])

  const [currentSequence, setCurrentSequence] = useState<number[]>([])
  const currentSequenceRef = useRef<number[]>([])
  const [capturedNotes, setCapturedNotes] = useState<number[]>([])
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
      history: SequenceExerciseResult[]
      limitType: SessionLimitType
      durationMinutes: number
    }): DbSessionRecord => {
      const exactCount = history.filter((r) => r.isExactMatch).length
      const avgScore = Math.round(
        history.reduce((acc, r) => acc + r.similarityScorePercentage, 0) / answers.length
      )
      const avgTime = Math.round(
        history.reduce((acc, r) => acc + r.responseTimeMs, 0) / answers.length
      )

      const presetLabel =
        limitType === 'time'
          ? `Secuencias (${sequenceLengthBufferRef.current} notas) • Cronometrado ${durationMinutes}m`
          : `Secuencias (${sequenceLengthBufferRef.current} notas) • Bloque ${answers.length} preguntas`

      return {
        id: sessionId,
        createdAt: new Date().toISOString(),
        strategyId: 'sequences_v1',
        instrumentId: 'piano_sequences',
        presetName: presetLabel,
        totalQuestions: answers.length,
        correctAnswers: exactCount,
        accuracyPercentage: avgScore,
        avgResponseTimeMs: avgTime,
        durationSeconds: totalSeconds,
        targetMode: 'sequences' // 👈 CANÓNICO
      }
    },
    []
  )

  const core = useTrainerCore<SequenceExerciseResult>({
    defaultLimitType: 'questions',
    defaultQuestionsCount: 10,
    defaultDurationMinutes: 5,
    defaultAdvanceMode: 'smart',
    autoAdvanceFastDelayMs: 1800,
    autoAdvanceSlowDelayMs: 3500,
    onBuildSessionRecord
  })

  const { sessionHistory } = core

  const setCustomCandidateNotes = useCallback((notes: number[]): void => {
    customCandidateNotesBufferRef.current = notes
    setCustomCandidateNotesState(notes)
  }, [])

  const setSequenceLength = useCallback((len: number): void => {
    sequenceLengthBufferRef.current = len
    setSequenceLengthState(len)
  }, [])

  const setSelectedPresetId = useCallback(
    (id: string): void => {
      setSelectedPresetIdState(id)
      const preset = SEQUENCE_PRESETS.find((p) => p.id === id)
      if (preset) {
        setSequenceLength(preset.length)
        setCustomCandidateNotes([...preset.candidateNotes])
      }
    },
    [setCustomCandidateNotes, setSequenceLength]
  )

  const toggleCustomNote = useCallback(
    (note: number): void => {
      const prev = customCandidateNotesBufferRef.current
      const next = prev.includes(note)
        ? prev.filter((n) => n !== note)
        : [...prev, note].sort((a, b) => a - b)
      setCustomCandidateNotes(next)
    },
    [setCustomCandidateNotes]
  )

  const triggerNextSequence = useCallback(
    (notesPool?: number[], lengthToUse?: number): void => {
      const currentPool = notesPool || customCandidateNotesBufferRef.current
      const currentLen = lengthToUse || sequenceLengthBufferRef.current
      if (currentPool.length < 2) return

      core.generateQuestionToken('token_seq')

      const preset = SEQUENCE_PRESETS.find((p) => p.id === selectedPresetId)
      const maxJump = preset ? preset.maxJumpSemitones : 12
      const allowRepeat = preset ? preset.allowRepeatedConsecutive : true

      const sequence = generateMelodicSequence(currentPool, currentLen, maxJump, allowRepeat)

      currentSequenceRef.current = sequence
      setCurrentSequence(sequence)
      setCapturedNotes([])
      stimulusStartTimeRef.current = Date.now()

      core.setLastResult(null)
      core.setIsWaitingAnswer(true)

      onPlaySequence(sequence)
    },
    [core, selectedPresetId, onPlaySequence]
  )

  const startSession = useCallback(
    (overrideConfigOrNotes?: unknown, overrideLength?: unknown): void => {
      let notesToUse = customCandidateNotesBufferRef.current
      let lengthToUse = sequenceLengthBufferRef.current
      let coreOptions: CoreStartSessionOptions | undefined = undefined

      if (Array.isArray(overrideConfigOrNotes) && overrideConfigOrNotes.length > 0) {
        notesToUse = overrideConfigOrNotes as number[]
        if (typeof overrideLength === 'number' && overrideLength >= 3) {
          lengthToUse = overrideLength
        }
      } else if (overrideConfigOrNotes && typeof overrideConfigOrNotes === 'object') {
        const opts = overrideConfigOrNotes as SequenceSessionOptions
        if (Array.isArray(opts.notes) && opts.notes.length >= 2) {
          notesToUse = opts.notes
        }
        if (typeof opts.length === 'number' && opts.length >= 3) {
          lengthToUse = opts.length
        }
        coreOptions = opts
      }

      if (notesToUse.length < 2) return

      setCustomCandidateNotes(notesToUse)
      setSequenceLength(lengthToUse)
      setCapturedNotes([])

      core.startCoreSession(coreOptions, () => {
        triggerNextSequence(notesToUse, lengthToUse)
      })
    },
    [core, setCustomCandidateNotes, setSequenceLength, triggerNextSequence]
  )

  const advanceToNextSequence = useCallback((): void => {
    core.advanceToNextQuestion(() => {
      triggerNextSequence()
    })
  }, [core, triggerNextSequence])

  const stopSession = useCallback((): void => {
    setCurrentSequence([])
    currentSequenceRef.current = []
    setCapturedNotes([])
    core.stopCoreSession()
  }, [core])

  const resetToConfig = useCallback((): void => {
    setCurrentSequence([])
    currentSequenceRef.current = []
    setCapturedNotes([])
    core.resetCoreToConfig()
  }, [core])

  const repeatCurrentSequence = useCallback((): void => {
    const seq = currentSequenceRef.current
    if (seq.length > 0) {
      onPlaySequence(seq)
    }
  }, [onPlaySequence])

  const handleUserNotePlayed = useCallback(
    (playedNoteNumber: number, source: 'midi_hardware' | 'virtual_ui' = 'midi_hardware'): void => {
      const seq = currentSequenceRef.current
      if (!core.isSessionActive || seq.length === 0 || !core.questionToken) return

      setCapturedNotes((prev) => {
        const updated = [...prev, playedNoteNumber]

        if (onTelemetryLog) {
          onTelemetryLog('EVAL', `Nota ${updated.length}/${seq.length}: ${playedNoteNumber}`)
        }

        if (updated.length >= seq.length) {
          const responseTimeMs = Date.now() - stimulusStartTimeRef.current
          const result = evaluateSequenceAnswer(seq, updated, responseTimeMs)

          const answerRecord: DbAnswerRecord = {
            id: `ans_seq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            sessionId: core.sessionId,
            questionIndex: core.currentQuestionIndex,
            expectedNote: seq[0],
            playedNote: playedNoteNumber,
            isCorrect: result.isExactMatch,
            semitoneDistance: result.levenshteinDistance,
            responseTimeMs,
            velocity: 90,
            reasonTelemetry: `Secuencia: [${seq.join(', ')}] | Tocadas: [${updated.join(', ')}]`,
            createdAt: new Date().toISOString(),
            inputSource: source
          }

          if (onTelemetryLog) {
            onTelemetryLog('EVAL', result.feedbackMessage)
          }

          core.recordAnswer(result, answerRecord, result.isExactMatch, () => {
            advanceToNextSequence()
          })
        }

        return updated
      })
    },
    [core, onTelemetryLog, advanceToNextSequence]
  )

  const trainWeakMotifsOnly = useCallback((): void => {
    const weakPool = Array.from(
      new Set(sessionHistory.filter((h) => !h.isExactMatch).flatMap((h) => h.expectedNotes))
    )

    if (weakPool.length === 0) return
    const poolToTrain =
      weakPool.length === 1
        ? [weakPool[0], weakPool[0] >= 60 ? weakPool[0] - 2 : weakPool[0] + 2]
        : weakPool

    startSession(poolToTrain.sort((a, b) => a - b))
  }, [sessionHistory, startSession])

  return {
    presets: SEQUENCE_PRESETS,
    selectedPresetId,
    setSelectedPresetId,
    sequenceLength,
    setSequenceLength,
    customCandidateNotes,
    setCustomCandidateNotes,
    toggleCustomNote,
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
    currentSequence,
    capturedNotes,
    lastResult: core.lastResult,
    sessionHistory: core.sessionHistory,
    startSession,
    stopSession,
    advanceToNextSequence,
    repeatCurrentSequence,
    handleUserNotePlayed,
    trainWeakMotifsOnly,
    resetToConfig
  }
}
