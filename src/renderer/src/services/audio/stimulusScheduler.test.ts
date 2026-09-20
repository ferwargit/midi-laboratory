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

  // ---- OLA 2.2 (Auditoría V6, H-04): sincronización del reloj maestro ante cambios de BPM ----

  it('un cambio de tempo con el metrónomo continuo activo debe reiniciar el intervalo y descartar el reloj anterior (H-04)', () => {
    const playNoteFn = vi.fn()
    scheduler.startContinuousMetronome(750, 2, playNoteFn) // 80 BPM
    expect(scheduler.isContinuousMetronomeActive()).toBe(true)
    expect(scheduler.getCurrentBeatDurationMs()).toBe(750)

    // Clic 1 inicial (downbeat) en t = 0
    expect(playNoteFn).toHaveBeenCalledWith(76, 120, 115, 10)
    playNoteFn.mockClear()

    // Avanzamos al 4to clic (fase de beat avanzada, ya dentro del 2do compás)
    vi.advanceTimersByTime(750 * 3)

    // Cambio de tempo a 500 ms/beat (120 BPM) con el metrónomo YA activo
    scheduler.startContinuousMetronome(500, 2, playNoteFn)
    expect(scheduler.isContinuousMetronomeActive()).toBe(true)
    expect(scheduler.getCurrentBeatDurationMs()).toBe(500)

    // El reinicio reemite el downbeat inmediatamente
    expect(playNoteFn).toHaveBeenCalledWith(76, 120, 115, 10)
    playNoteFn.mockClear()

    // Los clics siguientes se emiten cada 500 ms (no cada 750 ms)
    vi.advanceTimersByTime(500)
    expect(playNoteFn).toHaveBeenCalledTimes(1)
    // 1er clic del intervalo nuevo: tiempo débil (la fase reinició en downbeat)
    expect(playNoteFn).toHaveBeenLastCalledWith(77, 120, 90, 10)

    vi.advanceTimersByTime(500)
    expect(playNoteFn).toHaveBeenCalledTimes(2)
    // 2do clic: vuelve a caer en downbeat, confirmando cadencia de 500 ms desde el reinicio
    expect(playNoteFn).toHaveBeenLastCalledWith(76, 120, 115, 10)
  })

  it('un cambio de tempo debe cancelar las frases pendientes programadas sobre la cuadrícula anterior (H-04)', () => {
    const playNoteFn = vi.fn()

    scheduler.startContinuousMetronome(750, 2, playNoteFn)
    playNoteFn.mockClear()

    // Frase de piano programada sobre la cuadrícula de 750 ms/beat
    const pianoEvents: ScheduledNoteEvent[] = [
      { note: 67, durationMs: 500, delayMs: 0, velocity: 100, channel: 1 }
    ]
    scheduler.schedulePhraseOnContinuousGrid(pianoEvents, 1, playNoteFn)
    expect(scheduler.hasPending()).toBe(true)

    // Cambio de tempo: la frase vieja debe cancelarse
    scheduler.startContinuousMetronome(500, 2, playNoteFn)
    expect(scheduler.hasPending()).toBe(false)

    // Avanzamos más allá del downbeat objetivo original: la frase vieja NO suena
    vi.advanceTimersByTime(2000)
    expect(playNoteFn).not.toHaveBeenCalledWith(67, 500, 100, 1)
  })

  it('invocar startContinuousMetronome con el mismo tempo debe ser idempotente y no reiniciar el reloj', () => {
    const playNoteFn = vi.fn()
    scheduler.startContinuousMetronome(750, 2, playNoteFn) // t = 0: downbeat

    // Avanzamos 1 clic: fase en tiempo débil (t = 750 ms)
    vi.advanceTimersByTime(750)
    expect(playNoteFn).toHaveBeenLastCalledWith(77, 120, 90, 10)
    playNoteFn.mockClear()

    // Reinvocación con el mismo tempo: no debe reemitir ningún clic ni reiniciar la fase
    scheduler.startContinuousMetronome(750, 2, playNoteFn)
    expect(playNoteFn).not.toHaveBeenCalled()

    // El siguiente clic cae en t = 1500 ms: downbeat NATURAL de la fase original
    vi.advanceTimersByTime(750)
    expect(playNoteFn).toHaveBeenCalledTimes(1)
    expect(playNoteFn).toHaveBeenLastCalledWith(76, 120, 115, 10)

    // Y el siguiente, en t = 2250 ms: tiempo débil
    vi.advanceTimersByTime(750)
    expect(playNoteFn).toHaveBeenCalledTimes(2)
    expect(playNoteFn).toHaveBeenLastCalledWith(77, 120, 90, 10)
  })
})
