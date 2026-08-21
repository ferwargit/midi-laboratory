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
      return `⏳ Tiempo: ${formatTime(trainer.timeRemainingSeconds)} (Frase ${trainer.currentQuestionIndex})`
    }
    if (trainer.sessionLimitType === 'infinite') {
      return `∞ Frase ${trainer.currentQuestionIndex}`
    }
    return `Frase ${trainer.currentQuestionIndex} de ${trainer.sessionQuestionsCount}`
  }

  // 1. PANTALLA DE RESULTADOS
  if (trainer.isSessionFinished) {
    return (
      <SequenceSummaryCard
        history={trainer.sessionHistory}
        onRepeatSession={trainer.startSession}
        onTrainWeakOnly={trainer.trainWeakMotifsOnly}
        onResetToConfig={trainer.resetToConfig}
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* 2. CABECERA DINÁMICA */}
      <div className="flex justify-between items-center bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 px-4 py-2.5 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3 font-mono">
          <span className="px-2 py-0.5 rounded-md bg-sky-950/80 border border-sky-800 text-sky-300 text-[10px] font-bold">
            MODO 03
          </span>
          <span className="text-xs text-zinc-300 font-semibold">
            {trainer.isSessionActive
              ? getSessionProgressLabel()
              : `Memoria Melódica (${trainer.sequenceLength} notas)`}
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

      {/* 3. DISPLAY OLED HUD (SOLO VISIBLE CUANDO HAY SESIÓN ACTIVA) */}
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

      {/* 4. PIANO HERO CENTRAL */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400 px-1">
          <span>
            {trainer.isSessionActive
              ? `🎹 ENTRADA SECUENCIAL EN FP-8 (${trainer.capturedNotes.length}/${trainer.sequenceLength} NOTAS CAPTURADAS):`
              : `NOTAS CANDIDATAS DISPONIBLES (${trainer.customCandidateNotes.length} TONOS):`}
          </span>
          {!trainer.isSessionActive && (
            <span className="text-[10px] text-zinc-500">
              Selecciona el pool de notas para las frases
            </span>
          )}
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

      {/* 5. DECK DE CONFIGURACIÓN (SOLO CUANDO NO HAY SESIÓN ACTIVA) */}
      {!trainer.isSessionActive && (
        <Card className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-4 space-y-4 rounded-2xl">
          {/* PRESETS PEDAGÓGICOS */}
          <div>
            <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-2 font-bold">
              Presets de Frases y Arpegios:
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
                    <div className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                      {preset.description}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-sky-400 shrink-0 ml-2">
                    {preset.length} notas
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* PARÁMETROS EN REJILLA */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono">
            <div>
              <label className="block text-[10px] uppercase text-zinc-400 mb-1 font-bold">
                Longitud de Secuencia:
              </label>
              <select
                value={trainer.sequenceLength}
                onChange={(e): void => trainer.setSequenceLength(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
              >
                <option value={3}>3 notas (Motivos cortos)</option>
                <option value={4}>4 notas (Frases estándar)</option>
                <option value={5}>5 notas (Arpegios y melodías)</option>
                <option value={6}>6 notas (Memoria avanzada)</option>
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
        <div className="grid grid-cols-3 gap-2.5 font-mono text-center select-none">
          <div className="bg-zinc-950/80 p-2 rounded-xl border border-zinc-800/80">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
              Frases Tocadas
            </span>
            <strong className="text-sm text-zinc-200">
              {trainer.sessionHistory.length} / {trainer.sessionQuestionsCount}
            </strong>
          </div>

          <div className="bg-zinc-950/80 p-2 rounded-xl border border-zinc-800/80">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
              Melodías Exactas
            </span>
            <strong className="text-sm text-emerald-400">
              {trainer.sessionHistory.filter((h) => h.isExactMatch).length}
            </strong>
          </div>

          <div className="bg-zinc-950/80 p-2 rounded-xl border border-zinc-800/80">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block font-bold">
              Longitud Frase
            </span>
            <strong className="text-sm text-sky-400">{trainer.sequenceLength} notas</strong>
          </div>
        </div>
      )}
    </div>
  )
}
