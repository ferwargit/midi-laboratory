import React, { useRef, useEffect, useState, useCallback } from 'react'
import { generateMidiRange, midiNoteToName } from './domain/music/noteUtils'
import { VisualCueMode } from './domain/exercise/visualAudioSync'
import { useMidi } from './hooks/useMidi'
import { useSingleNoteTrainer } from './hooks/useSingleNoteTrainer'
import { useIntervalTrainer } from './hooks/useIntervalTrainer'
import { useSequenceTrainer } from './hooks/useSequenceTrainer'
import { useDatabaseStore } from './stores/useDatabaseStore'
import { Header } from './components/trainer/Header'
import { MidiDeviceSelect } from './components/trainer/MidiDeviceSelect'
import { MidiDisconnectAlert } from './components/trainer/MidiDisconnectAlert'
import { SingleNoteView } from './components/views/SingleNoteView'
import { IntervalsView } from './components/views/IntervalsView'
import { SequencesView } from './components/views/SequencesView'
import { AnalyticsView } from './components/views/AnalyticsView'
import { DatabaseCard } from './components/views/DatabaseCard'
import { ConfirmModal } from './components/ui/ConfirmModal'
import { MidiMonitor } from './components/trainer/MidiMonitor'
import { AiExercisePrescription } from './domain/ai/types'

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6 (37 teclas)

type AppMode = 'single_note' | 'intervals' | 'sequences' | 'analytics'

export default function App(): React.ReactElement {
  const [appMode, setAppMode] = useState<AppMode>('single_note')
  const [visualCueMode, setVisualCueMode] = useState<VisualCueMode>('blind') // Por defecto oído puro
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false)
  const handleNoteRef = useRef<(note: number) => void>(() => {})

  const initializeDb = useDatabaseStore((state) => state.initialize)
  const clearDb = useDatabaseStore((state) => state.clearDatabase)

  useEffect(() => {
    initializeDb()
  }, [initializeDb])

  const midi = useMidi({
    onNoteOn: (note) => handleNoteRef.current(note),
    enableSoftwareThru: true
  })

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
    onTelemetryLog: (type, message) => {
      midi.addLog({ type, message })
    }
  })

  // 2. Modalidad 2: Intervalos (2 Notas)
  const intervalTrainer = useIntervalTrainer({
    onPlayInterval: (root, target) => {
      midi.sendNote(root, 500)
      const rootName = midiNoteToName(root)
      const targetName = midiNoteToName(target)
      midi.addLog({
        type: 'OUT',
        message: `📏 Intervalo Nota 1 -> ${rootName} (${root})`
      })

      setTimeout(() => {
        midi.sendNote(target, 600)
        midi.addLog({
          type: 'OUT',
          message: `📏 Intervalo Nota 2 -> ${targetName} (${target})`
        })
      }, 550)
    },
    onTelemetryLog: (type, message) => {
      midi.addLog({ type, message })
    }
  })

  // 3. Modalidad 3: Secuencias (3 a 6 Notas)
  const sequenceTrainer = useSequenceTrainer({
    onPlaySequence: (notes) => {
      const names = notes.map((n) => midiNoteToName(n)).join(' - ')
      midi.addLog({
        type: 'OUT',
        message: `🎼 Secuencia (${notes.length} notas) -> ${names}`
      })

      notes.forEach((note, idx) => {
        setTimeout(() => {
          midi.sendNote(note, 450)
        }, idx * 500)
      })
    },
    onTelemetryLog: (type, message) => {
      midi.addLog({ type, message })
    }
  })

  useEffect(() => {
    if (appMode === 'single_note') {
      handleNoteRef.current = singleNoteTrainer.handleUserNotePlayed
    } else if (appMode === 'intervals') {
      handleNoteRef.current = intervalTrainer.handleUserNotePlayed
    } else {
      handleNoteRef.current = sequenceTrainer.handleUserNotePlayed
    }
  }, [
    appMode,
    singleNoteTrainer.handleUserNotePlayed,
    intervalTrainer.handleUserNotePlayed,
    sequenceTrainer.handleUserNotePlayed
  ])

  // Atajos de Teclado Globales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (appMode === 'single_note' && singleNoteTrainer.isWaitingManualAdvance) {
          singleNoteTrainer.advanceToNextQuestion()
        } else if (appMode === 'intervals' && intervalTrainer.isWaitingManualAdvance) {
          intervalTrainer.advanceToNextInterval()
        } else if (appMode === 'sequences' && sequenceTrainer.isWaitingManualAdvance) {
          sequenceTrainer.advanceToNextSequence()
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (appMode === 'single_note' && singleNoteTrainer.isSessionActive) {
          singleNoteTrainer.repeatCurrentNote()
        } else if (appMode === 'intervals' && intervalTrainer.isSessionActive) {
          intervalTrainer.repeatCurrentInterval()
        } else if (appMode === 'sequences' && sequenceTrainer.isSessionActive) {
          sequenceTrainer.repeatCurrentSequence()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return (): void => window.removeEventListener('keydown', handleKeyDown)
  }, [appMode, singleNoteTrainer, intervalTrainer, sequenceTrainer])

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
        singleNoteTrainer.handleUserNotePlayed(noteNumber)
      } else if (appMode === 'intervals') {
        intervalTrainer.handleUserNotePlayed(noteNumber)
      } else {
        sequenceTrainer.handleUserNotePlayed(noteNumber)
      }
    },
    [midi, appMode, singleNoteTrainer, intervalTrainer, sequenceTrainer]
  )

  const handleLoadPrescription = (p: AiExercisePrescription): void => {
    if (p.targetMode === 'single_note') {
      setAppMode('single_note')
      singleNoteTrainer.setSelectedInstrumentId(p.instrumentId)
      singleNoteTrainer.setSessionLimitType(p.limitType)
      singleNoteTrainer.setSessionQuestionsCount(p.questionsCount)
      singleNoteTrainer.setSessionDurationMinutes(p.durationMinutes)
      singleNoteTrainer.setAdvanceMode(p.advanceMode)
      singleNoteTrainer.startSession(p.recommendedNotes)
    } else if (p.targetMode === 'intervals') {
      setAppMode('intervals')
      if (p.recommendedIntervals && p.recommendedIntervals.length > 0) {
        intervalTrainer.setActiveIntervals(p.recommendedIntervals)
      }
      intervalTrainer.setSessionLimitType(p.limitType)
      intervalTrainer.setSessionQuestionsCount(p.questionsCount)
      intervalTrainer.setSessionDurationMinutes(p.durationMinutes)
      intervalTrainer.setAdvanceMode(p.advanceMode)
      intervalTrainer.startSession()
    } else {
      setAppMode('sequences')
      sequenceTrainer.setCustomCandidateNotes(p.recommendedNotes)
      if (p.sequenceLength) sequenceTrainer.setSequenceLength(p.sequenceLength)
      sequenceTrainer.setSessionLimitType(p.limitType)
      sequenceTrainer.setSessionQuestionsCount(p.questionsCount)
      sequenceTrainer.setSessionDurationMinutes(p.durationMinutes)
      sequenceTrainer.setAdvanceMode(p.advanceMode)
      sequenceTrainer.startSession()
    }
  }

  const isAnySessionActive =
    singleNoteTrainer.isSessionActive ||
    intervalTrainer.isSessionActive ||
    sequenceTrainer.isSessionActive

  const handleConfirmReset = async (): Promise<void> => {
    await clearDb()
    setIsResetModalOpen(false)
  }

  // Notas del estímulo que se iluminan según el modo pedagógico
  const liveStimulusNotes = visualCueMode === 'assisted' ? midi.activeStimulusNotes : []

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 font-sans">
      <Header status={midi.status} />

      <MidiDisconnectAlert isDisconnected={midi.isDeviceDisconnected} />

      {/* BARRA DE NAVEGACIÓN Y SELECTOR DE PISTAS LED */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-2 rounded-2xl gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* SELECTOR SEGMENTADO PRINCIPAL */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 flex-1">
          {[
            { id: 'single_note', label: 'Nota Individual', code: 'MODO 01' },
            { id: 'intervals', label: 'Intervalos', code: 'MODO 02' },
            { id: 'sequences', label: 'Secuencias', code: 'MODO 03' },
            { id: 'analytics', label: 'Psicometría & IA', code: 'DIAGNÓSTICO' }
          ].map((tab) => {
            const isActive = appMode === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                disabled={isAnySessionActive}
                onClick={(): void => setAppMode(tab.id as AppMode)}
                className={`py-2 px-3 rounded-xl font-medium transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center ${
                  isActive
                    ? tab.id === 'analytics'
                      ? 'bg-purple-600/90 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)] border border-purple-400/40'
                      : 'bg-gradient-to-b from-sky-500 to-sky-600 text-white shadow-[0_0_20px_rgba(56,189,248,0.3)] border border-sky-400/40'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <span className="text-[9px] font-mono tracking-widest opacity-60 uppercase mb-0.5">
                  {tab.code}
                </span>
                <span className="text-xs font-semibold">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* SELECTOR DE PISTAS VISUALES / AUDITIVAS */}
        <div className="flex items-center justify-center gap-1 bg-zinc-950/80 p-1.5 rounded-xl border border-zinc-800/80 text-[11px] font-mono shrink-0">
          <span className="text-zinc-500 px-2 text-[10px] tracking-wider uppercase font-semibold">
            Pistas:
          </span>
          <button
            type="button"
            onClick={(): void => setVisualCueMode('blind')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              visualCueMode === 'blind'
                ? 'bg-amber-400/15 border border-amber-400/50 text-amber-300 font-bold shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="El piano no se ilumina al sonar la nota para entrenar la escucha real"
          >
            Oído Puro
          </button>
          <button
            type="button"
            onClick={(): void => setVisualCueMode('assisted')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              visualCueMode === 'assisted'
                ? 'bg-cyan-400/15 border border-cyan-400/50 text-cyan-300 font-bold shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="La tecla se ilumina en cian sincronizada con el sonido"
          >
            Asistido LED
          </button>
        </div>
      </div>

      <MidiDeviceSelect
        inputs={midi.inputs}
        outputs={midi.outputs}
        selectedInputId={midi.selectedInputId}
        selectedOutputId={midi.selectedOutputId}
        onSelectInput={midi.setSelectedInputId}
        onSelectOutput={midi.setSelectedOutputId}
        disabled={isAnySessionActive}
      />

      {/* VISTAS MODULARES DE ENTRENAMIENTO */}
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

      {appMode === 'analytics' && <AnalyticsView onLoadPrescription={handleLoadPrescription} />}

      <DatabaseCard onOpenResetModal={(): void => setIsResetModalOpen(true)} />

      <ConfirmModal
        isOpen={isResetModalOpen}
        title="¿Resetear Base de Datos de Prueba?"
        message="Esta acción eliminará todas las sesiones y respuestas acumuladas en la memoria local para que puedas reiniciar tu historial desde cero. Esta operación no se puede deshacer."
        confirmText="Sí, Borrar Todo"
        cancelText="Cancelar"
        onConfirm={handleConfirmReset}
        onCancel={(): void => setIsResetModalOpen(false)}
      />

      <MidiMonitor logs={midi.logs} />
    </div>
  )
}
