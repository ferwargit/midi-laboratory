import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSingleNoteTrainer } from './useSingleNoteTrainer'

describe('s1-session-snapshot - Aislamiento de Sesión y Control Concurrente', () => {
  it('inactive session ignored: notas MIDI recibidas con sesión inactiva deben ser descartadas sin evaluar', () => {
    const onPlayStimulus = vi.fn()
    const onInstrumentChanged = vi.fn()

    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus,
        onInstrumentChanged
      })
    )

    act(() => {
      result.current.handleUserNotePlayed(60)
    })

    expect(result.current.lastResult).toBeNull()
    expect(result.current.sessionHistory.length).toBe(0)
  })

  it('stale session discarded after stop: detener la sesión invalida el token y descarta notas rezagadas', () => {
    const onPlayStimulus = vi.fn()
    const onInstrumentChanged = vi.fn()

    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus,
        onInstrumentChanged
      })
    )

    act(() => {
      result.current.startSession()
    })
    expect(result.current.isSessionActive).toBe(true)

    act(() => {
      result.current.stopSession()
    })
    expect(result.current.isSessionActive).toBe(false)

    act(() => {
      result.current.handleUserNotePlayed(64)
    })

    expect(result.current.isWaitingAnswer).toBe(false)
  })

  it('manual and auto advance cannot overlap: invocar avance manual repetido no dispara doble pregunta', () => {
    const onPlayStimulus = vi.fn()
    const onInstrumentChanged = vi.fn()

    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus,
        onInstrumentChanged
      })
    )

    act(() => {
      result.current.setSessionLimitType('questions')
      result.current.setSessionQuestionsCount(10)
      result.current.startSession()
    })

    expect(result.current.currentQuestionIndex).toBe(1)

    act(() => {
      result.current.handleUserNotePlayed(60)
      result.current.advanceToNextQuestion()
      result.current.advanceToNextQuestion() // Segundo clic concurrente que debe ser bloqueado
    })

    expect(result.current.currentQuestionIndex).toBe(2)
  })
})
