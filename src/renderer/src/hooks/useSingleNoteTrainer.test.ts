import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSingleNoteTrainer } from './useSingleNoteTrainer'

describe('useSingleNoteTrainer - Hook de Entrenamiento de Nota Individual', () => {
  it('debe iniciar en estado de reposo (no activo)', () => {
    const onPlayStimulus = vi.fn()
    const onInstrumentChanged = vi.fn()

    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus,
        onInstrumentChanged
      })
    )

    expect(result.current.isSessionActive).toBe(false)
    expect(result.current.isSessionFinished).toBe(false)
    expect(result.current.currentQuestionIndex).toBe(0)
  })

  it('debe activar la sesión y emitir el primer estímulo al llamar a startSession', () => {
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
    expect(result.current.currentQuestionIndex).toBe(1)
    expect(result.current.isWaitingAnswer).toBe(true)
    expect(onPlayStimulus).toHaveBeenCalledTimes(1)
  })

  it('debe evaluar correctamente la respuesta del usuario y registrar acierto/fallo', () => {
    const onPlayStimulus = vi.fn()
    const onInstrumentChanged = vi.fn()

    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus,
        onInstrumentChanged
      })
    )

    act(() => {
      result.current.setActiveNotes([60, 62]) // C4 y D4
      result.current.startSession()
    })

    // Simulamos que el usuario responde la nota 60
    act(() => {
      result.current.handleUserNotePlayed(60)
    })

    expect(result.current.isWaitingAnswer).toBe(false)
    expect(result.current.lastResult).not.toBeNull()
    expect(result.current.sessionHistory.length).toBe(1)
  })

  it('debe permitir detener la sesión manualmente sin errores', () => {
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
  })
})
