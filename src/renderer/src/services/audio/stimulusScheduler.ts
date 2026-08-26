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
  private currentIntervalMs = 0

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

  startContinuousMetronome(
    stepUnitMs: number,
    beatsPerMeasure = 2,
    playNoteFn: (note: number, durationMs: number, velocity?: number, channel?: number) => void
  ): void {
    // Si ya está sonando al mismo intervalo, no reinicia para mantener la fase
    if (this.metronomeTimer && this.currentIntervalMs === stepUnitMs) {
      return
    }

    this.stopContinuousMetronome()
    this.currentIntervalMs = stepUnitMs
    let currentBeat = 0

    // Primer clic en tiempo 1
    playNoteFn(76, 120, 115, 10)
    currentBeat = 1

    this.metronomeTimer = setInterval(() => {
      const isFirstBeat = currentBeat % beatsPerMeasure === 0
      const note = isFirstBeat ? 76 : 77
      const velocity = isFirstBeat ? 115 : 90
      playNoteFn(note, 120, velocity, 10)
      currentBeat++
    }, stepUnitMs)
  }

  stopContinuousMetronome(): void {
    if (this.metronomeTimer) {
      clearInterval(this.metronomeTimer)
      this.metronomeTimer = null
      this.currentIntervalMs = 0
    }
  }

  isContinuousMetronomeActive(): boolean {
    return this.metronomeTimer !== null
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
