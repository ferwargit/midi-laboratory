import React, { useRef, useEffect, useState, useCallback } from 'react'
import { generateMidiRange, midiNoteToName } from './domain/music/noteUtils'
import { useMidi } from './hooks/useMidi'
import { useSingleNoteTrainer } from './hooks/useSingleNoteTrainer'
import { useIntervalTrainer } from './hooks/useIntervalTrainer'
import { useDatabaseStore } from './stores/useDatabaseStore'
import { Header } from './components/trainer/Header'
import { MidiDeviceSelect } from './components/trainer/MidiDeviceSelect'
import { SingleNoteView } from './components/views/SingleNoteView'
import { IntervalsView } from './components/views/IntervalsView'
import { DatabaseCard } from './components/views/DatabaseCard'
import { ConfirmModal } from './components/ui/ConfirmModal'
import { MidiMonitor } from './components/trainer/MidiMonitor'

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6 (37 teclas)

type AppMode = 'single_note' | 'intervals'

export default function App(): React.ReactElement {
  const [appMode, setAppMode] = useState<AppMode>('single_note')
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false)
  const handleNoteRef = useRef<(note: number) => void>(() => {})

  // 1. Inicializar Store de Base de Datos
  const initializeDb = useDatabaseStore((state) => state.initialize)
  const clearDb = useDatabaseStore((state) => state.clearDatabase)

  useEffect(() => {
    initializeDb()
  }, [initializeDb])

  // 2. Hook de MIDI
  const midi = useMidi({
    onNoteOn: (note) => handleNoteRef.current(note),
    enableSoftwareThru: true
  })

  // 3. Entrenador de Nota Individual
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

  // 4. Entrenador de Intervalos (2 Notas)
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

  // Enrutar pulsaciones físicas del piano FP-8
  useEffect(() => {
    if (appMode === 'single_note') {
      handleNoteRef.current = singleNoteTrainer.handleUserNotePlayed
    } else {
      handleNoteRef.current = intervalTrainer.handleUserNotePlayed
    }
  }, [appMode, singleNoteTrainer.handleUserNotePlayed, intervalTrainer.handleUserNotePlayed])

  // Handler unificado para cuando hacés clic en una tecla del piano virtual
  const handleVirtualKeyPress = useCallback(
    (noteNumber: number): void => {
      // Reproduce el sonido en el Korg NS5R
      midi.sendNote(noteNumber, 350, 95)

      // Registra en el log
      midi.addLog({
        type: 'IN',
        message: `🖱️ Clic en Piano Virtual -> ${midiNoteToName(noteNumber)} (${noteNumber})`,
        noteNumber,
        velocity: 95
      })

      // Envía la nota a la modalidad activa
      if (appMode === 'single_note') {
        singleNoteTrainer.handleUserNotePlayed(noteNumber)
      } else {
        intervalTrainer.handleUserNotePlayed(noteNumber)
      }
    },
    [midi, appMode, singleNoteTrainer, intervalTrainer]
  )

  const isAnySessionActive = singleNoteTrainer.isSessionActive || intervalTrainer.isSessionActive

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

      {/* VISTAS MODULARES CON SOPORTE DE CLIC VIRTUAL */}
      {appMode === 'single_note' ? (
        <SingleNoteView
          trainer={singleNoteTrainer}
          pianoKeys={PIANO_KEYS}
          pressedNotes={midi.pressedNotes}
          onVirtualKeyPress={handleVirtualKeyPress}
        />
      ) : (
        <IntervalsView
          trainer={intervalTrainer}
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
