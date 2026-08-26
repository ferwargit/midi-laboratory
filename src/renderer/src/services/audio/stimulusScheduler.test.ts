import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StimulusScheduler, ScheduledNoteEvent } from './stimulusScheduler'

describe('stimulusScheduler - Programación y Cancelación Atómica de Estímulos de Audio', () => {
  let scheduler: StimulusScheduler

  beforeEach(() => {
    scheduler = new StimulusScheduler()
    vi.useFakeTimers()
  })

  afterEach(() => {
    scheduler.cancelAll()
    vi.useRealTimers()
  })

  it('debe programar y reproducir eventos con sus retrasos, duraciones y canales exactos', () => {
    const playNoteFn = vi.fn()
    const events: ScheduledNoteEvent[] = [
      { note: 60, durationMs: 400, delayMs: 0, velocity: 85, channel: 1 },
      { note: 76, durationMs: 120, delayMs: 500, velocity: 105, channel: 10 }
    ]

    scheduler.scheduleSequence(events, playNoteFn)
    expect(scheduler.hasPending()).toBe(true)

    // Evento 1 a los 0ms en Canal 1 (Piano)
    vi.advanceTimersByTime(10)
    expect(playNoteFn).toHaveBeenCalledWith(60, 400, 85, 1)
    expect(playNoteFn).toHaveBeenCalledTimes(1)

    // Evento 2 a los 500ms en Canal 10 (Metrónomo)
    vi.advanceTimersByTime(500)
    expect(playNoteFn).toHaveBeenCalledWith(76, 120, 105, 10)
    expect(playNoteFn).toHaveBeenCalledTimes(2)
  })

  it('schedulePhraseOnContinuousGrid con 1 compás de pausa debe esperar exactamente 2 clics (1 compás en 2/4)', () => {
    const playNoteFn = vi.fn()
    const beatMs = 750 // 80 BPM
    const beatsPerMeasure = 2 // 2/4 (1 compás = 1500ms = 2 clics)

    // Iniciar metrónomo continuo en t = 0ms
    scheduler.startContinuousMetronome(beatMs, beatsPerMeasure, playNoteFn)
    expect(scheduler.isContinuousMetronomeActive()).toBe(true)

    // Clic 1 inicial (0ms)
    expect(playNoteFn).toHaveBeenCalledWith(76, 120, 115, 10)

    // Clic 2 (750ms)
    vi.advanceTimersByTime(750)
    expect(playNoteFn).toHaveBeenCalledWith(77, 120, 90, 10)

    // Programar frase de piano con 1 compás de respiración (entrará a los 1500ms = exactamente 2 clics de espera)
    const pianoEvents: ScheduledNoteEvent[] = [
      { note: 67, durationMs: 500, delayMs: 0, velocity: 100, channel: 1 }
    ]
    scheduler.schedulePhraseOnContinuousGrid(pianoEvents, 1, playNoteFn)

    // A los 1500ms entra el piano exactamente en el Tiempo 1 fuerte del siguiente compás
    vi.advanceTimersByTime(750)
    expect(playNoteFn).toHaveBeenCalledWith(67, 500, 100, 1)
  })

  it('cancelAll debe anular todos los temporizadores y apagar el metrónomo continuo', () => {
    const playNoteFn = vi.fn()
    scheduler.startContinuousMetronome(500, 2, playNoteFn)
    expect(scheduler.isContinuousMetronomeActive()).toBe(true)

    scheduler.cancelAll()
    expect(scheduler.hasPending()).toBe(false)
    expect(scheduler.isContinuousMetronomeActive()).toBe(false)
  })

  it('debe invocar el callback onComplete al finalizar la duración total de la secuencia', () => {
    const playNoteFn = vi.fn()
    const onComplete = vi.fn()
    const events: ScheduledNoteEvent[] = [{ note: 60, durationMs: 300, delayMs: 0 }]

    scheduler.scheduleSequence(events, playNoteFn, onComplete)

    vi.advanceTimersByTime(310)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
