import { describe, it, expect } from 'vitest'
import { EXERCISE_PRESETS } from './presets'

describe('presets - Definiciones de escalas y niveles', () => {
  it('todos los presets deben contener al menos 2 notas para ser viables', () => {
    EXERCISE_PRESETS.forEach((preset) => {
      expect(preset.notes.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('el preset cromático debe contener exactamente 13 notas (incluyendo octava C4-C5)', () => {
    const chromatic = EXERCISE_PRESETS.find((p) => p.id === 'level_4_octave_chromatic')
    expect(chromatic).toBeDefined()
    expect(chromatic?.notes.length).toBe(13)
  })
})
