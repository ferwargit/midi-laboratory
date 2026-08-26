import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRepertoireTrainer } from './useRepertoireTrainer'
import { ScoreDataModel } from '../domain/music/scoreTypes'
import { useDatabaseStore } from '../stores/useDatabaseStore'

const MOCK_SCORE_DATA: ScoreDataModel = {
  title: 'Partitura 1 (Félix Dumont)',
  composer: 'Félix Dumont',
  timeSignature: { beats: 2, beatType: 4 },
  keySignature: { fifths: 0, mode: 'major' },
  baseBpm: 86,
  divisionsPerQuarter: 4,
  totalMeasures: 8,
  events: [
    // Compás 1 - Mano Derecha
    {
      id: 'e1',
      measureNumber: 1,
      beatPosition: 1.0,
      notes: [{ pitch: 67, step: 'G', alter: 0, octave: 4 }],
      midiNotes: [67],
      durationDivisions: 2,
      durationBeats: 0.5,
      durationMs: 348,
      isChord: false,
      isRest: false,
      hand: 'RH',
      staff: 1,
      voice: 1
    },
    {
      id: 'e2',
      measureNumber: 1,
      beatPosition: 1.5,
      notes: [{ pitch: 67, step: 'G', alter: 0, octave: 4 }],
      midiNotes: [67],
      durationDivisions: 1,
      durationBeats: 0.25,
      durationMs: 174,
      isChord: false,
      isRest: false,
      hand: 'RH',
      staff: 1,
      voice: 1
    },
    {
      id: 'e3',
      measureNumber: 1,
      beatPosition: 1.75,
      notes: [{ pitch: 69, step: 'A', alter: 0, octave: 4 }],
      midiNotes: [69],
      durationDivisions: 1,
      durationBeats: 0.25,
      durationMs: 174,
      isChord: false,
      isRest: false,
      hand: 'RH',
      staff: 1,
      voice: 1
    },
    // Compás 2 - Mano Derecha (Nota C5 en tiempo 1.0)
    {
      id: 'e4',
      measureNumber: 2,
      beatPosition: 1.0,
      notes: [{ pitch: 72, step: 'C', alter: 0, octave: 5 }],
      midiNotes: [72],
      durationDivisions: 2,
      durationBeats: 0.5,
      durationMs: 348,
      isChord: false,
      isRest: false,
      hand: 'RH',
      staff: 1,
      voice: 1
    },
    {
      id: 'e5',
      measureNumber: 2,
      beatPosition: 1.5,
      notes: [{ pitch: 64, step: 'E', alter: 0, octave: 4 }],
      midiNotes: [64],
      durationDivisions: 1,
      durationBeats: 0.25,
      durationMs: 174,
      isChord: false,
      isRest: false,
      hand: 'RH',
      staff: 1,
      voice: 1
    },
    // Compás 3 - Mano Derecha (Nota F4 en tiempo 1.0)
    {
      id: 'e6',
      measureNumber: 3,
      beatPosition: 1.0,
      notes: [{ pitch: 65, step: 'F', alter: 0, octave: 4 }],
      midiNotes: [65],
      durationDivisions: 2,
      durationBeats: 0.5,
      durationMs: 348,
      isChord: false,
      isRest: false,
      hand: 'RH',
      staff: 1,
      voice: 1
    },
    // Compás 4 - Mano Derecha (Resolución E4 en tiempo 1.0)
    {
      id: 'e7',
      measureNumber: 4,
      beatPosition: 1.0,
      notes: [{ pitch: 64, step: 'E', alter: 0, octave: 4 }],
      midiNotes: [64],
      durationDivisions: 2,
      durationBeats: 0.5,
      durationMs: 348,
      isChord: false,
      isRest: false,
      hand: 'RH',
      staff: 1,
      voice: 1
    },
    // Compás 1 - Mano Izquierda (C3 en tiempo 1.0)
    {
      id: 'lh1',
      measureNumber: 1,
      beatPosition: 1.0,
      notes: [{ pitch: 48, step: 'C', alter: 0, octave: 3 }],
      midiNotes: [48],
      durationDivisions: 2,
      durationBeats: 0.5,
      durationMs: 348,
      isChord: false,
      isRest: false,
      hand: 'LH',
      staff: 2,
      voice: 5
    },
    // Compás 2 - Mano Izquierda (C3 en tiempo 1.0)
    {
      id: 'lh2',
      measureNumber: 2,
      beatPosition: 1.0,
      notes: [{ pitch: 48, step: 'C', alter: 0, octave: 3 }],
      midiNotes: [48],
      durationDivisions: 2,
      durationBeats: 0.5,
      durationMs: 348,
      isChord: false,
      isRest: false,
      hand: 'LH',
      staff: 2,
      voice: 5
    }
  ],
  harmonicProgression: []
}

describe('useRepertoireTrainer - Hook de Entrenamiento Audiomotor de Repertorio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe iniciar en estado de reposo con valores por defecto', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice
      })
    )

    expect(result.current.isSessionActive).toBe(false)
    expect(result.current.selectedHand).toBe('RH')
    expect(result.current.startMeasure).toBe(1)
    expect(result.current.streakTarget).toBe(3)
    expect(result.current.currentStreak).toBe(0)
    expect(result.current.includeResolutionNote).toBe(true)
    expect(result.current.continuousMetronome).toBe(false)
    expect(result.current.restingMeasures).toBe(1)
    expect(result.current.isFreeMetronomeActive).toBe(false)
  })

  it('debe permitir activar y detener el Metrónomo Libre en reposo y cambiar tempo en vivo', () => {
    const onPlayMetronomeTick = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice: vi.fn(),
        onPlayMetronomeTick
      })
    )

    act(() => {
      result.current.toggleFreeMetronome()
    })
    expect(result.current.isFreeMetronomeActive).toBe(true)
    expect(onPlayMetronomeTick).toHaveBeenCalled()

    act(() => {
      result.current.setStudyBpm(100)
    })
    expect(result.current.studyBpm).toBe(100)

    act(() => {
      result.current.toggleFreeMetronome()
    })
    expect(result.current.isFreeMetronomeActive).toBe(false)
  })

  it('en Ambas Manos con includeResolutionNote debe terminar en la resolución estricta del tiempo 1.0 (C3 + C5)', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice
      })
    )

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'both',
        startMeasure: 1,
        endMeasure: 1,
        includeResolutionNote: true
      })
    })

    expect(result.current.activeEventsSlice[0].midiNotes).toEqual([48, 67]) // C3 + G4
  })

  it('en rango arbitrario del Compás 2 al 3 con includeResolutionNote debe anexar exactamente el primer evento del Compás 4 (E4)', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice
      })
    )

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 2,
        endMeasure: 3,
        includeResolutionNote: true
      })
    })

    // El primer evento del compás 2 es C5 (72)
    expect(result.current.activeEventsSlice[0].midiNotes).toEqual([72])
  })

  it('debe configurar y propagar el BPM de estudio a la reproducción del estímulo', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice
      })
    )

    act(() => {
      result.current.setStudyBpm(75)
    })
    expect(result.current.studyBpm).toBe(75)

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 1,
        endMeasure: 1,
        rhythmMode: 'free_rubato',
        studyBpm: 75
      })
    })

    expect(result.current.studyBpm).toBe(75)
    expect(onPlaySlice).toHaveBeenCalledWith(expect.any(Array), 75, 2, 'free_rubato', false, 1)
  })

  it('al iniciar sesión con Forward Chaining debe emitir la primera nota (Evento 1)', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice
      })
    )

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 1,
        endMeasure: 1,
        chainingDirection: 'forward',
        streakTarget: 3
      })
    })

    expect(result.current.isSessionActive).toBe(true)
    expect(result.current.activeSliceLength).toBe(1)
    expect(result.current.activeEventsSlice.length).toBe(1)
    expect(result.current.activeEventsSlice[0].midiNotes).toEqual([67]) // G4
  })

  it('Backward Chaining debe iniciar en la última nota y anteponer la anterior tras cumplir el streak', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice
      })
    )

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 1,
        endMeasure: 1,
        chainingDirection: 'backward',
        streakTarget: 1,
        includeResolutionNote: false
      })
    })

    expect(result.current.activeEventsSlice[0].midiNotes).toEqual([69]) // A4

    act(() => {
      result.current.handleUserNotePlayed(69)
    })

    expect(result.current.activeSliceLength).toBe(2)
    expect(result.current.activeEventsSlice.map((e) => e.midiNotes[0])).toEqual([67, 69])
  })

  it('debe incrementar el streak y expandir la rebanada tras completar los aciertos consecutivos', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice
      })
    )

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 1,
        endMeasure: 1,
        streakTarget: 2,
        rhythmMode: 'free_rubato'
      })
    })

    act(() => {
      result.current.handleUserNotePlayed(67, 90, 'midi_hardware')
    })
    expect(result.current.currentStreak).toBe(1)
    expect(result.current.activeSliceLength).toBe(1)

    act(() => {
      result.current.handleUserNotePlayed(67, 90, 'midi_hardware')
    })
    expect(result.current.currentStreak).toBe(0)
    expect(result.current.activeSliceLength).toBe(2)
    expect(result.current.activeEventsSlice.length).toBe(2)
  })

  it('al fallar una nota debe resetear el streak a 0', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice
      })
    )

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 1,
        endMeasure: 1,
        streakTarget: 3,
        rhythmMode: 'free_rubato'
      })
    })

    act(() => {
      result.current.handleUserNotePlayed(67)
    })
    expect(result.current.currentStreak).toBe(1)

    act(() => {
      result.current.handleUserNotePlayed(65)
    })
    expect(result.current.currentStreak).toBe(0)
  })

  it('al dominar la totalidad de notas de la frase debe finalizar la sesión automáticamente', async () => {
    const saveSpy = vi
      .spyOn(useDatabaseStore.getState(), 'saveSession')
      .mockResolvedValue(undefined)
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() => useRepertoireTrainer({ onPlaySlice }))

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 1,
        endMeasure: 1,
        includeResolutionNote: false,
        streakTarget: 1,
        rhythmMode: 'free_rubato'
      })
    })

    act(() => {
      result.current.handleUserNotePlayed(67)
    })

    act(() => {
      result.current.handleUserNotePlayed(67)
      result.current.handleUserNotePlayed(67)
    })

    await act(async () => {
      result.current.handleUserNotePlayed(67)
      result.current.handleUserNotePlayed(67)
      result.current.handleUserNotePlayed(69)
    })

    await waitFor(() => {
      expect(result.current.isSessionFinished).toBe(true)
    })
    expect(saveSpy).toHaveBeenCalled()

    saveSpy.mockRestore()
  })

  it('al seleccionar Mano Izquierda (LH) debe filtrar únicamente las notas del pentagrama 2', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice
      })
    )

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'LH',
        startMeasure: 1,
        endMeasure: 1
      })
    })

    expect(result.current.activeEventsSlice.length).toBe(1)
    expect(result.current.activeEventsSlice[0].midiNotes).toEqual([48]) // C3
  })

  it('debe guardar la sesión de repertorio en la base de datos con targetMode repertoire', async () => {
    const saveSpy = vi
      .spyOn(useDatabaseStore.getState(), 'saveSession')
      .mockResolvedValue(undefined)

    const onPlaySlice = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice
      })
    )

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 1,
        endMeasure: 1,
        rhythmMode: 'free_rubato'
      })
    })

    act(() => {
      result.current.handleUserNotePlayed(67, 90, 'midi_hardware')
    })

    await act(async () => {
      result.current.stopSession()
    })

    expect(saveSpy).toHaveBeenCalled()
    const savedSession = saveSpy.mock.calls[0][0]
    expect(savedSession.targetMode).toBe('repertoire')
    expect(savedSession.presetName).toContain('Félix Dumont')

    saveSpy.mockRestore()
  })
})
