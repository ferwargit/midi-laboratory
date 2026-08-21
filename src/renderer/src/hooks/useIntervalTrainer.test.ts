import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIntervalTrainer } from './useIntervalTrainer'

describe('useIntervalTrainer - Suite Completa y Acumulativa de Intervalos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
      result.current.startSession([4], [60])
    })

    expect(result.current.isSessionActive).toBe(true)
    expect(result.current.currentQuestionIndex).toBe(1)
    expect(onPlayInterval).toHaveBeenCalledTimes(1)

    const [root, target] = onPlayInterval.mock.calls[0]
    expect(root).toBe(60)
    expect(target).toBe(64)
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

  it('debe permitir cambiar de preset y alternar intervalos y raíces libres', () => {
    const { result } = renderHook(() =>
      useIntervalTrainer({
        onPlayInterval: vi.fn()
      })
    )

    act(() => {
      result.current.setSelectedPresetId('level_1_0_contrast')
    })
    expect(result.current.selectedPresetId).toBe('level_1_0_contrast')
    expect(result.current.activeIntervals).toEqual([1, 12])

    act(() => {
      result.current.toggleInterval(4)
    })
    expect(result.current.activeIntervals).toContain(4)

    act(() => {
      result.current.toggleRootNote(64)
    })
    expect(result.current.rootRangeNotes).toContain(64)
  })

  it('repeatCurrentInterval debe volver a emitir el par de notas', () => {
    const onPlayInterval = vi.fn()
    const { result } = renderHook(() =>
      useIntervalTrainer({
        onPlayInterval
      })
    )

    act(() => {
      result.current.startSession([4], [60])
    })
    expect(onPlayInterval).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.repeatCurrentInterval()
    })
    expect(onPlayInterval).toHaveBeenCalledTimes(2)
  })

  it('trainWeakIntervalsOnly debe aislar intervalos con fallo', () => {
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
    act(() => {
      result.current.handleUserNotePlayed(61) // Fallo (+1st en vez de +4st)
    })
    act(() => {
      result.current.stopSession()
    })

    expect(result.current.isSessionFinished).toBe(true)

    act(() => {
      result.current.trainWeakIntervalsOnly()
    })

    expect(result.current.isSessionActive).toBe(true)
  })
})
