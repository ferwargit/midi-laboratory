export interface ScheduledNoteEvent {
  note: number
  durationMs: number
  delayMs: number
  velocity?: number
  channel?: number // 1: Piano, 10: Metrónomo
}

export class StimulusScheduler {
  private activeTimers: Set<ReturnType<typeof setTimeout>> = new Set()
  private metronomeTimer: ReturnType<typeof setInterval> | null = null
  private clockStartTime = 0
  private currentBeatDurationMs = 700
  private currentBeatsPerMeasure = 2
  private isMetroRunning = false

  // 👈 Declaración pública para sincronización con el indicador visual LED
  public onBeatTick?: (beatIndex: number, isDownbeat?: boolean) => void

  scheduleSequence(
    events: ScheduledNoteEvent[],
    playNoteFn: (note: number, durationMs: number, velocity?: number, channel?: number) => void,
    onComplete?: () => void
  ): void {
    this.cancelSequenceTimers()

    let maxDelay = 0

    events.forEach((evt) => {
      const timer = setTimeout(() => {
        this.activeTimers.delete(timer)
        playNoteFn(evt.note, evt.durationMs, evt.velocity ?? 90, evt.channel ?? 1)
      }, evt.delayMs)

      this.activeTimers.add(timer)
      const eventEnd = evt.delayMs + evt.durationMs
      if (eventEnd > maxDelay) maxDelay = eventEnd
    })

    if (onComplete) {
      const completeTimer = setTimeout(() => {
        this.activeTimers.delete(completeTimer)
        onComplete()
      }, maxDelay)
      this.activeTimers.add(completeTimer)
    }
  }

  /**
   * Inicia el Metrónomo Continuo en Canal 10 con notificación de Beat al indicador visual.
   */
  startContinuousMetronome(
    beatDurationMs: number,
    beatsPerMeasure = 2,
    playNoteFn: (note: number, durationMs: number, velocity?: number, channel?: number) => void
  ): void {
    if (this.metronomeTimer && this.currentBeatDurationMs === beatDurationMs) {
      return
    }

    this.stopContinuousMetronome()
    this.currentBeatDurationMs = beatDurationMs
    this.currentBeatsPerMeasure = beatsPerMeasure
    this.isMetroRunning = true
    this.clockStartTime = Date.now()

    let currentBeat = 0
    // Clic 1 inicial (Tiempo 1 fuerte)
    playNoteFn(76, 120, 115, 10)
    if (this.onBeatTick) this.onBeatTick(0, true)
    currentBeat = 1

    this.metronomeTimer = setInterval(() => {
      const beatIdx = currentBeat % beatsPerMeasure
      const isDownbeat = beatIdx === 0
      const note = isDownbeat ? 76 : 77
      const velocity = isDownbeat ? 115 : 90
      playNoteFn(note, 120, velocity, 10)
      if (this.onBeatTick) this.onBeatTick(beatIdx, isDownbeat)
      currentBeat++
    }, beatDurationMs)
  }

  /**
   * Programa la frase de piano para que entre exactamente en el tiempo 1 fuerte
   * respetando la cantidad exacta de compases de respiración (1 o 2 compases).
   */
  schedulePhraseOnContinuousGrid(
    pianoEvents: ScheduledNoteEvent[],
    restingMeasures = 1,
    playNoteFn: (note: number, durationMs: number, velocity?: number, channel?: number) => void
  ): void {
    this.cancelSequenceTimers()

    const now = Date.now()
    const measureDurationMs = this.currentBeatsPerMeasure * this.currentBeatDurationMs
    const elapsedSinceClockStart = now - this.clockStartTime

    // Compás actual en curso
    const currentMeasureIndex = Math.floor(elapsedSinceClockStart / measureDurationMs)

    // El compás objetivo es el compás actual + compases de descanso
    let targetMeasureIndex = currentMeasureIndex + restingMeasures
    let targetMeasureStartMs = targetMeasureIndex * measureDurationMs
    let delayUntilTargetDownbeat = targetMeasureStartMs - elapsedSinceClockStart

    // Si el cálculo da menos de 250ms (estamos cayendo al final del compás), pasa al siguiente compás entero
    if (delayUntilTargetDownbeat < 250) {
      targetMeasureIndex += 1
      targetMeasureStartMs = targetMeasureIndex * measureDurationMs
      delayUntilTargetDownbeat = targetMeasureStartMs - elapsedSinceClockStart
    }

    const alignedEvents: ScheduledNoteEvent[] = pianoEvents.map((evt) => ({
      ...evt,
      delayMs: delayUntilTargetDownbeat + evt.delayMs
    }))

    this.scheduleSequence(alignedEvents, playNoteFn)
  }

  stopContinuousMetronome(): void {
    if (this.metronomeTimer) {
      clearInterval(this.metronomeTimer)
      this.metronomeTimer = null
      this.isMetroRunning = false
    }
  }

  isContinuousMetronomeActive(): boolean {
    return this.isMetroRunning
  }

  cancelSequenceTimers(): void {
    this.activeTimers.forEach((timer) => clearTimeout(timer))
    this.activeTimers.clear()
  }

  cancelAll(): void {
    this.cancelSequenceTimers()
    this.stopContinuousMetronome()
  }

  hasPending(): boolean {
    return this.activeTimers.size > 0
  }
}

export const stimulusScheduler = new StimulusScheduler()
