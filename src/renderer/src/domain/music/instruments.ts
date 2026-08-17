export interface InstrumentProfile {
  id: string
  name: string
  category: 'Keyboards' | 'Winds' | 'Strings' | 'Bass' | 'Brass'
  programNumber: number // 0 a 127 (MIDI Program Change)
  minOptimalNote: number // Nota MIDI mínima recomendada para buen timbre
  maxOptimalNote: number // Nota MIDI máxima recomendada
  description: string
}

export const INSTRUMENT_CATALOG: InstrumentProfile[] = [
  {
    id: 'acoustic_grand_piano',
    name: '🎹 Piano Acústico',
    category: 'Keyboards',
    programNumber: 0, // GM 1: Acoustic Grand Piano
    minOptimalNote: 48, // C3
    maxOptimalNote: 84, // C6
    description: 'Timbre estándar con ataque percusivo claro.'
  },
  {
    id: 'flute',
    name: '🪈 Flauta Dulce / Traversa',
    category: 'Winds',
    programNumber: 73, // GM 74: Flute
    minOptimalNote: 60, // C4
    maxOptimalNote: 84, // C6
    description: 'Timbre de viento con sostenimiento largo y pocos armónicos.'
  },
  {
    id: 'violin',
    name: '🎻 Violín (Cuerdas)',
    category: 'Strings',
    programNumber: 40, // GM 41: Violin
    minOptimalNote: 55, // G3
    maxOptimalNote: 84, // C6
    description: 'Ataque frotado continuo y armónicos agudos.'
  },
  {
    id: 'clarinet',
    name: '🎷 Clarinete',
    category: 'Winds',
    programNumber: 71, // GM 72: Clarinet
    minOptimalNote: 50, // D3
    maxOptimalNote: 79, // G5
    description: 'Rico en armónicos impares y sonido redondo.'
  },
  {
    id: 'acoustic_bass',
    name: '🎸 Bajo Acústico',
    category: 'Bass',
    programNumber: 32, // GM 33: Acoustic Bass
    minOptimalNote: 36, // C2
    maxOptimalNote: 60, // C4
    description: 'Entrenamiento de frecuencias fundamentales graves.'
  }
]

export function getInstrumentById(id: string): InstrumentProfile {
  const found = INSTRUMENT_CATALOG.find((inst) => inst.id === id)
  return found || INSTRUMENT_CATALOG[0]
}
