import React from 'react'
import { AnalyticsModeFilter, AnalyticsMetrics } from '../../../domain/analytics/historyAnalytics'
import { midiNoteToName } from '../../../domain/music/noteUtils'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { AiAnalysisResponse, AiExercisePrescription } from '../../../domain/ai/types'
import { MarkdownRenderer } from '../../ui/MarkdownRenderer'

interface AiDiagnosticTabProps {
  modeFilter: AnalyticsModeFilter
  currentAiResponse: AiAnalysisResponse | null
  isAiAnalyzing: boolean
  reasoningSeconds: number
  lastGeneratedAt: string | null
  metrics: AnalyticsMetrics
  onRunDiagnostic: () => void
  onLoadPrescription: (p: AiExercisePrescription) => void
}

function formatReasoningTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function AiDiagnosticTab({
  modeFilter,
  currentAiResponse,
  isAiAnalyzing,
  reasoningSeconds,
  lastGeneratedAt,
  onRunDiagnostic,
  onLoadPrescription
}: AiDiagnosticTabProps): React.ReactElement {
  return (
    <Card className="space-y-4 bg-zinc-900/80 backdrop-blur-2xl border-purple-900/40 shadow-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-zinc-800">
        <div>
          <h3 className="text-base font-bold text-purple-400 m-0 tracking-tight flex items-center gap-2">
            <span>✨ Diagnóstico Psicoacústico Actual ({modeFilter.toUpperCase()})</span>
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-zinc-400 font-mono">
              🏷️ Modelo:{' '}
              <strong className="text-zinc-200">
                {currentAiResponse?.modelName || 'Qwen 3.5 en GPU NVIDIA'}
              </strong>
            </span>
            {lastGeneratedAt && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 font-semibold">
                ✅ Generado a las {lastGeneratedAt}
              </span>
            )}
          </div>
        </div>

        <Button
          size="sm"
          variant="primary"
          disabled={isAiAnalyzing}
          onClick={onRunDiagnostic}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(168,85,247,0.3)] border border-purple-400/30 shrink-0"
        >
          {isAiAnalyzing ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>Razonando en GPU ({formatReasoningTime(reasoningSeconds)})...</span>
            </div>
          ) : (
            '🔄 Generar Nuevo Diagnóstico'
          )}
        </Button>
      </div>

      {/* HUD de Razonamiento */}
      {isAiAnalyzing && (
        <div className="p-5 bg-purple-950/30 border border-purple-500/50 rounded-2xl space-y-3 font-mono animate-pulse">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="w-4 h-4 rounded-full bg-purple-400 animate-ping absolute" />
              <span className="w-3 h-3 rounded-full bg-purple-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-purple-200 m-0">
                🧠 El modelo de IA Local está razonando en GPU NVIDIA (
                {formatReasoningTime(reasoningSeconds)})...
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Analizando patrones de fatiga, velocidad de reflejo, correlación de sesgo
                direccional y calculando prescripción adaptativa.
              </p>
            </div>
          </div>
          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-sky-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* Informe Textual con Markdown Renderer */}
      {!isAiAnalyzing && (
        <div className="p-5 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 shadow-inner">
          <MarkdownRenderer
            content={
              currentAiResponse?.analysisText ||
              'Presiona "Generar Nuevo Diagnóstico" para analizar las sesiones.'
            }
          />
        </div>
      )}

      {/* Prescripción */}
      {!isAiAnalyzing && currentAiResponse?.prescription && (
        <div className="p-4 bg-purple-950/30 border border-purple-800/60 rounded-2xl space-y-3.5 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div>
              <span className="text-xs text-purple-400 font-mono uppercase tracking-wider font-bold block">
                🎯 Prescripción Pedagógica Diseñada a Medida:
              </span>
              <h4 className="text-base font-bold text-zinc-100 mt-1 m-0">
                {currentAiResponse.prescription.title}
              </h4>
              <p className="text-xs md:text-sm text-zinc-300 mt-1 leading-normal">
                {currentAiResponse.prescription.rationale}
              </p>
            </div>

            <Button
              variant="success"
              onClick={(): void => onLoadPrescription(currentAiResponse.prescription)}
              className="shrink-0 font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
            >
              🚀 Cargar y Ejecutar Ejercicio
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-mono pt-3 border-t border-purple-900/40">
            <span className="px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
              Modo:{' '}
              <strong className="text-sky-300">{currentAiResponse.prescription.targetMode}</strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
              Timbre:{' '}
              <strong className="text-emerald-300">
                {currentAiResponse.prescription.instrumentId}
              </strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
              Criterio:{' '}
              <strong className="text-amber-300">{currentAiResponse.prescription.limitType}</strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
              Avance:{' '}
              <strong className="text-purple-300">
                {currentAiResponse.prescription.advanceMode}
              </strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
              Tonos:{' '}
              <strong className="text-white">
                {currentAiResponse.prescription.recommendedNotes
                  .map((n) => midiNoteToName(n))
                  .join(', ')}
              </strong>
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
