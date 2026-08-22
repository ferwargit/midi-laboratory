import React, { useRef, useEffect, useState, useCallback } from 'react'
import { generateMidiRange, midiNoteToName } from './domain/music/noteUtils'
import { VisualCueMode } from './domain/exercise/visualAudioSync'
import { useMidi } from './hooks/useMidi'
import { useSingleNoteTrainer } from './hooks/useSingleNoteTrainer'
import { useIntervalTrainer } from './hooks/useIntervalTrainer'
import { useSequenceTrainer } from './hooks/useSequenceTrainer'
import { useDatabaseStore } from './stores/useDatabaseStore'
import { StudioTopBar } from './components/trainer/StudioTopBar'
import { StudioBottomDock } from './components/trainer/StudioBottomDock'
import { MidiDisconnectAlert } from './components/trainer/MidiDisconnectAlert'
import { SingleNoteView } from './components/views/SingleNoteView'
import { IntervalsView } from './components/views/IntervalsView'
import { SequencesView } from './components/views/SequencesView'
import { AnalyticsView } from './components/views/AnalyticsView'
import { ConfirmModal } from './components/ui/ConfirmModal'
import { AiExercisePrescription } from './domain/ai/types'

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6 (37 teclas)
type AppMode = 'single_note' | 'intervals' | 'sequences' | 'analytics'

export default function App(): React.ReactElement {
  const [appMode, setAppMode] = useState<AppMode>('single_note')
  const [visualCueMode, setVisualCueMode] = useState<VisualCueMode>('blind')
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

  // Atajos de Teclado con filtro inteligente de campos de texto
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      // Si el usuario está escribiendo en el chat o buscador, no capturar las teclas
      if (isTyping) {
        return
      }

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

  const liveStimulusNotes = visualCueMode === 'assisted' ? midi.activeStimulusNotes : []

  return (
    // Ampliado a max-w-[1540px] para ocupar con elegancia los monitores panorámicos
    <div className="min-h-screen flex flex-col justify-between p-4 md:p-6 max-w-[1540px] w-full mx-auto space-y-3 font-sans">
      {/* 1. MASTER TOPBAR */}
      <StudioTopBar
        appMode={appMode}
        onSelectMode={(m): void => setAppMode(m)}
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
