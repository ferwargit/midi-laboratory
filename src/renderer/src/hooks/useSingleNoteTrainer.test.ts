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

  it('debe tolerar que startSession reciba un evento sin lanzar error de iterador', () => {
    const onPlayStimulus = vi.fn()
    const onInstrumentChanged = vi.fn()

    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus,
        onInstrumentChanged
      })
    )

    // Simulamos que React le pasa un objeto no array
    const fakeEvent = {} as unknown as number[]
    act(() => {
      result.current.startSession(fakeEvent)
    })

    expect(result.current.isSessionActive).toBe(true)
    expect(result.current.isWaitingAnswer).toBe(true)
    expect(onPlayStimulus).toHaveBeenCalledTimes(1)
  })

  it('debe activar la sesión y emitir una nota perteneciente al pool exacto', () => {
    const onPlayStimulus = vi.fn()
    const onInstrumentChanged = vi.fn()

    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus,
        onInstrumentChanged
      })
    )

    const specificPool = [62, 64, 65] // D4, E4, F4
    act(() => {
      result.current.startSession(specificPool)
    })

    expect(result.current.isSessionActive).toBe(true)
    expect(result.current.currentQuestionIndex).toBe(1)
    expect(result.current.isWaitingAnswer).toBe(true)
    expect(onPlayStimulus).toHaveBeenCalledTimes(1)

    const noteCalled = onPlayStimulus.mock.calls[0][0]
    expect(specificPool).toContain(noteCalled)
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
      result.current.startSession([60, 62])
    })

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
