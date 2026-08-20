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
    <div className="h-28 w-full bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between relative overflow-hidden select-none shadow-inner">
      {isWaitingAnswer ? (
        <div className="w-full flex items-center justify-center gap-3">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
          <div className="text-center">
            <span className="text-amber-300 text-sm md:text-base font-bold block">
              👂 Escuchá la nota y tocala en tu Roland FP-8 o hacé clic en el piano
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">Esperando respuesta...</span>
          </div>
        </div>
      ) : lastResult ? (
        <>
          <div className="flex flex-col gap-1.5 text-left">
            {/* ESTADO DE ACIERTO / FALLO */}
            <div className="flex items-center gap-2">
              <span
                className={`text-base font-bold flex items-center gap-1.5 ${
                  lastResult.correct ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {lastResult.correct ? '✅ ¡Correcto!' : '❌ Incorrecto'}
              </span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                  lastResult.correct
                    ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                    : 'bg-red-950/50 border-red-800 text-red-300'
                }`}
              >
                {getDeviationText(lastResult.semitoneDistance)}
              </span>
              <span className="text-zinc-500 text-[10px] font-mono">
                ({(lastResult.responseTimeMs / 1000).toFixed(2)}s)
              </span>
            </div>

            {/* CHIPS INEQUÍVOCOS: ESPERADA VS TOCADA */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded bg-zinc-900 border border-sky-800/80 text-sky-200">
                🎯 Esperada: <strong>{midiNoteToName(lastResult.expectedNote)}</strong> (
                {lastResult.expectedNote})
              </span>
              <span
                className={`px-2.5 py-1 rounded border ${
                  lastResult.correct
                    ? 'bg-zinc-900 border-emerald-800/80 text-emerald-200'
                    : 'bg-zinc-900 border-red-800/80 text-red-200'
                }`}
              >
                🎹 Tocaste: <strong>{midiNoteToName(lastResult.playedNote)}</strong> (
                {lastResult.playedNote})
              </span>
            </div>
          </div>

          {/* SLOT FIJO PARA EL PROMPT DE AVANCE */}
          <div className="min-w-[210px] flex flex-col items-end justify-center">
            {isWaitingManualAdvance && onAdvanceNext ? (
              <div className="space-y-1 text-right">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onAdvanceNext}
                  className="font-bold shadow-lg text-xs"
                >
                  Siguiente Pregunta ➔
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
      ) : (
        <div className="w-full text-center text-zinc-600 text-xs italic">Listo para comenzar</div>
      )}
    </div>
  )
}
