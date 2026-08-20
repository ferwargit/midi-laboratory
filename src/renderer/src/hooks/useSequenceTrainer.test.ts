import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSequenceTrainer } from './useSequenceTrainer'

describe('useSequenceTrainer - Hook de Entrenamiento de Secuencias Melódicas', () => {
  it('debe iniciar en estado de reposo', () => {
    const onPlaySequence = vi.fn()

    const { result } = renderHook(() =>
      useSequenceTrainer({
        onPlaySequence
      })
    )

    expect(result.current.isSessionActive).toBe(false)
    expect(result.current.capturedNotes.length).toBe(0)
    expect(result.current.sequenceLength).toBe(3)
  })

  it('debe capturar notas secuencialmente y evaluar al completar la longitud', () => {
    const onPlaySequence = vi.fn()

    const { result } = renderHook(() =>
      useSequenceTrainer({
        onPlaySequence
      })
    )

    act(() => {
      // Iniciamos pasando explícitamente notas y longitud 3
      result.current.startSession([60, 62, 64], 3)
    })

    expect(result.current.isSessionActive).toBe(true)
    expect(onPlaySequence).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.handleUserNotePlayed(60)
    })
    expect(result.current.capturedNotes.length).toBe(1)

    act(() => {
      result.current.handleUserNotePlayed(62)
    })
    expect(result.current.capturedNotes.length).toBe(2)

    act(() => {
      result.current.handleUserNotePlayed(64)
    })

    expect(result.current.lastResult).not.toBeNull()
    expect(result.current.sessionHistory.length).toBe(1)
  })
})
