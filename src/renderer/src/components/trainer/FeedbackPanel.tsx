import React from 'react'
import { ExerciseResult } from '../../domain/exercise/types'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { Button } from '../ui/Button'
import { Play, SkipForward } from 'lucide-react'

interface FeedbackPanelProps {
  isWaitingAnswer: boolean
  lastResult: ExerciseResult | null
  isWaitingManualAdvance?: boolean
  onAdvanceNext?: () => void
}

const OLED_CONTAINER =
  'min-h-[112px] w-full bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between relative overflow-hidden select-none shadow-inner'

const CHIP_EXPECTED = 'border-cyan-500/30 bg-cyan-950/20 text-cyan-300 font-mono tabular-nums'
const CHIP_CORRECT =
  'border-emerald-500/30 bg-emerald-950/20 text-emerald-300 font-mono tabular-nums'
const CHIP_DEVIATION = 'border-amber-500/30 bg-amber-950/20 text-amber-300 font-mono tabular-nums'

function getDeviationText(semitoneDistance: number): string {
  if (semitoneDistance === 0) return 'Afinación exacta'
  const abs = Math.abs(semitoneDistance)
  const unit = abs === 1 ? 'semitono' : 'semitonos'
  const direction = semitoneDistance > 0 ? 'más agudo (+st)' : 'más grave (-st)'
  return `${semitoneDistance > 0 ? `+${semitoneDistance}` : semitoneDistance} ${unit} (${direction})`
}

export function FeedbackPanel({
  isWaitingAnswer,
  lastResult,
  isWaitingManualAdvance = false,
  onAdvanceNext
}: FeedbackPanelProps): React.ReactElement {
  return (
    <div className={OLED_CONTAINER}>
      {isWaitingAnswer ? (
        <div className="w-full flex items-center justify-center gap-4">
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping absolute" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          </div>
          <div className="text-left">
            <span className="text-zinc-100 text-sm md:text-base font-semibold block tracking-tight">
              Escuchá la nota y tocala en tu Roland FP-8 o hacé clic en el piano
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">Esperando respuesta...</span>
          </div>
        </div>
      ) : lastResult ? (
        <>
          <div className="flex flex-col gap-2 text-left">
            <div className="flex items-center gap-2.5">
              <span
                className={`text-sm md:text-base font-bold tracking-tight px-2.5 py-0.5 rounded-lg border ${
                  lastResult.correct ? CHIP_CORRECT : CHIP_DEVIATION
                }`}
              >
                {lastResult.correct ? '✅ ¡Correcto!' : '❌ Incorrecto'}
              </span>

              <span className="text-xs font-mono text-zinc-400 bg-zinc-900/90 border border-zinc-800 px-2 py-0.5 rounded-md">
                {getDeviationText(lastResult.semitoneDistance)}
              </span>

              <span className="text-zinc-500 text-xs font-mono tabular-nums">
                ({(lastResult.responseTimeMs / 1000).toFixed(2)}s)
              </span>
            </div>

            {/* Fichas de comparación */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 ${CHIP_EXPECTED}`}
              >
                <span className="text-cyan-400/80">🎯 Esperada:</span>
                <strong className="text-white text-sm tabular-nums">
                  {midiNoteToName(lastResult.expectedNote)}
                </strong>
                <span className="text-[10px] text-cyan-400/70 tabular-nums">
                  ({lastResult.expectedNote})
                </span>
              </span>

              <span
                className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 ${
                  lastResult.correct ? CHIP_CORRECT : CHIP_DEVIATION
                }`}
              >
                <span className={lastResult.correct ? 'text-emerald-400/80' : 'text-amber-400/80'}>
                  🎹 Tocaste:
                </span>
                <strong className="text-white text-sm tabular-nums">
                  {midiNoteToName(lastResult.playedNote)}
                </strong>
                <span className={lastResult.correct ? 'text-emerald-400/70' : 'text-amber-400/70'}>
                  ({lastResult.playedNote})
                </span>
              </span>
            </div>
          </div>

          {/* Botón de avance manual / automático */}
          <div className="min-w-[210px] flex flex-col items-end justify-center">
            {isWaitingManualAdvance && onAdvanceNext ? (
              <div className="space-y-1.5 text-right">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onAdvanceNext}
                  className="font-bold text-xs shadow-lg flex items-center gap-1.5"
                >
                  <Play className="w-4 h-4 mr-1.5 fill-current" />
                  <span>Siguiente Pregunta ➔</span>
                </Button>
                <span className="block text-[10px] text-zinc-400 font-mono">
                  o presiona{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-sky-400 font-sans text-[10px] font-bold">
                    Espacio
                  </kbd>
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
      ) : (
        <div className="w-full text-center text-zinc-500 text-xs font-mono tracking-wider uppercase">
          Listo para comenzar
        </div>
      )}
    </div>
  )
}
