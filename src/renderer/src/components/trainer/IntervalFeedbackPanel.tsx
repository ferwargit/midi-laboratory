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
    <div className="h-24 w-full bg-zinc-950/90 border border-zinc-800 rounded-lg p-3 flex flex-col items-center justify-center relative overflow-hidden select-none">
      {!lastResult ? (
        <div className="text-center space-y-1">
          <div className="text-amber-400 text-sm md:text-base font-semibold tracking-wide flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            {waitingNoteStep === 1
              ? 'Escuchá las 2 notas y tocá la PRIMERA nota'
              : `1ª Nota (${midiNoteToName(firstNotePlayed!)}) registrada. ¡Tocá la SEGUNDA nota!`}
          </div>
          <div className="text-[11px] text-zinc-500">
            Dirección:{' '}
            <strong className="text-zinc-400">
              {stimulus?.direction === 'ascending'
                ? '⬆️ Ascendente (Grave → Aguda)'
                : '⬇️ Descendente (Aguda → Grave)'}
            </strong>
          </div>
        </div>
      ) : (
        <div className="w-full flex items-center justify-between px-4">
          <div className="text-left space-y-0.5">
            <div
              className={`text-base font-bold ${
                lastResult.isExactMatch
                  ? 'text-emerald-400'
                  : lastResult.isTransposedCorrect
                    ? 'text-sky-400'
                    : 'text-red-400'
              }`}
            >
              {lastResult.feedbackMessage}
            </div>
            <div className="text-xs text-zinc-400">
              Esperado:{' '}
              <strong className="text-zinc-200">
                {getIntervalDefinition(lastResult.expectedStimulus.semitones).fullName} (
                {lastResult.expectedStimulus.semitones} st)
              </strong>{' '}
              | Tocaste:{' '}
              <strong className="text-zinc-200">
                {getIntervalDefinition(lastResult.playedSemitones).shortName}
              </strong>
              <span className="text-zinc-500 ml-2 text-[10px]">
                ({(lastResult.responseTimeMs / 1000).toFixed(2)}s)
              </span>
            </div>
          </div>

          <div className="min-w-[190px] flex justify-end">
            {isWaitingManualAdvance && onAdvanceNext ? (
              <Button
                variant="primary"
                size="sm"
                onClick={onAdvanceNext}
                className="font-bold shadow-lg text-xs"
              >
                Siguiente ➔ (Espacio)
              </Button>
            ) : (
              <span className="text-[10px] text-zinc-500 italic">Avanzando automáticamente...</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
