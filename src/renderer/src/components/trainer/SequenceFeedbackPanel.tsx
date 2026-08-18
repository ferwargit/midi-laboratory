import React from 'react'
import { SequenceExerciseResult } from '../../domain/exercise/sequenceEvaluator'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { Button } from '../ui/Button'

interface SequenceFeedbackPanelProps {
  isSessionActive: boolean
  expectedLength: number
  capturedNotes: number[]
  lastResult: SequenceExerciseResult | null
  isWaitingManualAdvance?: boolean
  onAdvanceNext?: () => void
}

export function SequenceFeedbackPanel({
  isSessionActive,
  expectedLength,
  capturedNotes,
  lastResult,
  isWaitingManualAdvance = false,
  onAdvanceNext
}: SequenceFeedbackPanelProps): React.ReactElement | null {
  if (!isSessionActive) return null

  return (
    <div className="h-28 w-full bg-zinc-950/90 border border-zinc-800 rounded-lg p-3 flex flex-col items-center justify-center relative overflow-hidden select-none">
      {!lastResult ? (
        <div className="text-center space-y-2">
          <div className="text-amber-400 text-xs md:text-sm font-semibold tracking-wide flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Escuchá la melodía de {expectedLength} notas y tocalas en orden:
          </div>
          <div className="flex justify-center gap-2">
            {Array.from({ length: expectedLength }).map((_, idx) => {
              const note = capturedNotes[idx]
              const isFilled = note !== undefined
              return (
                <div
                  key={idx}
                  className={`w-12 h-9 rounded border flex items-center justify-center font-bold text-xs transition-all ${
                    isFilled
                      ? 'bg-sky-950/90 border-sky-400 text-sky-200 shadow-md scale-105'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-600'
                  }`}
                >
                  {isFilled ? midiNoteToName(note) : `${idx + 1}`}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="w-full flex items-center justify-between px-3">
          <div className="text-left space-y-1">
            <div
              className={`text-base font-bold ${
                lastResult.isExactMatch
                  ? 'text-emerald-400'
                  : lastResult.isContourCorrect
                    ? 'text-sky-400'
                    : 'text-amber-400'
              }`}
            >
              {lastResult.feedbackMessage}
            </div>

            <div className="flex gap-1 text-xs">
              {lastResult.noteByNoteEvaluation.map((item, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono ${
                    item.isCorrect
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                      : 'bg-red-950/60 border-red-700 text-red-300'
                  }`}
                >
                  {midiNoteToName(item.expected)}{' '}
                  {item.played !== null && !item.isCorrect && `(❌ ${midiNoteToName(item.played)})`}
                </span>
              ))}
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
