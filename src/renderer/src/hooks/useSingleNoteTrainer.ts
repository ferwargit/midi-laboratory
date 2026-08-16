import { useState, useCallback, useMemo } from 'react'
import { ExerciseResult, SessionStats } from '../domain/exercise/types'
import { evaluateSingleNoteAnswer, calculateSessionStats } from '../domain/exercise/evaluator'
import { StrategyId, NotePerformance } from '../domain/adaptation/types'
import { createStrategy } from '../domain/adaptation/adaptiveEngine'

interface TrainerOptions {
  onPlayStimulus: (noteNumber: number) => void
}

export interface UseSingleNoteTrainerReturn {
  activeNotes: number[]
  setActiveNotes: (notes: number[]) => void
  toggleNote: (note: number) => void
  sessionLength: number
  setSessionLength: (len: number) => void
  selectedStrategyId: StrategyId
  setSelectedStrategyId: (id: StrategyId) => void
  isSessionActive: boolean
  isSessionFinished: boolean
  currentQuestionIndex: number
  isWaitingAnswer: boolean
  lastResult: ExerciseResult | null
  sessionHistory: ExerciseResult[]
  stats: SessionStats
  performances: Map<number, NotePerformance>
  startSession: () => void
  stopSession: () => void
  repeatCurrentNote: () => void
  handleUserNotePlayed: (playedNoteNumber: number) => void
  trainWeakNotesOnly: () => void
  resetToConfig: () => void
}

export function useSingleNoteTrainer({
  onPlayStimulus
}: TrainerOptions): UseSingleNoteTrainerReturn {
  const [activeNotes, setActiveNotes] = useState<number[]>([60, 62, 64, 65, 67, 69, 71, 72])
  const [sessionLength, setSessionLength] = useState<number>(10)
  const [selectedStrategyId, setSelectedStrategyId] = useState<StrategyId>('adaptive_v1')
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false)
  const [isSessionFinished, setIsSessionFinished] = useState<boolean>(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [currentExpectedNote, setCurrentExpectedNote] = useState<number | null>(null)
  const [stimulusStartTime, setStimulusStartTime] = useState<number>(0)
  const [isWaitingAnswer, setIsWaitingAnswer] = useState<boolean>(false)
  const [lastResult, setLastResult] = useState<ExerciseResult | null>(null)
  const [sessionHistory, setSessionHistory] = useState<ExerciseResult[]>([])

  const strategy = useMemo(() => createStrategy(selectedStrategyId), [selectedStrategyId])

  const triggerNextQuestion = useCallback((): void => {
    if (activeNotes.length < 2) return

    const nextNote = strategy.selectNextNote({
      activeNotes,
      history: sessionHistory,
      lastPlayedNote: currentExpectedNote
    })

    setCurrentExpectedNote(nextNote)
    setLastResult(null)
    setIsWaitingAnswer(true)
    setStimulusStartTime(Date.now())

    onPlayStimulus(nextNote)
  }, [activeNotes, sessionHistory, currentExpectedNote, strategy, onPlayStimulus])

  const startSession = (): void => {
    if (activeNotes.length < 2) {
      alert('Debes seleccionar al menos 2 notas para entrenar.')
      return
    }
    setSessionHistory([])
    setCurrentQuestionIndex(1)
    setIsSessionFinished(false)
    setIsSessionActive(true)
    triggerNextQuestion()
  }

  const stopSession = (): void => {
    setIsSessionActive(false)
    setIsSessionFinished(false)
    setIsWaitingAnswer(false)
    setCurrentExpectedNote(null)
  }

  const resetToConfig = (): void => {
    setIsSessionActive(false)
    setIsSessionFinished(false)
    setIsWaitingAnswer(false)
    setCurrentExpectedNote(null)
  }

  const repeatCurrentNote = (): void => {
    if (currentExpectedNote !== null) {
      onPlayStimulus(currentExpectedNote)
    }
  }

  const handleUserNotePlayed = useCallback(
    (playedNoteNumber: number): void => {
      if (!isSessionActive || !isWaitingAnswer || currentExpectedNote === null) return

      const responseTimeMs = Date.now() - stimulusStartTime
      const result = evaluateSingleNoteAnswer(currentExpectedNote, playedNoteNumber, responseTimeMs)

      setLastResult(result)
      setSessionHistory((prev) => [...prev, result])
      setIsWaitingAnswer(false)

      setTimeout(() => {
        if (sessionLength > 0 && currentQuestionIndex >= sessionLength) {
          setIsSessionActive(false)
          setIsSessionFinished(true)
          setIsWaitingAnswer(false)
        } else {
          setCurrentQuestionIndex((prev) => prev + 1)
          triggerNextQuestion()
        }
      }, 1400)
    },
    [
      isSessionActive,
      isWaitingAnswer,
      currentExpectedNote,
      stimulusStartTime,
      sessionLength,
      currentQuestionIndex,
      triggerNextQuestion
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

  // Entrenar únicamente las notas que tuvieron fallos en esta sesión
  const trainWeakNotesOnly = (): void => {
    const weakNotes: number[] = []
    performances.forEach((perf, note) => {
      if (perf.attempts > 0 && perf.accuracyPercentage < 85) {
        weakNotes.push(note)
      }
    })

    if (weakNotes.length < 2) {
      alert(
        '¡Felicitaciones! No tienes suficientes notas débiles para aislar (< 2). Puedes seguir con la selección actual.'
      )
      return
    }

    setActiveNotes(weakNotes.sort((a, b) => a - b))
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
    sessionLength,
    setSessionLength,
    selectedStrategyId,
    setSelectedStrategyId,
    isSessionActive,
    isSessionFinished,
    currentQuestionIndex,
    isWaitingAnswer,
    lastResult,
    sessionHistory,
    stats,
    performances,
    startSession,
    stopSession,
    repeatCurrentNote,
    handleUserNotePlayed,
    trainWeakNotesOnly,
    resetToConfig
  }
}
