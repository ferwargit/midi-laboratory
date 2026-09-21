import { describe, it, expect } from 'vitest'
import { DEFAULT_PARTITURA_XML } from './defaultScore'
import { parseMusicXml } from './scoreParser'

describe('defaultScore - Partitura por defecto del repertorio', () => {
  it('expone un string MusicXML no vacío', () => {
    expect(typeof DEFAULT_PARTITURA_XML).toBe('string')
    expect(DEFAULT_PARTITURA_XML.length).toBeGreaterThan(0)
    expect(DEFAULT_PARTITURA_XML.trim().length).toBeGreaterThan(0)
  })

  it('declara el doctype y la versión 4.0 de MusicXML', () => {
    expect(DEFAULT_PARTITURA_XML).toContain('score-partwise')
    expect(DEFAULT_PARTITURA_XML).toContain('version="4.0"')
  })

  describe('parseMusicXml(DEFAULT_PARTITURA_XML)', () => {
    it('produce un modelo íntegro con los metadatos de la obra', () => {
      const model = parseMusicXml(DEFAULT_PARTITURA_XML)

      expect(model.title).toBe('Partitura 1')
      expect(model.composer).toBe('Félix Dumont')
      expect(model.subtitle).toBe('Canto de los cazadores tiroleses')
    })

    it('resuelve el compás 2/4 y la armadura de Do Mayor', () => {
      const model = parseMusicXml(DEFAULT_PARTITURA_XML)

      expect(model.timeSignature.beats).toBe(2)
      expect(model.timeSignature.beatType).toBe(4)
      expect(model.keySignature.fifths).toBe(0)
      expect(model.keySignature.mode).toBe('major')
    })

    it('extrae el tempo nominal de 86 BPM desde <sound tempo>', () => {
      const model = parseMusicXml(DEFAULT_PARTITURA_XML)

      expect(model.baseBpm).toBe(86)
      expect(model.divisionsPerQuarter).toBe(4)
    })

    it('contiene los 8 compases de la partitura', () => {
      const model = parseMusicXml(DEFAULT_PARTITURA_XML)

      expect(model.totalMeasures).toBe(8)
      expect(model.events.every((e) => e.measureNumber >= 1 && e.measureNumber <= 8)).toBe(true)
    })

    it('genera eventos melódicos válidos (no silencios) con duraciones calculadas', () => {
      const model = parseMusicXml(DEFAULT_PARTITURA_XML)
      const melodic = model.events.filter((e) => !e.isRest)

      expect(model.events.length).toBeGreaterThan(0)
      expect(melodic.length).toBeGreaterThan(0)
      melodic.forEach((e) => {
        expect(e.notes.length).toBeGreaterThanOrEqual(1)
        expect(e.midiNotes.length).toBe(e.notes.length)
        expect(e.durationMs).toBeGreaterThan(0)
      })
    })

    it('consolida eventos acorde a partir de <chord/>', () => {
      const model = parseMusicXml(DEFAULT_PARTITURA_XML)
      const chords = model.events.filter((e) => e.isChord)

      expect(chords.length).toBeGreaterThan(0)
      chords.forEach((e) => {
        expect(e.notes.length).toBeGreaterThanOrEqual(2)
        expect(e.isRest).toBe(false)
      })
    })

    it('incluye silencios consolidados como eventos isRest', () => {
      const model = parseMusicXml(DEFAULT_PARTITURA_XML)
      const rests = model.events.filter((e) => e.isRest)

      expect(rests.length).toBeGreaterThan(0)
    })

    it('construye la progresión armónica con cifrados C y G/B', () => {
      const model = parseMusicXml(DEFAULT_PARTITURA_XML)

      expect(model.harmonicProgression.length).toBeGreaterThan(0)
      const symbols = model.harmonicProgression.map((h) => h.chordSymbol)
      expect(symbols).toContain('C')
      expect(symbols).toContain('G/B')
    })

    it('etiqueta eventos melódicos con su contexto armónico', () => {
      const model = parseMusicXml(DEFAULT_PARTITURA_XML)
      const tagged = model.events.filter((e) => e.harmonicTag !== undefined)

      expect(tagged.length).toBeGreaterThan(0)
    })

    it('asigna manos y claves (staff 1 sol / staff 2 fa) de forma coherente', () => {
      const model = parseMusicXml(DEFAULT_PARTITURA_XML)

      const rightHand = model.events.filter((e) => e.staff === 1)
      const leftHand = model.events.filter((e) => e.staff === 2)
      expect(rightHand.length).toBeGreaterThan(0)
      expect(leftHand.length).toBeGreaterThan(0)
      model.events.forEach((e) => {
        expect([1, 2]).toContain(e.staff)
      })
    })
  })
})
