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

export function FeedbackPanel({
  isWaitingAnswer,
  lastResult,
  isWaitingManualAdvance = false,
  onAdvanceNext
}: FeedbackPanelProps): React.ReactElement {
  return (
    <div className="h-24 w-full bg-zinc-950/90 border border-zinc-800 rounded-lg p-3 flex flex-col items-center justify-center relative overflow-hidden select-none">
      {isWaitingAnswer ? (
        <div className="text-center space-y-1">
          <div className="text-amber-400 text-sm md:text-base font-semibold tracking-wide flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Escuchá la nota y tocala en el piano o hacé clic
          </div>
          <div className="text-[11px] text-zinc-500">Esperando respuesta...</div>
        </div>
      ) : lastResult ? (
        <div className="w-full flex items-center justify-between px-4">
          <div className="text-left space-y-0.5">
            <div
              className={`text-lg font-bold flex items-center gap-2 ${
                lastResult.correct ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {lastResult.correct ? '✅ ¡Correcto!' : '❌ Incorrecto'}
              {!lastResult.correct && (
                <span className="text-xs font-normal text-red-400 bg-red-950/60 border border-red-800 px-2 py-0.5 rounded ml-1">
                  Distancia:{' '}
                  {lastResult.semitoneDistance > 0
                    ? `+${lastResult.semitoneDistance}`
                    : lastResult.semitoneDistance}{' '}
                  st
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-300">
              Esperada:{' '}
              <strong className="text-white">{midiNoteToName(lastResult.expectedNote)}</strong> |{' '}
              Tocaste:{' '}
              <strong className="text-white">{midiNoteToName(lastResult.playedNote)}</strong>
              <span className="text-zinc-500 ml-2 text-[10px]">
                ({(lastResult.responseTimeMs / 1000).toFixed(2)}s)
              </span>
            </div>
          </div>

          {/* SLOT RESERVADO FIJO PARA EL BOTÓN */}
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
      ) : (
        <div className="text-zinc-600 text-xs italic">Listo para comenzar</div>
      )}
    </div>
  )
}
