import React from 'react'
import { UseSingleNoteTrainerReturn } from '../../hooks/useSingleNoteTrainer'
import { EXERCISE_PRESETS } from '../../domain/music/presets'
import { AVAILABLE_STRATEGIES } from '../../domain/adaptation/adaptiveEngine'
import { INSTRUMENT_CATALOG } from '../../domain/music/instruments'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { StatCard } from '../ui/StatCard'
import { PianoKeyboard } from '../trainer/PianoKeyboard'
import { FeedbackPanel } from '../trainer/FeedbackPanel'

interface SingleNoteViewProps {
  trainer: UseSingleNoteTrainerReturn
  pianoKeys: number[]
  pressedNotes: number[]
  onVirtualKeyPress?: (note: number) => void
}

export function SingleNoteView({
  trainer,
  pianoKeys,
  pressedNotes,
  onVirtualKeyPress
}: SingleNoteViewProps): React.ReactElement {
  const weakNotesList = Array.from(trainer.performances.values())
    .filter((p) => p.attempts > 0 && p.accuracyPercentage < 85)
    .map((p) => ({
      name: midiNoteToName(p.noteNumber),
      accuracy: p.accuracyPercentage,
      attempts: p.attempts
    }))

  return (
    <>
      {trainer.isSessionFinished ? (
        <Card className="border-sky-500/40 bg-zinc-900/90">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-sky-400 m-0">🎉 ¡Sesión Finalizada!</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Diagnóstico guardado ({trainer.selectedInstrument.name}):
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

          <div className="space-y-2 mb-4">
            <PianoKeyboard
              keys={pianoKeys}
              activeNotes={trainer.activeNotes}
              pressedNotes={pressedNotes}
              performances={trainer.performances}
              showHeatmap={true}
              disabled={true}
            />
          </div>

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
              🌟 ¡Excelente rendimiento! Todas las notas fueron reconocidas con alta precisión
              (&gt;85%).
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-100 m-0">
                {trainer.isSessionActive
                  ? `Pregunta ${trainer.currentQuestionIndex} / ${
                      trainer.sessionLength === -1
                        ? '🎯 Modo Maestría'
                        : trainer.sessionLength === 0
                          ? '∞'
                          : trainer.sessionLength
                    }`
                  : 'Configuración: Reconocimiento de Notas'}
              </h3>
              <div className="text-xs text-zinc-400 mt-0.5">
                Timbre:{' '}
                <strong className="text-emerald-400">{trainer.selectedInstrument.name}</strong> |
                Motor:{' '}
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
                    ⏹ Detener y Guardar
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

          {/* TECLADO EN VIVO: HACE CLIC EN LA TECLA PARA RESPONDER CON EL MOUSE */}
          {trainer.isSessionActive && (
            <div className="space-y-1.5 mb-3">
              <div className="text-xs text-zinc-400 flex justify-between items-center">
                <span>
                  🎹 Tocá en tu Roland FP-8 o hacé clic en el piano virtual para responder:
                </span>
              </div>
              <PianoKeyboard
                keys={pianoKeys}
                activeNotes={trainer.activeNotes}
                pressedNotes={pressedNotes}
                isInteractiveTraining={true}
                onPlayNoteVirtual={onVirtualKeyPress}
                performances={trainer.performances}
                showHeatmap={true}
              />
            </div>
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
                  Selección Libre de Teclas (C3 a C6 - {trainer.activeNotes.length} notas
                  seleccionadas):
                </div>
                <PianoKeyboard
                  keys={pianoKeys}
                  activeNotes={trainer.activeNotes}
                  pressedNotes={pressedNotes}
                  onToggleNote={trainer.toggleNote}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-zinc-800">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Timbre / Instrumento:</label>
                  <select
                    value={trainer.selectedInstrument.id}
                    onChange={(e): void => trainer.setSelectedInstrumentId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                  >
                    {INSTRUMENT_CATALOG.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Motor de Adaptabilidad:
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
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Criterio de Sesión:</label>
                  <select
                    value={trainer.sessionLength}
                    onChange={(e): void => trainer.setSessionLength(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                  >
                    <option value={5}>5 ejercicios</option>
                    <option value={10}>10 ejercicios</option>
                    <option value={20}>20 ejercicios</option>
                    <option value={-1}>🎯 Modo Maestría (Hasta dominar en verde)</option>
                    <option value={0}>∞ Práctica Libre</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-4 gap-3">
        <StatCard title="Respuestas (Sesión)" value={trainer.stats.totalAnswers} />
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
    </>
  )
}
