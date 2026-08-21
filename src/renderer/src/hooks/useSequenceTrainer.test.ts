import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSequenceTrainer } from './useSequenceTrainer'

describe('useSequenceTrainer - Suite Completa y Acumulativa de Secuencias', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('debe permitir cambiar presets, longitudes y agregar notas candidatas', () => {
    const { result } = renderHook(() =>
      useSequenceTrainer({
        onPlaySequence: vi.fn()
      })
    )

    act(() => {
      result.current.setSelectedPresetId('level_2_2_four_notes_melody')
    })
    expect(result.current.sequenceLength).toBe(4)

    // Agregamos una nota grave que no está en el preset (55 / G3)
    act(() => {
      result.current.toggleCustomNote(55)
    })
    expect(result.current.customCandidateNotes).toContain(55)
  })

  it('repeatCurrentSequence debe volver a emitir la melodía', () => {
    const onPlaySequence = vi.fn()
    const { result } = renderHook(() =>
      useSequenceTrainer({
        onPlaySequence
      })
    )

    act(() => {
      result.current.startSession([60, 62, 64], 3)
    })
    expect(onPlaySequence).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.repeatCurrentSequence()
    })
    expect(onPlaySequence).toHaveBeenCalledTimes(2)
  })

  it('trainWeakMotifsOnly debe aislar notas falladas en las frases', () => {
    const onPlaySequence = vi.fn()
    const { result } = renderHook(() =>
      useSequenceTrainer({
        onPlaySequence
      })
    )

    act(() => {
      result.current.startSession([60, 62, 64], 3)
    })

    // Tocamos 3 notas equivocadas consecutivas
    act(() => {
      result.current.handleUserNotePlayed(71)
    })
    act(() => {
      result.current.handleUserNotePlayed(72)
    })
    act(() => {
      result.current.handleUserNotePlayed(74)
    })
    act(() => {
      result.current.stopSession()
    })

    expect(result.current.isSessionFinished).toBe(true)

    act(() => {
      result.current.trainWeakMotifsOnly()
    })

    expect(result.current.isSessionActive).toBe(true)
  })
})
