import React from 'react'
import { UseSingleNoteTrainerReturn } from '../../hooks/useSingleNoteTrainer'
import { EXERCISE_PRESETS } from '../../domain/music/presets'
import { AVAILABLE_STRATEGIES } from '../../domain/adaptation/adaptiveEngine'
import { INSTRUMENT_CATALOG } from '../../domain/music/instruments'
import { ADVANCE_MODE_OPTIONS, AdvanceMode, SessionLimitType } from '../../domain/exercise/types'
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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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

  const getSessionProgressLabel = (): string => {
    if (trainer.sessionLimitType === 'time') {
      return `⏳ Tiempo Restante: ${formatTime(trainer.timeRemainingSeconds)} (Pregunta ${trainer.currentQuestionIndex})`
    }
    if (trainer.sessionLimitType === 'mastery') {
      return `🎯 Modo Maestría (Pregunta ${trainer.currentQuestionIndex})`
    }
    if (trainer.sessionLimitType === 'infinite') {
      return `∞ Pregunta ${trainer.currentQuestionIndex}`
    }
    return `Pregunta ${trainer.currentQuestionIndex} / ${trainer.sessionQuestionsCount}`
  }

  return (
    <>
      {trainer.isSessionFinished ? (
        <Card className="border-sky-500/40 bg-zinc-900/90 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-sky-400 m-0">🎉 ¡Sesión Finalizada!</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Diagnóstico guardado ({trainer.selectedInstrument.name}):
              </p>
            </div>
            <div className="flex gap-2">
              {weakNotesList.length >= 2 && (
                <Button variant="danger" onClick={trainer.trainWeakNotesOnly}>
                  🎯 Entrenar Notas Débiles ({weakNotesList.length})
                </Button>
              )}
              <Button variant="primary" onClick={trainer.startSession}>
                🔄 Repetir Sesión
              </Button>
              <Button variant="secondary" onClick={trainer.resetToConfig}>
                ⚙️ Configurar Otra
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
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
        <Card className="space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 m-0">
                {trainer.isSessionActive
                  ? getSessionProgressLabel()
                  : 'Configuración: Reconocimiento de Notas'}
              </h3>
              <div className="text-[11px] text-zinc-400 mt-0.5">
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
                  <Button variant="primary" size="sm" onClick={trainer.repeatCurrentNote}>
                    🔊 Repetir (R)
                  </Button>
                  <Button variant="danger" size="sm" onClick={trainer.stopSession}>
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
              isWaitingManualAdvance={trainer.isWaitingManualAdvance}
              onAdvanceNext={trainer.advanceToNextQuestion}
            />
          )}

          <div className="space-y-1.5">
            <div className="text-xs text-zinc-400 flex justify-between items-center">
              <span>
                {trainer.isSessionActive
                  ? '🎹 Tocá en tu Roland FP-8 o hacé clic en el teclado:'
                  : `Selección Libre (${trainer.activeNotes.length} notas seleccionadas):`}
              </span>
            </div>
            <PianoKeyboard
              keys={pianoKeys}
              activeNotes={trainer.activeNotes}
              pressedNotes={pressedNotes}
              isInteractiveTraining={trainer.isSessionActive}
              onPlayNoteVirtual={onVirtualKeyPress}
              onToggleNote={!trainer.isSessionActive ? trainer.toggleNote : undefined}
              performances={trainer.isSessionActive ? trainer.performances : undefined}
              showHeatmap={trainer.isSessionActive}
            />
          </div>

          {!trainer.isSessionActive && (
            <div className="space-y-3 pt-2">
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

              {/* PANEL DE 4 CONFIGURACIONES INCLUYENDO TIEMPO Y CRITERIO */}
              <div className="grid grid-cols-4 gap-3 pt-2 border-t border-zinc-800">
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
                  <label className="block text-xs text-zinc-400 mb-1">Modo de Avance:</label>
                  <select
                    value={trainer.advanceMode}
                    onChange={(e): void => trainer.setAdvanceMode(e.target.value as AdvanceMode)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                  >
                    {ADVANCE_MODE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Límite de Sesión:</label>
                  <div className="flex gap-1.5">
                    <select
                      value={trainer.sessionLimitType}
                      onChange={(e): void =>
                        trainer.setSessionLimitType(e.target.value as SessionLimitType)
                      }
                      className="w-1/2 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-1.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                    >
                      <option value="questions">Preguntas</option>
                      <option value="time">Por Tiempo</option>
                      <option value="mastery">🎯 Maestría</option>
                      <option value="infinite">∞ Libre</option>
                    </select>

                    {trainer.sessionLimitType === 'questions' && (
                      <select
                        value={trainer.sessionQuestionsCount}
                        onChange={(e): void =>
                          trainer.setSessionQuestionsCount(Number(e.target.value))
                        }
                        className="w-1/2 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-1.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                      >
                        <option value={5}>5 ej.</option>
                        <option value={10}>10 ej.</option>
                        <option value={20}>20 ej.</option>
                      </select>
                    )}

                    {trainer.sessionLimitType === 'time' && (
                      <select
                        value={trainer.sessionDurationMinutes}
                        onChange={(e): void =>
                          trainer.setSessionDurationMinutes(Number(e.target.value))
                        }
                        className="w-1/2 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-1.5 py-1.5 text-xs focus:outline-none focus:border-sky-500 font-semibold text-emerald-400"
                      >
                        <option value={1}>1 min</option>
                        <option value={3}>3 min</option>
                        <option value={5}>5 min</option>
                        <option value={10}>10 min</option>
                        <option value={15}>15 min</option>
                      </select>
                    )}
                  </div>
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
