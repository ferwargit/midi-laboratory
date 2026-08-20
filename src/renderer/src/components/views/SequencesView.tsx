import React from 'react'
import { UseSequenceTrainerReturn } from '../../hooks/useSequenceTrainer'
import { ADVANCE_MODE_OPTIONS, AdvanceMode, SessionLimitType } from '../../domain/exercise/types'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { PianoKeyboard } from '../trainer/PianoKeyboard'
import { SequenceFeedbackPanel } from '../trainer/SequenceFeedbackPanel'
import { SequenceSummaryCard } from '../trainer/SequenceSummaryCard'

interface SequencesViewProps {
  trainer: UseSequenceTrainerReturn
  pianoKeys: number[]
  pressedNotes: number[]
  stimulusNotes?: number[]
  onVirtualKeyPress?: (note: number) => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function SequencesView({
  trainer,
  pianoKeys,
  pressedNotes,
  stimulusNotes = [],
  onVirtualKeyPress
}: SequencesViewProps): React.ReactElement {
  const getSessionProgressLabel = (): string => {
    if (trainer.sessionLimitType === 'time') {
      return `⏳ Tiempo Restante: ${formatTime(trainer.timeRemainingSeconds)} (Frase ${trainer.currentQuestionIndex})`
    }
    if (trainer.sessionLimitType === 'infinite') {
      return `∞ Frase ${trainer.currentQuestionIndex}`
    }
    return `Frase ${trainer.currentQuestionIndex} / ${trainer.sessionQuestionsCount}`
  }

  return (
    <>
      {trainer.isSessionFinished ? (
        <SequenceSummaryCard
          history={trainer.sessionHistory}
          onRepeatSession={trainer.startSession}
          onTrainWeakOnly={trainer.trainWeakMotifsOnly}
          onResetToConfig={trainer.resetToConfig}
        />
      ) : (
        <Card className="space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 m-0">
                {trainer.isSessionActive
                  ? getSessionProgressLabel()
                  : 'Configuración: Memoria Melódica / Secuencias'}
              </h3>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Longitud: <strong className="text-sky-400">{trainer.sequenceLength} notas</strong> |
                Notas activas:{' '}
                <strong className="text-emerald-400">{trainer.customCandidateNotes.length}</strong>
              </div>
            </div>

            <div className="flex gap-2">
              {!trainer.isSessionActive ? (
                <Button variant="success" onClick={trainer.startSession}>
                  ▶ Comenzar Sesión
                </Button>
              ) : (
                <>
                  <Button variant="primary" size="sm" onClick={trainer.repeatCurrentSequence}>
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
            <SequenceFeedbackPanel
              isSessionActive={trainer.isSessionActive}
              expectedLength={trainer.sequenceLength}
              capturedNotes={trainer.capturedNotes}
              lastResult={trainer.lastResult}
              isWaitingManualAdvance={trainer.isWaitingManualAdvance}
              onAdvanceNext={trainer.advanceToNextSequence}
            />
          )}

          <div className="space-y-1.5">
            <div className="text-xs text-zinc-400 font-medium">
              {trainer.isSessionActive
                ? `🎹 Tocá en tu Roland FP-8 o hacé clic (${trainer.capturedNotes.length}/${trainer.sequenceLength} notas):`
                : `Selección Libre de Notas Candidatas (${trainer.customCandidateNotes.length} activas):`}
            </div>
            <PianoKeyboard
              keys={pianoKeys}
              activeNotes={trainer.customCandidateNotes}
              pressedNotes={pressedNotes}
              stimulusNotes={stimulusNotes}
              isInteractiveTraining={trainer.isSessionActive}
              onPlayNoteVirtual={onVirtualKeyPress}
              onToggleNote={!trainer.isSessionActive ? trainer.toggleCustomNote : undefined}
            />
          </div>

          {!trainer.isSessionActive && (
            <div className="space-y-4 pt-2">
              <div>
                <div className="text-xs text-zinc-400 mb-1.5">Presets Pedagógicos:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {trainer.presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={(): void => trainer.setSelectedPresetId(preset.id)}
                      className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer flex justify-between items-center ${
                        trainer.selectedPresetId === preset.id
                          ? 'bg-sky-950/60 border-sky-600 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs">{preset.name}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{preset.description}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-mono shrink-0 ml-2">
                        {preset.length} notas
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-zinc-800">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Longitud de Secuencia:</label>
                  <select
                    value={trainer.sequenceLength}
                    onChange={(e): void => trainer.setSequenceLength(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                  >
                    <option value={3}>3 notas (Motivos cortos)</option>
                    <option value={4}>4 notas (Frases estándar)</option>
                    <option value={5}>5 notas (Arpegios y melodías)</option>
                    <option value={6}>6 notas (Memoria avanzada)</option>
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
    </>
  )
}
