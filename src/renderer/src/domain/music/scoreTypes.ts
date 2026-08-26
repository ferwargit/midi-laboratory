export type HandSelection = 'RH' | 'LH' | 'both'

export interface HarmonicContextTag {
  chordSymbol: string // Ej: "C", "G/B", "Am7"
  rootStep: string // "C", "G", "A"
  rootAlter?: number // 1 (sostenido), -1 (bemol)
  kind: string // "major", "minor", "dominant", etc.
  bassStep?: string // "B" en caso de inversiones
  bassAlter?: number
  measureNumber: number
  beatPosition: number // Posición métrica en el compás (1.0, 1.5, 2.0, etc.)
}

export interface ScoreNoteDetail {
  pitch: number // Nota MIDI estándar (ej: 60 = C4, 48 = C3)
  step: string // "C", "D", "E", "F", "G", "A", "B"
  alter: number // -1 (bemol), 0 (natural), 1 (sostenido)
  octave: number // 2, 3, 4, 5, 6
  fingering?: number // 1 a 5 (digitación sugerida)
}

export interface ScorePlaybackEvent {
  id: string // UUID único
  measureNumber: number // Número de compás (1-indexado)
  beatPosition: number // Posición métrica (1.0, 1.5, 2.0, etc.)
  notes: ScoreNoteDetail[] // Array de notas (1 = melodía, 2+ = acorde)
  midiNotes: number[] // Array plano de números MIDI (ej: [48, 52] o [67])
  durationDivisions: number // Duración en divisiones del XML
  durationBeats: number // Duración en tiempos de compás (1.0 = negra, 0.5 = corchea)
  durationMs: number // Duración calculada en milisegundos según el BPM
  isChord: boolean // True si contiene 2 o más notas simultáneas
  isRest: boolean // True si es un silencio
  hand: HandSelection // 👈 'RH' | 'LH' | 'both' (permite eventos polifónicos fusionados de ambas manos)
  staff: 1 | 2 // 1: Clave de Sol (MD), 2: Clave de Fa (MI)
  voice: number // 1, 5, etc.
  harmonicTag?: HarmonicContextTag // Cifrado armónico asociado
}

export interface ScoreDataModel {
  title: string
  subtitle?: string
  composer?: string
  timeSignature: {
    beats: number // 2 (en 2/4)
    beatType: number // 4 (en 2/4)
  }
  keySignature: {
    fifths: number // 0 = C Mayor / A menor
    mode: 'major' | 'minor'
  }
  baseBpm: number // Tempo nominal de la partitura (ej: 86)
  divisionsPerQuarter: number // Divisiones por negra (ej: 4)
  totalMeasures: number
  events: ScorePlaybackEvent[] // Lista cronológica de eventos
  harmonicProgression: HarmonicContextTag[] // Lista ordenada de acordes
}
