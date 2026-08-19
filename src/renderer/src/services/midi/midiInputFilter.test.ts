import { describe, it, expect } from 'vitest'
import { MidiInputFilter } from './midiInputFilter'

describe('s1-midi-state-machine - Filtro Anti-Rebote y Arpegios', () => {
  it('debe ignorar eventos duplicados que ocurran dentro de la ventana de debounce (duplicate note-on ignored)', () => {
    const filter = new MidiInputFilter(40) // 40 ms
    const baseTime = 1000

    const first = filter.processNoteOn(60, 90, baseTime)
    expect(first.isDebouncedDuplicate).toBe(false)

    // Evento mecánico espurio a los 15 ms
    const duplicate = filter.processNoteOn(60, 90, baseTime + 15)
    expect(duplicate.isDebouncedDuplicate).toBe(true)

    // Evento válido a los 50 ms
    const valid = filter.processNoteOn(60, 90, baseTime + 50)
    expect(valid.isDebouncedDuplicate).toBe(false)
  })

  it('debe procesar arpegios rápidos de notas distintas sin descartarlas (rapid arpeggio safe)', () => {
    const filter = new MidiInputFilter(40)
    const baseTime = 1000

    // Arpegio ultra-rápido: C4 (60) a los 0ms, E4 (64) a los 10ms, G4 (67) a los 20ms
    const note1 = filter.processNoteOn(60, 90, baseTime)
    const note2 = filter.processNoteOn(64, 90, baseTime + 10)
    const note3 = filter.processNoteOn(67, 90, baseTime + 20)

    expect(note1.isDebouncedDuplicate).toBe(false)
    expect(note2.isDebouncedDuplicate).toBe(false)
    expect(note3.isDebouncedDuplicate).toBe(false)
  })

  it('clearHistory debe limpiar el historial y permitir notas inmediatas', () => {
    const filter = new MidiInputFilter(40)
    const baseTime = 1000

    filter.processNoteOn(60, 90, baseTime)
    filter.clearHistory()

    const immediate = filter.processNoteOn(60, 90, baseTime + 5)
    expect(immediate.isDebouncedDuplicate).toBe(false)
  })
})
