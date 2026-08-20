import { describe, it, expect } from 'vitest'
import {
  generateValidSingleNote,
  generateValidInterval,
  generateValidSequence,
  shouldPromoteLevel,
  DEFAULT_PIANO_BOUNDS
} from './exerciseGeneratorRules'

describe('exerciseGeneratorRules - Reglas Pedagógicas de Generación de Ejercicios', () => {
  it('no repeat same note consecutively: no repite la misma nota de forma consecutiva cuando el pool >= 3', () => {
    const pool = [60, 62, 64] // C4, D4, E4
    const lastNote = 60 // C4 fue la última

    for (let i = 0; i < 30; i++) {
      const nextNote = generateValidSingleNote(pool, lastNote)
      expect(nextNote).not.toBe(60)
      expect(pool).toContain(nextNote)
    }
  })

  it('respect sequence maximum length by level: la secuencia respeta la longitud exacta entre 3 y 6 notas', () => {
    const candidateNotes = [60, 62, 64, 65, 67]

    const seq3 = generateValidSequence(candidateNotes, 3)
    expect(seq3.length).toBe(3)

    const seq5 = generateValidSequence(candidateNotes, 5)
    expect(seq5.length).toBe(5)

    const seqClamped = generateValidSequence(candidateNotes, 10)
    expect(seqClamped.length).toBe(6)
  })

  it('out-of-range interval never generated: un intervalo nunca genera notas fuera de los límites físicos', () => {
    const highRoot = [84] // C6 (límite superior)
    const semitones = [12] // Octava

    const interval = generateValidInterval(
      semitones,
      highRoot,
      'ascending',
      null,
      DEFAULT_PIANO_BOUNDS
    )

    expect(interval.targetNote).toBeLessThanOrEqual(DEFAULT_PIANO_BOUNDS.maxMidiNote)
    expect(interval.targetNote).toBeGreaterThanOrEqual(DEFAULT_PIANO_BOUNDS.minMidiNote)
    expect(interval.direction).toBe('descending')
    expect(interval.targetNote).toBe(72) // C5
  })

  it('progression increases difficulty with mastery: promueve de nivel si mantiene maestría consecutiva (>=85%)', () => {
    expect(shouldPromoteLevel([70, 90, 85, 100], 85, 3)).toBe(true)
    expect(shouldPromoteLevel([90, 60, 100], 85, 3)).toBe(false)
  })
})
