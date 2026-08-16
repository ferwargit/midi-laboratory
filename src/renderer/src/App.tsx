import React, { useRef, useEffect } from 'react'
import { generateMidiRange, midiNoteToName } from './domain/music/noteUtils'
import { EXERCISE_PRESETS } from './domain/music/presets'
import { AVAILABLE_STRATEGIES } from './domain/adaptation/adaptiveEngine'
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

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6 (37 teclas)

export default function App(): React.ReactElement {
  const handleNoteRef = useRef<(note: number) => void>(() => {})

  const midi = useMidi({
    onNoteOn: (note) => handleNoteRef.current(note),
    enableSoftwareThru: true
  })

  const trainer = useSingleNoteTrainer({
    onPlayStimulus: (note) => midi.sendNote(note)
  })

  useEffect(() => {
    handleNoteRef.current = trainer.handleUserNotePlayed
  }, [trainer.handleUserNotePlayed])

  // Obtener notas débiles de la sesión para el diagnóstico
  const weakNotesList = Array.from(trainer.performances.values())
    .filter((p) => p.attempts > 0 && p.accuracyPercentage < 85)
    .map((p) => ({
      name: midiNoteToName(p.noteNumber),
      accuracy: p.accuracyPercentage,
      attempts: p.attempts
    }))

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

      {/* 1. PANTALLA DE RESUMEN FINAL (Al terminar la sesión) */}
      {trainer.isSessionFinished ? (
        <Card className="border-sky-500/40 bg-zinc-900/90">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-sky-400 m-0">🎉 ¡Sesión Finalizada!</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Diagnóstico del Perfil Auditivo según tus respuestas:
              </p>
            </div>
            <div className="flex gap-2">
              {weakNotesList.length >= 2 && (
                <Button variant="danger" onClick={trainer.trainWeakNotesOnly}>
                  🎯 Entrenar Solo Notas Débiles ({weakNotesList.length})
                </Button>
              )}
              <Button variant="primary" onClick={trainer.startSession}>
                🔄 Repetir Misma Sesión
              </Button>
              <Button variant="secondary" onClick={trainer.resetToConfig}>
                ⚙️ Configurar Otra Sesión
              </Button>
            </div>
          </div>

          {/* Heatmap del resultado final */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Mapa de Calor Final:</span>
              <div className="flex gap-3 text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Dominada
                  (&gt;85%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> En progreso
                  (50-85%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> A reforzar
                  (&lt;50%)
                </span>
              </div>
            </div>
            <PianoKeyboard
              keys={PIANO_KEYS}
              activeNotes={trainer.activeNotes}
              onToggleNote={() => {}}
              performances={trainer.performances}
              showHeatmap={true}
              disabled={true}
            />
          </div>

          {/* Diagnóstico de debilidades */}
          {weakNotesList.length > 0 ? (
            <div className="bg-zinc-950 p-3 rounded border border-red-900/40 text-xs">
              <strong className="text-red-400 block mb-1">Notas prioritarias a reforzar:</strong>
              <div className="flex flex-wrap gap-2">
                {weakNotesList.map((item) => (
                  <span
                    key={item.name}
                    className="bg-red-950/60 border border-red-800 text-red-300 px-2 py-0.5 rounded"
                  >
                    {item.name}: {item.accuracy}% acierto ({item.attempts} intentos)
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded text-xs text-emerald-300">
              🌟 ¡Excelente rendimiento! Todas las notas de la sesión fueron reconocidas con alta
              precisión (&gt;85%).
            </div>
          )}
        </Card>
      ) : (
        /* 2. PANTALLA DE ENTRENAMIENTO O CONFIGURACIÓN */
        <Card>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-100 m-0">
                {trainer.isSessionActive
                  ? `Pregunta ${trainer.currentQuestionIndex} / ${trainer.sessionLength === 0 ? '∞' : trainer.sessionLength}`
                  : 'Configuración del Entrenamiento'}
              </h3>
              <div className="text-xs text-zinc-400 mt-0.5">
                Motor activo:{' '}
                <strong className="text-sky-400">
                  {AVAILABLE_STRATEGIES.find((s) => s.id === trainer.selectedStrategyId)?.name}
                </strong>
              </div>
            </div>

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

          {/* HEATMAP EN VIVO DURANTE LA SESIÓN */}
          {trainer.isSessionActive && (
            <div className="space-y-1.5 mb-3">
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Mapa de Precisión en Vivo:</span>
                <div className="flex gap-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Dominada
                    (&gt;85%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> En progreso
                    (50-85%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> A reforzar
                    (&lt;50%)
                  </span>
                </div>
              </div>
              <PianoKeyboard
                keys={PIANO_KEYS}
                activeNotes={trainer.activeNotes}
                onToggleNote={() => {}}
                performances={trainer.performances}
                showHeatmap={true}
                disabled={true}
              />
            </div>
          )}

          {/* PANEL DE CONFIGURACIÓN PREVIA */}
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
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={(): void => trainer.setActiveNotes([])}
                  >
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

              <div className="grid grid-cols-2 gap-4 pt-1 border-t border-zinc-800">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Motor de Adaptabilidad / IA:
                  </label>
                  <select
                    value={trainer.selectedStrategyId}
                    onChange={(e): void =>
                      trainer.setSelectedStrategyId(e.target.value as 'random' | 'adaptive_v1')
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                  >
                    {AVAILABLE_STRATEGIES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} - {st.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Ejercicios por sesión:</label>
                  <select
                    value={trainer.sessionLength}
                    onChange={(e): void => trainer.setSessionLength(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                  >
                    <option value={5}>5 ejercicios</option>
                    <option value={10}>10 ejercicios</option>
                    <option value={20}>20 ejercicios</option>
                    <option value={0}>Infinito (Práctica libre)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

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
