import { midiNoteToName } from './noteUtils'

export type TonalContextMode = 'none' | 'cadence' | 'tonic' | 'drone'

export interface TonalContextOption {
  id: TonalContextMode
  name: string
  shortLabel: string
  description: string
}

export interface MidiChordStep {
  notes: number[]
  durationMs: number
  delayAfterMs: number
}

export const TONAL_CONTEXT_OPTIONS: TonalContextOption[] = [
  {
    id: 'none',
    name: '🔕 Sin Referencia (Oído Absoluto / Aislado)',
    shortLabel: 'Aislado',
    description: 'El tono suena sin contexto previo para entrenar la altura absoluta pura.'
  },
  {
    id: 'cadence',
    name: '🎹 Cadencia I - IV - V7 - I (Tonalidad Dinámica)',
    shortLabel: 'Cadencia I-IV-V-I',
    description:
      'Progresión armónica transportada a la nota raíz de tu selección para fijar el centro tonal.'
  },
  {
    id: 'tonic',
    name: '🔊 Tónica de Referencia (Nota Raíz)',
    shortLabel: 'Tónica Raíz',
    description: 'Emite la nota tónica fundamental como diapasón antes de comenzar.'
  },
  {
    id: 'drone',
    name: '🎻 Bordón / Drone (Pedal Grave)',
    shortLabel: 'Drone Pedal',
    description: 'Nota pedal grave en la fundamental para entrenar la resonancia armónica.'
  }
]

/**
 * Genera la secuencia armónica I - IV - V7 - I transportada automáticamente a cualquier nota raíz.
 */
export function generateCadenceSteps(rootMidi = 60): MidiChordStep[] {
  // Ajuste para registro medio confortable
  const root = rootMidi < 55 ? rootMidi + 12 : rootMidi > 72 ? rootMidi - 12 : rootMidi

  return [
    // I: Acorde Mayor Fundamental (Tónica, 3ªM, 5ªJ)
    { notes: [root, root + 4, root + 7], durationMs: 350, delayAfterMs: 380 },
    // IV: Subdominante en 2ª Inversión (5ª, Tónica, 3ª)
    { notes: [root - 3, root, root + 5], durationMs: 350, delayAfterMs: 380 },
    // V7: Dominante con 7ma (Sensible, 2ª, 4ª, 5ª)
    { notes: [root - 1, root + 2, root + 5, root + 7], durationMs: 400, delayAfterMs: 430 },
    // I: Resolución en Tónica Fundamental
    { notes: [root, root + 4, root + 7], durationMs: 600, delayAfterMs: 650 }
  ]
}

export function generateTonicStep(rootMidi = 60): MidiChordStep[] {
  return [{ notes: [rootMidi], durationMs: 800, delayAfterMs: 850 }]
}

export function generateDroneStep(rootMidi = 60): MidiChordStep[] {
  const lowRoot = rootMidi >= 60 ? rootMidi - 12 : rootMidi
  return [{ notes: [lowRoot], durationMs: 1200, delayAfterMs: 1250 }]
}

export function getTonalContextSteps(mode: TonalContextMode, rootMidi = 60): MidiChordStep[] {
  switch (mode) {
    case 'cadence':
      return generateCadenceSteps(rootMidi)
    case 'tonic':
      return generateTonicStep(rootMidi)
    case 'drone':
      return generateDroneStep(rootMidi)
    case 'none':
    default:
      return []
  }
}

export function getTotalContextDurationMs(mode: TonalContextMode, rootMidi = 60): number {
  const steps = getTonalContextSteps(mode, rootMidi)
  return steps.reduce((acc, step) => acc + step.delayAfterMs, 0)
}

export function getTonalContextDescription(mode: TonalContextMode, rootMidi = 60): string {
  if (mode === 'none') return 'Aislado'
  const rootName = midiNoteToName(rootMidi)
  if (mode === 'cadence') return `Cadencia en ${rootName} Mayor`
  if (mode === 'tonic') return `Tónica ${rootName}`
  if (mode === 'drone') return `Drone en ${rootName}`
  return 'Aislado'
}
