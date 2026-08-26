import React, { useRef, useState } from 'react'
import { UseRepertoireTrainerReturn, ChainingDirection } from '../../hooks/useRepertoireTrainer'
import { RhythmEvaluationMode } from '../../domain/exercise/repertoireEvaluator'
import { HandSelection } from '../../domain/music/scoreTypes'
import { parseMusicXml } from '../../domain/music/scoreParser'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { PianoKeyboard, KeyboardVisualTheme } from '../trainer/PianoKeyboard'
import { RepertoireFeedbackPanel } from '../trainer/RepertoireFeedbackPanel'
import { RepertoireSummaryCard } from '../trainer/RepertoireSummaryCard'

interface RepertoireViewProps {
  trainer: UseRepertoireTrainerReturn
  pianoKeys: number[]
  pressedNotes: number[]
  stimulusNotes?: number[]
  onVirtualKeyPress?: (note: number) => void
}

export function RepertoireView({
  trainer,
  pianoKeys,
  pressedNotes,
  stimulusNotes = [],
  onVirtualKeyPress
}: RepertoireViewProps): React.ReactElement {
  const [visualTheme, setVisualTheme] = useState<KeyboardVisualTheme>('ghost_neon')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const msPerBeat = Math.round(60000 / trainer.studyBpm)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt): void => {
      const content = evt.target?.result as string
      if (!content) return

      try {
        const score = parseMusicXml(content)
        trainer.setCurrentScore(score)
        trainer.setStartMeasure(1)
        trainer.setEndMeasure(Math.min(4, score.totalMeasures))
        trainer.setStudyBpm(score.baseBpm)
        setLoadError(null)
      } catch (err) {
        setLoadError(
          `Error al leer archivo MusicXML: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
    reader.readAsText(file)
  }

  if (trainer.isSessionFinished) {
    return (
      <RepertoireSummaryCard
        score={trainer.currentScore}
        history={trainer.sessionHistory}
        studyBpm={trainer.studyBpm}
        rhythmMode={trainer.rhythmMode}
        onRepeatSession={(): void => trainer.startSession()}
        onResetToConfig={trainer.resetToConfig}
      />
    )
  }

  return (
    <div className="space-y-3 font-sans">
      {/* 1. CABECERA DINÁMICA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 px-4 py-2.5 rounded-2xl shadow-lg gap-2">
        <div className="flex items-center gap-3 font-mono">
          <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-800 text-purple-300 text-xs font-bold">
            MODO 04
          </span>
          <div>
            <span className="text-xs md:text-sm text-zinc-100 font-bold block">
              {trainer.currentScore?.title || 'Cargar Partitura (.musicxml / MuseScore 4)'}
            </span>
            <span className="text-[10px] text-zinc-400">
              {trainer.currentScore?.composer || 'Félix Dumont'} •{' '}
              {trainer.currentScore?.timeSignature.beats}/
              {trainer.currentScore?.timeSignature.beatType} • {trainer.studyBpm} BPM (~{msPerBeat}{' '}
              ms/negra)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={trainer.isSessionActive}
            onClick={() => fileInputRef.current?.click()}
            className="font-mono text-xs cursor-pointer"
          >
            📁 Cambiar Partitura
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".musicxml,.xml"
            onChange={handleFileUpload}
            className="hidden"
          />

          {!trainer.isSessionActive ? (
            <Button
              variant="success"
              size="md"
              disabled={!trainer.currentScore}
              onClick={(): void => trainer.startSession()}
              className="px-5 py-2 font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] font-mono cursor-pointer"
            >
              ▶ COMENZAR SESIÓN
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={trainer.repeatCurrentSlice}
                className="font-mono cursor-pointer"
              >
                🔊 Repetir (R)
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={trainer.stopSession}
                className="font-mono cursor-pointer"
              >
                ⏹ Detener y Guardar
              </Button>
            </>
          )}
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-rose-950/80 border border-rose-700 text-rose-300 rounded-xl text-xs font-mono">
          {loadError}
        </div>
      )}

      {/* 2. OLED DISPLAY / FEEDBACK */}
      {trainer.isSessionActive && (
        <RepertoireFeedbackPanel
          isSessionActive={trainer.isSessionActive}
          activeSlice={trainer.activeEventsSlice}
          currentStreak={trainer.currentStreak}
          streakTarget={trainer.streakTarget}
          lastResult={trainer.lastResult}
          isWaitingManualAdvance={trainer.isWaitingManualAdvance}
          onAdvanceNext={trainer.advanceToNextStep}
          onRepeatSlice={trainer.repeatCurrentSlice}
        />
      )}

      {/* 3. PIANO HERO */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs font-mono text-zinc-400 px-1">
          <span>
            {trainer.isSessionActive
              ? `🎹 ENTRADA ROLAND FP-8 (${trainer.selectedHand === 'RH' ? 'MANO DERECHA' : trainer.selectedHand === 'LH' ? 'MANO IZQUIERDA' : 'AMBAS MANOS'}):`
              : 'TECLADO DE PRÁCTICA AUDIOMOTORA (TOCA EN TU ROLAND FP-8 O CLIC VIRTUAL):'}
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
                    ? 'bg-purple-600 text-white shadow-[0_0_8px_rgba(168,85,247,0.4)]'
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
          activeNotes={[]}
          pressedNotes={pressedNotes}
          stimulusNotes={stimulusNotes}
          isInteractiveTraining={trainer.isSessionActive}
          onPlayNoteVirtual={onVirtualKeyPress}
          visualTheme={visualTheme}
        />
      </div>

      {/* 4. DECK DE CONFIGURACIÓN */}
      {!trainer.isSessionActive && (
        <Card className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-4 space-y-4 rounded-2xl font-mono text-xs">
          {/* FILA 1: MANO, RANGO Y ENCADENAMIENTO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs uppercase text-zinc-400 mb-1 font-bold">
                Mano / Pentagrama a Estudiar:
              </label>
              <div className="flex gap-1">
                {(
                  [
                    ['RH', 'Mano Derecha (MD)'],
                    ['LH', 'Mano Izquierda (MI)'],
                    ['both', 'Ambas Manos']
                  ] as [HandSelection, string][]
                ).map(([hand, label]) => (
                  <button
                    key={hand}
                    type="button"
                    onClick={(): void => trainer.setSelectedHand(hand)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      trainer.selectedHand === hand
                        ? 'bg-purple-950/80 border-purple-500 text-purple-200 font-bold shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs uppercase text-zinc-400 font-bold">
                  Rango de Compases:
                </label>
                <label className="flex items-center gap-1 text-[10px] text-purple-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trainer.includeResolutionNote}
                    onChange={(e): void => trainer.setIncludeResolutionNote(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-purple-500"
                  />
                  <span>+1 Res. (C.+1)</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">Desde:</span>
                  <input
                    type="number"
                    min={1}
                    max={trainer.endMeasure}
                    value={trainer.startMeasure}
                    onChange={(e): void => trainer.setStartMeasure(Number(e.target.value))}
                    className="w-14 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-center text-zinc-100"
                  />
                </div>
                <span className="text-zinc-500">➔</span>
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">Hasta:</span>
                  <input
                    type="number"
                    min={trainer.startMeasure}
                    max={trainer.currentScore?.totalMeasures || 8}
                    value={trainer.endMeasure}
                    onChange={(e): void => trainer.setEndMeasure(Number(e.target.value))}
                    className="w-14 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-center text-zinc-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase text-zinc-400 mb-1 font-bold">
                Estrategia de Encadenamiento:
              </label>
              <div className="flex gap-1">
                {(
                  [
                    ['forward', '➡️ Hacia Adelante'],
                    ['backward', '⬅️ Hacia Atrás']
                  ] as [ChainingDirection, string][]
                ).map(([dir, label]) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={(): void => trainer.setChainingDirection(dir)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      trainer.chainingDirection === dir
                        ? 'bg-sky-950/80 border-sky-500 text-sky-200 font-bold shadow-sm'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* FILA 2: RITMO, CONTROL MAESTRO DE TEMPO, METRÓNOMO Y STREAKS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-800/80">
            {/* Modo Rítmico */}
            <div>
              <label className="block text-xs uppercase text-zinc-400 mb-1 font-bold">
                Modo Rítmico:
              </label>
              <select
                value={trainer.rhythmMode}
                onChange={(e): void =>
                  trainer.setRhythmMode(e.target.value as RhythmEvaluationMode)
                }
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 font-semibold"
              >
                <option value="free_rubato">1: 🟢 Isócrono (Notas Iguales)</option>
                <option value="relative_proportional">2: 🟡 Proporcional (IOI)</option>
                <option value="strict_metronome">3: 🔴 Metrónomo Estricto</option>
              </select>
            </div>

            {/* Tolerancia Rítmica (Visible en Modos 2 y 3) o Explicación (Modo 1) */}
            <div>
              {trainer.rhythmMode === 'free_rubato' ? (
                <div>
                  <label className="text-xs uppercase text-zinc-400 font-bold block mb-1">
                    Modo 1: Altura Pura
                  </label>
                  <span className="text-[11px] text-zinc-500 font-sans block leading-tight">
                    Cada nota suena como 1 negra homogénea a este tempo.
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs uppercase text-zinc-400 font-bold">
                      Tolerancia Rítmica:
                    </label>
                    <span className="text-purple-400 font-bold">
                      ±{trainer.rhythmTolerancePercent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={trainer.rhythmTolerancePercent}
                    onChange={(e): void =>
                      trainer.setRhythmTolerancePercent(Number(e.target.value))
                    }
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </>
              )}
            </div>

            {/* CONTROL MAESTRO DE TEMPO (BPM y ms unificados) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs uppercase text-zinc-400 font-bold">Tempo (BPM):</label>
                <label className="flex items-center gap-1 text-[10px] text-amber-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trainer.continuousMetronome}
                    onChange={(e): void => trainer.setContinuousMetronome(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-700 text-amber-500"
                  />
                  <span>Metro. Continuo</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={40}
                  max={140}
                  step={2}
                  value={trainer.studyBpm}
                  onChange={(e): void => trainer.setStudyBpm(Number(e.target.value))}
                  className="flex-1 accent-emerald-500 cursor-pointer"
                />
                <span className="text-emerald-400 font-bold text-xs shrink-0">
                  {trainer.studyBpm}{' '}
                  <span className="text-[10px] text-zinc-400 font-normal">({msPerBeat}ms)</span>
                </span>
              </div>
            </div>

            {/* Streak Target */}
            <div>
              <label className="block text-xs uppercase text-zinc-400 mb-1 font-bold">
                Streak de Retención:
              </label>
              <select
                value={trainer.streakTarget}
                onChange={(e): void => trainer.setStreakTarget(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 text-amber-300 font-bold rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500"
              >
                <option value={1}>1x acierto (Rápido)</option>
                <option value={2}>2x aciertos (Intermedio)</option>
                <option value={3}>3x aciertos (Estándar)</option>
                <option value={6}>6x aciertos (Consolidación)</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* 5. TELEMETRÍA EN VIVO */}
      {trainer.isSessionActive && (
        <div className="grid grid-cols-4 gap-2.5 font-mono text-center select-none text-xs">
          <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-bold">
              Compases
            </span>
            <strong className="text-sm text-zinc-200">
              C.{trainer.startMeasure} ➔ C.{trainer.endMeasure}
              {trainer.includeResolutionNote && (
                <span className="text-purple-400 text-[10px] block font-normal">
                  +Res. C.{trainer.endMeasure + 1}
                </span>
              )}
            </strong>
          </div>

          <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-bold">
              Streak Activo
            </span>
            <strong className="text-sm text-amber-400">
              {trainer.currentStreak} / {trainer.streakTarget} ⭐
            </strong>
          </div>

          <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-bold">
              Longitud Frase
            </span>
            <strong className="text-sm text-purple-300">
              {trainer.activeEventsSlice.length} evento(s)
            </strong>
          </div>

          <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-bold">
              {trainer.continuousMetronome ? 'Metrónomo Continuo' : 'Tempo'}
            </span>
            <strong className="text-sm text-emerald-400">
              {trainer.studyBpm} BPM{' '}
              <span className="text-[10px] text-zinc-400 font-normal">({msPerBeat}ms)</span>
            </strong>
          </div>
        </div>
      )}
    </div>
  )
}
