import React from 'react'
import { SequenceExerciseResult } from '../../domain/exercise/sequenceEvaluator'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { Button } from '../ui/Button'
import { Play, SkipForward } from 'lucide-react'

interface SequenceFeedbackPanelProps {
  isSessionActive: boolean
  expectedLength: number
  capturedNotes: number[]
  lastResult: SequenceExerciseResult | null
  isWaitingManualAdvance?: boolean
  onAdvanceNext?: () => void
}

const OLED_CONTAINER =
  'min-h-[112px] w-full bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between relative overflow-hidden select-none shadow-inner'

const CHIP_EXPECTED = 'border-cyan-500/30 bg-cyan-950/20 text-cyan-300 font-mono tabular-nums'
const CHIP_CORRECT =
  'border-emerald-500/30 bg-emerald-950/20 text-emerald-300 font-mono tabular-nums'
const CHIP_DEVIATION = 'border-amber-500/30 bg-amber-950/20 text-amber-300 font-mono tabular-nums'

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
    <div className={OLED_CONTAINER}>
      {!lastResult ? (
        <div className="w-full flex flex-col items-center justify-center gap-3">
          <div className="text-amber-400 text-xs md:text-sm font-semibold tracking-wide flex items-center justify-center gap-2">
            <Play className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Escuchá la melodía de {expectedLength} notas y tocalas en orden:</span>
          </div>
          <div className="flex justify-center gap-2">
            {Array.from({ length: expectedLength }).map((_, idx) => {
              const note = capturedNotes[idx]
              const isFilled = note !== undefined
              return (
                <div
                  key={idx}
                  className={`w-12 h-9 rounded-lg border flex items-center justify-center font-bold text-xs transition-all ${
                    isFilled
                      ? `${CHIP_EXPECTED} shadow-md scale-105`
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
          <div className="text-left space-y-1.5">
            <div
              className={`text-base font-bold tabular-nums ${
                lastResult.isExactMatch
                  ? 'text-emerald-400'
                  : lastResult.isContourCorrect
                    ? 'text-cyan-400'
                    : 'text-amber-400'
              }`}
            >
              {lastResult.feedbackMessage}
            </div>

            <div className="flex items-center gap-2">
              {lastResult.isContourCorrect && (
                <span
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono ${CHIP_EXPECTED}`}
                >
                  🎵 Contorno melódico correcto
                </span>
              )}

              <div className="flex gap-1 text-xs">
                {lastResult.noteByNoteEvaluation.map((item, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono flex items-center gap-1.5 ${
                      item.isCorrect ? CHIP_CORRECT : CHIP_DEVIATION
                    }`}
                  >
                    <strong className="text-white tabular-nums">
                      {midiNoteToName(item.expected)}
                    </strong>
                    {item.played !== null && !item.isCorrect && (
                      <span
                        className={item.isCorrect ? 'text-emerald-400/70' : 'text-amber-400/70'}
                      >
                        ❌ {midiNoteToName(item.played)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-[190px] flex justify-end">
            {isWaitingManualAdvance && onAdvanceNext ? (
              <Button
                variant="primary"
                size="sm"
                onClick={onAdvanceNext}
                className="font-bold shadow-lg text-xs flex items-center gap-1.5"
              >
                <Play className="w-4 h-4 mr-1.5 fill-current" />
                <span>Siguiente ➔ (Espacio)</span>
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <SkipForward className="w-4 h-4 mr-1.5" />
                <span>Avanzando automáticamente...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
