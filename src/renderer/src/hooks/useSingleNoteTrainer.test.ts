import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSingleNoteTrainer } from './useSingleNoteTrainer'

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

  it('debe evaluar la respuesta del usuario y registrar acierto/fallo', () => {
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

    // Simulamos fallo
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
})
