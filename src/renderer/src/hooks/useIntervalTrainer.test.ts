import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIntervalTrainer } from './useIntervalTrainer'

describe('useIntervalTrainer - Hook de Entrenamiento de Intervalos (2 Notas)', () => {
  it('debe iniciar en estado de reposo', () => {
    const onPlayInterval = vi.fn()

    const { result } = renderHook(() =>
      useIntervalTrainer({
        onPlayInterval
      })
    )

    expect(result.current.isSessionActive).toBe(false)
    expect(result.current.waitingNoteStep).toBe(1)
    expect(result.current.firstNotePlayed).toBeNull()
  })

  it('debe emitir las 2 notas al iniciar la sesión', () => {
    const onPlayInterval = vi.fn()

    const { result } = renderHook(() =>
      useIntervalTrainer({
        onPlayInterval
      })
    )

    act(() => {
      result.current.startSession()
    })

    expect(result.current.isSessionActive).toBe(true)
    expect(result.current.currentQuestionIndex).toBe(1)
    expect(onPlayInterval).toHaveBeenCalledTimes(1)
  })

  it('debe manejar la secuencia de 2 pasos: fijar Nota 1 y evaluar al tocar Nota 2', () => {
    const onPlayInterval = vi.fn()

    const { result } = renderHook(() =>
      useIntervalTrainer({
        onPlayInterval
      })
    )

    act(() => {
      result.current.startSession()
    })

    // Paso 1: Usuario toca C4 (60)
    act(() => {
      result.current.handleUserNotePlayed(60)
    })

    expect(result.current.waitingNoteStep).toBe(2)
    expect(result.current.firstNotePlayed).toBe(60)
    expect(result.current.lastResult).toBeNull() // Aún no evalúa

    // Paso 2: Usuario toca E4 (64)
    act(() => {
      result.current.handleUserNotePlayed(64)
    })

    expect(result.current.waitingNoteStep).toBe(1)
    expect(result.current.firstNotePlayed).toBeNull()
    expect(result.current.lastResult).not.toBeNull()
    expect(result.current.sessionHistory.length).toBe(1)
  })
})
