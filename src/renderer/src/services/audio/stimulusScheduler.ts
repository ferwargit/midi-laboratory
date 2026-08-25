export interface ScheduledNoteEvent {
  note: number
  durationMs: number
  delayMs: number
  velocity?: number
  channel?: number // 1: Piano/Melodía, 10: Metrónomo/Percusión
}

export class StimulusScheduler {
  private activeTimers: Set<ReturnType<typeof setTimeout>> = new Set()

  scheduleSequence(
    events: ScheduledNoteEvent[],
    playNoteFn: (note: number, durationMs: number, velocity?: number, channel?: number) => void,
    onComplete?: () => void
  ): void {
    this.cancelAll()

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

  cancelAll(): void {
    this.activeTimers.forEach((timer) => clearTimeout(timer))
    this.activeTimers.clear()
  }

  hasPending(): boolean {
    return this.activeTimers.size > 0
  }
}

export const stimulusScheduler = new StimulusScheduler()
