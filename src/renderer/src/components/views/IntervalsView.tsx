import React from 'react'
import { UseIntervalTrainerReturn } from '../../hooks/useIntervalTrainer'
import { getIntervalDefinition } from '../../domain/music/intervals'
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
}

export function IntervalsView({
  trainer,
  pianoKeys,
  pressedNotes
}: IntervalsViewProps): React.ReactElement {
  const liveActiveNotes = trainer.isSessionActive
    ? trainer.firstNotePlayed !== null
      ? [trainer.firstNotePlayed]
      : trainer.rootRangeNotes
    : trainer.rootRangeNotes

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
        <Card>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-100 m-0">
                {trainer.isSessionActive
                  ? `Pregunta ${trainer.currentQuestionIndex} / ${trainer.sessionLength === 0 ? '∞' : trainer.sessionLength}`
                  : 'Configuración: Reconocimiento de Intervalos'}
              </h3>
              <div className="text-xs text-zinc-400 mt-0.5">
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
                  ▶ Comenzar Sesión de Intervalos
                </Button>
              ) : (
                <>
                  <Button variant="primary" onClick={trainer.repeatCurrentInterval}>
                    🔊 Repetir Intervalo
                  </Button>
                  <Button variant="danger" onClick={trainer.stopSession}>
                    ⏹ Detener y Guardar
                  </Button>
                </>
              )}
            </div>
          </div>

          <IntervalFeedbackPanel
            isSessionActive={trainer.isSessionActive}
            stimulus={trainer.currentStimulus}
            waitingNoteStep={trainer.waitingNoteStep}
            firstNotePlayed={trainer.firstNotePlayed}
            lastResult={trainer.lastResult}
          />

          {trainer.isSessionActive && (
            <div className="space-y-1.5 mb-3">
              <div className="text-xs text-zinc-400 font-medium">
                {trainer.waitingNoteStep === 1
                  ? '🎹 Rango de partida activo (Tocá la primera nota):'
                  : `🎹 1ª Nota (${midiNoteToName(trainer.firstNotePlayed!)}) fijada. Tocá la 2ª nota en el piano:`}
              </div>
              <PianoKeyboard
                keys={pianoKeys}
                activeNotes={liveActiveNotes}
                pressedNotes={pressedNotes}
                onToggleNote={() => {}}
                disabled={true}
              />
            </div>
          )}

          {!trainer.isSessionActive && (
            <div className="space-y-4">
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

              <div>
                <div className="text-xs text-zinc-400 mb-1.5">
                  Rango de Notas Base de Partida ({trainer.rootRangeNotes.length} notas
                  seleccionadas):
                </div>
                <PianoKeyboard
                  keys={pianoKeys}
                  activeNotes={trainer.rootRangeNotes}
                  pressedNotes={pressedNotes}
                  onToggleNote={trainer.toggleRootNote}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
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
                    <option value="ascending">⬆️ Solo Ascendente (Grave → Aguda)</option>
                    <option value="descending">⬇️ Solo Descendente (Aguda → Grave)</option>
                    <option value="both">🔀 Mixta (Ascendente y Descendente al azar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Preguntas por sesión:</label>
                  <select
                    value={trainer.sessionLength}
                    onChange={(e): void => trainer.setSessionLength(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                  >
                    <option value={5}>5 ejercicios</option>
                    <option value={10}>10 ejercicios</option>
                    <option value={20}>20 ejercicios</option>
                    <option value={0}>∞ Práctica Libre</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  )
}
