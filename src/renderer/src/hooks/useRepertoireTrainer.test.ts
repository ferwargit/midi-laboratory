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

  it('debe iniciar en estado de reposo y permitir configurar setters de parámetros', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() => useRepertoireTrainer({ onPlaySlice }))

    expect(result.current.isSessionActive).toBe(false)
    expect(result.current.selectedHand).toBe('RH')

    act(() => {
      result.current.setStartMeasure(2)
      result.current.setEndMeasure(3)
      result.current.setChainingDirection('backward')
      result.current.setStreakTarget(6)
      result.current.setRhythmMode('strict_metronome')
      result.current.setRhythmTolerancePercent(15)
      result.current.setAdvanceMode('manual')
      result.current.setSessionLimitType('time')
      result.current.setAutoSpeedRamp(true)
    })

    expect(result.current.startMeasure).toBe(2)
    expect(result.current.endMeasure).toBe(3)
    expect(result.current.chainingDirection).toBe('backward')
    expect(result.current.streakTarget).toBe(6)
    expect(result.current.rhythmMode).toBe('strict_metronome')
    expect(result.current.rhythmTolerancePercent).toBe(15)
    expect(result.current.advanceMode).toBe('manual')
    expect(result.current.sessionLimitType).toBe('time')
    expect(result.current.autoSpeedRamp).toBe(true)
  })

  it('debe permitir activar y detener el Metrónomo Libre y cambiar BPM en vivo', () => {
    const onPlayMetronomeTick = vi.fn()
    const onTelemetryLog = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice: vi.fn(),
        onPlayMetronomeTick,
        onTelemetryLog
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

  it('repeatCurrentSlice y resetToConfig deben operar limpiamente', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() => useRepertoireTrainer({ onPlaySlice }))

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 1,
        endMeasure: 1
      })
    })

    expect(onPlaySlice).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.repeatCurrentSlice()
    })
    expect(onPlaySlice).toHaveBeenCalledTimes(2)

    act(() => {
      result.current.resetToConfig()
    })
    expect(result.current.isSessionActive).toBe(false)
    expect(result.current.currentStreak).toBe(0)
  })

  it('en Ambas Manos (both) debe fusionar notas del mismo tiempo en un acorde polifónico', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() => useRepertoireTrainer({ onPlaySlice }))

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'both',
        startMeasure: 1,
        endMeasure: 1,
        includeResolutionNote: false
      })
    })

    expect(result.current.activeEventsSlice.length).toBe(1)
    expect(result.current.activeEventsSlice[0].isChord).toBe(true)
    expect(result.current.activeEventsSlice[0].midiNotes).toEqual([48, 67])
  })

  it('handleUserNotePlayed debe soportar entradas virtuales de UI (virtual_ui)', () => {
    const onPlaySlice = vi.fn()
    const { result } = renderHook(() => useRepertoireTrainer({ onPlaySlice }))

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 1,
        endMeasure: 1
      })
    })

    act(() => {
      result.current.handleUserNotePlayed(67, 95, 'virtual_ui')
    })
    expect(result.current.currentStreak).toBe(1)
  })

  it('al activar autoSpeedRamp debe incrementar el BPM (+5) al completar la frase pero topar en el tempo nominal', () => {
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
        studyBpm: 84, // Cerca del máximo de 86
        autoSpeedRamp: true
      })
    })

    act(() => {
      result.current.handleUserNotePlayed(67)
    })
    act(() => {
      result.current.handleUserNotePlayed(67)
      result.current.handleUserNotePlayed(67)
    })

    expect(result.current.studyBpm).toBe(86) // Tope en 86 BPM de la partitura
  })

  it('al fallar una nota debe resetear el streak a 0 y emitir feedback', () => {
    const onTelemetryLog = vi.fn()
    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice: vi.fn(),
        onTelemetryLog
      })
    )

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 1,
        endMeasure: 1,
        streakTarget: 3
      })
    })

    act(() => {
      result.current.handleUserNotePlayed(67)
    })
    expect(result.current.currentStreak).toBe(1)

    act(() => {
      result.current.handleUserNotePlayed(65) // Nota errónea
    })
    expect(result.current.currentStreak).toBe(0)
    expect(onTelemetryLog).toHaveBeenCalledWith('EVAL', expect.stringContaining('Fallo'))
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
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.isSessionFinished).toBe(true)
    })
    expect(saveSpy).toHaveBeenCalled()

    saveSpy.mockRestore()
  })

  it('debe guardar la sesión de repertorio en la base de datos con targetMode repertoire', async () => {
    const saveSpy = vi
      .spyOn(useDatabaseStore.getState(), 'saveSession')
      .mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useRepertoireTrainer({
        onPlaySlice: vi.fn()
      })
    )

    act(() => {
      result.current.startSession({
        score: MOCK_SCORE_DATA,
        hand: 'RH',
        startMeasure: 1,
        endMeasure: 1
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

    saveSpy.mockRestore()
  })
})
