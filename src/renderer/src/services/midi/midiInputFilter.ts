export interface FilteredMidiEvent {
  noteNumber: number
  velocity: number
  timestamp: number
  isDebouncedDuplicate: boolean
}

export class MidiInputFilter {
  private lastNoteTimestamps: Map<number, number> = new Map()
  private debounceWindowMs: number

  constructor(debounceWindowMs = 35) {
    this.debounceWindowMs = debounceWindowMs
  }

  processNoteOn(noteNumber: number, velocity: number, now = Date.now()): FilteredMidiEvent {
    const lastTime = this.lastNoteTimestamps.get(noteNumber) || 0
    const elapsed = now - lastTime

    const isDebouncedDuplicate = elapsed < this.debounceWindowMs

    if (!isDebouncedDuplicate) {
      this.lastNoteTimestamps.set(noteNumber, now)
    }

    return {
      noteNumber,
      velocity,
      timestamp: now,
      isDebouncedDuplicate
    }
  }

  clearHistory(): void {
    this.lastNoteTimestamps.clear()
  }
}
