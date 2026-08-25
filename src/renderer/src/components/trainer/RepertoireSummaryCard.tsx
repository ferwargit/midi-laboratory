import React from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { RepertoireExerciseResult } from '../../domain/exercise/repertoireEvaluator'
import { ScoreDataModel } from '../../domain/music/scoreTypes'

interface RepertoireSummaryCardProps {
  score: ScoreDataModel | null
  history: RepertoireExerciseResult[]
  studyBpm: number
  onRepeatSession: () => void
  onResetToConfig: () => void
}

export function RepertoireSummaryCard({
  score,
  history,
  studyBpm,
  onRepeatSession,
  onResetToConfig
}: RepertoireSummaryCardProps): React.ReactElement {
  const total = history.length
  const perfect = history.filter((h) => h.isCompleteSuccess).length
  const avgPitch =
    total > 0 ? Math.round(history.reduce((acc, h) => acc + h.pitchAccuracyPercent, 0) / total) : 0
  const avgRhythm =
    total > 0 ? Math.round(history.reduce((acc, h) => acc + h.rhythmAccuracyPercent, 0) / total) : 0
  const avgScore =
    total > 0 ? Math.round(history.reduce((acc, h) => acc + h.overallScorePercent, 0) / total) : 0

  return (
    <Card className="border-purple-500/40 bg-zinc-900/90 backdrop-blur-2xl space-y-4 shadow-2xl">
      <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
        <div>
          <h3 className="text-lg font-bold text-purple-400 m-0 tracking-tight flex items-center gap-2">
            <span>🎉 ¡Sesión de Repertorio Completada!</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Diagnóstico de Audiación y Fraseo Motor para:{' '}
            <strong className="text-zinc-200">{score?.title || 'Obra'}</strong> (
            {score?.composer || 'Autor'})
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={onRepeatSession} className="font-mono text-xs">
            🔄 Repetir Fragmento
          </Button>
          <Button variant="secondary" onClick={onResetToConfig} className="font-mono text-xs">
            ⚙️ Ajustar Configuración
          </Button>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPALES */}
      <div className="grid grid-cols-4 gap-2.5 text-center text-xs font-mono">
        <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
          <span className="text-zinc-500 block text-[10px] uppercase">Frases Tocadas</span>
          <strong className="text-base text-zinc-100">{total}</strong>
        </div>
        <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
          <span className="text-zinc-500 block text-[10px] uppercase">Acierto Global</span>
          <strong
            className={`text-base ${
              avgScore >= 85
                ? 'text-emerald-400'
                : avgScore >= 60
                  ? 'text-amber-400'
                  : 'text-rose-400'
            }`}
          >
            {avgScore}%
          </strong>
        </div>
        <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
          <span className="text-zinc-500 block text-[10px] uppercase">Afinación / Ritmo</span>
          <strong className="text-sm text-zinc-200">
            <span className="text-emerald-400">{avgPitch}%</span> /{' '}
            <span className="text-sky-400">{avgRhythm}%</span>
          </strong>
        </div>
        <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
          <span className="text-zinc-500 block text-[10px] uppercase">Tempo Alcanzado</span>
          <strong className="text-base text-purple-300">{studyBpm} BPM</strong>
        </div>
      </div>

      {/* RESUMEN DE FRASES PERFECTAS */}
      <div className="p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <span>🌟</span>
          <span>Frases 100% Perfectas (Afinación y Ritmo):</span>
        </div>
        <span className="text-emerald-400 font-bold text-sm">
          {perfect} de {total} intentos ({total > 0 ? Math.round((perfect / total) * 100) : 0}%)
        </span>
      </div>
    </Card>
  )
}
