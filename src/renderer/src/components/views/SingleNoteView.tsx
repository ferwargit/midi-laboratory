import React from 'react'
import { UseSingleNoteTrainerReturn } from '../../hooks/useSingleNoteTrainer'
import { EXERCISE_PRESETS } from '../../domain/music/presets'
import { AVAILABLE_STRATEGIES } from '../../domain/adaptation/adaptiveEngine'
import { StrategyId } from '../../domain/adaptation/types'
import { INSTRUMENT_CATALOG } from '../../domain/music/instruments'
import { ADVANCE_MODE_OPTIONS, AdvanceMode, SessionLimitType } from '../../domain/exercise/types'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { PianoKeyboard } from '../trainer/PianoKeyboard'
import { FeedbackPanel } from '../trainer/FeedbackPanel'

interface SingleNoteViewProps {
  trainer: UseSingleNoteTrainerReturn
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

export function SingleNoteView({
  trainer,
  pianoKeys,
  pressedNotes,
  stimulusNotes = [],
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
      return `⏳ Tiempo: ${formatTime(trainer.timeRemainingSeconds)} (Pregunta ${trainer.currentQuestionIndex})`
    }
    if (trainer.sessionLimitType === 'mastery') {
      return `🎯 Modo Maestría (Pregunta ${trainer.currentQuestionIndex})`
    }
    if (trainer.sessionLimitType === 'infinite') {
      return `∞ Pregunta ${trainer.currentQuestionIndex}`
    }
    return `Pregunta ${trainer.currentQuestionIndex} de ${trainer.sessionQuestionsCount}`
  }

  // 1. PANTALLA DE RESULTADOS / RESUMEN
  if (trainer.isSessionFinished) {
    return (
      <Card className="border-sky-500/30 bg-zinc-900/80 backdrop-blur-2xl space-y-4 shadow-2xl">
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-bold text-sky-400 m-0 tracking-tight">
              🎉 Sesión Completada ({trainer.selectedInstrument.name})
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Diagnóstico psicométrico almacenado en la memoria local:
            </p>
          </div>
          <div className="flex gap-2">
            {weakNotesList.length >= 2 && (
              <Button variant="danger" size="sm" onClick={trainer.trainWeakNotesOnly}>
                🎯 Reforzar Débiles ({weakNotesList.length})
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={trainer.startSession}>
              🔄 Repetir Sesión
            </Button>
            <Button variant="secondary" size="sm" onClick={trainer.resetToConfig}>
              ⚙️ Reconfigurar
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs text-zinc-400 px-1 font-mono">
            <span>MAPA DE CALOR POR TONO:</span>
            <div className="flex gap-3 text-[10px]">
              <span className="text-emerald-400">● Dominada (&gt;85%)</span>
              <span className="text-amber-400">● En progreso (50-85%)</span>
              <span className="text-rose-400">● A reforzar (&lt;50%)</span>
            </div>
          </div>
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
          <div className="bg-zinc-950/80 p-3 rounded-xl border border-rose-900/40 text-xs">
            <strong className="text-rose-400 block mb-1 font-mono uppercase text-[10px] tracking-wider">
              Puntos ciegos prioritarios a reforzar:
            </strong>
            <div className="flex flex-wrap gap-1.5">
              {weakNotesList.map((item) => (
                <span
                  key={item.name}
                  className="bg-rose-950/60 border border-rose-800 text-rose-300 px-2.5 py-0.5 rounded-lg text-xs font-mono"
                >
                  {item.name}: <strong>{item.accuracy}%</strong> ({item.attempts} intentos)
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded-xl text-xs text-emerald-300 font-mono">
            🌟 Discriminación perfecta: Todas las notas superaron el umbral de maestría (&gt;85%).
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* 2. CABECERA DE SESIÓN DINÁMICA */}
      <div className="flex justify-between items-center bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 px-4 py-2.5 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3 font-mono">
          <span className="px-2 py-0.5 rounded-md bg-sky-950/80 border border-sky-800 text-sky-300 text-[10px] font-bold">
            MODO 01
          </span>
          <span className="text-xs text-zinc-300 font-semibold">
            {trainer.isSessionActive
              ? getSessionProgressLabel()
              : 'Discriminación de Altura Absoluta'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!trainer.isSessionActive ? (
            <Button
              variant="success"
              size="md"
              onClick={trainer.startSession}
              className="px-5 py-2 font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              ▶ COMENZAR SESIÓN
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

      {/* 3. DISPLAY OLED HUD (SOLO VISIBLE CUANDO HAY SESIÓN ACTIVA) */}
      {trainer.isSessionActive && (
        <FeedbackPanel
          isWaitingAnswer={trainer.isWaitingAnswer}
          lastResult={trainer.lastResult}
          isWaitingManualAdvance={trainer.isWaitingManualAdvance}
          onAdvanceNext={trainer.advanceToNextQuestion}
        />
      )}

      {/* 4. PIANO HERO CENTRAL */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400 px-1">
          <span>
            {trainer.isSessionActive
              ? '🎹 ENTRADA MIDI EN VIVO (TOCA EN EL FP-8 O CLIC VIRTUAL):'
              : `SELECCIÓN DE NOTAS ACTIVAS (${trainer.activeNotes.length} TONOS ACTIVOS):`}
          </span>
          {!trainer.isSessionActive && (
            <span className="text-[10px] text-zinc-500">
              Haz clic para activar/desactivar notas
            </span>
          )}
        </div>

        <PianoKeyboard
          keys={pianoKeys}
          activeNotes={trainer.activeNotes}
          pressedNotes={pressedNotes}
          stimulusNotes={stimulusNotes}
          isInteractiveTraining={trainer.isSessionActive}
          onPlayNoteVirtual={onVirtualKeyPress}
          onToggleNote={!trainer.isSessionActive ? trainer.toggleNote : undefined}
          performances={trainer.isSessionActive ? trainer.performances : undefined}
          showHeatmap={trainer.isSessionActive}
        />
      </div>

      {/* 5. DECK DE CONFIGURACIÓN (SOLO CUANDO NO HAY SESIÓN ACTIVA) */}
      {!trainer.isSessionActive && (
        <Card className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-4 space-y-4 rounded-2xl">
          {/* PRESETS RÁPIDOS */}
          <div>
            <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2 font-bold">
              Escalas y Presets Pedagógicos:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {EXERCISE_PRESETS.map((p) => {
                const isSelected =
                  p.notes.length === trainer.activeNotes.length &&
                  p.notes.every((n) => trainer.activeNotes.includes(n))

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(): void => trainer.setActiveNotes(p.notes)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-sky-600 border-sky-400 text-white font-bold shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {p.name}
                  </button>
                )
              })}

              <button
                type="button"
                onClick={(): void => trainer.setActiveNotes([])}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-950/30 border border-rose-900/40 hover:bg-rose-900/50 cursor-pointer ml-auto"
              >
                Limpiar Selección
              </button>
            </div>
          </div>

          {/* PARÁMETROS EN REJILLA */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono">
            <div>
              <label className="block text-[10px] uppercase text-zinc-400 mb-1 font-bold">
                Timbre / Instrumento:
              </label>
              <select
                value={trainer.selectedInstrument.id}
                onChange={(e): void => trainer.setSelectedInstrumentId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
              >
                {INSTRUMENT_CATALOG.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase text-zinc-400 mb-1 font-bold">
                Motor de Adaptabilidad:
              </label>
              <select
                value={trainer.selectedStrategyId}
                onChange={(e): void => trainer.setSelectedStrategyId(e.target.value as StrategyId)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
              >
                {AVAILABLE_STRATEGIES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase text-zinc-400 mb-1 font-bold">
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
              <label className="block text-[10px] uppercase text-zinc-400 mb-1 font-bold">
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
                  <option value="mastery">Maestría</option>
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

      {/* 6. TELEMETRÍA EN VIVO (DURANTE LA SESIÓN) */}
      {trainer.isSessionActive && (
        <div className="grid grid-cols-4 gap-2.5 font-mono text-center select-none">
          <div className="bg-zinc-950/80 p-2 rounded-xl border border-zinc-800/80">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
              Respuestas
            </span>
            <strong className="text-sm text-zinc-200">{trainer.stats.totalAnswers}</strong>
          </div>

          <div className="bg-zinc-950/80 p-2 rounded-xl border border-zinc-800/80">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
              Precisión Oído
            </span>
            <strong
              className={`text-sm ${
                trainer.stats.accuracyPercentage >= 80
                  ? 'text-emerald-400'
                  : trainer.stats.accuracyPercentage >= 50
                    ? 'text-amber-400'
                    : 'text-rose-400'
              }`}
            >
              {trainer.stats.accuracyPercentage}%
            </strong>
          </div>

          <div className="bg-zinc-950/80 p-2 rounded-xl border border-zinc-800/80">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
              Aciertos / Fallos
            </span>
            <strong className="text-sm text-zinc-300">
              <span className="text-emerald-400">{trainer.stats.correctAnswers}</span> /{' '}
              <span className="text-rose-400">
                {trainer.stats.totalAnswers - trainer.stats.correctAnswers}
              </span>
            </strong>
          </div>

          <div className="bg-zinc-950/80 p-2 rounded-xl border border-zinc-800/80">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
              Tiempo Medio
            </span>
            <strong className="text-sm text-zinc-200">
              {(trainer.stats.avgResponseTimeMs / 1000).toFixed(2)}s
            </strong>
          </div>
        </div>
      )}
    </div>
  )
}
