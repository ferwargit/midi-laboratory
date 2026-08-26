import { describe, it, expect } from 'vitest'
import { parseMusicXml, pitchToMidiNote } from './scoreParser'

const MOCK_PARTITURA_1_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>Partitura 1</work-title>
  </work>
  <credit page="1">
    <credit-type>title</credit-type>
    <credit-words default-x="600.17" default-y="1611.01" justify="center" valign="top" font-size="22">Partitura 1</credit-words>
  </credit>
  <credit page="1">
    <credit-type>composer</credit-type>
    <credit-words default-x="1114.62" default-y="1511.01" justify="right" valign="bottom">Félix Dumont</credit-words>
  </credit>
  <credit page="1">
    <credit-type>subtitle</credit-type>
    <credit-words default-x="600.17" default-y="1553.86" justify="center" valign="top" font-size="14">Canto de los cazadores tiroleses</credit-words>
  </credit>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>2</beats>
          <beat-type>4</beat-type>
        </time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <harmony print-frame="no">
        <root><root-step>C</root-step></root>
        <kind>major</kind>
      </harmony>
      <direction placement="above">
        <sound tempo="86"/>
      </direction>
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>2</duration>
        <voice>1</voice>
        <type>eighth</type>
        <staff>1</staff>
        <notations><technical><fingering>1</fingering></technical></notations>
      </note>
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>16th</type>
        <staff>1</staff>
      </note>
      <note>
        <pitch><step>A</step><octave>4</octave></pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>16th</type>
        <staff>1</staff>
        <notations><technical><fingering>2</fingering></technical></notations>
      </note>
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>2</duration>
        <voice>1</voice>
        <type>eighth</type>
        <staff>1</staff>
      </note>
      <note>
        <pitch><step>E</step><octave>5</octave></pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>16th</type>
        <staff>1</staff>
        <notations><technical><fingering>5</fingering></technical></notations>
      </note>
      <note>
        <pitch><step>D</step><octave>5</octave></pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>16th</type>
        <staff>1</staff>
      </note>
      <backup>
        <duration>8</duration>
      </backup>
      <note>
        <pitch><step>C</step><octave>3</octave></pitch>
        <duration>2</duration>
        <voice>5</voice>
        <staff>2</staff>
        <notations><technical><fingering>5</fingering></technical></notations>
      </note>
      <note>
        <pitch><step>G</step><octave>3</octave></pitch>
        <duration>2</duration>
        <voice>5</voice>
        <staff>2</staff>
        <notations><technical><fingering>1</fingering></technical></notations>
      </note>
      <note>
        <pitch><step>E</step><octave>3</octave></pitch>
        <duration>2</duration>
        <voice>5</voice>
        <staff>2</staff>
        <notations><technical><fingering>3</fingering></technical></notations>
      </note>
      <note>
        <pitch><step>G</step><octave>3</octave></pitch>
        <duration>2</duration>
        <voice>5</voice>
        <staff>2</staff>
        <notations><technical><fingering>1</fingering></technical></notations>
      </note>
    </measure>
    <measure number="8">
      <harmony print-frame="no">
        <root><root-step>C</root-step></root>
        <kind>major</kind>
      </harmony>
      <note>
        <pitch><step>C</step><octave>6</octave></pitch>
        <duration>2</duration>
        <voice>1</voice>
        <type>eighth</type>
        <staff>1</staff>
      </note>
      <note>
        <rest/>
        <duration>2</duration>
        <voice>1</voice>
        <type>eighth</type>
        <staff>1</staff>
      </note>
      <backup>
        <duration>8</duration>
      </backup>
      <note>
        <pitch><step>C</step><octave>3</octave></pitch>
        <duration>2</duration>
        <voice>5</voice>
        <type>eighth</type>
        <staff>2</staff>
      </note>
      <note>
        <chord/>
        <pitch><step>E</step><octave>3</octave></pitch>
        <duration>2</duration>
        <voice>5</voice>
        <type>eighth</type>
        <staff>2</staff>
      </note>
    </measure>
  </part>
</score-partwise>`

describe('scoreParser - Parser de MusicXML para MuseScore Studio 4.x', () => {
  describe('pitchToMidiNote', () => {
    it('debe convertir notas científicas estándar a números MIDI', () => {
      expect(pitchToMidiNote('C', 0, 4)).toBe(60) // C4
      expect(pitchToMidiNote('G', 0, 4)).toBe(67) // G4
      expect(pitchToMidiNote('E', 0, 5)).toBe(76) // E5
      expect(pitchToMidiNote('C', 0, 3)).toBe(48) // C3
      expect(pitchToMidiNote('B', 0, 2)).toBe(47) // B2
      expect(pitchToMidiNote('F', 1, 4)).toBe(66) // F#4
      expect(pitchToMidiNote('B', -1, 3)).toBe(58) // Bb3
    })
  })

  describe('parseMusicXml con Partitura 1 (Félix Dumont)', () => {
    it('debe extraer correctamente los metadatos de título, compositor y compás', () => {
      const model = parseMusicXml(MOCK_PARTITURA_1_XML)

      expect(model.title).toBe('Partitura 1')
      expect(model.composer).toBe('Félix Dumont')
      expect(model.subtitle).toBe('Canto de los cazadores tiroleses')
      expect(model.timeSignature).toEqual({ beats: 2, beatType: 4 })
      expect(model.baseBpm).toBe(86)
      expect(model.divisionsPerQuarter).toBe(4)
      expect(model.keySignature).toEqual({ fifths: 0, mode: 'major' })
    })

    it('debe sincronizar mano derecha e izquierda con <backup>', () => {
      const model = parseMusicXml(MOCK_PARTITURA_1_XML)
      const m1Events = model.events.filter((e) => e.measureNumber === 1)

      const rhNotes = m1Events.filter((e) => e.hand === 'RH')
      expect(rhNotes.length).toBe(6)
      expect(rhNotes[0].midiNotes).toEqual([67])

      const lhNotes = m1Events.filter((e) => e.hand === 'LH')
      expect(lhNotes.length).toBe(4)
      expect(lhNotes[0].midiNotes).toEqual([48])
      expect(lhNotes[0].beatPosition).toBe(1.0)
    })

    it('debe reconocer acordes polifónicos (<chord/>) en la mano izquierda en el Compás 8', () => {
      const model = parseMusicXml(MOCK_PARTITURA_1_XML)
      const m8Events = model.events.filter((e) => e.measureNumber === 8)

      const chordEvent = m8Events.find((e) => e.hand === 'LH' && e.beatPosition === 1.0)
      expect(chordEvent).toBeDefined()
      expect(chordEvent?.isChord).toBe(true)
      expect(chordEvent?.midiNotes).toEqual([48, 52])
    })

    it('debe detectar silencios (<rest/>) y digitaciones (<fingering>)', () => {
      const model = parseMusicXml(MOCK_PARTITURA_1_XML)
      const m8Events = model.events.filter((e) => e.measureNumber === 8)

      const restEvent = m8Events.find((e) => e.hand === 'RH' && e.isRest)
      expect(restEvent).toBeDefined()

      const firstNote = model.events.find((e) => e.measureNumber === 1 && e.hand === 'RH')
      expect(firstNote?.notes[0].fingering).toBe(1)
    })
  })

  describe('Manejo de Errores', () => {
    it('debe lanzar error ante contenido vacío o no válido', () => {
      expect(() => parseMusicXml('')).toThrow(/vacío/i)
      expect(() => parseMusicXml('<score-partwise><measure><unclosed></score-partwise>')).toThrow(
        /sintaxis/i
      )
    })
  })
})
