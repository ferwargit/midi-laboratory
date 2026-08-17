import React from 'react'
import {
  IntervalExerciseStimulus,
  IntervalExerciseResult
} from '../../domain/exercise/intervalEvaluator'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { getIntervalDefinition } from '../../domain/music/intervals'

interface IntervalFeedbackPanelProps {
  isSessionActive: boolean
  stimulus: IntervalExerciseStimulus | null
  waitingNoteStep: 1 | 2
  firstNotePlayed: number | null
  lastResult: IntervalExerciseResult | null
}

export function IntervalFeedbackPanel({
  isSessionActive,
  stimulus,
  waitingNoteStep,
  firstNotePlayed,
  lastResult
}: IntervalFeedbackPanelProps): React.ReactElement | null {
  if (!isSessionActive) return null

  return (
    <div className="text-center p-4 bg-zinc-950 border border-zinc-800 rounded-md mb-3 min-h-[100px] flex items-center justify-center">
      {!lastResult ? (
        <div className="space-y-1.5 animate-pulse">
          <div className="text-amber-400 text-base font-semibold">
            {waitingNoteStep === 1
              ? '👂 Escuchá las 2 notas y tocá la PRIMERA nota en el piano...'
              : `🎹 1ª Nota (${midiNoteToName(firstNotePlayed!)}) registrada. ¡Tocá la SEGUNDA nota!`}
          </div>
          <div className="text-xs text-zinc-500">
            Dirección:{' '}
            <strong className="text-zinc-300">
              {stimulus?.direction === 'ascending'
                ? '⬆️ Ascendente (Grave → Aguda)'
                : '⬇️ Descendente (Aguda → Grave)'}
            </strong>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div
            className={`text-xl font-bold ${
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
            Intervalo esperado:{' '}
            <strong className="text-zinc-200">
              {getIntervalDefinition(lastResult.expectedStimulus.semitones).fullName} (
              {lastResult.expectedStimulus.semitones} semitonos)
            </strong>{' '}
            | Tocaste:{' '}
            <strong className="text-zinc-200">
              {getIntervalDefinition(lastResult.playedSemitones).shortName} (
              {lastResult.playedSemitones} st)
            </strong>{' '}
            <span className="text-zinc-500 ml-2">
              ({(lastResult.responseTimeMs / 1000).toFixed(2)}s)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
