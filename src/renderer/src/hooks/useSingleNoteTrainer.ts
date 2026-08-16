import { useState, useCallback } from 'react'
import { ExerciseResult, SessionStats } from '../domain/exercise/types'
import { evaluateSingleNoteAnswer, calculateSessionStats } from '../domain/exercise/evaluator'

interface TrainerOptions {
  onPlayStimulus: (noteNumber: number) => void
}

export interface UseSingleNoteTrainerReturn {
  activeNotes: number[]
  setActiveNotes: (notes: number[]) => void
  toggleNote: (note: number) => void
  sessionLength: number
  setSessionLength: (len: number) => void
  isSessionActive: boolean
  currentQuestionIndex: number
  isWaitingAnswer: boolean
  lastResult: ExerciseResult | null
  stats: SessionStats
  startSession: () => void
  stopSession: () => void
  repeatCurrentNote: () => void
  handleUserNotePlayed: (playedNoteNumber: number) => void
}

export function useSingleNoteTrainer({
  onPlayStimulus
}: TrainerOptions): UseSingleNoteTrainerReturn {
  const [activeNotes, setActiveNotes] = useState<number[]>([60, 62, 64, 65, 67, 69, 71, 72])
  const [sessionLength, setSessionLength] = useState<number>(10)
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [currentExpectedNote, setCurrentExpectedNote] = useState<number | null>(null)
  const [stimulusStartTime, setStimulusStartTime] = useState<number>(0)
  const [isWaitingAnswer, setIsWaitingAnswer] = useState<boolean>(false)
  const [lastResult, setLastResult] = useState<ExerciseResult | null>(null)
  const [sessionHistory, setSessionHistory] = useState<ExerciseResult[]>([])

  const triggerNextQuestion = useCallback((): void => {
    if (activeNotes.length < 2) return

    const randomNote = activeNotes[Math.floor(Math.random() * activeNotes.length)]
    setCurrentExpectedNote(randomNote)
    setLastResult(null)
    setIsWaitingAnswer(true)
    setStimulusStartTime(Date.now())

    onPlayStimulus(randomNote)
  }, [activeNotes, onPlayStimulus])

  const startSession = (): void => {
    if (activeNotes.length < 2) {
      alert('Debes seleccionar al menos 2 notas para entrenar.')
      return
    }
    setSessionHistory([])
    setCurrentQuestionIndex(1)
    setIsSessionActive(true)
    triggerNextQuestion()
  }

  const stopSession = (): void => {
    setIsSessionActive(false)
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

  return {
    activeNotes,
    setActiveNotes,
    toggleNote,
    sessionLength,
    setSessionLength,
    isSessionActive,
    currentQuestionIndex,
    isWaitingAnswer,
    lastResult,
    stats,
    startSession,
    stopSession,
    repeatCurrentNote,
    handleUserNotePlayed
  }
}
