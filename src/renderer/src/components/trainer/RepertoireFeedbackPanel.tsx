import React from 'react'
import { RepertoireExerciseResult } from '../../domain/exercise/repertoireEvaluator'
import { ScorePlaybackEvent } from '../../domain/music/scoreTypes'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { Button } from '../ui/Button'

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
    <div className="h-28 w-full bg-zinc-950/90 border border-zinc-800 rounded-2xl p-3.5 flex items-center justify-between relative overflow-hidden select-none shadow-2xl backdrop-blur-xl">
      {!lastResult ? (
        <div className="w-full flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="w-3.5 h-3.5 rounded-full bg-purple-400 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <span>
                  👂 Escuchá la frase ({totalNotesInSlice} notas/acordes) y tocala en tu piano:
                </span>
                <span className="px-2 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-purple-300 font-bold">
                  Compás {currentMeasure}
                </span>
              </div>
              <div className="text-xs text-zinc-400 font-mono mt-0.5 flex items-center gap-3">
                <span>
                  Meta de Retención:{' '}
                  <strong className="text-amber-400">
                    {currentStreak} / {streakTarget} ⭐
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Longitud activa:{' '}
                  <strong className="text-sky-300">{activeSlice.length} evento(s)</strong>
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onRepeatSlice}
            className="font-mono text-xs"
          >
            🔊 Escuchar (R)
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 text-left">
            <div className="flex items-center gap-2.5">
              <span
                className={`text-sm md:text-base font-bold tracking-tight px-2.5 py-0.5 rounded-lg border ${
                  lastResult.isCompleteSuccess
                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : lastResult.pitchAccuracyPercent === 100
                      ? 'bg-sky-950/70 border-sky-500/50 text-sky-300'
                      : 'bg-rose-950/70 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                }`}
              >
                {lastResult.feedbackMessage}
              </span>

              <span className="text-xs font-mono text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded-md font-bold">
                Streak: {currentStreak} / {streakTarget} ⭐
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                Afinación:{' '}
                <strong
                  className={
                    lastResult.pitchAccuracyPercent === 100 ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {lastResult.pitchAccuracyPercent}%
                </strong>
              </span>
              <span className="px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                Ritmo:{' '}
                <strong
                  className={
                    lastResult.rhythmAccuracyPercent === 100 ? 'text-emerald-400' : 'text-sky-400'
                  }
                >
                  {lastResult.rhythmAccuracyPercent}%
                </strong>
              </span>
              <span className="text-[11px] text-zinc-500">
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
                className="font-bold shadow-lg text-xs font-mono"
              >
                Siguiente Paso ➔ (Espacio)
              </Button>
            ) : (
              <span className="text-[11px] text-zinc-500 font-mono italic">
                Avanzando automáticamente...
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
