export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export type NoteName = (typeof NOTE_NAMES)[number]

/**
 * Convierte un número de nota MIDI estándar (0-127) a su nombre científico (ej: 60 -> C4).
 */
export function midiNoteToName(midiNumber: number): string {
  if (midiNumber < 0 || midiNumber > 127 || !Number.isInteger(midiNumber)) {
    throw new Error(`Número de nota MIDI inválido: ${midiNumber}. Debe estar entre 0 y 127.`)
  }
  const octave = Math.floor(midiNumber / 12) - 1
  const noteIndex = midiNumber % 12
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

/**
 * Determina si una nota MIDI corresponde a una tecla negra en el piano (alteración).
 */
export function isBlackKey(midiNumber: number): boolean {
  const noteIndex = midiNumber % 12
  return [1, 3, 6, 8, 10].includes(noteIndex) // C#, D#, F#, G#, A#
}

/**
 * Genera un rango secuencial de notas MIDI entre dos extremos inclusivos.
 */
export function generateMidiRange(fromNote: number, toNote: number): number[] {
  if (fromNote > toNote) {
    throw new Error('fromNote debe ser menor o igual a toNote')
  }
  const range: number[] = []
  for (let i = fromNote; i <= toNote; i++) {
    range.push(i)
  }
  return range
}
