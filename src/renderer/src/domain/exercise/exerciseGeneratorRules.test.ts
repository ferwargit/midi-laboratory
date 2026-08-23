import { describe, it, expect } from 'vitest'
import {
  generateValidSingleNote,
  generateValidInterval,
  generateValidSequence,
  shouldPromoteLevel,
  DEFAULT_PIANO_BOUNDS
} from './exerciseGeneratorRules'

describe('exerciseGeneratorRules - Reglas Pedagógicas de Generación de Ejercicios', () => {
  it('generateValidSingleNote maneja pools de 1 nota, anti-repetición y lanza error si está vacío', () => {
    // 1. Error con pool vacío
    expect(() => generateValidSingleNote([], null)).toThrow(/no puede estar vacío/i)

    // 2. Pool de 1 sola nota
    expect(generateValidSingleNote([60], null)).toBe(60)

    // 3. Pool >= 3 no repite la última nota
    const pool = [60, 62, 64]
    for (let i = 0; i < 20; i++) {
      expect(generateValidSingleNote(pool, 60)).not.toBe(60)
    }
  })

  it('generateValidInterval valida desbordes superior e inferior y lanza error ante parámetros vacíos', () => {
    // 1. Error ante parámetros vacíos
    expect(() => generateValidInterval([], [60], 'ascending')).toThrow(/insuficientes/i)
    expect(() => generateValidInterval([4], [], 'ascending')).toThrow(/insuficientes/i)

    // 2. Desborde Superior (Root 84 + 12st -> debe auto-corregir a descendente target 72)
    const highInterval = generateValidInterval([12], [84], 'ascending', null, DEFAULT_PIANO_BOUNDS)
    expect(highInterval.targetNote).toBe(72)
    expect(highInterval.direction).toBe('descending')

    // 3. Desborde Inferior (Root 48 - 12st en descendente -> debe auto-corregir a ascendente target 60)
    const lowInterval = generateValidInterval([12], [48], 'descending', null, DEFAULT_PIANO_BOUNDS)
    expect(lowInterval.targetNote).toBe(60)
    expect(lowInterval.direction).toBe('ascending')

    // 4. Modo de dirección 'both' y anti-repetición
    const bothInterval = generateValidInterval([2, 4, 7], [60], 'both', 2, DEFAULT_PIANO_BOUNDS)
    expect(bothInterval.targetNote).toBeDefined()
  })

  it('generateValidSequence acota longitudes entre 3 y 6 notas', () => {
    const candidateNotes = [60, 62, 64, 65, 67]

    // Clamping mínimo (2 -> 3)
    const seqMin = generateValidSequence(candidateNotes, 1)
    expect(seqMin.length).toBe(3)

    // Clamping máximo (10 -> 6)
    const seqMax = generateValidSequence(candidateNotes, 10)
    expect(seqMax.length).toBe(6)
  })

  it('shouldPromoteLevel determina si promueve de nivel por maestría consecutiva (>=85%)', () => {
    expect(shouldPromoteLevel([70, 90, 85, 100], 85, 3)).toBe(true)
    expect(shouldPromoteLevel([90, 60, 100], 85, 3)).toBe(false)
    expect(shouldPromoteLevel([100, 100], 85, 3)).toBe(false) // Insuficientes rondas
  })
})
