import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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
    // Compás 1 - Mano Izquierda (Bajo de Alberti)
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
        chainingDirection: 'backward', // 👈 Hacia atrás
        streakTarget: 1,
        rhythmMode: 'free_rubato'
      })
    })

    // Debe comenzar con la última nota del compás 1 (A4 = 69)
    expect(result.current.activeEventsSlice[0].midiNotes).toEqual([69])

    // Tocamos A4 -> Cumple streak y expande anteponiendo la nota previa (G4 + A4)
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

    // Intento 1 correcto
    act(() => {
      result.current.handleUserNotePlayed(67, 90, 'midi_hardware')
    })
    expect(result.current.currentStreak).toBe(1)
    expect(result.current.activeSliceLength).toBe(1)

    // Intento 2 correcto -> Cumple el streak target (2) y expande a 2 notas
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

    // Acierto 1
    act(() => {
      result.current.handleUserNotePlayed(67)
    })
    expect(result.current.currentStreak).toBe(1)

    // Fallo (toca F4 en vez de G4)
    act(() => {
      result.current.handleUserNotePlayed(65)
    })
    expect(result.current.currentStreak).toBe(0)
  })

  it('al activar autoSpeedRamp debe incrementar el BPM (+5) al dominar la frase completa', () => {
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
        streakTarget: 1,
        studyBpm: 60,
        autoSpeedRamp: true,
        rhythmMode: 'free_rubato'
      })
    })

    // Dominar nota 1 (longitud 1 -> 2)
    act(() => {
      result.current.handleUserNotePlayed(67)
    })
    // Dominar nota 1+2 (longitud 2 -> 3)
    act(() => {
      result.current.handleUserNotePlayed(67)
      result.current.handleUserNotePlayed(67)
    })
    // Dominar nota 1+2+3 (longitud 3 = total del compás -> activa Rampa de Velocidad)
    act(() => {
      result.current.handleUserNotePlayed(67)
      result.current.handleUserNotePlayed(67)
      result.current.handleUserNotePlayed(69)
    })

    expect(result.current.studyBpm).toBe(65) // 60 BPM + 5 BPM
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
