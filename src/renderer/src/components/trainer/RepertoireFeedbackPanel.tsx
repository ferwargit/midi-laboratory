import React from 'react'
import { RepertoireExerciseResult } from '../../domain/exercise/repertoireEvaluator'
import { ScorePlaybackEvent } from '../../domain/music/scoreTypes'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { Button } from '../ui/Button'
import { Play, SkipForward, RotateCcw } from 'lucide-react'

interface RepertoireFeedbackPanelProps {
  isSessionActive: boolean
  activeSlice: ScorePlaybackEvent[]
  currentStreak: number
  streakTarget: number
  lastResult: RepertoireExerciseResult | null
  isWaitingManualAdvance?: boolean
  onAdvanceNext?: () => void
  onRepeatSlice?: () => void
}

const OLED_CONTAINER =
  'min-h-[112px] w-full bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between relative overflow-hidden select-none shadow-inner'

const CHIP_EXPECTED = 'border-cyan-500/30 bg-cyan-950/20 text-cyan-300 font-mono tabular-nums'
const CHIP_CORRECT =
  'border-emerald-500/30 bg-emerald-950/20 text-emerald-300 font-mono tabular-nums'
const CHIP_DEVIATION = 'border-amber-500/30 bg-amber-950/20 text-amber-300 font-mono tabular-nums'

const StreakProgressBars = React.memo(function StreakProgressBars({
  currentStreak,
  streakTarget
}: {
  currentStreak: number
  streakTarget: number
}): React.ReactElement {
  const steps = Array.from({ length: 10 }, (_, i) => i + 1)

  return (
    <div className="flex items-center gap-1.5 mt-1">
      {steps.map((step) => (
        <div
          key={step}
          className={`flex-1 h-1.5 rounded transition-colors ${
            step <= currentStreak
              ? 'bg-amber-400'
              : step <= streakTarget
                ? 'bg-amber-900/50 border border-amber-800/50'
                : 'bg-zinc-800/50 border border-zinc-700/50'
          }`}
          title={`${step}x`}
        />
      ))}
      <span className="text-[10px] text-amber-400/80 font-mono tabular-nums w-8 text-right">
        {currentStreak}x
      </span>
    </div>
  )
})

export function RepertoireFeedbackPanel({
  isSessionActive,
  activeSlice,
  currentStreak,
  streakTarget,
  lastResult,
  isWaitingManualAdvance = false,
  onAdvanceNext,
  onRepeatSlice
}: RepertoireFeedbackPanelProps): React.ReactElement | null {
  if (!isSessionActive) return null

  const currentMeasure = activeSlice[0]?.measureNumber || 1
  const totalNotesInSlice = activeSlice.reduce((acc, e) => acc + e.midiNotes.length, 0)

  return (
    <div className={OLED_CONTAINER}>
      {!lastResult ? (
        <div className="w-full flex items-center justify-between px-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="w-3.5 h-3.5 rounded-full bg-purple-400 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Play className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                <span>Escuchá la frase ({totalNotesInSlice} notas/acordes) y tocala:</span>
                <span className="px-2 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-[11px] text-purple-300 font-bold tabular-nums">
                  Compás {currentMeasure}
                </span>
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-3">
                <span>
                  Meta de Retención:{' '}
                  <strong className="text-amber-400 tabular-nums">
                    {currentStreak} / {streakTarget} ⭐
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Longitud activa:{' '}
                  <strong className="text-cyan-300 tabular-nums">
                    {activeSlice.length} evento(s)
                  </strong>
                </span>
              </div>
              <StreakProgressBars currentStreak={currentStreak} streakTarget={streakTarget} />
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onRepeatSlice}
            className="text-xs shrink-0 cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            <span>Escuchar (R)</span>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 text-left">
            <div className="flex items-center gap-2.5">
              <span
                className={`text-sm md:text-base font-bold tracking-tight px-2.5 py-0.5 rounded-lg border ${
                  lastResult.isCompleteSuccess
                    ? CHIP_CORRECT
                    : lastResult.pitchAccuracyPercent === 100
                      ? CHIP_EXPECTED
                      : CHIP_DEVIATION
                }`}
              >
                {lastResult.feedbackMessage}
              </span>

              <span className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded-md font-bold tabular-nums">
                Streak: {currentStreak} / {streakTarget} ⭐
              </span>
            </div>

            <StreakProgressBars currentStreak={currentStreak} streakTarget={streakTarget} />

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-lg border flex items-center gap-1.5">
                Afinación:{' '}
                <strong
                  className={
                    lastResult.pitchAccuracyPercent === 100 ? 'text-emerald-400' : 'text-amber-400'
                  }
                >
                  {lastResult.pitchAccuracyPercent}%
                </strong>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg border flex items-center gap-1.5">
                Ritmo:{' '}
                <strong
                  className={
                    lastResult.rhythmAccuracyPercent === 100 ? 'text-emerald-400' : 'text-cyan-400'
                  }
                >
                  {lastResult.rhythmAccuracyPercent}%
                </strong>
              </span>
              <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
                Esperadas:{' '}
                {activeSlice
                  .flatMap((e) => e.midiNotes)
                  .map((n) => midiNoteToName(n))
                  .join(', ')}
              </span>
            </div>
          </div>

          <div className="min-w-[200px] flex justify-end gap-2">
            {isWaitingManualAdvance && onAdvanceNext ? (
              <Button
                variant="primary"
                size="sm"
                onClick={onAdvanceNext}
                className="font-bold shadow-lg text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-4 h-4 mr-1.5 fill-current" />
                <span>Siguiente Paso ➔ (Espacio)</span>
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <SkipForward className="w-4 h-4 mr-1.5" />
                <span>Avanzando automáticamente...</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
