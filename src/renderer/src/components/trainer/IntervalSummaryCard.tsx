import React, { useMemo } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { IntervalExerciseResult } from '../../domain/exercise/intervalEvaluator'
import { getIntervalDefinition } from '../../domain/music/intervals'
import { PianoKeyboard } from './PianoKeyboard'
import { generateMidiRange } from '../../domain/music/noteUtils'
import { NotePerformance } from '../../domain/adaptation/types'

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6

interface IntervalSummaryCardProps {
  history: IntervalExerciseResult[]
  onRepeatSession: () => void
  onTrainWeakOnly: () => void
  onResetToConfig: () => void
}

export function IntervalSummaryCard({
  history,
  onRepeatSession,
  onTrainWeakOnly,
  onResetToConfig
}: IntervalSummaryCardProps): React.ReactElement {
  const total = history.length
  const correct = history.filter((h) => h.isIntervalCorrect).length
  const transposed = history.filter((h) => h.isTransposedCorrect).length
  const exact = history.filter((h) => h.isExactMatch).length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
  const avgTime =
    total > 0
      ? (history.reduce((acc, h) => acc + h.responseTimeMs, 0) / total / 1000).toFixed(2)
      : '0.00'

  // Estadísticas por clase de intervalo
  const intervalStats = Array.from(new Set(history.map((h) => h.expectedStimulus.semitones))).map(
    (semitones) => {
      const items = history.filter((h) => h.expectedStimulus.semitones === semitones)
      const success = items.filter((h) => h.isIntervalCorrect).length
      const def = getIntervalDefinition(semitones)
      return {
        semitones,
        name: `${def.shortName} (${def.fullName})`,
        song: def.anchorSong,
        total: items.length,
        accuracy: Math.round((success / items.length) * 100)
      }
    }
  )

  const weakCount = intervalStats.filter((s) => s.accuracy < 85).length

  // Mapa de calor acumulado sobre las teclas objetivo tocadas
  const keyboardPerformances = useMemo(() => {
    const map = new Map<number, NotePerformance>()
    history.forEach((h) => {
      const target = h.expectedStimulus.targetNote
      if (!map.has(target)) {
        map.set(target, {
          noteNumber: target,
          attempts: 0,
          correct: 0,
          lastResultWasCorrect: null,
          accuracyPercentage: 0,
          weight: 1.0
        })
      }
      const perf = map.get(target)!
      perf.attempts += 1
      if (h.isIntervalCorrect) perf.correct += 1
      perf.accuracyPercentage = Math.round((perf.correct / perf.attempts) * 100)
    })
    return map
  }, [history])

  const activeNotesInSession = Array.from(
    new Set(history.flatMap((h) => [h.expectedStimulus.rootNote, h.expectedStimulus.targetNote]))
  )

  return (
    <Card className="border-sky-500/40 bg-zinc-900/90 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-sky-400 m-0">
            🎉 ¡Sesión de Intervalos Finalizada!
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Diagnóstico y Desglose Interválico Guardado:
          </p>
        </div>
        <div className="flex gap-2">
          {weakCount > 0 && (
            <Button variant="danger" onClick={onTrainWeakOnly}>
              🎯 Entrenar Intervalos Débiles ({weakCount})
            </Button>
          )}
          <Button variant="primary" onClick={onRepeatSession}>
            🔄 Repetir Sesión
          </Button>
          <Button variant="secondary" onClick={onResetToConfig}>
            ⚙️ Configurar Otra
          </Button>
        </div>
      </div>

      {/* HEATMAP FINAL DE TECLAS INVOLUCRADAS */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs text-zinc-400">
          <span>Mapa de Precisión en Teclado:</span>
          <div className="flex gap-3 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Dominada
              (&gt;85%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> En progreso
              (50-85%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> A reforzar (&lt;50%)
            </span>
          </div>
        </div>
        <PianoKeyboard
          keys={PIANO_KEYS}
          activeNotes={activeNotesInSession}
          onToggleNote={() => {}}
          performances={keyboardPerformances}
          showHeatmap={true}
          disabled={true}
        />
      </div>

      {/* MÉTRICAS GLOBALES */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <span className="text-zinc-500 block text-[10px]">Total Preguntas</span>
          <strong className="text-base text-zinc-100">{total}</strong>
        </div>
        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <span className="text-zinc-500 block text-[10px]">Precisión de Oído</span>
          <strong
            className={`text-base ${
              accuracy >= 80
                ? 'text-emerald-400'
                : accuracy >= 50
                  ? 'text-amber-400'
                  : 'text-red-400'
            }`}
          >
            {accuracy}%
          </strong>
        </div>
        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <span className="text-zinc-500 block text-[10px]">Exactas / Transportadas</span>
          <strong className="text-sm text-zinc-200">
            <span className="text-emerald-400">{exact}</span> /{' '}
            <span className="text-sky-400">{transposed}</span>
          </strong>
        </div>
        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <span className="text-zinc-500 block text-[10px]">Tiempo Medio</span>
          <strong className="text-base text-zinc-200">{avgTime}s</strong>
        </div>
      </div>

      {/* DESGLOSE POR INTERVALO */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-zinc-300">
          Rendimiento por Clase de Intervalo:
        </div>
        <div className="grid grid-cols-2 gap-2">
          {intervalStats.map((stat) => (
            <div
              key={stat.semitones}
              className={`p-2.5 rounded-lg border flex justify-between items-center text-xs ${
                stat.accuracy >= 85
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                  : stat.accuracy >= 50
                    ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                    : 'bg-red-950/30 border-red-800/60 text-red-300'
              }`}
            >
              <div>
                <span className="font-bold">{stat.name}</span>
                <div className="text-[10px] opacity-75 mt-0.5">
                  Mnemotécnica: &quot;{stat.song}&quot;
                </div>
              </div>
              <div className="text-right font-mono font-bold text-sm">
                {stat.accuracy}%{' '}
                <span className="text-[10px] font-normal opacity-70">({stat.total})</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
