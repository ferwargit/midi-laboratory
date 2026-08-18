import React, { useMemo } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { SequenceExerciseResult } from '../../domain/exercise/sequenceEvaluator'
import { PianoKeyboard } from './PianoKeyboard'
import { generateMidiRange, midiNoteToName } from '../../domain/music/noteUtils'
import { NotePerformance } from '../../domain/adaptation/types'

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6

interface SequenceSummaryCardProps {
  history: SequenceExerciseResult[]
  onRepeatSession: () => void
  onTrainWeakOnly: () => void
  onResetToConfig: () => void
}

export function SequenceSummaryCard({
  history,
  onRepeatSession,
  onTrainWeakOnly,
  onResetToConfig
}: SequenceSummaryCardProps): React.ReactElement {
  const total = history.length
  const exact = history.filter((h) => h.isExactMatch).length
  const contourAccurate = history.filter((h) => h.isContourCorrect).length
  const avgSimilarity =
    total > 0
      ? Math.round(history.reduce((acc, h) => acc + h.similarityScorePercentage, 0) / total)
      : 0
  const avgTime =
    total > 0
      ? (history.reduce((acc, h) => acc + h.responseTimeMs, 0) / total / 1000).toFixed(2)
      : '0.00'

  // Mapa de calor acumulado por notas dentro de las frases
  const keyboardPerformances = useMemo(() => {
    const map = new Map<number, NotePerformance>()
    history.forEach((h) => {
      h.noteByNoteEvaluation.forEach((item) => {
        if (!map.has(item.expected)) {
          map.set(item.expected, {
            noteNumber: item.expected,
            attempts: 0,
            correct: 0,
            lastResultWasCorrect: null,
            accuracyPercentage: 0,
            weight: 1.0
          })
        }
        const perf = map.get(item.expected)!
        perf.attempts += 1
        if (item.isCorrect) perf.correct += 1
        perf.accuracyPercentage = Math.round((perf.correct / perf.attempts) * 100)
      })
    })
    return map
  }, [history])

  const activeNotesInSession = Array.from(new Set(history.flatMap((h) => h.expectedNotes)))
  const weakNotesList = Array.from(keyboardPerformances.values()).filter(
    (p) => p.accuracyPercentage < 85
  )

  return (
    <Card className="border-sky-500/40 bg-zinc-900/90 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-sky-400 m-0">
            🎉 ¡Sesión de Secuencias Finalizada!
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">Diagnóstico de Memoria Melódica Guardado:</p>
        </div>
        <div className="flex gap-2">
          {weakNotesList.length >= 2 && (
            <Button variant="danger" onClick={onTrainWeakOnly}>
              🎯 Entrenar Notas Débiles ({weakNotesList.length})
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

      {/* HEATMAP EN TECLADO */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs text-zinc-400">
          <span>Mapa de Precisión por Nota en las Frases:</span>
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

      {/* MÉTRICAS DE SECUENCIAS */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <span className="text-zinc-500 block text-[10px]">Total Frases</span>
          <strong className="text-base text-zinc-100">{total}</strong>
        </div>
        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <span className="text-zinc-500 block text-[10px]">Similitud Global</span>
          <strong
            className={`text-base ${
              avgSimilarity >= 80
                ? 'text-emerald-400'
                : avgSimilarity >= 50
                  ? 'text-amber-400'
                  : 'text-red-400'
            }`}
          >
            {avgSimilarity}%
          </strong>
        </div>
        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <span className="text-zinc-500 block text-[10px]">Frases Exactas / Contorno</span>
          <strong className="text-sm text-zinc-200">
            <span className="text-emerald-400">{exact}</span> /{' '}
            <span className="text-sky-400">{contourAccurate}</span>
          </strong>
        </div>
        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <span className="text-zinc-500 block text-[10px]">Tiempo Medio</span>
          <strong className="text-base text-zinc-200">{avgTime}s</strong>
        </div>
      </div>

      {/* DETALLE DE NOTAS A REFORZAR */}
      {weakNotesList.length > 0 && (
        <div className="bg-zinc-950 p-3 rounded border border-red-900/40 text-xs">
          <strong className="text-red-400 block mb-1">
            Notas que más fallaron dentro de las frases:
          </strong>
          <div className="flex flex-wrap gap-2">
            {weakNotesList.map((item) => (
              <span
                key={item.noteNumber}
                className="bg-red-950/60 border border-red-800 text-red-300 px-2 py-0.5 rounded"
              >
                {midiNoteToName(item.noteNumber)}: {item.accuracyPercentage}% acierto (
                {item.attempts} veces)
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
