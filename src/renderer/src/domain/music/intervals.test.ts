import { describe, it, expect } from 'vitest'
import { INTERVAL_DEFINITIONS, INTERVAL_PRESETS, getIntervalDefinition } from './intervals'

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
