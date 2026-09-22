import React from 'react'
import {
  IntervalExerciseStimulus,
  IntervalExerciseResult
} from '../../domain/exercise/intervalEvaluator'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { getIntervalDefinition } from '../../domain/music/intervals'
import { Button } from '../ui/Button'
import { Play, SkipForward } from 'lucide-react'

interface IntervalFeedbackPanelProps {
  isSessionActive: boolean
  stimulus: IntervalExerciseStimulus | null
  waitingNoteStep: 1 | 2
  firstNotePlayed: number | null
  lastResult: IntervalExerciseResult | null
  isWaitingManualAdvance?: boolean
  onAdvanceNext?: () => void
}

const OLED_CONTAINER =
  'min-h-[112px] w-full bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between relative overflow-hidden select-none shadow-inner'

const CHIP_EXPECTED = 'border-cyan-500/30 bg-cyan-950/20 text-cyan-300 font-mono tabular-nums'
const CHIP_CORRECT =
  'border-emerald-500/30 bg-emerald-950/20 text-emerald-300 font-mono tabular-nums'
const CHIP_DEVIATION = 'border-amber-500/30 bg-amber-950/20 text-amber-300 font-mono tabular-nums'

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
    <div className={OLED_CONTAINER}>
      {!lastResult ? (
        <div className="w-full flex items-center justify-center gap-3">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
          <div className="text-center">
            <span className="text-amber-300 text-sm md:text-base font-bold block flex items-center justify-center gap-2">
              {waitingNoteStep === 1 ? (
                <>
                  <Play className="w-4 h-4 text-amber-400" />
                  <span>Escuchá las 2 notas y tocá la PRIMERA nota en el piano</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-amber-400" />
                  <span>
                    1ª Nota ({midiNoteToName(firstNotePlayed!)}) fijada. ¡Tocá la SEGUNDA nota!
                  </span>
                </>
              )}
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
              Dirección:{' '}
              <strong className="text-cyan-300 tabular-nums">
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
                className={`text-base font-bold tabular-nums ${
                  lastResult.isExactMatch
                    ? 'text-emerald-400'
                    : lastResult.isTransposedCorrect
                      ? 'text-cyan-400'
                      : 'text-amber-400'
                }`}
              >
                {lastResult.feedbackMessage}
              </span>
              <span className="text-zinc-500 text-[10px] font-mono tabular-nums">
                ({(lastResult.responseTimeMs / 1000).toFixed(2)}s)
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${CHIP_EXPECTED}`}
              >
                🎯 Intervalo Esperado:{' '}
                <strong className="text-white tabular-nums">
                  {getIntervalDefinition(lastResult.expectedStimulus.semitones).fullName} (
                  {lastResult.expectedStimulus.semitones}st)
                </strong>
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                  lastResult.isIntervalCorrect ? CHIP_CORRECT : CHIP_DEVIATION
                }`}
              >
                🎹 Tocaste:{' '}
                <strong className="text-white tabular-nums">
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
                  className="font-bold shadow-lg text-xs flex items-center gap-1.5"
                >
                  <Play className="w-4 h-4 mr-1.5 fill-current" />
                  <span>Siguiente Intervalo ➔</span>
                </Button>
                <span className="block text-[10px] text-zinc-400 font-mono">
                  o presiona <strong className="text-cyan-400 font-bold">Espacio</strong>
                </span>
              </div>
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
