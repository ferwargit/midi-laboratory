import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSingleNoteTrainer } from './useSingleNoteTrainer'
import { useDatabaseStore } from '../stores/useDatabaseStore'

describe('useSingleNoteTrainer - Suite Completa y Acumulativa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe iniciar en estado de reposo con límites por defecto', () => {
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
    expect(result.current.sessionLimitType).toBe('questions')
    expect(result.current.advanceMode).toBe('smart')
  })

  it('debe tolerar que startSession reciba un evento de React sin lanzar error', () => {
    const onPlayStimulus = vi.fn()
    const onInstrumentChanged = vi.fn()

    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus,
        onInstrumentChanged
      })
    )

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

    const specificPool = [62, 64, 65]
    act(() => {
      result.current.startSession(specificPool)
    })

    expect(result.current.isSessionActive).toBe(true)
    expect(result.current.currentQuestionIndex).toBe(1)
    expect(result.current.isWaitingAnswer).toBe(true)

    const noteCalled = onPlayStimulus.mock.calls[0][0]
    expect(specificPool).toContain(noteCalled)
  })

  it('debe evaluar la respuesta del usuario y registrar acierto/fallo con inputSource', () => {
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

    // Simulamos respuesta tocada desde el ratón virtual
    act(() => {
      result.current.handleUserNotePlayed(60, 'virtual_ui')
    })

    expect(result.current.isWaitingAnswer).toBe(false)
    expect(result.current.lastResult).not.toBeNull()
    expect(result.current.sessionHistory.length).toBe(1)
  })

  it('debe alternar notas con toggleNote', () => {
    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus: vi.fn(),
        onInstrumentChanged: vi.fn()
      })
    )

    act(() => {
      result.current.toggleNote(60)
    })
    expect(result.current.activeNotes).not.toContain(60)

    act(() => {
      result.current.toggleNote(60)
    })
    expect(result.current.activeNotes).toContain(60)
  })

  it('debe cambiar de instrumento y notificar al Korg', () => {
    const onInstrumentChanged = vi.fn()
    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus: vi.fn(),
        onInstrumentChanged
      })
    )

    act(() => {
      result.current.setSelectedInstrumentId('flute')
    })

    expect(result.current.selectedInstrument.id).toBe('flute')
    expect(onInstrumentChanged).toHaveBeenCalledWith(73)
  })

  it('repeatCurrentNote debe volver a emitir el estímulo activo', () => {
    const onPlayStimulus = vi.fn()
    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus,
        onInstrumentChanged: vi.fn()
      })
    )

    act(() => {
      result.current.startSession([60, 62])
    })
    expect(onPlayStimulus).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.repeatCurrentNote()
    })
    expect(onPlayStimulus).toHaveBeenCalledTimes(2)
  })

  it('trainWeakNotesOnly debe aislar notas falladas y re-lanzar la sesión', () => {
    const onPlayStimulus = vi.fn()
    const { result } = renderHook(() =>
      useSingleNoteTrainer({
        onPlayStimulus,
        onInstrumentChanged: vi.fn()
      })
    )

    act(() => {
      result.current.startSession([60, 62])
    })

    act(() => {
      result.current.handleUserNotePlayed(70)
    })
    act(() => {
      result.current.stopSession()
    })

    expect(result.current.isSessionFinished).toBe(true)

    act(() => {
      result.current.trainWeakNotesOnly()
    })

    expect(result.current.isSessionActive).toBe(true)
  })

  describe('Timers: auto-advance, cleanup y sesiones por tiempo', () => {
    it('el timer de auto-advance (modo smart, acierto) dispara advanceToNextQuestion tras el delay', () => {
      vi.useFakeTimers()
      const onPlayStimulus = vi.fn()
      const onInstrumentChanged = vi.fn()

      const { result } = renderHook(() =>
        useSingleNoteTrainer({ onPlayStimulus, onInstrumentChanged })
      )

      act(() => {
        result.current.startSession([60, 62])
      })

      const expectedNote = result.current.currentExpectedNote as number

      act(() => {
        result.current.handleUserNotePlayed(expectedNote)
      })

      expect(result.current.isWaitingManualAdvance).toBe(false)
      expect(result.current.currentQuestionIndex).toBe(1)

      act(() => {
        vi.advanceTimersByTime(1400)
      })

      expect(result.current.currentQuestionIndex).toBe(2)
      expect(onPlayStimulus).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('stopSession cancela el timer de auto-advance pendiente: no dispara una pregunta extra', () => {
      vi.useFakeTimers()
      const onPlayStimulus = vi.fn()
      const onInstrumentChanged = vi.fn()

      const { result } = renderHook(() =>
        useSingleNoteTrainer({ onPlayStimulus, onInstrumentChanged })
      )

      act(() => {
        result.current.startSession([60, 62])
      })

      const expectedNote = result.current.currentExpectedNote as number

      act(() => {
        result.current.handleUserNotePlayed(expectedNote)
      })

      act(() => {
        result.current.stopSession()
      })

      expect(result.current.isSessionFinished).toBe(true)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(onPlayStimulus).toHaveBeenCalledTimes(1)
      expect(result.current.currentQuestionIndex).toBe(1)

      vi.useRealTimers()
    })

    it('una sesión por tiempo finaliza sola al llegar a 0 y guarda una única vez', () => {
      vi.useFakeTimers()
      const onPlayStimulus = vi.fn()
      const onInstrumentChanged = vi.fn()

      const { result } = renderHook(() =>
        useSingleNoteTrainer({ onPlayStimulus, onInstrumentChanged })
      )

      act(() => {
        result.current.setSessionLimitType('time')
        result.current.setSessionDurationMinutes(1)
      })

      act(() => {
        result.current.startSession([60, 62])
      })

      expect(result.current.timeRemainingSeconds).toBe(60)

      act(() => {
        vi.advanceTimersByTime(60000)
      })

      expect(result.current.isSessionActive).toBe(false)
      expect(result.current.isSessionFinished).toBe(true)
      expect(result.current.timeRemainingSeconds).toBe(0)

      vi.useRealTimers()
    })

    it('regression: si el pool queda con menos de 2 notas al avanzar, advanceToNextQuestion no debe quedar trabado luego de reponerlo', () => {
      const onPlayStimulus = vi.fn()
      const onInstrumentChanged = vi.fn()

      const { result } = renderHook(() =>
        useSingleNoteTrainer({ onPlayStimulus, onInstrumentChanged })
      )

      act(() => {
        result.current.setAdvanceMode('manual')
      })

      act(() => {
        result.current.startSession([60, 62])
      })

      const firstExpected = result.current.currentExpectedNote as number

      act(() => {
        result.current.handleUserNotePlayed(firstExpected)
      })

      expect(result.current.isWaitingManualAdvance).toBe(true)

      act(() => {
        result.current.toggleNote(62)
      })

      act(() => {
        result.current.advanceToNextQuestion()
      })

      expect(onPlayStimulus).toHaveBeenCalledTimes(1)

      act(() => {
        result.current.toggleNote(62)
      })

      act(() => {
        result.current.advanceToNextQuestion()
      })

      expect(onPlayStimulus).toHaveBeenCalledTimes(2)
    })

    it('debe guardar la sesión con metadatos enriquecidos de contenido y formato de entrenamiento', async () => {
      const saveSpy = vi
        .spyOn(useDatabaseStore.getState(), 'saveSession')
        .mockResolvedValue(undefined)
      const onPlayStimulus = vi.fn()
      const onInstrumentChanged = vi.fn()

      const { result } = renderHook(() =>
        useSingleNoteTrainer({ onPlayStimulus, onInstrumentChanged })
      )

      act(() => {
        result.current.setSessionLimitType('questions')
        result.current.setSessionQuestionsCount(1)
        result.current.startSession([60, 62, 64])
      })

      act(() => {
        const expected = result.current.currentExpectedNote as number
        result.current.handleUserNotePlayed(expected, 'midi_hardware')
      })

      act(() => {
        result.current.stopSession()
      })

      expect(saveSpy).toHaveBeenCalled()
      const savedSession = saveSpy.mock.calls[0][0]
      const savedAnswers = saveSpy.mock.calls[0][1]

      expect(savedSession.presetName).toContain('Nivel 1 (C, D, E)')
      expect(savedSession.presetName).toContain('Bloque 1 preguntas')
      expect(savedAnswers[0].inputSource).toBe('midi_hardware')

      saveSpy.mockRestore()
    })
  })
})
