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

  it('debe capturar notas secuencialmente y evaluar al completar la longitud con inputSource', () => {
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
      result.current.handleUserNotePlayed(60, 'virtual_ui')
    })
    expect(result.current.capturedNotes.length).toBe(1)

    act(() => {
      result.current.handleUserNotePlayed(62, 'virtual_ui')
    })
    expect(result.current.capturedNotes.length).toBe(2)

    act(() => {
      result.current.handleUserNotePlayed(64, 'virtual_ui')
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

  describe('Timers: auto-advance, cleanup y sesiones por tiempo', () => {
    it('el timer de auto-advance (modo smart, acierto) dispara advanceToNextSequence tras el delay', () => {
      vi.useFakeTimers()
      const onPlaySequence = vi.fn()
      const { result } = renderHook(() => useSequenceTrainer({ onPlaySequence }))

      act(() => {
        result.current.startSession([60, 62, 64], 3)
      })

      const generatedSequence = result.current.currentSequence

      generatedSequence.forEach((note) => {
        act(() => {
          result.current.handleUserNotePlayed(note)
        })
      })

      expect(result.current.currentQuestionIndex).toBe(1)
      expect(result.current.isWaitingManualAdvance).toBe(false)

      act(() => {
        vi.advanceTimersByTime(1800)
      })

      expect(result.current.currentQuestionIndex).toBe(2)
      expect(onPlaySequence).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('stopSession cancela el timer de auto-advance pendiente: no dispara una secuencia extra', () => {
      vi.useFakeTimers()
      const onPlaySequence = vi.fn()
      const { result } = renderHook(() => useSequenceTrainer({ onPlaySequence }))

      act(() => {
        result.current.startSession([60, 62, 64], 3)
      })

      const generatedSequence = result.current.currentSequence

      generatedSequence.forEach((note) => {
        act(() => {
          result.current.handleUserNotePlayed(note)
        })
      })

      act(() => {
        result.current.stopSession()
      })

      expect(result.current.isSessionFinished).toBe(true)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(onPlaySequence).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })

    it('una sesión de secuencias por tiempo finaliza sola al llegar a 0', () => {
      vi.useFakeTimers()
      const onPlaySequence = vi.fn()
      const { result } = renderHook(() => useSequenceTrainer({ onPlaySequence }))

      act(() => {
        result.current.setSessionLimitType('time')
        result.current.setSessionDurationMinutes(1)
      })

      act(() => {
        result.current.startSession([60, 62, 64], 3)
      })

      expect(result.current.timeRemainingSeconds).toBe(60)

      act(() => {
        vi.advanceTimersByTime(60000)
      })

      expect(result.current.isSessionActive).toBe(false)
      expect(result.current.isSessionFinished).toBe(true)

      vi.useRealTimers()
    })

    it('regression: si el pool de notas candidatas queda con menos de 2 al avanzar, advanceToNextSequence no debe quedar trabado luego de reponerlo', () => {
      const onPlaySequence = vi.fn()
      const { result } = renderHook(() => useSequenceTrainer({ onPlaySequence }))

      act(() => {
        result.current.setAdvanceMode('manual')
      })

      act(() => {
        result.current.startSession([60, 62, 64], 3)
      })

      act(() => {
        result.current.handleUserNotePlayed(60)
      })
      act(() => {
        result.current.handleUserNotePlayed(62)
      })
      act(() => {
        result.current.handleUserNotePlayed(64)
      })

      expect(result.current.isWaitingManualAdvance).toBe(true)

      act(() => {
        result.current.toggleCustomNote(60)
        result.current.toggleCustomNote(62)
      })

      act(() => {
        result.current.advanceToNextSequence()
      })

      expect(onPlaySequence).toHaveBeenCalledTimes(1)

      act(() => {
        result.current.toggleCustomNote(60)
      })

      act(() => {
        result.current.advanceToNextSequence()
      })

      expect(onPlaySequence).toHaveBeenCalledTimes(2)
    })
  })
})
