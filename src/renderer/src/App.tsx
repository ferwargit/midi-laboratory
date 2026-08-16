import React, { useRef, useEffect } from 'react'
import { generateMidiRange } from './domain/music/noteUtils'
import { EXERCISE_PRESETS } from './domain/music/presets'
import { useMidi } from './hooks/useMidi'
import { useSingleNoteTrainer } from './hooks/useSingleNoteTrainer'
import { Card } from './components/ui/Card'
import { Button } from './components/ui/Button'
import { StatCard } from './components/ui/StatCard'
import { Header } from './components/trainer/Header'
import { MidiDeviceSelect } from './components/trainer/MidiDeviceSelect'
import { PianoKeyboard } from './components/trainer/PianoKeyboard'
import { FeedbackPanel } from './components/trainer/FeedbackPanel'
import { MidiMonitor } from './components/trainer/MidiMonitor'

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6

export default function App(): React.ReactElement {
  // Referencia mutable para resolver la dependencia circular limpiamente
  const handleNoteRef = useRef<(note: number) => void>(() => {})

  const midi = useMidi({
    onNoteOn: (note) => handleNoteRef.current(note),
    enableSoftwareThru: true
  })

  const trainer = useSingleNoteTrainer({
    onPlayStimulus: (note) => midi.sendNote(note)
  })

  // Sincronizamos la referencia con la función del entrenador
  useEffect(() => {
    handleNoteRef.current = trainer.handleUserNotePlayed
  }, [trainer.handleUserNotePlayed])

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-4">
      <Header status={midi.status} />

      <MidiDeviceSelect
        inputs={midi.inputs}
        outputs={midi.outputs}
        selectedInputId={midi.selectedInputId}
        selectedOutputId={midi.selectedOutputId}
        onSelectInput={midi.setSelectedInputId}
        onSelectOutput={midi.setSelectedOutputId}
        disabled={trainer.isSessionActive}
      />

      {/* PANEL DE ENTRENAMIENTO */}
      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-semibold text-zinc-100 m-0">
            {trainer.isSessionActive
              ? `Pregunta ${trainer.currentQuestionIndex} / ${trainer.sessionLength === 0 ? '∞' : trainer.sessionLength}`
              : 'Configuración del Entrenamiento'}
          </h3>
          <div className="flex gap-2">
            {!trainer.isSessionActive ? (
              <Button variant="success" onClick={trainer.startSession}>
                ▶ Comenzar Sesión
              </Button>
            ) : (
              <>
                <Button variant="primary" onClick={trainer.repeatCurrentNote}>
                  🔊 Repetir Nota
                </Button>
                <Button variant="danger" onClick={trainer.stopSession}>
                  ⏹ Detener
                </Button>
              </>
            )}
          </div>
        </div>

        {trainer.isSessionActive && (
          <FeedbackPanel
            isWaitingAnswer={trainer.isWaitingAnswer}
            lastResult={trainer.lastResult}
          />
        )}

        {!trainer.isSessionActive && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-zinc-400 mb-1.5">Presets Rápidos:</div>
              <div className="flex flex-wrap gap-1.5">
                {EXERCISE_PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant="secondary"
                    onClick={(): void => trainer.setActiveNotes(p.notes)}
                  >
                    {p.name}
                  </Button>
                ))}
                <Button size="sm" variant="danger" onClick={(): void => trainer.setActiveNotes([])}>
                  Limpiar Todo
                </Button>
              </div>
            </div>

            <div>
              <div className="text-xs text-zinc-400 mb-1.5">
                Selección Libre (C3 a C6 - {trainer.activeNotes.length} notas seleccionadas):
              </div>
              <PianoKeyboard
                keys={PIANO_KEYS}
                activeNotes={trainer.activeNotes}
                onToggleNote={trainer.toggleNote}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="text-xs text-zinc-400">Ejercicios por sesión:</label>
              <select
                value={trainer.sessionLength}
                onChange={(e): void => trainer.setSessionLength(Number(e.target.value))}
                className="bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1 text-xs"
              >
                <option value={5}>5 ejercicios</option>
                <option value={10}>10 ejercicios</option>
                <option value={20}>20 ejercicios</option>
                <option value={0}>Infinito (Práctica libre)</option>
              </select>
            </div>
          </div>
        )}
      </Card>

      {/* DASHBOARD DE ESTADÍSTICAS */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard title="Respuestas" value={trainer.stats.totalAnswers} />
        <StatCard
          title="Precisión"
          value={`${trainer.stats.accuracyPercentage}%`}
          highlightColor={
            trainer.stats.accuracyPercentage >= 80
              ? 'text-emerald-400'
              : trainer.stats.accuracyPercentage >= 50
                ? 'text-amber-400'
                : 'text-red-400'
          }
        />
        <StatCard
          title="Aciertos / Fallos"
          value={`${trainer.stats.correctAnswers} / ${trainer.stats.totalAnswers - trainer.stats.correctAnswers}`}
        />
        <StatCard
          title="Tiempo Medio"
          value={`${(trainer.stats.avgResponseTimeMs / 1000).toFixed(2)}s`}
        />
      </div>

      <MidiMonitor logs={midi.logs} />
    </div>
  )
}
