import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react'
import { generateMidiRange, midiNoteToName } from './domain/music/noteUtils'
import { VisualCueMode } from './domain/exercise/visualAudioSync'
import { TonalContextMode, getTonalContextSteps } from './domain/music/tonalContext'
import { parseMusicXml } from './domain/music/scoreParser'
import { stimulusScheduler, ScheduledNoteEvent } from './services/audio/stimulusScheduler'
import { useMidi } from './hooks/useMidi'
import { useSingleNoteTrainer } from './hooks/useSingleNoteTrainer'
import { useIntervalTrainer } from './hooks/useIntervalTrainer'
import { useSequenceTrainer } from './hooks/useSequenceTrainer'
import { useRepertoireTrainer } from './hooks/useRepertoireTrainer'
import { useDatabaseStore } from './stores/useDatabaseStore'
import { StudioTopBar } from './components/trainer/StudioTopBar'
import { StudioBottomDock } from './components/trainer/StudioBottomDock'
import { MidiDisconnectAlert } from './components/trainer/MidiDisconnectAlert'
import { DbSaveAlert } from './components/trainer/DbSaveAlert'
import { SingleNoteView } from './components/views/SingleNoteView'
import { IntervalsView } from './components/views/IntervalsView'
import { SequencesView } from './components/views/SequencesView'
import { RepertoireView } from './components/views/RepertoireView'
import { AnalyticsView } from './components/views/AnalyticsView'
import { ConfirmModal } from './components/ui/ConfirmModal'
import { AiExercisePrescription } from './domain/ai/types'

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6 (37 teclas)
type AppMode = 'single_note' | 'intervals' | 'sequences' | 'repertoire' | 'analytics'

const DEFAULT_PARTITURA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Partitura 1</work-title></work>
  <credit page="1"><credit-type>title</credit-type><credit-words default-x="600" default-y="1600" font-size="22">Partitura 1</credit-words></credit>
  <credit page="1"><credit-type>composer</credit-type><credit-words default-x="1100" default-y="1500" justify="right">Félix Dumont</credit-words></credit>
  <credit page="1"><credit-type>subtitle</credit-type><credit-words default-x="600" default-y="1550" font-size="14">Canto de los cazadores tiroleses</credit-words></credit>
  <part id="P1">
    <!-- Compas 1 -->
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>2</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
      <direction placement="above"><sound tempo="86"/></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
    </measure>
    <!-- Compas 2 -->
    <measure number="2">
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
    </measure>
    <!-- Compas 3 -->
    <measure number="3">
      <harmony><root><root-step>G</root-step></root><kind>major</kind><bass><bass-step>B</bass-step></bass></harmony>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>B</step><octave>2</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>D</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
    </measure>
    <!-- Compas 4 -->
    <measure number="4">
      <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
    </measure>
    <!-- Compas 5 -->
    <measure number="5">
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>A</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>6</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>D</step><octave>6</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
    </measure>
    <!-- Compas 6 -->
    <measure number="6">
      <note><pitch><step>C</step><octave>6</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
    </measure>
    <!-- Compas 7 -->
    <measure number="7">
      <harmony><root><root-step>G</root-step></root><kind>major</kind><bass><bass-step>B</bass-step></bass></harmony>
      <note><pitch><step>F</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>F</step><octave>6</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>6</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>D</step><octave>6</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>6</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <note><pitch><step>D</step><octave>6</octave></pitch><duration>1</duration><voice>1</voice><type>16th</type><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>B</step><octave>2</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>D</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
    </measure>
    <!-- Compas 8 -->
    <measure number="8">
      <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>C</step><octave>6</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>6</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><pitch><step>C</step><octave>6</octave></pitch><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <note><rest/><duration>2</duration><voice>1</voice><type>eighth</type><staff>1</staff></note>
      <backup><duration>8</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><chord/><pitch><step>E</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><chord/><pitch><step>E</step><octave>3</octave></pitch><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
      <note><rest/><duration>2</duration><voice>5</voice><type>eighth</type><staff>2</staff></note>
    </measure>
  </part>
</score-partwise>`

export default function App(): React.ReactElement {
  const [appMode, setAppMode] = useState<AppMode>('single_note')
  const [visualCueMode, setVisualCueMode] = useState<VisualCueMode>('blind')
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false)
  const handleNoteRef = useRef<
    (note: number, velocity?: number, source?: 'midi_hardware' | 'virtual_ui') => void
  >(() => {})

  const initializeDb = useDatabaseStore((state) => state.initialize)
  const clearDb = useDatabaseStore((state) => state.clearDatabase)

  useEffect(() => {
    initializeDb()
  }, [initializeDb])

  const midi = useMidi({
    onNoteOn: (note, vel) => handleNoteRef.current(note, vel, 'midi_hardware'),
    enableSoftwareThru: true
  })

  const playTonalContextMidi = useCallback(
    (mode: TonalContextMode, rootNote: number): void => {
      const steps = getTonalContextSteps(mode, rootNote)
      if (steps.length === 0) return

      midi.addLog({
        type: 'OUT',
        message: `🎼 Pre-Roll Tonal activado: ${mode.toUpperCase()} (Raíz: ${midiNoteToName(rootNote)})`
      })

      const scheduledEvents: ScheduledNoteEvent[] = []
      let accumulatedDelay = 0

      steps.forEach((step) => {
        step.notes.forEach((note) => {
          scheduledEvents.push({
            note,
            durationMs: step.durationMs,
            delayMs: accumulatedDelay,
            velocity: 85
          })
        })
        accumulatedDelay += step.delayAfterMs
      })

      stimulusScheduler.scheduleSequence(scheduledEvents, (note, dur, vel) => {
        midi.sendNote(note, dur, vel)
      })
    },
    [midi]
  )

  // 1. Modalidad 1: Nota Individual
  const singleNoteTrainer = useSingleNoteTrainer({
    onPlayStimulus: (note, decision) => {
      midi.sendNote(note, 500)
      const noteName = midiNoteToName(note)
      midi.addLog({
        type: 'OUT',
        message: `🎵 Estímulo (${singleNoteTrainer.selectedInstrument.name}) -> ${noteName} (${note})`
      })
      midi.addLog({
        type: 'AI',
        message: `🧠 Decisión IA: ${decision.reason} | Pesos: ${Object.entries(
          decision.weightsSnapshot
        )
          .map(([k, v]) => `${k}:${v}`)
          .join(', ')}`
      })
    },
    onInstrumentChanged: (programNumber) => {
      midi.changeProgram(programNumber)
      midi.addLog({
        type: 'OUT',
        message: `🎛️ Cambio de Timbre MIDI Program Change -> ${programNumber}`
      })
    },
    onPlayTonalContext: playTonalContextMidi,
    onTelemetryLog: (type, message) => {
      midi.addLog({ type, message })
    }
  })

  // 2. Modalidad 2: Intervalos (2 Notas)
  const intervalTrainer = useIntervalTrainer({
    onPlayInterval: (root, target) => {
      stimulusScheduler.scheduleSequence(
        [
          { note: root, durationMs: 500, delayMs: 0 },
          { note: target, durationMs: 600, delayMs: 550 }
        ],
        (note, dur) => midi.sendNote(note, dur)
      )

      midi.addLog({
        type: 'OUT',
        message: `📏 Intervalo -> ${midiNoteToName(root)} a ${midiNoteToName(target)}`
      })
    },
    onTelemetryLog: (type, message) => {
      midi.addLog({ type, message })
    }
  })

  // 3. Modalidad 3: Secuencias (3 a 6 Notas)
  const sequenceTrainer = useSequenceTrainer({
    onPlaySequence: (notes) => {
      const scheduled: ScheduledNoteEvent[] = notes.map((note, idx) => ({
        note,
        durationMs: 450,
        delayMs: idx * 500
      }))

      stimulusScheduler.scheduleSequence(scheduled, (note, dur) => midi.sendNote(note, dur))

      const names = notes.map((n) => midiNoteToName(n)).join(' - ')
      midi.addLog({
        type: 'OUT',
        message: `🎼 Secuencia (${notes.length} notas) -> ${names}`
      })
    },
    onTelemetryLog: (type, message) => {
      midi.addLog({ type, message })
    }
  })

  const handlePlayMetronomeTick = useCallback(
    (note: number, dur: number, vel?: number, ch?: number): void => {
      midi.sendNote(note, dur, vel, ch)
    },
    [midi]
  )

  // 4. Modalidad 4: Repertorio Audiomotor con Reloj Maestro Unificado
  const repertoireTrainer = useRepertoireTrainer({
    onPlaySlice: (
      events,
      bpm,
      beatsPerMeasure = 2,
      rhythmMode = 'free_rubato',
      isContinuousMetro = false,
      restingBars = 1
    ) => {
      const isIsochronous = rhythmMode === 'free_rubato'
      const beats = beatsPerMeasure || 2
      const beatDurationMs = Math.round(60000 / bpm)
      const pianoEvents: ScheduledNoteEvent[] = []

      let currentOffsetMs = 0

      events.forEach((evt) => {
        const noteIntervalMs = isIsochronous
          ? beatDurationMs
          : Math.round((evt.durationBeats || 0.5) * beatDurationMs)

        const soundingDurationMs = Math.max(80, Math.round(noteIntervalMs * 0.88))

        evt.midiNotes.forEach((note) => {
          pianoEvents.push({
            note,
            durationMs: soundingDurationMs,
            delayMs: currentOffsetMs,
            velocity: 100,
            channel: 1 // Piano Acústico
          })
        })
        currentOffsetMs += noteIntervalMs
      })

      if (isContinuousMetro) {
        if (!stimulusScheduler.isContinuousMetronomeActive()) {
          stimulusScheduler.startContinuousMetronome(
            beatDurationMs,
            beats,
            (note, dur, vel, ch) => {
              midi.sendNote(note, dur, vel, ch)
            }
          )
          midi.addLog({
            type: 'OUT',
            message: `⏱️ Metrónomo Continuo activo en Canal 10 (${bpm} BPM)`
          })
        }

        stimulusScheduler.schedulePhraseOnContinuousGrid(
          pianoEvents,
          restingBars,
          (note, dur, vel, ch) => {
            midi.sendNote(note, dur, vel, ch)
          }
        )
      } else {
        stimulusScheduler.stopContinuousMetronome()
        const preRollDurationMs = beats * beatDurationMs
        const unifiedEvents: ScheduledNoteEvent[] = []

        for (let beat = 0; beat < beats; beat++) {
          const isDownbeat = beat === 0
          unifiedEvents.push({
            note: isDownbeat ? 76 : 77,
            durationMs: 120,
            delayMs: beat * beatDurationMs,
            velocity: isDownbeat ? 115 : 90,
            channel: 10
          })
        }

        pianoEvents.forEach((e) => {
          unifiedEvents.push({
            ...e,
            delayMs: preRollDurationMs + e.delayMs
          })
        })

        stimulusScheduler.scheduleSequence(unifiedEvents, (note, dur, vel, ch) => {
          midi.sendNote(note, dur, vel, ch)
        })

        midi.addLog({
          type: 'OUT',
          message: isIsochronous
            ? `⏱️ Metrónomo: ${beats} tiempos a ${bpm} BPM (${beatDurationMs}ms/tiempo)`
            : `⏱️ Metrónomo: ${beats} tiempos a ${bpm} BPM`
        })
      }

      const noteNames = events
        .flatMap((e) => e.midiNotes)
        .map((n) => midiNoteToName(n))
        .join(', ')
      midi.addLog({
        type: 'OUT',
        message: isIsochronous
          ? `🎼 Frase (${events.length} notas a ${bpm} BPM) -> ${noteNames}`
          : `🎼 Frase (${events.length} notas a ${bpm} BPM) -> ${noteNames}`
      })
    },
    onPlayMetronomeTick: handlePlayMetronomeTick,
    onTelemetryLog: (type, message) => {
      midi.addLog({ type, message })
    }
  })

  // ✅ Cargar partitura completa por defecto una sola vez al montar (evita resetear el BPM a 86 al mover el slider)
  const hasLoadedDefaultScoreRef = useRef(false)
  const { setCurrentScore, setStartMeasure, setEndMeasure, setStudyBpm } = repertoireTrainer

  useEffect(() => {
    if (hasLoadedDefaultScoreRef.current) return
    try {
      const defaultScore = parseMusicXml(DEFAULT_PARTITURA_XML)
      setCurrentScore(defaultScore)
      setStartMeasure(1)
      setEndMeasure(1)
      setStudyBpm(defaultScore.baseBpm)
      hasLoadedDefaultScoreRef.current = true
    } catch {
      // No-op
    }
  }, [setCurrentScore, setStartMeasure, setEndMeasure, setStudyBpm])

  // Router MIDI Síncrono
  useLayoutEffect(() => {
    handleNoteRef.current = (note, vel, source) => {
      if (appMode === 'single_note') {
        singleNoteTrainer.handleUserNotePlayed(note, source)
      } else if (appMode === 'intervals') {
        intervalTrainer.handleUserNotePlayed(note, source)
      } else if (appMode === 'sequences') {
        sequenceTrainer.handleUserNotePlayed(note, source)
      } else if (appMode === 'repertoire') {
        repertoireTrainer.handleUserNotePlayed(note, vel ?? 90, source)
      }
    }
  })

  // Atajos de Teclado (Space y R)
  const {
    isWaitingManualAdvance: singleNoteWaiting,
    isSessionActive: singleNoteActive,
    advanceToNextQuestion: singleNoteAdvance,
    repeatCurrentNote: singleNoteRepeat
  } = singleNoteTrainer

  const {
    isWaitingManualAdvance: intervalWaiting,
    isSessionActive: intervalActive,
    advanceToNextInterval: intervalAdvance,
    repeatCurrentInterval: intervalRepeat
  } = intervalTrainer

  const {
    isWaitingManualAdvance: sequenceWaiting,
    isSessionActive: sequenceActive,
    advanceToNextSequence: sequenceAdvance,
    repeatCurrentSequence: sequenceRepeat
  } = sequenceTrainer

  const {
    isWaitingManualAdvance: repertoireWaiting,
    isSessionActive: repertoireActive,
    advanceToNextStep: repertoireAdvance,
    repeatCurrentSlice: repertoireRepeat
  } = repertoireTrainer

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (isResetModalOpen) return

      const target = e.target as HTMLElement | null
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (isTyping) return

      if (e.code === 'Space') {
        e.preventDefault()
        if (appMode === 'single_note' && singleNoteWaiting) {
          singleNoteAdvance()
        } else if (appMode === 'intervals' && intervalWaiting) {
          intervalAdvance()
        } else if (appMode === 'sequences' && sequenceWaiting) {
          sequenceAdvance()
        } else if (appMode === 'repertoire' && repertoireWaiting) {
          repertoireAdvance()
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (appMode === 'single_note' && singleNoteActive) {
          singleNoteRepeat()
        } else if (appMode === 'intervals' && intervalActive) {
          intervalRepeat()
        } else if (appMode === 'sequences' && sequenceActive) {
          sequenceRepeat()
        } else if (appMode === 'repertoire' && repertoireActive) {
          repertoireRepeat()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return (): void => window.removeEventListener('keydown', handleKeyDown)
  }, [
    appMode,
    isResetModalOpen,
    singleNoteWaiting,
    singleNoteActive,
    singleNoteAdvance,
    singleNoteRepeat,
    intervalWaiting,
    intervalActive,
    intervalAdvance,
    intervalRepeat,
    sequenceWaiting,
    sequenceActive,
    sequenceAdvance,
    sequenceRepeat,
    repertoireWaiting,
    repertoireActive,
    repertoireAdvance,
    repertoireRepeat
  ])

  const handleVirtualKeyPress = useCallback(
    (noteNumber: number): void => {
      midi.sendNote(noteNumber, 350, 95)
      midi.addLog({
        type: 'IN',
        message: `🖱️ Clic en Piano Virtual -> ${midiNoteToName(noteNumber)} (${noteNumber})`,
        noteNumber,
        velocity: 95
      })

      if (appMode === 'single_note') {
        singleNoteTrainer.handleUserNotePlayed(noteNumber, 'virtual_ui')
      } else if (appMode === 'intervals') {
        intervalTrainer.handleUserNotePlayed(noteNumber, 'virtual_ui')
      } else if (appMode === 'sequences') {
        sequenceTrainer.handleUserNotePlayed(noteNumber, 'virtual_ui')
      } else if (appMode === 'repertoire') {
        repertoireTrainer.handleUserNotePlayed(noteNumber, 90, 'virtual_ui')
      }
    },
    [midi, appMode, singleNoteTrainer, intervalTrainer, sequenceTrainer, repertoireTrainer]
  )

  const handleLoadPrescription = (p: AiExercisePrescription): void => {
    if (p.targetMode === 'single_note') {
      setAppMode('single_note')
      const tonalMode =
        p.tonalAnchorMode === 'drone_c'
          ? 'drone'
          : p.tonalAnchorMode === 'cadence_preview'
            ? 'cadence'
            : 'none'

      singleNoteTrainer.setSelectedInstrumentId(p.instrumentId)
      singleNoteTrainer.setSessionLimitType(p.limitType)
      singleNoteTrainer.setSessionQuestionsCount(p.questionsCount)
      singleNoteTrainer.setSessionDurationMinutes(p.durationMinutes)
      singleNoteTrainer.setAdvanceMode(p.advanceMode)
      singleNoteTrainer.setTonalContextMode(tonalMode)

      singleNoteTrainer.startSession(p.recommendedNotes)
    } else if (p.targetMode === 'intervals') {
      setAppMode('intervals')
      const intervals =
        p.recommendedIntervals && p.recommendedIntervals.length > 0
          ? p.recommendedIntervals
          : [2, 4, 5, 7, 12]

      intervalTrainer.startSession({
        intervals,
        roots: p.recommendedNotes && p.recommendedNotes.length > 0 ? p.recommendedNotes : undefined,
        limitType: p.limitType,
        questionsCount: p.questionsCount,
        durationMinutes: p.durationMinutes,
        advanceMode: p.advanceMode
      })
    } else {
      setAppMode('sequences')
      const seqLen = p.sequenceLength || 3

      sequenceTrainer.startSession({
        notes: p.recommendedNotes,
        length: seqLen,
        limitType: p.limitType,
        questionsCount: p.questionsCount,
        durationMinutes: p.durationMinutes,
        advanceMode: p.advanceMode
      })
    }
  }

  const handleSelectMode = (newMode: AppMode): void => {
    stimulusScheduler.cancelAll()
    midi.sendAllNotesOff()
    setAppMode(newMode)
  }

  const isAnySessionActive =
    singleNoteTrainer.isSessionActive ||
    intervalTrainer.isSessionActive ||
    sequenceTrainer.isSessionActive ||
    repertoireTrainer.isSessionActive

  const activeDbSaveError =
    singleNoteTrainer.saveError ||
    intervalTrainer.saveError ||
    sequenceTrainer.saveError ||
    repertoireTrainer.saveError

  const handleDismissDbSaveError = (): void => {
    singleNoteTrainer.clearSaveError()
    intervalTrainer.clearSaveError()
    sequenceTrainer.clearSaveError()
    repertoireTrainer.clearSaveError()
  }

  const handleConfirmReset = async (): Promise<void> => {
    await clearDb()
    setIsResetModalOpen(false)
  }

  const liveStimulusNotes = visualCueMode === 'assisted' ? midi.activeStimulusNotes : []

  return (
    <div className="min-h-screen flex flex-col justify-between p-3 md:p-5 max-w-[1800px] w-full mx-auto space-y-3 font-sans">
      {/* 1. MASTER TOPBAR */}
      <StudioTopBar
        appMode={appMode}
        onSelectMode={handleSelectMode}
        isSessionActive={isAnySessionActive}
        visualCueMode={visualCueMode}
        onToggleVisualCue={(m): void => setVisualCueMode(m)}
        status={midi.status}
        inputs={midi.inputs}
        outputs={midi.outputs}
        selectedInputId={midi.selectedInputId}
        selectedOutputId={midi.selectedOutputId}
        onSelectInput={midi.setSelectedInputId}
        onSelectOutput={midi.setSelectedOutputId}
      />

      <MidiDisconnectAlert isDisconnected={midi.isDeviceDisconnected} />
      <DbSaveAlert error={activeDbSaveError} onDismiss={handleDismissDbSaveError} />

      {/* 2. MAIN STAGE */}
      <main className="flex-1 flex flex-col justify-start w-full">
        {appMode === 'single_note' && (
          <SingleNoteView
            trainer={singleNoteTrainer}
            pianoKeys={PIANO_KEYS}
            pressedNotes={midi.pressedNotes}
            stimulusNotes={liveStimulusNotes}
            onVirtualKeyPress={handleVirtualKeyPress}
          />
        )}

        {appMode === 'intervals' && (
          <IntervalsView
            trainer={intervalTrainer}
            pianoKeys={PIANO_KEYS}
            pressedNotes={midi.pressedNotes}
            stimulusNotes={liveStimulusNotes}
            onVirtualKeyPress={handleVirtualKeyPress}
          />
        )}

        {appMode === 'sequences' && (
          <SequencesView
            trainer={sequenceTrainer}
            pianoKeys={PIANO_KEYS}
            pressedNotes={midi.pressedNotes}
            stimulusNotes={liveStimulusNotes}
            onVirtualKeyPress={handleVirtualKeyPress}
          />
        )}

        {appMode === 'repertoire' && (
          <RepertoireView
            trainer={repertoireTrainer}
            pianoKeys={PIANO_KEYS}
            pressedNotes={midi.pressedNotes}
            stimulusNotes={liveStimulusNotes}
            onVirtualKeyPress={handleVirtualKeyPress}
          />
        )}

        {appMode === 'analytics' && <AnalyticsView onLoadPrescription={handleLoadPrescription} />}
      </main>

      {/* 3. DOCK INFERIOR PLEGABLE */}
      <StudioBottomDock logs={midi.logs} onOpenResetModal={(): void => setIsResetModalOpen(true)} />

      <ConfirmModal
        isOpen={isResetModalOpen}
        title="¿Resetear Base de Datos de Prueba?"
        message="Esta acción eliminará todas las sesiones y respuestas acumuladas en la memoria local. Esta operación no se puede deshacer."
        confirmText="Sí, Borrar Todo"
        cancelText="Cancelar"
        onConfirm={handleConfirmReset}
        onCancel={(): void => setIsResetModalOpen(false)}
      />
    </div>
  )
}
