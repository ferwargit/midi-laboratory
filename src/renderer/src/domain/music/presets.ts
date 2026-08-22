import { generateMidiRange } from './noteUtils'

export interface MusicPreset {
  id: string
  name: string
  description: string
  notes: number[]
}

export const EXERCISE_PRESETS: MusicPreset[] = [
  {
    id: 'level_1_c_d_e',
    name: 'Nivel 1 (C, D, E)',
    description: '3 notas naturales básicas en registro central',
    notes: [60, 62, 64]
  },
  {
    id: 'level_2_c_to_g',
    name: 'Nivel 2 (C a G)',
    description: '5 notas naturales consecutivas (Do a Sol)',
    notes: [60, 62, 64, 65, 67]
  },
  {
    id: 'level_3_octave_diatonic',
    name: 'Nivel 3 (Octava Diatónica C4-C5)',
    description: 'Octava completa de notas naturales',
    notes: [60, 62, 64, 65, 67, 69, 71, 72]
  },
  {
    id: 'level_4_octave_chromatic',
    name: 'Nivel 4 (Cromático C4-C5)',
    description: 'Todas las 12 notas (blancas y negras) de la 4ta octava',
    notes: generateMidiRange(60, 72)
  },
  {
    id: 'pentatonic_c_major',
    name: 'Pentatónica C Mayor',
    description: 'C4, D4, E4, G4, A4, C5',
    notes: [60, 62, 64, 67, 69, 72]
  },
  {
    id: 'range_g4_g5',
    name: 'Rango G4 a G5',
    description: 'Rango extendido de Sol4 a Sol5',
    notes: generateMidiRange(67, 79)
  }
]

/**
 * Resuelve automáticamente el nombre canónico de un pool de notas comparándolo con los presets formales.
 */
export function resolveNotePresetName(notes: number[]): string {
  if (!Array.isArray(notes) || notes.length === 0) {
    return 'Notas Personalizadas (0)'
  }

  const sortedNotes = [...notes].sort((a, b) => a - b)

  for (const preset of EXERCISE_PRESETS) {
    const presetSorted = [...preset.notes].sort((a, b) => a - b)
    if (
      sortedNotes.length === presetSorted.length &&
      sortedNotes.every((val, idx) => val === presetSorted[idx])
    ) {
      return preset.name
    }
  }

  return `Notas Personalizadas (${notes.length})`
}
