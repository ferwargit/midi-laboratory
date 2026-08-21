import React from 'react'
import { ExerciseResult } from '../../domain/exercise/types'
import { midiNoteToName } from '../../domain/music/noteUtils'
import { Button } from '../ui/Button'

interface FeedbackPanelProps {
  isWaitingAnswer: boolean
  lastResult: ExerciseResult | null
  isWaitingManualAdvance?: boolean
  onAdvanceNext?: () => void
}

function getDeviationText(semitoneDistance: number): string {
  if (semitoneDistance === 0) return 'Afinación exacta (0 st)'
  const abs = Math.abs(semitoneDistance)
  const unit = abs === 1 ? 'semitono' : 'semitonos'
  const direction = semitoneDistance > 0 ? '+agudo' : '-grave'
  return `${semitoneDistance > 0 ? `+${semitoneDistance}` : semitoneDistance} ${unit} (${direction})`
}

export function FeedbackPanel({
  isWaitingAnswer,
  lastResult,
  isWaitingManualAdvance = false,
  onAdvanceNext
}: FeedbackPanelProps): React.ReactElement {
  return (
    <div className="h-28 w-full bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden select-none shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
      {isWaitingAnswer ? (
        <div className="w-full flex items-center justify-center gap-4">
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping absolute" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          </div>
          <div className="text-left">
            <span className="text-zinc-100 text-sm md:text-base font-semibold block tracking-tight">
              Escucha el tono y reprodúcelo en tu teclado MIDI
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              Esperando entrada Note-On...
            </span>
          </div>
        </div>
      ) : lastResult ? (
        <>
          <div className="flex flex-col gap-2 text-left">
            <div className="flex items-center gap-2.5">
              <span
                className={`text-sm md:text-base font-bold tracking-tight px-2.5 py-0.5 rounded-lg border ${
                  lastResult.correct
                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'bg-rose-950/70 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                }`}
              >
                {lastResult.correct ? 'ACIERTO EXACTO' : 'DESVIACIÓN DETECTADA'}
              </span>

              <span className="text-xs font-mono text-zinc-400 bg-zinc-900/90 border border-zinc-800 px-2 py-0.5 rounded-md">
                {getDeviationText(lastResult.semitoneDistance)}
              </span>

              <span className="text-zinc-500 text-xs font-mono">
                {(lastResult.responseTimeMs / 1000).toFixed(2)}s
              </span>
            </div>

            {/* Fichas de comparación */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-3 py-1 rounded-lg bg-zinc-900/90 border border-sky-500/40 text-sky-300 flex items-center gap-1.5">
                <span className="text-zinc-500">OBJETIVO:</span>
                <strong className="text-white text-sm">
                  {midiNoteToName(lastResult.expectedNote)}
                </strong>
              </span>

              <span
                className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 ${
                  lastResult.correct
                    ? 'bg-zinc-900/90 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900/90 border-rose-500/40 text-rose-300'
                }`}
              >
                <span className="text-zinc-500">TOCASTE:</span>
                <strong className="text-white text-sm">
                  {midiNoteToName(lastResult.playedNote)}
                </strong>
              </span>
            </div>
          </div>

          {/* Botón de avance manual / automático */}
          <div className="min-w-[200px] flex flex-col items-end justify-center">
            {isWaitingManualAdvance && onAdvanceNext ? (
              <div className="space-y-1.5 text-right">
                <Button
                  variant="primary"
                  size="md"
                  onClick={onAdvanceNext}
                  className="font-bold text-xs"
                >
                  Siguiente ➔
                </Button>
                <span className="block text-[10px] text-zinc-400 font-mono">
                  Presiona{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 font-sans text-[10px]">
                    Espacio
                  </kbd>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                Avanzando automáticamente...
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="w-full text-center text-zinc-500 text-xs font-mono tracking-wider uppercase">
          Listo para iniciar entrenamiento
        </div>
      )}
    </div>
  )
}
