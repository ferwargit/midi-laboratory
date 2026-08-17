export type IntervalDirection = 'ascending' | 'descending' | 'harmonic'
export type DirectionSelection = 'ascending' | 'descending' | 'both'

export interface IntervalDefinition {
  semitones: number
  shortName: string
  fullName: string
  anchorSong: string
  inversionName: string
}

export const INTERVAL_DEFINITIONS: Record<number, IntervalDefinition> = {
  0: {
    semitones: 0,
    shortName: '1P',
    fullName: 'Unísono Perfecto',
    anchorSong: 'Misma nota',
    inversionName: '8J'
  },
  1: {
    semitones: 1,
    shortName: '2m',
    fullName: 'Segunda Menor',
    anchorSong: 'Tiburón (Jaws) / Para Elisa',
    inversionName: '7M'
  },
  2: {
    semitones: 2,
    shortName: '2M',
    fullName: 'Segunda Mayor',
    anchorSong: 'Cumpleaños Feliz / Noche de Paz',
    inversionName: '7m'
  },
  3: {
    semitones: 3,
    shortName: '3m',
    fullName: 'Tercera Menor',
    anchorSong: 'Greensleeves / Smoke on the Water',
    inversionName: '6M'
  },
  4: {
    semitones: 4,
    shortName: '3M',
    fullName: 'Tercera Mayor',
    anchorSong: 'Himno a la Alegría / Primavera (Vivaldi)',
    inversionName: '6m'
  },
  5: {
    semitones: 5,
    shortName: '4J',
    fullName: 'Cuarta Justa',
    anchorSong: 'Marcha Nupcial / Himno Nacional',
    inversionName: '5J'
  },
  6: {
    semitones: 6,
    shortName: 'TT',
    fullName: 'Tritono (4ª aum / 5ª dim)',
    anchorSong: 'Los Simpsons / María (West Side Story)',
    inversionName: 'TT'
  },
  7: {
    semitones: 7,
    shortName: '5J',
    fullName: 'Quinta Justa',
    anchorSong: 'Star Wars / Estrellita Dónde Estás',
    inversionName: '4J'
  },
  8: {
    semitones: 8,
    shortName: '6m',
    fullName: 'Sexta Menor',
    anchorSong: 'The Entertainer (intro) / Love Story',
    inversionName: '3M'
  },
  9: {
    semitones: 9,
    shortName: '6M',
    fullName: 'Sexta Mayor',
    anchorSong: 'My Way (A Mi Manera) / Jingle Bells',
    inversionName: '3m'
  },
  10: {
    semitones: 10,
    shortName: '7m',
    fullName: 'Séptima Menor',
    anchorSong: 'The Winner Takes It All / Somewhere',
    inversionName: '2M'
  },
  11: {
    semitones: 11,
    shortName: '7M',
    fullName: 'Séptima Mayor',
    anchorSong: 'Take On Me (A-ha) / Superman Theme',
    inversionName: '2m'
  },
  12: {
    semitones: 12,
    shortName: '8J',
    fullName: 'Octava Justa',
    anchorSong: 'Somewhere Over the Rainbow',
    inversionName: '1P'
  }
}

export interface IntervalPreset {
  id: string
  name: string
  description: string
  intervalSemitones: number[]
  defaultDirection: DirectionSelection
  fixedRootNote: number | null
}

export const INTERVAL_PRESETS: IntervalPreset[] = [
  {
    id: 'level_1_0_contrast',
    name: 'Nivel 1.0: Contraste Extremo (2m vs 8J)',
    description: 'Aprender el procedimiento con la máxima distancia perceptual.',
    intervalSemitones: [1, 12],
    defaultDirection: 'ascending',
    fixedRootNote: 60
  },
  {
    id: 'level_1_1_reference',
    name: 'Nivel 1.1: Intervalos Clásicos (2M, 3M, 4J, 5J, 8J)',
    description: 'Intervalos consonantes de anclaje con base fija (C4).',
    intervalSemitones: [2, 4, 5, 7, 12],
    defaultDirection: 'ascending',
    fixedRootNote: 60
  },
  {
    id: 'level_1_2_bidirectional',
    name: 'Nivel 1.2: Clásicos Bidireccionales (Asc/Desc)',
    description: 'Mismos intervalos clásicos pero mezclando direcciones al azar.',
    intervalSemitones: [2, 4, 5, 7, 12],
    defaultDirection: 'both',
    fixedRootNote: 60
  },
  {
    id: 'level_1_3_full_chromatic',
    name: 'Nivel 1.3: Todos los 12 Intervalos (Cromático)',
    description: 'Segundas, terceras, cuartas, tritono, quintas, sextas, séptimas y octava.',
    intervalSemitones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultDirection: 'ascending',
    fixedRootNote: 60
  },
  {
    id: 'level_1_4_random_root',
    name: 'Nivel 1.4: Oído Relativo Puro (Base Libre C3-C5)',
    description: 'Todos los intervalos con nota raíz aleatoria en registro medio.',
    intervalSemitones: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultDirection: 'both',
    fixedRootNote: null
  }
]

export function getIntervalDefinition(semitones: number): IntervalDefinition {
  const normalized = Math.abs(semitones) % 13
  return INTERVAL_DEFINITIONS[normalized] || INTERVAL_DEFINITIONS[0]
}

/**
 * Calcula el intervalo en semitonos y dirección dadas dos notas MIDI.
 */
export function calculateIntervalFromNotes(
  rootNote: number,
  targetNote: number
): { semitones: number; direction: IntervalDirection } {
  const diff = targetNote - rootNote
  if (diff === 0) {
    return { semitones: 0, direction: 'harmonic' }
  }
  return {
    semitones: Math.abs(diff),
    direction: diff > 0 ? 'ascending' : 'descending'
  }
}
