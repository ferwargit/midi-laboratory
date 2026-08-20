import React, { useRef, useEffect, useState, useCallback } from 'react'
import { generateMidiRange, midiNoteToName } from './domain/music/noteUtils'
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
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false)
  const handleNoteRef = useRef<(note: number) => void>(() => {})

  const initializeDb = useDatabaseStore((state) => state.initialize)
  const clearDb = useDatabaseStore((state) => state.clearDatabase)

  useEffect(() => {
    initializeDb()
  }, [initializeDb])

  // Hook de MIDI con auto-recuperación ante desconexión
  const midi = useMidi({
    onNoteOn: (note) => handleNoteRef.current(note),
    onDeviceDisconnected: () => {
      midi.addLog({ type: 'EVAL', message: '⚠️ Hardware MIDI desconectado en caliente.' })
    },
    onDeviceReconnected: () => {
      midi.addLog({ type: 'EVAL', message: '✅ Hardware MIDI re-conectado y re-vinculado.' })
    },
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

  // Atajos de Teclado (Space = Avanzar / R = Repetir)
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

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-4">
      <Header status={midi.status} />

      {/* ALERTA DE DESCONEXIÓN MIDI EN CALIENTE */}
      <MidiDisconnectAlert isDisconnected={midi.isDeviceDisconnected} />

      {/* SELECTOR PRINCIPAL */}
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
          🎵 Nota Individual
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
          📏 Intervalos (2 Notas)
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
          🎼 Secuencias (3 a 6 Notas)
        </button>
        <button
          type="button"
          disabled={isAnySessionActive}
          onClick={(): void => setAppMode('analytics')}
          className={`flex-1 py-2 rounded-md font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 ${
            appMode === 'analytics'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          📊 Historial & IA
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

      {appMode === 'analytics' && <AnalyticsView onLoadPrescription={handleLoadPrescription} />}

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
