import React from 'react'
import { ExerciseResult } from '../../domain/exercise/types'
import { midiNoteToName } from '../../domain/music/noteUtils'

interface FeedbackPanelProps {
  isWaitingAnswer: boolean
  lastResult: ExerciseResult | null
}

export function FeedbackPanel({
  isWaitingAnswer,
  lastResult
}: FeedbackPanelProps): React.ReactElement {
  return (
    <div className="text-center p-4 bg-zinc-950 border border-zinc-800 rounded-md mb-3 min-h-[90px] flex items-center justify-center">
      {isWaitingAnswer ? (
        <div className="text-amber-400 text-base font-medium animate-pulse">
          👂 Escuchá el sonido y tocá la tecla en tu Roland FP-8...
        </div>
      ) : lastResult ? (
        <div>
          <div
            className={`text-2xl font-bold ${
              lastResult.correct ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {lastResult.correct ? '✅ ¡Correcto!' : '❌ Incorrecto'}
          </div>
          <div className="mt-1 text-sm text-zinc-300">
            Esperada:{' '}
            <strong className="text-white">{midiNoteToName(lastResult.expectedNote)}</strong> |
            Tocaste: <strong className="text-white">{midiNoteToName(lastResult.playedNote)}</strong>
            {!lastResult.correct && (
              <span className="text-red-400 ml-2">
                (Distancia:{' '}
                {lastResult.semitoneDistance > 0
                  ? `+${lastResult.semitoneDistance}`
                  : lastResult.semitoneDistance}{' '}
                semitonos)
              </span>
            )}
            <span className="text-zinc-500 ml-3">
              ({(lastResult.responseTimeMs / 1000).toFixed(2)}s)
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
