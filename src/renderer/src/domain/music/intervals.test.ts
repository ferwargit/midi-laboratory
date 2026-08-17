import { describe, it, expect } from 'vitest'
import {
  INTERVAL_DEFINITIONS,
  INTERVAL_PRESETS,
  getIntervalDefinition,
  calculateIntervalFromNotes
} from './intervals'

describe('intervals - Dominio Musical de Intervalos', () => {
  it('debe contener las 13 definiciones de intervalos (0 a 12 semitonos)', () => {
    expect(Object.keys(INTERVAL_DEFINITIONS).length).toBe(13)
    expect(INTERVAL_DEFINITIONS[4].shortName).toBe('3M')
    expect(INTERVAL_DEFINITIONS[7].shortName).toBe('5J')
    expect(INTERVAL_DEFINITIONS[12].shortName).toBe('8J')
  })

  it('getIntervalDefinition debe devolver la definición correcta y canción ancla', () => {
    const fifth = getIntervalDefinition(7)
    expect(fifth.fullName).toBe('Quinta Justa')
    expect(fifth.anchorSong).toContain('Star Wars')
  })

  it('calculateIntervalFromNotes debe calcular correctamente semitonos y dirección', () => {
    // C4 (60) a E4 (64) -> Ascendente 4 semitonos (3M)
    const asc = calculateIntervalFromNotes(60, 64)
    expect(asc.semitones).toBe(4)
    expect(asc.direction).toBe('ascending')

    // C4 (60) a G3 (55) -> Descendente 5 semitonos (4J desc)
    const desc = calculateIntervalFromNotes(60, 55)
    expect(desc.semitones).toBe(5)
    expect(desc.direction).toBe('descending')
  })

  it('todos los presets de intervalos deben tener listas de semitonos válidas', () => {
    INTERVAL_PRESETS.forEach((preset) => {
      expect(preset.intervalSemitones.length).toBeGreaterThanOrEqual(2)
      preset.intervalSemitones.forEach((st) => {
        expect(st).toBeGreaterThanOrEqual(1)
        expect(st).toBeLessThanOrEqual(12)
      })
    })
  })
})
