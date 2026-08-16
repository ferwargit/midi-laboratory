import { describe, it, expect } from 'vitest'
import { midiNoteToName, isBlackKey, generateMidiRange } from './noteUtils'

describe('noteUtils - Utilidades musicales del dominio', () => {
  describe('midiNoteToName', () => {
    it('debe convertir correctamente el Do central (60 -> C4)', () => {
      expect(midiNoteToName(60)).toBe('C4')
    })

    it('debe convertir notas alteradas correctamente (61 -> C#4)', () => {
      expect(midiNoteToName(61)).toBe('C#4')
      expect(midiNoteToName(66)).toBe('F#4')
    })

    it('debe manejar extremos y registros graves/agudos', () => {
      expect(midiNoteToName(21)).toBe('A0') // Nota más grave de un piano de 88 teclas
      expect(midiNoteToName(108)).toBe('C8') // Nota más aguda de un piano de 88 teclas
    })

    it('debe lanzar error ante números MIDI fuera de rango', () => {
      expect(() => midiNoteToName(-1)).toThrow()
      expect(() => midiNoteToName(128)).toThrow()
    })
  })

  describe('isBlackKey', () => {
    it('debe identificar correctamente teclas blancas', () => {
      expect(isBlackKey(60)).toBe(false) // C4
      expect(isBlackKey(62)).toBe(false) // D4
      expect(isBlackKey(64)).toBe(false) // E4
      expect(isBlackKey(65)).toBe(false) // F4
    })

    it('debe identificar correctamente teclas negras', () => {
      expect(isBlackKey(61)).toBe(true) // C#4
      expect(isBlackKey(63)).toBe(true) // D#4
      expect(isBlackKey(66)).toBe(true) // F#4
      expect(isBlackKey(68)).toBe(true) // G#4
      expect(isBlackKey(70)).toBe(true) // A#4
    })
  })

  describe('generateMidiRange', () => {
    it('debe generar el rango correcto de notas inclusivo', () => {
      const range = generateMidiRange(60, 64)
      expect(range).toEqual([60, 61, 62, 63, 64])
    })
  })
})
