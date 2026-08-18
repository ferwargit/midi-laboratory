export type ContourDirection = 'up' | 'down' | 'same'

export interface SequencePreset {
  id: string
  name: string
  description: string
  length: number // Cantidad de notas (3, 4, 5)
  candidateNotes: number[] // Pool de notas posibles
  maxJumpSemitones: number // Salto máximo permitido entre notas consecutivas (2 = grado conjunto, 4 = terceras, 12 = libre)
  allowRepeatedConsecutive: boolean
}

export const SEQUENCE_PRESETS: SequencePreset[] = [
  {
    id: 'level_2_0_diatonic_stepwise',
    name: 'Nivel 2.0: 3 Notas por Grados Conjuntos',
    description: 'Secuencias de 3 notas diatónicas consecutivas (segundas) en Do Mayor.',
    length: 3,
    candidateNotes: [60, 62, 64, 65, 67], // C4 a G4
    maxJumpSemitones: 2,
    allowRepeatedConsecutive: false
  },
  {
    id: 'level_2_1_three_notes_jumps',
    name: 'Nivel 2.1: 3 Notas con Saltos Simples',
    description: 'Secuencias de 3 notas con saltos de 3ra o 4ta (contorno mixto).',
    length: 3,
    candidateNotes: [60, 62, 64, 65, 67, 69, 72], // C4 a C5
    maxJumpSemitones: 5,
    allowRepeatedConsecutive: false
  },
  {
    id: 'level_2_2_four_notes_melody',
    name: 'Nivel 2.2: 4 Notas Melódicas',
    description: 'Motivos de 4 notas combinando grados conjuntos y saltos diatónicos.',
    length: 4,
    candidateNotes: [60, 62, 64, 65, 67, 69, 71, 72], // Octava C4-C5
    maxJumpSemitones: 7,
    allowRepeatedConsecutive: true
  },
  {
    id: 'level_2_3_five_notes_arpeggios',
    name: 'Nivel 2.3: 5 Notas (Arpegios y Frases)',
    description: 'Frases melódicas completas de 5 notas en registro extendido.',
    length: 5,
    candidateNotes: [55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72], // G3 a C5
    maxJumpSemitones: 8,
    allowRepeatedConsecutive: true
  },
  {
    id: 'level_2_4_chromatic_free',
    name: 'Nivel 2.4: Frases Cromáticas Libres (4 Notas)',
    description: 'Secuencias con notas alteradas (blancas y negras) fuera de escala.',
    length: 4,
    candidateNotes: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72],
    maxJumpSemitones: 12,
    allowRepeatedConsecutive: true
  }
]

/**
 * Calcula el contorno melódico de una secuencia (ej: [60, 64, 62] -> ['up', 'down']).
 */
export function calculateMelodicContour(notes: number[]): ContourDirection[] {
  if (notes.length < 2) return []
  const contour: ContourDirection[] = []
  for (let i = 0; i < notes.length - 1; i++) {
    const diff = notes[i + 1] - notes[i]
    if (diff > 0) contour.push('up')
    else if (diff < 0) contour.push('down')
    else contour.push('same')
  }
  return contour
}

/**
 * Genera una secuencia melódica válida según los parámetros del preset o configuración libre.
 */
export function generateMelodicSequence(
  candidateNotes: number[],
  length: number,
  maxJumpSemitones = 12,
  allowRepeatedConsecutive = true
): number[] {
  if (candidateNotes.length === 0) throw new Error('No hay notas candidatas.')
  if (candidateNotes.length === 1) return Array(length).fill(candidateNotes[0])

  const sequence: number[] = []

  // Primera nota aleatoria del pool
  let currentNote = candidateNotes[Math.floor(Math.random() * candidateNotes.length)]
  sequence.push(currentNote)

  for (let i = 1; i < length; i++) {
    const validCandidates = candidateNotes.filter((note) => {
      if (!allowRepeatedConsecutive && note === currentNote) return false
      const jump = Math.abs(note - currentNote)
      return jump <= maxJumpSemitones
    })

    const pool = validCandidates.length > 0 ? validCandidates : candidateNotes
    currentNote = pool[Math.floor(Math.random() * pool.length)]
    sequence.push(currentNote)
  }

  return sequence
}
