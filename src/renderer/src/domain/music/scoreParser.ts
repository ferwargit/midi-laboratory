import {
  ScoreDataModel,
  ScorePlaybackEvent,
  ScoreNoteDetail,
  HarmonicContextTag
} from './scoreTypes'

const STEP_OFFSETS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
}

/**
 * Convierte un paso musical, alteración y octava a número de nota MIDI estándar (0-127).
 * Ej: C4 -> 60, G4 -> 67, C3 -> 48, B2 -> 47.
 */
export function pitchToMidiNote(step: string, alter = 0, octave = 4): number {
  const cleanStep = step.trim().toUpperCase()
  const offset = STEP_OFFSETS[cleanStep] ?? 0
  const midi = (octave + 1) * 12 + offset + alter
  return Math.min(127, Math.max(0, midi))
}

/**
 * Formatea un cifrado armónico a texto estándar (ej: "C", "G/B", "Am7", "F#m").
 */
function buildChordSymbol(
  rootStep: string,
  rootAlter = 0,
  kind = 'major',
  bassStep?: string,
  bassAlter = 0
): string {
  let symbol = rootStep
  if (rootAlter === 1) symbol += '#'
  else if (rootAlter === -1) symbol += 'b'

  if (kind === 'minor') symbol += 'm'
  else if (kind === 'dominant') symbol += '7'
  else if (kind === 'major-seventh') symbol += 'maj7'
  else if (kind === 'minor-seventh') symbol += 'm7'
  else if (kind === 'diminished') symbol += 'dim'
  else if (kind === 'augmented') symbol += 'aug'

  if (bassStep) {
    let bass = bassStep
    if (bassAlter === 1) bass += '#'
    else if (bassAlter === -1) bass += 'b'
    symbol += `/${bass}`
  }

  return symbol
}

/**
 * Parsea un archivo MusicXML (formato MuseScore Studio 4) y genera el modelo de datos canónico.
 */
export function parseMusicXml(xmlContent: string): ScoreDataModel {
  if (!xmlContent || typeof xmlContent !== 'string' || xmlContent.trim().length === 0) {
    throw new Error('El contenido MusicXML está vacío.')
  }

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlContent, 'application/xml')

  // Manejo de errores de sintaxis XML
  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    throw new Error(`Error de sintaxis en el archivo MusicXML: ${parserError.textContent}`)
  }

  // 1. Metadatos de la Obra
  const title =
    xmlDoc.querySelector('work > work-title')?.textContent?.trim() ||
    xmlDoc.querySelector('credit[page="1"] credit-words[font-size="22"]')?.textContent?.trim() ||
    'Sin Título'

  const subtitle =
    xmlDoc.querySelector('credit[page="1"] credit-words[font-size="14"]')?.textContent?.trim() ||
    undefined

  const composer =
    xmlDoc.querySelector('creator[type="composer"]')?.textContent?.trim() ||
    xmlDoc.querySelector('credit[page="1"] credit-words[justify="right"]')?.textContent?.trim() ||
    undefined

  // 2. Parámetros globales por defecto
  let divisions = 4
  let beats = 4
  let beatType = 4
  let fifths = 0
  let mode: 'major' | 'minor' = 'major'
  let baseBpm = 120

  const soundTempo = xmlDoc.querySelector('direction sound[tempo]')
  if (soundTempo) {
    const tempoAttr = soundTempo.getAttribute('tempo')
    if (tempoAttr) baseBpm = parseFloat(tempoAttr)
  } else {
    const perMinute = xmlDoc.querySelector('metronome per-minute')
    if (perMinute) baseBpm = parseFloat(perMinute.textContent || '120')
  }

  const measureElements = xmlDoc.querySelectorAll('part > measure')
  const totalMeasures = measureElements.length

  const allEvents: ScorePlaybackEvent[] = []
  const harmonicProgression: HarmonicContextTag[] = []

  // 3. Procesamiento compás por compás respetando <backup>, <chord>, <harmony>
  measureElements.forEach((measureEl, mIdx) => {
    const measureNumber = parseInt(measureEl.getAttribute('number') || `${mIdx + 1}`, 10)
    let currentCursorDivisions = 0
    let lastEventInVoice: ScorePlaybackEvent | null = null

    // Recorrer los hijos en orden estricto de aparición
    const children = Array.from(measureEl.children)

    children.forEach((child) => {
      const tagName = child.tagName.toLowerCase()

      // A. Atributos (cambio de compás, divisiones, armadura)
      if (tagName === 'attributes') {
        const divEl = child.querySelector('divisions')
        if (divEl) divisions = parseInt(divEl.textContent || '4', 10)

        const beatsEl = child.querySelector('time > beats')
        const beatTypeEl = child.querySelector('time > beat-type')
        if (beatsEl && beatTypeEl) {
          beats = parseInt(beatsEl.textContent || '4', 10)
          beatType = parseInt(beatTypeEl.textContent || '4', 10)
        }

        const fifthsEl = child.querySelector('key > fifths')
        if (fifthsEl) fifths = parseInt(fifthsEl.textContent || '0', 10)

        const modeEl = child.querySelector('key > mode')
        if (modeEl && modeEl.textContent) {
          mode = modeEl.textContent.trim().toLowerCase() === 'minor' ? 'minor' : 'major'
        }
      }

      // B. Tempo dinámico
      else if (tagName === 'direction') {
        const tempoAttr = child.querySelector('sound')?.getAttribute('tempo')
        if (tempoAttr) baseBpm = parseFloat(tempoAttr)
      }

      // C. Cifrado Armónico (<harmony>)
      else if (tagName === 'harmony') {
        const rootStep = child.querySelector('root > root-step')?.textContent?.trim() || 'C'
        const rootAlter = parseInt(child.querySelector('root > root-alter')?.textContent || '0', 10)
        const kind = child.querySelector('kind')?.textContent?.trim() || 'major'
        const bassStep = child.querySelector('bass > bass-step')?.textContent?.trim() || undefined
        const bassAlter = parseInt(child.querySelector('bass > bass-alter')?.textContent || '0', 10)

        const beatPosition = 1.0 + currentCursorDivisions / divisions
        const chordSymbol = buildChordSymbol(rootStep, rootAlter, kind, bassStep, bassAlter)

        const harmonyTag: HarmonicContextTag = {
          chordSymbol,
          rootStep,
          rootAlter,
          kind,
          bassStep,
          bassAlter,
          measureNumber,
          beatPosition
        }

        harmonicProgression.push(harmonyTag)
      }

      // D. Rebobinado de tiempo (<backup>)
      else if (tagName === 'backup') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10)
        currentCursorDivisions = Math.max(0, currentCursorDivisions - dur)
        lastEventInVoice = null
      }

      // E. Avance de tiempo (<forward>)
      else if (tagName === 'forward') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10)
        currentCursorDivisions += dur
        lastEventInVoice = null
      }

      // F. Nota / Acorde / Silencio (<note>)
      else if (tagName === 'note') {
        const isChord = child.querySelector('chord') !== null
        const isRest = child.querySelector('rest') !== null

        const duration = parseInt(child.querySelector('duration')?.textContent || '0', 10)
        const voice = parseInt(child.querySelector('voice')?.textContent || '1', 10)
        const staff = (parseInt(child.querySelector('staff')?.textContent || '1', 10) || 1) as 1 | 2
        const hand: 'RH' | 'LH' = staff === 1 ? 'RH' : 'LH'

        // Digitación sugerida
        const fingeringText = child.querySelector('technical > fingering')?.textContent?.trim()
        const fingering = fingeringText ? parseInt(fingeringText, 10) : undefined

        let noteDetail: ScoreNoteDetail | null = null

        if (!isRest) {
          const step = child.querySelector('pitch > step')?.textContent?.trim() || 'C'
          const alter = parseInt(child.querySelector('pitch > alter')?.textContent || '0', 10)
          const octave = parseInt(child.querySelector('pitch > octave')?.textContent || '4', 10)
          const pitch = pitchToMidiNote(step, alter, octave)

          noteDetail = {
            pitch,
            step,
            alter,
            octave,
            fingering
          }
        }

        // Si es una nota de acorde simultáneo (<chord/>)
        if (isChord && lastEventInVoice && noteDetail) {
          lastEventInVoice.notes.push(noteDetail)
          lastEventInVoice.midiNotes.push(noteDetail.pitch)
          lastEventInVoice.isChord = true
          // Las notas con <chord/> no avanzan el cursor temporal
        } else {
          const beatPosition = 1.0 + currentCursorDivisions / divisions
          const durationBeats = duration / divisions
          const durationMs = Math.round(durationBeats * (60000 / baseBpm))

          const event: ScorePlaybackEvent = {
            id: crypto.randomUUID(),
            measureNumber,
            beatPosition,
            notes: noteDetail ? [noteDetail] : [],
            midiNotes: noteDetail ? [noteDetail.pitch] : [],
            durationDivisions: duration,
            durationBeats,
            durationMs,
            isChord: false,
            isRest,
            hand,
            staff,
            voice
          }

          allEvents.push(event)
          lastEventInVoice = event
          currentCursorDivisions += duration
        }
      }
    })
  })

  // 4. Ordenamiento cronológico de eventos
  allEvents.sort((a, b) => {
    if (a.measureNumber !== b.measureNumber) {
      return a.measureNumber - b.measureNumber
    }
    if (a.beatPosition !== b.beatPosition) {
      return a.beatPosition - b.beatPosition
    }
    return a.staff - b.staff
  })

  // Asociar etiquetas armónicas a los eventos correspondientes
  allEvents.forEach((evt) => {
    const matchingHarmony = harmonicProgression.find(
      (h) =>
        h.measureNumber === evt.measureNumber && Math.abs(h.beatPosition - evt.beatPosition) < 0.05
    )
    if (matchingHarmony) {
      evt.harmonicTag = matchingHarmony
    }
  })

  return {
    title,
    subtitle,
    composer,
    timeSignature: { beats, beatType },
    keySignature: { fifths, mode },
    baseBpm,
    divisionsPerQuarter: divisions,
    totalMeasures,
    events: allEvents,
    harmonicProgression
  }
}
