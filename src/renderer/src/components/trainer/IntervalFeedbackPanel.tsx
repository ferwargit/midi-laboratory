import React from 'react'
import {
  IntervalExerciseStimulus,
  IntervalExerciseResult
} from '../../domain/exercise/intervalEvaluator'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { getIntervalDefinition } from '../../domain/music/intervals'
import { Button } from '../ui/Button'

interface IntervalFeedbackPanelProps {
  isSessionActive: boolean
  stimulus: IntervalExerciseStimulus | null
  waitingNoteStep: 1 | 2
  firstNotePlayed: number | null
  lastResult: IntervalExerciseResult | null
  isWaitingManualAdvance?: boolean
  onAdvanceNext?: () => void
}

export function IntervalFeedbackPanel({
  isSessionActive,
  stimulus,
  waitingNoteStep,
  firstNotePlayed,
  lastResult,
  isWaitingManualAdvance = false,
  onAdvanceNext
}: IntervalFeedbackPanelProps): React.ReactElement | null {
  if (!isSessionActive) return null

  return (
    <div className="h-28 w-full bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between relative overflow-hidden select-none shadow-inner">
      {!lastResult ? (
        <div className="w-full flex items-center justify-center gap-3">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
          <div className="text-center">
            <span className="text-amber-300 text-sm md:text-base font-bold block">
              {waitingNoteStep === 1
                ? '👂 Escuchá las 2 notas y tocá la PRIMERA nota en el piano'
                : `🎹 1ª Nota (${midiNoteToName(firstNotePlayed!)}) fijada. ¡Tocá la SEGUNDA nota!`}
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
              Dirección:{' '}
              <strong className="text-sky-300">
                {stimulus?.direction === 'ascending'
                  ? '⬆️ Ascendente (Grave ➔ Aguda)'
                  : '⬇️ Descendente (Aguda ➔ Grave)'}
              </strong>
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 text-left">
            <div className="flex items-center gap-2">
              <span
                className={`text-base font-bold ${
                  lastResult.isExactMatch
                    ? 'text-emerald-400'
                    : lastResult.isTransposedCorrect
                      ? 'text-sky-400'
                      : 'text-red-400'
                }`}
              >
                {lastResult.feedbackMessage}
              </span>
              <span className="text-zinc-500 text-[10px] font-mono">
                ({(lastResult.responseTimeMs / 1000).toFixed(2)}s)
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded bg-zinc-900 border border-sky-800/80 text-sky-200">
                🎯 Intervalo Esperado:{' '}
                <strong>
                  {getIntervalDefinition(lastResult.expectedStimulus.semitones).fullName} (
                  {lastResult.expectedStimulus.semitones}st)
                </strong>
              </span>
              <span
                className={`px-2.5 py-1 rounded border ${
                  lastResult.isIntervalCorrect
                    ? 'bg-zinc-900 border-emerald-800/80 text-emerald-200'
                    : 'bg-zinc-900 border-red-800/80 text-red-200'
                }`}
              >
                🎹 Tocaste:{' '}
                <strong>
                  {getIntervalDefinition(lastResult.playedSemitones).shortName} (
                  {lastResult.playedSemitones}st)
                </strong>
              </span>
            </div>
          </div>

          <div className="min-w-[210px] flex flex-col items-end justify-center">
            {isWaitingManualAdvance && onAdvanceNext ? (
              <div className="space-y-1 text-right">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onAdvanceNext}
                  className="font-bold shadow-lg text-xs"
                >
                  Siguiente Intervalo ➔
                </Button>
                <span className="block text-[10px] text-zinc-400 font-mono">
                  o presiona <strong className="text-sky-400 font-bold">Espacio</strong>
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-zinc-500 italic">Avanzando automáticamente...</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
