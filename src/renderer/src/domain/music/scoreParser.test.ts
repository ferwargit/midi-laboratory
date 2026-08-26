import { describe, it, expect } from 'vitest'
import { parseMusicXml, pitchToMidiNote } from './scoreParser'

const MOCK_COMPLEX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Obra Compleja</work-title></work>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>-1</fifths><mode>minor</mode></key>
        <time><beats>3</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><direction-type><metronome><per-minute>110</per-minute></metronome></direction-type></direction>
      <harmony>
        <root><root-step>F</root-step><root-alter>1</root-alter></root>
        <kind>minor</kind>
        <bass><bass-step>B</bass-step><bass-alter>1</bass-alter></bass>
      </harmony>
      <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
      <forward><duration>4</duration></forward>
      <harmony><root><root-step>B</root-step><root-alter>-1</root-alter></root><kind>major-seventh</kind></harmony>
      <note><pitch><step>B</step><alter>-1</alter><octave>3</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
    </measure>
  </part>
</score-partwise>`

describe('scoreParser - Parser de MusicXML para MuseScore Studio 4.x', () => {
  describe('pitchToMidiNote', () => {
    it('debe convertir notas científicas estándar a números MIDI', () => {
      expect(pitchToMidiNote('C', 0, 4)).toBe(60)
      expect(pitchToMidiNote('G', 0, 4)).toBe(67)
      expect(pitchToMidiNote('E', 0, 5)).toBe(76)
      expect(pitchToMidiNote('C', 0, 3)).toBe(48)
      expect(pitchToMidiNote('B', 0, 2)).toBe(47)
      expect(pitchToMidiNote('F', 1, 4)).toBe(66) // F#4
      expect(pitchToMidiNote('B', -1, 3)).toBe(58) // Bb3
    })
  })

  it('debe parsear acordes complejos con alteraciones sostenidas, bemoles, inversiones y forward', () => {
    const model = parseMusicXml(MOCK_COMPLEX_XML)

    expect(model.title).toBe('Obra Compleja')
    expect(model.baseBpm).toBe(110)
    expect(model.keySignature).toEqual({ fifths: -1, mode: 'minor' })
    expect(model.timeSignature).toEqual({ beats: 3, beatType: 4 })

    // Acorde 1: F#m/B#
    expect(model.harmonicProgression[0].chordSymbol).toBe('F#m/B#')
    // Acorde 2: Bbmaj7
    expect(model.harmonicProgression[1].chordSymbol).toBe('Bbmaj7')

    // Avance de cursor temporal con <forward>
    expect(model.events[1].beatPosition).toBe(3.0)
  })

  it('debe lanzar error ante contenido vacío o sintaxis XML corrupta', () => {
    expect(() => parseMusicXml('')).toThrow(/vacío/i)
    expect(() => parseMusicXml('<score-partwise><unclosed>')).toThrow(/sintaxis/i)
  })
})
