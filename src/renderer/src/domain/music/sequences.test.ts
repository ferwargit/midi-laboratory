import { describe, it, expect } from 'vitest'
import { SEQUENCE_PRESETS, calculateMelodicContour, generateMelodicSequence } from './sequences'

describe('sequences - Dominio Musical de Secuencias', () => {
  it('calculateMelodicContour debe calcular correctamente el contorno', () => {
    // C4 (60) -> E4 (64) -> D4 (62) -> D4 (62)
    const contour = calculateMelodicContour([60, 64, 62, 62])
    expect(contour).toEqual(['up', 'down', 'same'])
  })

  it('generateMelodicSequence debe generar la cantidad exacta de notas solicitadas', () => {
    const notes = [60, 62, 64, 65, 67]
    const seq = generateMelodicSequence(notes, 4, 2, false)

    expect(seq.length).toBe(4)
    seq.forEach((n) => expect(notes).toContain(n))
  })

  it('generateMelodicSequence debe respetar la restricción de saltos máximos', () => {
    const notes = [60, 62, 64, 65, 67]
    for (let i = 0; i < 10; i++) {
      const seq = generateMelodicSequence(notes, 3, 2, false)
      for (let j = 0; j < seq.length - 1; j++) {
        expect(Math.abs(seq[j + 1] - seq[j])).toBeLessThanOrEqual(2)
      }
    }
  })

  it('todos los presets deben tener candidatos válidos y longitudes de 3 a 5 notas', () => {
    SEQUENCE_PRESETS.forEach((preset) => {
      expect(preset.length).toBeGreaterThanOrEqual(3)
      expect(preset.length).toBeLessThanOrEqual(5)
      expect(preset.candidateNotes.length).toBeGreaterThanOrEqual(3)
    })
  })
})
