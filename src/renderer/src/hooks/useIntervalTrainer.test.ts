import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIntervalTrainer } from './useIntervalTrainer'
import { useDatabaseStore } from '../stores/useDatabaseStore'

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

  it('debe manejar la secuencia de 2 pasos: fijar Nota 1 y evaluar al tocar Nota 2 con inputSource', () => {
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
      result.current.handleUserNotePlayed(60, 'virtual_ui')
    })

    expect(result.current.waitingNoteStep).toBe(2)
    expect(result.current.firstNotePlayed).toBe(60)
    expect(result.current.lastResult).toBeNull()

    act(() => {
      result.current.handleUserNotePlayed(64, 'virtual_ui')
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
      result.current.handleUserNotePlayed(61)
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

  describe('Timers: auto-advance, cleanup y sesiones por tiempo', () => {
    it('el timer de auto-advance (modo smart, acierto) dispara advanceToNextInterval tras el delay', () => {
      vi.useFakeTimers()
      const onPlayInterval = vi.fn()
      const { result } = renderHook(() => useIntervalTrainer({ onPlayInterval }))

      act(() => {
        result.current.startSession([4], [60])
      })
      act(() => {
        result.current.handleUserNotePlayed(60)
      })
      act(() => {
        result.current.handleUserNotePlayed(64)
      })

      expect(result.current.currentQuestionIndex).toBe(1)
      expect(result.current.isWaitingManualAdvance).toBe(false)

      act(() => {
        vi.advanceTimersByTime(1600)
      })

      expect(result.current.currentQuestionIndex).toBe(2)
      expect(onPlayInterval).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('stopSession cancela el timer de auto-advance pendiente: no dispara un intervalo extra', () => {
      vi.useFakeTimers()
      const onPlayInterval = vi.fn()
      const { result } = renderHook(() => useIntervalTrainer({ onPlayInterval }))

      act(() => {
        result.current.startSession([4], [60])
      })
      act(() => {
        result.current.handleUserNotePlayed(60)
      })
      act(() => {
        result.current.handleUserNotePlayed(64)
      })

      act(() => {
        result.current.stopSession()
      })

      expect(result.current.isSessionFinished).toBe(true)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(onPlayInterval).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })

    it('una sesión de intervalos por tiempo finaliza sola al llegar a 0', () => {
      vi.useFakeTimers()
      const onPlayInterval = vi.fn()
      const { result } = renderHook(() => useIntervalTrainer({ onPlayInterval }))

      act(() => {
        result.current.setSessionLimitType('time')
        result.current.setSessionDurationMinutes(1)
      })

      act(() => {
        result.current.startSession([4], [60])
      })

      expect(result.current.timeRemainingSeconds).toBe(60)

      act(() => {
        vi.advanceTimersByTime(60000)
      })

      expect(result.current.isSessionActive).toBe(false)
      expect(result.current.isSessionFinished).toBe(true)

      vi.useRealTimers()
    })

    it('regression: si el pool de intervalos queda vacío al avanzar, advanceToNextInterval no debe quedar trabado luego de reponerlo', () => {
      const onPlayInterval = vi.fn()
      const { result } = renderHook(() => useIntervalTrainer({ onPlayInterval }))

      act(() => {
        result.current.setAdvanceMode('manual')
      })

      act(() => {
        result.current.startSession([4], [60])
      })

      act(() => {
        result.current.handleUserNotePlayed(60)
      })
      act(() => {
        result.current.handleUserNotePlayed(64)
      })

      expect(result.current.isWaitingManualAdvance).toBe(true)

      act(() => {
        result.current.toggleInterval(4)
      })

      act(() => {
        result.current.advanceToNextInterval()
      })

      expect(onPlayInterval).toHaveBeenCalledTimes(1)

      act(() => {
        result.current.toggleInterval(4)
      })

      act(() => {
        result.current.advanceToNextInterval()
      })

      expect(onPlayInterval).toHaveBeenCalledTimes(2)
    })

    it('debe guardar la sesión de intervalos con metadatos y fuente de entrada en la base de datos', async () => {
      const saveSpy = vi
        .spyOn(useDatabaseStore.getState(), 'saveSession')
        .mockResolvedValue(undefined)
      const onPlayInterval = vi.fn()
      const { result } = renderHook(() => useIntervalTrainer({ onPlayInterval }))

      act(() => {
        result.current.setSessionLimitType('questions')
        result.current.setSessionQuestionsCount(1)
        result.current.startSession([4], [60])
      })

      // Paso 1: fijar la primera nota en un act independiente
      act(() => {
        result.current.handleUserNotePlayed(60, 'midi_hardware')
      })

      // Paso 2: evaluar la segunda nota en su propio act
      act(() => {
        result.current.handleUserNotePlayed(64, 'midi_hardware')
      })

      act(() => {
        result.current.stopSession()
      })

      expect(saveSpy).toHaveBeenCalled()
      const savedSession = saveSpy.mock.calls[0][0]
      const savedAnswers = saveSpy.mock.calls[0][1]

      expect(savedSession.strategyId).toBe('intervals_v1')
      expect(savedAnswers[0].inputSource).toBe('midi_hardware')

      saveSpy.mockRestore()
    })
  })
})
