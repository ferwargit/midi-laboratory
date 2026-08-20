import { AiExercisePrescription } from './types'

// Mapeo canónico de nombres científicos a números MIDI estándar
const SCIENTIFIC_NOTE_TO_MIDI: Record<string, number> = {
  C3: 48,
  'C#3': 49,
  DB3: 49,
  D3: 50,
  'D#3': 51,
  EB3: 51,
  E3: 52,
  F3: 53,
  'F#3': 54,
  GB3: 54,
  G3: 55,
  'G#3': 56,
  AB3: 56,
  A3: 57,
  'A#3': 58,
  BB3: 58,
  B3: 59,
  C4: 60,
  'C#4': 61,
  DB4: 61,
  D4: 62,
  'D#4': 63,
  EB4: 63,
  E4: 64,
  F4: 65,
  'F#4': 66,
  GB4: 66,
  G4: 67,
  'G#4': 68,
  AB4: 68,
  A4: 69,
  'A#4': 70,
  BB4: 70,
  B4: 71,
  C5: 72,
  'C#5': 73,
  DB5: 73,
  D5: 74,
  'D#5': 75,
  EB5: 75,
  E5: 76,
  F5: 77,
  'F#5': 78,
  GB5: 78,
  G5: 79,
  'G#5': 80,
  AB5: 80,
  A5: 81,
  'A#5': 82,
  BB5: 82,
  B5: 83,
  C6: 84
}

/**
 * Sanitiza, normaliza y corrige inconsistencias lógicas en la prescripción generada por la IA.
 */
export function sanitizePrescription(
  rawPrescription: AiExercisePrescription,
  contextText = ''
): AiExercisePrescription {
  const p = { ...rawPrescription }

  // 1. Limpieza de campos según la modalidad activa
  if (p.targetMode === 'single_note') {
    delete p.recommendedIntervals
    delete p.sequenceLength
  } else if (p.targetMode === 'intervals') {
    delete p.sequenceLength
    if (!p.recommendedIntervals || p.recommendedIntervals.length === 0) {
      p.recommendedIntervals = [2, 4, 5, 7]
    }
  } else if (p.targetMode === 'sequences') {
    delete p.recommendedIntervals
    if (!p.sequenceLength || p.sequenceLength < 3 || p.sequenceLength > 6) {
      p.sequenceLength = 3
    }
  }

  // 2. Corrección de octava basada en menciones textuales en el título y justificación
  const textToScan = `${p.title} ${p.rationale} ${contextText}`.toUpperCase()
  const mentionedMidiNotes = new Set<number>()

  Object.entries(SCIENTIFIC_NOTE_TO_MIDI).forEach(([noteName, midiNumber]) => {
    // Busca la nota como palabra o parte de token (ej: "B4", "E4/F4/B4")
    const regex = new RegExp(
      `\\b${noteName.replace('#', '\\#')}\\b|(?<=[/\\-\\s,])(${noteName.replace('#', '\\#')})(?=[/\\-\\s,]|$)`,
      'i'
    )
    if (regex.test(textToScan)) {
      mentionedMidiNotes.add(midiNumber)
    }
  })

  // Si el texto menciona notas concretas (ej: B4) pero el LLM puso la octava equivocada (ej: B5/83)
  if (mentionedMidiNotes.size > 0 && Array.isArray(p.recommendedNotes)) {
    const correctedNotes = p.recommendedNotes.map((note) => {
      // Si la nota en el array está a una octava (+12 o -12) de una nota explícitamente nombrada en el texto
      for (const targetMidi of mentionedMidiNotes) {
        if (Math.abs(note - targetMidi) === 12) {
          return targetMidi // Corrige B5 (83) -> B4 (71)
        }
      }
      return note
    })
    p.recommendedNotes = Array.from(new Set(correctedNotes)).sort((a, b) => a - b)
  }

  // 3. Asegurar al menos 2 notas para que la sesión sea viable
  if (!Array.isArray(p.recommendedNotes) || p.recommendedNotes.length < 2) {
    p.recommendedNotes = [60, 62, 64]
  }

  return p
}
