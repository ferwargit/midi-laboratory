import { IntervalDirection, DirectionSelection } from '../music/intervals'
import { generateMelodicSequence } from '../music/sequences'

export interface BoundedInterval {
  rootNote: number
  targetNote: number
  semitones: number
  direction: IntervalDirection
}

export interface GeneratorBounds {
  minMidiNote: number
  maxMidiNote: number
}

export const DEFAULT_PIANO_BOUNDS: GeneratorBounds = {
  minMidiNote: 48, // C3
  maxMidiNote: 84 // C6
}

/**
 * 1. Regla: Seleccionar siguiente nota respetando anti-repetición si el pool lo permite.
 */
export function generateValidSingleNote(activeNotes: number[], lastNote: number | null): number {
  if (!Array.isArray(activeNotes) || activeNotes.length === 0) {
    throw new Error('El pool de notas activas no puede estar vacío.')
  }
  if (activeNotes.length === 1) return activeNotes[0]

  const candidates =
    activeNotes.length >= 3 && lastNote !== null
      ? activeNotes.filter((n) => n !== lastNote)
      : activeNotes

  return candidates[Math.floor(Math.random() * candidates.length)]
}

/**
 * 2. Regla: Generar intervalo que garantice que ninguna nota se salga de los límites físicos.
 */
export function generateValidInterval(
  allowedSemitones: number[],
  rootCandidates: number[],
  directionMode: DirectionSelection,
  lastIntervalSemitones: number | null = null,
  bounds: GeneratorBounds = DEFAULT_PIANO_BOUNDS
): BoundedInterval {
  if (allowedSemitones.length === 0 || rootCandidates.length === 0) {
    throw new Error('Parámetros de intervalo insuficientes.')
  }

  // Filtrar semitono previo si hay suficientes opciones (anti-repetición)
  const candidateSemitones =
    allowedSemitones.length >= 3 && lastIntervalSemitones !== null
      ? allowedSemitones.filter((st) => st !== lastIntervalSemitones)
      : allowedSemitones

  const chosenSemitones = candidateSemitones[Math.floor(Math.random() * candidateSemitones.length)]

  // Seleccionar raíz aleatoria de las candidatas
  const rootNote = rootCandidates[Math.floor(Math.random() * rootCandidates.length)]

  let direction: IntervalDirection = 'ascending'
  if (directionMode === 'both') {
    direction = Math.random() > 0.5 ? 'ascending' : 'descending'
  } else {
    direction = directionMode
  }

  // Comprobar desborde de rango físico y autocorregir dirección si es necesario
  let targetNote =
    direction === 'ascending' ? rootNote + chosenSemitones : rootNote - chosenSemitones

  if (targetNote > bounds.maxMidiNote) {
    direction = 'descending'
    targetNote = rootNote - chosenSemitones
  } else if (targetNote < bounds.minMidiNote) {
    direction = 'ascending'
    targetNote = rootNote + chosenSemitones
  }

  // Si aun así se saliera, clamp seguro a los límites
  targetNote = Math.min(bounds.maxMidiNote, Math.max(bounds.minMidiNote, targetNote))

  return {
    rootNote,
    targetNote,
    semitones: chosenSemitones,
    direction
  }
}

/**
 * 3. Regla: Generar secuencia melódica respetando longitud exacta y límites.
 */
export function generateValidSequence(
  candidateNotes: number[],
  length: number,
  maxJumpSemitones = 12,
  allowRepeatedConsecutive = true
): number[] {
  const boundedLength = Math.min(6, Math.max(3, length))
  return generateMelodicSequence(
    candidateNotes,
    boundedLength,
    maxJumpSemitones,
    allowRepeatedConsecutive
  )
}

/**
 * 4. Regla: Determina si el alumno debe ser promovido al siguiente nivel por maestría.
 */
export function shouldPromoteLevel(
  recentAccuracyList: number[],
  masteryThreshold = 85,
  minConsecutiveRounds = 3
): boolean {
  if (recentAccuracyList.length < minConsecutiveRounds) return false
  const recentSlice = recentAccuracyList.slice(-minConsecutiveRounds)
  return recentSlice.every((acc) => acc >= masteryThreshold)
}
