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

  it('debe programar y reproducir eventos con sus retrasos y duraciones exactas', () => {
    const playNoteFn = vi.fn()
    const events: ScheduledNoteEvent[] = [
      { note: 60, durationMs: 400, delayMs: 0, velocity: 85 },
      { note: 64, durationMs: 400, delayMs: 500, velocity: 90 }
    ]

    scheduler.scheduleSequence(events, playNoteFn)
    expect(scheduler.hasPending()).toBe(true)

    // Evento 1 a los 0ms
    vi.advanceTimersByTime(10)
    expect(playNoteFn).toHaveBeenCalledWith(60, 400, 85)
    expect(playNoteFn).toHaveBeenCalledTimes(1)

    // Evento 2 a los 500ms
    vi.advanceTimersByTime(500)
    expect(playNoteFn).toHaveBeenCalledWith(64, 400, 90)
    expect(playNoteFn).toHaveBeenCalledTimes(2)
  })

  it('cancelAll debe anular todos los temporizadores pendientes y evitar notas huérfanas en el sintetizador', () => {
    const playNoteFn = vi.fn()
    const events: ScheduledNoteEvent[] = [
      { note: 60, durationMs: 400, delayMs: 0 },
      { note: 64, durationMs: 400, delayMs: 500 },
      { note: 67, durationMs: 400, delayMs: 1000 }
    ]

    scheduler.scheduleSequence(events, playNoteFn)

    // Disparamos la primera nota
    vi.advanceTimersByTime(10)
    expect(playNoteFn).toHaveBeenCalledTimes(1)

    // Cancelamos atómicamente antes de que suenen la 2da y 3ra
    scheduler.cancelAll()
    expect(scheduler.hasPending()).toBe(false)

    // Avanzamos el tiempo y verificamos que NO suenen las notas canceladas
    vi.advanceTimersByTime(2000)
    expect(playNoteFn).toHaveBeenCalledTimes(1)
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
