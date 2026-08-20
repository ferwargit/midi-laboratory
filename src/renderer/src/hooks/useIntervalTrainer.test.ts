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

  it('debe emitir 2 notas válidas y acotadas al iniciar la sesión', () => {
    const onPlayInterval = vi.fn()

    const { result } = renderHook(() =>
      useIntervalTrainer({
        onPlayInterval
      })
    )

    act(() => {
      // Iniciamos pasando explícitamente 4 semitonos (3M) sobre C4 (60)
      result.current.startSession([4], [60])
    })

    expect(result.current.isSessionActive).toBe(true)
    expect(result.current.currentQuestionIndex).toBe(1)
    expect(onPlayInterval).toHaveBeenCalledTimes(1)

    const [root, target] = onPlayInterval.mock.calls[0]
    expect(root).toBe(60)
    expect(target).toBe(64) // C4 + 4 semitonos = E4
  })

  it('debe manejar la secuencia de 2 pasos: fijar Nota 1 y evaluar al tocar Nota 2', () => {
    const onPlayInterval = vi.fn()

    const { result } = renderHook(() =>
      useIntervalTrainer({
        onPlayInterval
      })
    )

    act(() => {
      result.current.startSession([4], [60])
    })

    act(() => {
      result.current.handleUserNotePlayed(60)
    })

    expect(result.current.waitingNoteStep).toBe(2)
    expect(result.current.firstNotePlayed).toBe(60)
    expect(result.current.lastResult).toBeNull()

    act(() => {
      result.current.handleUserNotePlayed(64)
    })

    expect(result.current.waitingNoteStep).toBe(1)
    expect(result.current.firstNotePlayed).toBeNull()
    expect(result.current.lastResult).not.toBeNull()
    expect(result.current.sessionHistory.length).toBe(1)
  })
})
