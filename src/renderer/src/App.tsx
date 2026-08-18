import React, { useRef, useEffect, useState, useCallback } from 'react'
import { generateMidiRange, midiNoteToName } from './domain/music/noteUtils'
import { useMidi } from './hooks/useMidi'
import { useSingleNoteTrainer } from './hooks/useSingleNoteTrainer'
import { useIntervalTrainer } from './hooks/useIntervalTrainer'
import { useSequenceTrainer } from './hooks/useSequenceTrainer'
import { useDatabaseStore } from './stores/useDatabaseStore'
import { Header } from './components/trainer/Header'
import { MidiDeviceSelect } from './components/trainer/MidiDeviceSelect'
import { SingleNoteView } from './components/views/SingleNoteView'
import { IntervalsView } from './components/views/IntervalsView'
import { SequencesView } from './components/views/SequencesView'
import { DatabaseCard } from './components/views/DatabaseCard'
import { ConfirmModal } from './components/ui/ConfirmModal'
import { MidiMonitor } from './components/trainer/MidiMonitor'

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6 (37 teclas)

type AppMode = 'single_note' | 'intervals' | 'sequences'

export default function App(): React.ReactElement {
  const [appMode, setAppMode] = useState<AppMode>('single_note')
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
      midi.sendNote(note)
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

  // ATAJOS DE TECLADO DE COMPUTADORA: Space (Avanzar) / R (Repetir)
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

  const isAnySessionActive =
    singleNoteTrainer.isSessionActive ||
    intervalTrainer.isSessionActive ||
    sequenceTrainer.isSessionActive

  const handleConfirmReset = async (): Promise<void> => {
    await clearDb()
    setIsResetModalOpen(false)
  }

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-4">
      <Header status={midi.status} />

      {/* SELECTOR DE MODALIDAD */}
      <div className="flex gap-2 bg-zinc-900/90 border border-zinc-800 p-1.5 rounded-lg">
        <button
          type="button"
          disabled={isAnySessionActive}
          onClick={(): void => setAppMode('single_note')}
          className={`flex-1 py-2 rounded-md font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 ${
            appMode === 'single_note'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          🎵 Modalidad 1: Nota Individual
        </button>
        <button
          type="button"
          disabled={isAnySessionActive}
          onClick={(): void => setAppMode('intervals')}
          className={`flex-1 py-2 rounded-md font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 ${
            appMode === 'intervals'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          📏 Modalidad 2: Intervalos (2 Notas)
        </button>
        <button
          type="button"
          disabled={isAnySessionActive}
          onClick={(): void => setAppMode('sequences')}
          className={`flex-1 py-2 rounded-md font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 ${
            appMode === 'sequences'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          🎼 Modalidad 3: Secuencias (3 a 6 Notas)
        </button>
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

      {/* VISTAS MODULARES */}
      {appMode === 'single_note' && (
        <SingleNoteView
          trainer={singleNoteTrainer}
          pianoKeys={PIANO_KEYS}
          pressedNotes={midi.pressedNotes}
          onVirtualKeyPress={handleVirtualKeyPress}
        />
      )}

      {appMode === 'intervals' && (
        <IntervalsView
          trainer={intervalTrainer}
          pianoKeys={PIANO_KEYS}
          pressedNotes={midi.pressedNotes}
          onVirtualKeyPress={handleVirtualKeyPress}
        />
      )}

      {appMode === 'sequences' && (
        <SequencesView
          trainer={sequenceTrainer}
          pianoKeys={PIANO_KEYS}
          pressedNotes={midi.pressedNotes}
          onVirtualKeyPress={handleVirtualKeyPress}
        />
      )}

      {/* TARJETA DE BASE DE DATOS GLOBAL */}
      <DatabaseCard onOpenResetModal={(): void => setIsResetModalOpen(true)} />

      {/* MODAL DE RESET */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="¿Resetear Base de Datos de Prueba?"
        message="Esta acción eliminará todas las sesiones y respuestas acumuladas en la memoria local para que puedas reiniciar tu historial desde cero. Esta operación no se puede deshacer."
        confirmText="🗑️ Sí, Borrar Todo"
        cancelText="Cancelar"
        onConfirm={handleConfirmReset}
        onCancel={(): void => setIsResetModalOpen(false)}
      />

      <MidiMonitor logs={midi.logs} />
    </div>
  )
}
