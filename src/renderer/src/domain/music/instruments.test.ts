import { describe, it, expect } from 'vitest'
import { INSTRUMENT_CATALOG, getInstrumentById } from './instruments'

describe('instruments - Catálogo de Timbres General MIDI', () => {
  it('todos los instrumentos deben tener números de Program Change válidos (0 a 127)', () => {
    INSTRUMENT_CATALOG.forEach((inst) => {
      expect(inst.programNumber).toBeGreaterThanOrEqual(0)
      expect(inst.programNumber).toBeLessThanOrEqual(127)
      expect(inst.minOptimalNote).toBeLessThan(inst.maxOptimalNote)
    })
  })

  it('debe devolver el piano por defecto si el id no existe', () => {
    const fallback = getInstrumentById('inexistente')
    expect(fallback.id).toBe('acoustic_grand_piano')
  })
})
