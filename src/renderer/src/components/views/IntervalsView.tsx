import React from 'react'
import { UseIntervalTrainerReturn } from '../../hooks/useIntervalTrainer'
import { getIntervalDefinition } from '../../domain/music/intervals'
import { ADVANCE_MODE_OPTIONS, AdvanceMode, SessionLimitType } from '../../domain/exercise/types'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { PianoKeyboard } from '../trainer/PianoKeyboard'
import { IntervalFeedbackPanel } from '../trainer/IntervalFeedbackPanel'
import { IntervalSummaryCard } from '../trainer/IntervalSummaryCard'

interface IntervalsViewProps {
  trainer: UseIntervalTrainerReturn
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

export function IntervalsView({
  trainer,
  pianoKeys,
  pressedNotes,
  stimulusNotes = [],
  onVirtualKeyPress
}: IntervalsViewProps): React.ReactElement {
  const liveActiveNotes = trainer.isSessionActive
    ? trainer.firstNotePlayed !== null
      ? [trainer.firstNotePlayed]
      : trainer.rootRangeNotes
    : trainer.rootRangeNotes

  const getSessionProgressLabel = (): string => {
    if (trainer.sessionLimitType === 'time') {
      return `⏳ Tiempo Restante: ${formatTime(trainer.timeRemainingSeconds)} (Pregunta ${trainer.currentQuestionIndex})`
    }
    if (trainer.sessionLimitType === 'infinite') {
      return `∞ Intervalo ${trainer.currentQuestionIndex}`
    }
    return `Pregunta ${trainer.currentQuestionIndex} / ${trainer.sessionQuestionsCount}`
  }

  return (
    <>
      {trainer.isSessionFinished ? (
        <IntervalSummaryCard
          history={trainer.sessionHistory}
          onRepeatSession={trainer.startSession}
          onTrainWeakOnly={trainer.trainWeakIntervalsOnly}
          onResetToConfig={trainer.resetToConfig}
        />
      ) : (
        <Card className="space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 m-0">
                {trainer.isSessionActive
                  ? getSessionProgressLabel()
                  : 'Configuración: Reconocimiento de Intervalos'}
              </h3>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Intervalos activos:{' '}
                <strong className="text-sky-400">{trainer.activeIntervals.length}</strong> |
                Dirección:{' '}
                <strong className="text-emerald-400">
                  {trainer.directionMode === 'ascending'
                    ? '⬆️ Ascendente'
                    : trainer.directionMode === 'descending'
                      ? '⬇️ Descendente'
                      : '🔀 Mixta'}
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
                  <Button variant="primary" size="sm" onClick={trainer.repeatCurrentInterval}>
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
            <IntervalFeedbackPanel
              isSessionActive={trainer.isSessionActive}
              stimulus={trainer.currentStimulus}
              waitingNoteStep={trainer.waitingNoteStep}
              firstNotePlayed={trainer.firstNotePlayed}
              lastResult={trainer.lastResult}
              isWaitingManualAdvance={trainer.isWaitingManualAdvance}
              onAdvanceNext={trainer.advanceToNextInterval}
            />
          )}

          <div className="space-y-1.5">
            <div className="text-xs text-zinc-400 font-medium">
              {trainer.isSessionActive
                ? trainer.waitingNoteStep === 1
                  ? '🎹 Rango de partida activo (Tocá la 1ª nota en el FP-8 o hacé clic):'
                  : `🎹 1ª Nota (${midiNoteToName(trainer.firstNotePlayed!)}) fijada. Tocá la 2ª nota:`
                : `Rango de Notas Base de Partida (${trainer.rootRangeNotes.length} notas):`}
            </div>
            <PianoKeyboard
              keys={pianoKeys}
              activeNotes={liveActiveNotes}
              pressedNotes={pressedNotes}
              stimulusNotes={stimulusNotes}
              isInteractiveTraining={trainer.isSessionActive}
              onPlayNoteVirtual={onVirtualKeyPress}
              onToggleNote={!trainer.isSessionActive ? trainer.toggleRootNote : undefined}
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
                      className={`text-left p-2 rounded-lg border transition-colors cursor-pointer flex justify-between items-center ${
                        trainer.selectedPresetId === preset.id
                          ? 'bg-sky-950/60 border-sky-600 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs">{preset.name}</div>
                        <div className="text-[10px] text-zinc-400">{preset.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-zinc-400 mb-1.5">
                  Selección Libre de Intervalos ({trainer.activeIntervals.length} activos):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((semitone) => {
                    const active = trainer.activeIntervals.includes(semitone)
                    const def = getIntervalDefinition(semitone)
                    return (
                      <button
                        key={semitone}
                        type="button"
                        onClick={(): void => trainer.toggleInterval(semitone)}
                        className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold transition-colors cursor-pointer border ${
                          active
                            ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                        }`}
                        title={`${def.fullName} (${semitone} semitonos)`}
                      >
                        {def.shortName} ({semitone}st)
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-zinc-800">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Dirección del Intervalo:
                  </label>
                  <select
                    value={trainer.directionMode}
                    onChange={(e): void =>
                      trainer.setDirectionMode(
                        e.target.value as 'ascending' | 'descending' | 'both'
                      )
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                  >
                    <option value="ascending">⬆️ Solo Ascendente</option>
                    <option value="descending">⬇️ Solo Descendente</option>
                    <option value="both">🔀 Mixta</option>
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
