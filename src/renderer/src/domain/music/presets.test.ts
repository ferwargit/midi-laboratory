import { describe, it, expect } from 'vitest'
import { EXERCISE_PRESETS, resolveNotePresetName } from './presets'

describe('presets - Definiciones de escalas y resolución canónica', () => {
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

  it('resolveNotePresetName debe resolver exactamente el nombre canónico para cada nivel formal', () => {
    // Nivel 1
    expect(resolveNotePresetName([60, 62, 64])).toBe('Nivel 1 (C, D, E)')
    // Nivel 2
    expect(resolveNotePresetName([60, 62, 64, 65, 67])).toBe('Nivel 2 (C a G)')
    // Nivel 3 (Octava Diatónica C4-C5)
    expect(resolveNotePresetName([60, 62, 64, 65, 67, 69, 71, 72])).toBe(
      'Nivel 3 (Octava Diatónica C4-C5)'
    )
    // Nivel 4 (Cromático)
    expect(resolveNotePresetName([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72])).toBe(
      'Nivel 4 (Cromático C4-C5)'
    )
    // Pentatónica
    expect(resolveNotePresetName([60, 62, 64, 67, 69, 72])).toBe('Pentatónica C Mayor')
    // Notas no estándar
    expect(resolveNotePresetName([60, 61, 65, 71])).toBe('Notas Personalizadas (4)')
  })
})
