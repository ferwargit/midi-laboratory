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

// H-05 (OLA 2.1, Auditoría V6): ligadura de prolongación entre compases contiguos.
// divisions = 4, BPM = 120 → 1 división = 0.25 tiempos = 125 ms.
const MOCK_TIE_ACROSS_MEASURES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Ligadura Entre Compases</work-title></work>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><direction-type><metronome><per-minute>120</per-minute></metronome></direction-type></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><tie type="start"/><voice>1</voice><staff>1</staff></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><tie type="stop"/><voice>1</voice><staff>1</staff></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><staff>1</staff></note>
    </measure>
  </part>
</score-partwise>`

// Misma partitura que la anterior, pero exportada con <tied> bajo <notations>.
const MOCK_TIED_NOTATIONS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Ligadura con Tied</work-title></work>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><direction-type><metronome><per-minute>120</per-minute></metronome></direction-type></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><staff>1</staff><notations><tied type="start"/></notations></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><staff>1</staff><notations><tied type="stop"/></notations></note>
    </measure>
  </part>
</score-partwise>`

// La continuación no coincide en pitch con la nota que abrió la ligadura.
const MOCK_TIE_PITCH_MISMATCH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Ligadura Rota</work-title></work>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><direction-type><metronome><per-minute>120</per-minute></metronome></direction-type></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><tie type="start"/><voice>1</voice><staff>1</staff></note>
    </measure>
    <measure number="2">
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><tie type="stop"/><voice>1</voice><staff>1</staff></note>
    </measure>
  </part>
</score-partwise>`

// El primer note de la voz llega con un stop huérfano, sin start previo.
const MOCK_TIE_ORPHAN_STOP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Stop Huerfano</work-title></work>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><direction-type><metronome><per-minute>120</per-minute></metronome></direction-type></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><tie type="stop"/><voice>1</voice><staff>1</staff></note>
    </measure>
  </part>
</score-partwise>`

// Voz aguda (staff 1, voice 1) avanza 2 divisiones, <backup> rebobina y entra la voz grave (staff 2, voice 5).
const MOCK_BACKUP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Backup Dos Manos</work-title></work>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><direction-type><metronome><per-minute>120</per-minute></metronome></direction-type></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><staff>1</staff></note>
      <backup><duration>2</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><staff>2</staff></note>
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

  it('debe consolidar una ligadura entre compases en un unico evento con la duracion combinada', () => {
    const model = parseMusicXml(MOCK_TIE_ACROSS_MEASURES_XML)

    // Compas 1: G4 abre la ligadura (blanca = 2 divisiones).
    // Compas 2: G4 continua la ligadura (negra = 1 division) y se acumula sobre el evento anterior.
    const tiedEvents = model.events.filter((e) => e.midiNotes.includes(67))
    expect(tiedEvents).toHaveLength(1)

    const tiedEvent = tiedEvents[0]
    expect(tiedEvent.measureNumber).toBe(1)
    expect(tiedEvent.beatPosition).toBe(1.0)
    expect(tiedEvent.durationDivisions).toBe(3)
    expect(tiedEvent.durationBeats).toBe(0.75)
    expect(tiedEvent.durationMs).toBe(375)
    expect(tiedEvent.isTied).toBe(true)

    // No se emite un segundo evento redundante para la nota continuada.
    const continuationEvents = model.events.filter(
      (e) => e.measureNumber === 2 && e.midiNotes.includes(67)
    )
    expect(continuationEvents).toHaveLength(0)

    // El cursor temporal si avanzo: la E4 del compas 2 cae en beat 1.25 (1.0 + 1 division / 4).
    const afterTie = model.events.find((e) => e.midiNotes.includes(64))
    expect(afterTie?.measureNumber).toBe(2)
    expect(afterTie?.beatPosition).toBe(1.25)
    expect(afterTie?.isTied).toBeFalsy()
  })

  it('debe consolidar la ligadura declarada con <tied> bajo <notations> igual que con <tie>', () => {
    const model = parseMusicXml(MOCK_TIED_NOTATIONS_XML)

    const tiedEvents = model.events.filter((e) => e.midiNotes.includes(67))
    expect(tiedEvents).toHaveLength(1)
    expect(tiedEvents[0].durationDivisions).toBe(3)
    expect(tiedEvents[0].durationBeats).toBe(0.75)
    expect(tiedEvents[0].durationMs).toBe(375)
    expect(tiedEvents[0].isTied).toBe(true)
  })

  it('no debe consolidar cuando la continuacion de la ligadura no coincide en pitch, staff o voice', () => {
    const model = parseMusicXml(MOCK_TIE_PITCH_MISMATCH_XML)

    // G4 (67) abre, A4 (69) llega con stop: pitch distinto => eventos independientes.
    expect(model.events).toHaveLength(2)
    const [g4, a4] = model.events

    expect(g4.midiNotes).toEqual([67])
    expect(g4.durationDivisions).toBe(2)
    expect(g4.durationBeats).toBe(0.5)
    expect(g4.durationMs).toBe(250)
    expect(g4.isTied).toBeFalsy()

    expect(a4.midiNotes).toEqual([69])
    expect(a4.measureNumber).toBe(2)
    expect(a4.durationDivisions).toBe(1)
    expect(a4.durationBeats).toBe(0.25)
    expect(a4.durationMs).toBe(125)
    expect(a4.isTied).toBeFalsy()
  })

  it('no debe consolidar un <tie type="stop"/> huerfano sin start previo', () => {
    const model = parseMusicXml(MOCK_TIE_ORPHAN_STOP_XML)

    expect(model.events).toHaveLength(1)
    const [event] = model.events

    expect(event.midiNotes).toEqual([67])
    expect(event.measureNumber).toBe(1)
    expect(event.durationDivisions).toBe(2)
    expect(event.durationBeats).toBe(0.5)
    expect(event.durationMs).toBe(250)
    expect(event.isTied).toBeFalsy()
  })

  it('debe alinear ambas manos en el mismo tiempo con <backup>', () => {
    const model = parseMusicXml(MOCK_BACKUP_XML)

    const treble = model.events.find((e) => e.staff === 1)
    const bass = model.events.find((e) => e.staff === 2)

    expect(treble?.voice).toBe(1)
    expect(bass?.voice).toBe(5)
    expect(treble?.beatPosition).toBe(bass?.beatPosition)
    expect(treble?.beatPosition).toBe(1.0)
  })
})
