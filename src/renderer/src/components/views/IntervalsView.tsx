import React, { useState } from 'react'
import { UseIntervalTrainerReturn } from '../../hooks/useIntervalTrainer'
import { getIntervalDefinition } from '../../domain/music/intervals'
import { ADVANCE_MODE_OPTIONS, AdvanceMode, SessionLimitType } from '../../domain/exercise/types'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { PianoKeyboard, KeyboardVisualTheme } from '../trainer/PianoKeyboard'
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
  const [visualTheme, setVisualTheme] = useState<KeyboardVisualTheme>('ghost_neon')

  const liveActiveNotes = trainer.isSessionActive
    ? trainer.firstNotePlayed !== null
      ? [trainer.firstNotePlayed]
      : trainer.rootRangeNotes
    : trainer.rootRangeNotes

  const getSessionProgressLabel = (): string => {
    if (trainer.sessionLimitType === 'time') {
      return `⏳ Tiempo: ${formatTime(trainer.timeRemainingSeconds)} (Pregunta ${trainer.currentQuestionIndex})`
    }
    if (trainer.sessionLimitType === 'infinite') {
      return `∞ Intervalo ${trainer.currentQuestionIndex}`
    }
    return `Pregunta ${trainer.currentQuestionIndex} de ${trainer.sessionQuestionsCount}`
  }

  if (trainer.isSessionFinished) {
    return (
      <IntervalSummaryCard
        history={trainer.sessionHistory}
        onRepeatSession={(): void => trainer.startSession()}
        onTrainWeakOnly={trainer.trainWeakIntervalsOnly}
        onResetToConfig={trainer.resetToConfig}
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* CABECERA DINÁMICA */}
      <div className="flex justify-between items-center bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 px-4 py-2.5 rounded-2xl shadow-lg h-14">
        <div className="flex items-center gap-3 font-mono">
          <span className="px-2 py-0.5 rounded-md bg-sky-950/80 border border-sky-800 text-sky-300 text-xs font-bold">
            MODO 02
          </span>
          <span className="text-xs md:text-sm text-zinc-200 font-semibold">
            {trainer.isSessionActive
              ? getSessionProgressLabel()
              : `Reconocimiento Interválico (${trainer.activeIntervals.length} activos)`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!trainer.isSessionActive ? (
            <Button
              variant="success"
              size="md"
              onClick={(): void => trainer.startSession()}
              className="px-5 py-2 font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              ▶ COMENZAR SESIÓN
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

      {/* DISPLAY OLED HUD */}
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

      {/* PIANO HERO CON SELECTOR DE TEMA VISUAL */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs font-mono text-zinc-400 px-1">
          <span>
            {trainer.isSessionActive
              ? trainer.waitingNoteStep === 1
                ? '🎹 PASO 1: TOCA LA 1ª NOTA (BASE DE PARTIDA):'
                : `🎹 PASO 2: [1ª Nota: ${midiNoteToName(trainer.firstNotePlayed!)}] ➔ TOCA LA 2ª NOTA DEL INTERVALO:`
              : `RANGO DE NOTAS BASE DE PARTIDA (${trainer.rootRangeNotes.length} TONOS):`}
          </span>

          <div className="flex items-center gap-1 bg-zinc-950/90 p-1 rounded-xl border border-zinc-800/80 text-[10px] select-none">
            <span className="text-zinc-500 px-1 uppercase font-semibold">Estilo:</span>
            {[
              ['ghost_neon', '👻 Silueta'],
              ['ambient_glow', '✨ Aura'],
              ['pool_heatmap', '🎨 Pool']
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={(): void => setVisualTheme(mode as KeyboardVisualTheme)}
                className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                  visualTheme === mode
                    ? 'bg-sky-600 text-white shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <PianoKeyboard
          keys={pianoKeys}
          activeNotes={liveActiveNotes}
          pressedNotes={pressedNotes}
          stimulusNotes={stimulusNotes}
          isInteractiveTraining={trainer.isSessionActive}
          onPlayNoteVirtual={onVirtualKeyPress}
          onToggleNote={!trainer.isSessionActive ? trainer.toggleRootNote : undefined}
          visualTheme={visualTheme}
        />
      </div>

      {/* DECK DE CONFIGURACIÓN */}
      {!trainer.isSessionActive && (
        <Card className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-4 space-y-4 rounded-2xl">
          <div>
            <span className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2 font-bold">
              Niveles y Presets Pedagógicos:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {trainer.presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={(): void => trainer.setSelectedPresetId(preset.id)}
                  className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                    trainer.selectedPresetId === preset.id
                      ? 'bg-sky-950/70 border-sky-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs text-zinc-100">{preset.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                      {preset.description}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono text-sky-400 shrink-0 ml-2">
                    {preset.intervalSemitones.length} int.
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800/80">
            <span className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2 font-bold">
              Selección Manual de Intervalos:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((semitone) => {
                const active = trainer.activeIntervals.includes(semitone)
                const def = getIntervalDefinition(semitone)
                return (
                  <button
                    key={semitone}
                    type="button"
                    onClick={(): void => trainer.toggleInterval(semitone)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                      active
                        ? 'bg-sky-600 border-sky-400 text-white shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                    title={`${def.fullName} (${semitone} semitonos)`}
                  >
                    {def.shortName} <span className="text-[10px] opacity-75">({semitone}st)</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono">
            <div>
              <label className="block text-xs uppercase text-zinc-400 mb-1 font-bold">
                Dirección del Intervalo:
              </label>
              <select
                value={trainer.directionMode}
                onChange={(e): void =>
                  trainer.setDirectionMode(e.target.value as 'ascending' | 'descending' | 'both')
                }
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
              >
                <option value="ascending">⬆️ Solo Ascendente</option>
                <option value="descending">⬇️ Solo Descendente</option>
                <option value="both">🔀 Mixta (Aleatoria)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase text-zinc-400 mb-1 font-bold">
                Modo de Avance:
              </label>
              <select
                value={trainer.advanceMode}
                onChange={(e): void => trainer.setAdvanceMode(e.target.value as AdvanceMode)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
              >
                {ADVANCE_MODE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase text-zinc-400 mb-1 font-bold">
                Criterio de Fin:
              </label>
              <div className="flex gap-1.5">
                <select
                  value={trainer.sessionLimitType}
                  onChange={(e): void =>
                    trainer.setSessionLimitType(e.target.value as SessionLimitType)
                  }
                  className="w-1/2 bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                >
                  <option value="questions">Preguntas</option>
                  <option value="time">Por Tiempo</option>
                  <option value="infinite">∞ Libre</option>
                </select>

                {trainer.sessionLimitType === 'questions' && (
                  <select
                    value={trainer.sessionQuestionsCount}
                    onChange={(e): void => trainer.setSessionQuestionsCount(Number(e.target.value))}
                    className="w-1/2 bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
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
                    className="w-1/2 bg-zinc-950 border border-zinc-800 text-emerald-400 font-bold rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                  >
                    <option value={1}>1 min</option>
                    <option value={3}>3 min</option>
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TELEMETRÍA EN VIVO */}
      {trainer.isSessionActive && (
        <div className="grid grid-cols-3 gap-2.5 font-mono text-center select-none">
          <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80">
            <span className="text-xs uppercase tracking-wider text-zinc-500 block font-bold">
              Progreso
            </span>
            <strong className="text-sm text-zinc-200">
              {trainer.sessionHistory.length} / {trainer.sessionQuestionsCount}
            </strong>
          </div>

          <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80">
            <span className="text-xs uppercase tracking-wider text-zinc-500 block font-bold">
              Intervalos Exactos
            </span>
            <strong className="text-sm text-emerald-400">
              {trainer.sessionHistory.filter((h) => h.isIntervalCorrect).length} aciertos
            </strong>
          </div>

          <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80">
            <span className="text-xs uppercase tracking-wider text-zinc-500 block font-bold">
              Dirección
            </span>
            <strong className="text-sm text-sky-400">
              {trainer.directionMode === 'ascending'
                ? '⬆️ Ascendente'
                : trainer.directionMode === 'descending'
                  ? '⬇️ Descendente'
                  : '🔀 Mixta'}
            </strong>
          </div>
        </div>
      )}
    </div>
  )
}
