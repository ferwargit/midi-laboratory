import React from 'react'
import {
  AnalyticsModeFilter,
  AnalyticsMetrics,
  LongitudinalComparison
} from '../../../domain/analytics/historyAnalytics'
import { midiNoteToName } from '../../../domain/music/noteUtils'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { AiAnalysisResponse, AiExercisePrescription } from '../../../domain/ai/types'

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

function getPsychoacousticInterpretation(c: LongitudinalComparison): {
  badge: string
  badgeColor: string
  explanation: string
  actionableTip: string
} {
  const isAccuracyHigher = c.rawAccuracyDelta > 0
  const isAccuracyStable = c.rawAccuracyDelta === 0 || c.rawAccuracyDelta === -1
  const isSlower = c.responseTimeDeltaMs > 150
  const isFaster = c.responseTimeDeltaMs < -150

  if (isAccuracyHigher && isFaster) {
    return {
      badge: '🌟 CONSOLIDACIÓN ÓPTIMA',
      badgeColor: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300',
      explanation: `Tu cerebro mejoró su precisión (+${c.rawAccuracyDelta}%) reduciendo el tiempo de reacción (${Math.abs(c.responseTimeDeltaMs)}ms más rápido). Esto evidencia una representación mental del tono más sólida y un acceso directo sin sobrepensamiento.`,
      actionableTip:
        'Recomendación: Estás listo para ampliar el pool de notas o aumentar la entropía agregando alteraciones cromáticas.'
    }
  }

  if (isAccuracyHigher && isSlower) {
    return {
      badge: '🎯 MAYOR PRECISIÓN CON DEDUCCIÓN ACTIVA',
      badgeColor: 'bg-sky-950/80 border-sky-500/60 text-sky-300',
      explanation: `Lograste mayor exactitud (+${c.rawAccuracyDelta}%), pero requirió +${c.responseTimeDeltaMs}ms de procesamiento mental. Tu oído está discriminando bien, pero aún utiliza deducción interválica en lugar de reconocimiento de reflejo instantáneo.`,
      actionableTip:
        'Recomendación: Realizar sesiones cronometradas cortas (1 minuto) para acelerar la velocidad de decisión.'
    }
  }

  if (isAccuracyStable && isSlower) {
    return {
      badge: '⚠️ PRECISIÓN ESTABLE CON FATIGA AUDITIVA',
      badgeColor: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
      explanation: `Tu oído mantuvo la precisión casi intacta (${c.baselineSession.accuracyPercentage}% ➔ ${c.latestSession.accuracyPercentage}%), pero tardó +${c.responseTimeDeltaMs}ms más por nota. En psicoacústica, cuando la precisión se sostiene pero la latencia sube tras varias sesiones, es el síntoma clínico primario de fatiga auditiva (el cerebro tarda más en decodificar los armónicos).`,
      actionableTip:
        'Recomendación: Realizar una pausa de descanso auditivo de 15 minutos antes de la siguiente sesión.'
    }
  }

  if (isAccuracyStable && isFaster) {
    return {
      badge: '⚡ MAYOR VELOCIDAD DE FLUJO',
      badgeColor: 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300',
      explanation: `Mantuviste la misma tasa de acierto respondiendo ${Math.abs(c.responseTimeDeltaMs)}ms más rápido y aumentando tu cadencia en +${c.rpmDelta} RPM. Tu reflejo auditivo se está automatizando.`,
      actionableTip:
        'Recomendación: Mantener este formato para fijar el reflejo antes de subir de nivel.'
    }
  }

  return {
    badge: '🔄 NECESIDAD DE ANCLAJE TONAL',
    badgeColor: 'bg-rose-950/80 border-rose-500/60 text-rose-300',
    explanation: `Se detectó una disminución en la tasa de acierto (${c.rawAccuracyDelta}%) con un cambio en la velocidad de respuesta. Las notas conflictivas están generando interferencia perceptual transitoria.`,
    actionableTip:
      'Recomendación: Entrenar en Modo Maestría focalizado exclusivamente en los pares de notas conflictivas.'
  }
}

export function AiDiagnosticTab({
  modeFilter,
  currentAiResponse,
  isAiAnalyzing,
  reasoningSeconds,
  lastGeneratedAt,
  metrics,
  onRunDiagnostic,
  onLoadPrescription
}: AiDiagnosticTabProps): React.ReactElement {
  return (
    <Card className="space-y-4 bg-zinc-900/80 backdrop-blur-2xl border-purple-900/40 shadow-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-zinc-800">
        <div>
          <h3 className="text-base font-bold text-purple-400 m-0 tracking-tight flex items-center gap-2">
            <span>✨ Diagnóstico Psicoacústico ({modeFilter.toUpperCase()})</span>
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-zinc-500 font-mono">
              Modelo: {currentAiResponse?.modelName || 'Qwen 3.5 en GPU NVIDIA'}
            </span>
            {lastGeneratedAt && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/80 text-emerald-300">
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
              <span>Razonando en GPU ({reasoningSeconds}s)...</span>
            </div>
          ) : (
            '🔄 Generar Diagnóstico & Comparativa'
          )}
        </Button>
      </div>

      {/* HUD de Razonamiento en GPU */}
      {isAiAnalyzing && (
        <div className="p-5 bg-purple-950/30 border border-purple-500/50 rounded-2xl space-y-3 font-mono animate-pulse">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="w-4 h-4 rounded-full bg-purple-400 animate-ping absolute" />
              <span className="w-3 h-3 rounded-full bg-purple-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-purple-200 m-0">
                🧠 El modelo de IA Local está razonando en GPU NVIDIA ({reasoningSeconds} segundos
                transcurridos)...
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Analizando patrones de fatiga, velocidad de reflejo, correlación de sesgo
                direccional y calculando deltas de re-testeo.
              </p>
            </div>
          </div>
          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-sky-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* Banner de Evolución Longitudinal */}
      {metrics.longitudinalComparisons && metrics.longitudinalComparisons.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-sky-950/40 via-purple-950/40 to-zinc-900 rounded-2xl border border-sky-500/40 space-y-3 font-mono shadow-xl">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-sky-500/20">
            <span className="font-bold text-sky-300 flex items-center gap-2">
              <span className="text-base">📈</span>
              <span className="tracking-wider uppercase">
                Evolución Longitudinal de Re-testeo (Test-Retest):
              </span>
            </span>
            <span className="text-[10px] text-zinc-400">
              {metrics.longitudinalComparisons.length} comparativa(s) activa(s)
            </span>
          </div>

          <div className="space-y-3">
            {metrics.longitudinalComparisons.map((c, i) => {
              const interp = getPsychoacousticInterpretation(c)
              const baselineDate = new Date(c.baselineSession.createdAt).toLocaleDateString(
                'es-AR',
                {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                }
              )
              const latestDate = new Date(c.latestSession.createdAt).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })

              return (
                <div
                  key={i}
                  className="p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 space-y-3 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <strong className="text-zinc-100 font-sans text-sm">{c.contentName}</strong>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold font-mono ${interp.badgeColor}`}
                    >
                      {interp.badge}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 text-[11px] font-mono">
                    <div className="space-y-1 p-2 bg-zinc-950 rounded-lg border border-zinc-800/60">
                      <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold block">
                        1. Baseline (Primer Intento: {baselineDate})
                      </span>
                      <div className="text-zinc-300">
                        Precisión:{' '}
                        <strong className="text-white">
                          {c.baselineSession.accuracyPercentage}%
                        </strong>{' '}
                        ({c.baselineSession.correctAnswers}/{c.baselineSession.totalQuestions})
                      </div>
                      <div className="text-zinc-300">
                        Latencia:{' '}
                        <strong className="text-white">
                          {(c.baselineSession.avgResponseTimeMs / 1000).toFixed(2)}s
                        </strong>{' '}
                        ({c.baselineSession.avgResponseTimeMs}ms)
                      </div>
                    </div>

                    <div className="space-y-1 p-2 bg-zinc-950 rounded-lg border border-zinc-800/60">
                      <span className="text-[9px] uppercase tracking-wider text-sky-400 font-bold block">
                        2. Retest (Último Intento: {latestDate})
                      </span>
                      <div className="text-zinc-300">
                        Precisión:{' '}
                        <strong className="text-white">
                          {c.latestSession.accuracyPercentage}%
                        </strong>{' '}
                        ({c.latestSession.correctAnswers}/{c.latestSession.totalQuestions})
                      </div>
                      <div className="text-zinc-300">
                        Latencia:{' '}
                        <strong className="text-white">
                          {(c.latestSession.avgResponseTimeMs / 1000).toFixed(2)}s
                        </strong>{' '}
                        ({c.latestSession.avgResponseTimeMs}ms)
                      </div>
                    </div>

                    <div className="space-y-1 p-2 bg-zinc-950 rounded-lg border border-zinc-800/60">
                      <span className="text-[9px] uppercase tracking-wider text-purple-400 font-bold block">
                        3. Cálculo de Deltas (Δ)
                      </span>
                      <div className="text-zinc-300">
                        Δ Precisión:{' '}
                        <strong
                          className={
                            c.rawAccuracyDelta >= 0
                              ? 'text-emerald-400 font-bold'
                              : 'text-rose-400 font-bold'
                          }
                        >
                          {c.latestSession.accuracyPercentage}% -{' '}
                          {c.baselineSession.accuracyPercentage}% ={' '}
                          {c.rawAccuracyDelta >= 0 ? `+${c.rawAccuracyDelta}` : c.rawAccuracyDelta}%
                        </strong>
                      </div>
                      <div className="text-zinc-300">
                        Δ Latencia:{' '}
                        <strong
                          className={
                            c.responseTimeDeltaMs <= 0
                              ? 'text-emerald-400 font-bold'
                              : 'text-amber-400 font-bold'
                          }
                        >
                          {c.latestSession.avgResponseTimeMs}ms -{' '}
                          {c.baselineSession.avgResponseTimeMs}ms ={' '}
                          {c.responseTimeDeltaMs > 0
                            ? `+${c.responseTimeDeltaMs}`
                            : c.responseTimeDeltaMs}
                          ms {c.responseTimeDeltaMs > 0 ? '(más lento)' : '(más rápido)'}
                        </strong>
                      </div>
                      <div className="text-zinc-400 text-[10px]">
                        Δ Cadencia: {c.rpmDelta >= 0 ? `+${c.rpmDelta}` : c.rpmDelta} RPM
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-1.5 font-sans">
                    <div className="text-xs text-zinc-200 leading-relaxed">
                      <strong className="text-sky-300 font-mono text-[11px] uppercase mr-1.5">
                        Diagnóstico Clínico:
                      </strong>
                      {interp.explanation}
                    </div>
                    <div className="text-xs text-emerald-300/90 font-medium">
                      💡 {interp.actionableTip}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Informe Textual de la IA */}
      {!isAiAnalyzing && (
        <div className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 text-xs text-zinc-300 leading-relaxed whitespace-pre-line font-sans shadow-inner">
          {currentAiResponse?.analysisText || 'Generando informe psicométrico...'}
        </div>
      )}

      {/* Prescripción */}
      {!isAiAnalyzing && currentAiResponse?.prescription && (
        <div className="p-4 bg-purple-950/30 border border-purple-800/60 rounded-2xl space-y-3.5 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div>
              <span className="text-[10px] text-purple-400 font-mono uppercase tracking-wider font-bold block">
                🎯 Prescripción Pedagógica Diseñada a Medida:
              </span>
              <h4 className="text-base font-bold text-zinc-100 mt-1 m-0">
                {currentAiResponse.prescription.title}
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-normal">
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

          <div className="flex flex-wrap gap-2 text-[11px] font-mono pt-3 border-t border-purple-900/40">
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
              Modo:{' '}
              <strong className="text-sky-300">{currentAiResponse.prescription.targetMode}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
              Timbre:{' '}
              <strong className="text-emerald-300">
                {currentAiResponse.prescription.instrumentId}
              </strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
              Criterio:{' '}
              <strong className="text-amber-300">{currentAiResponse.prescription.limitType}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
              Avance:{' '}
              <strong className="text-purple-300">
                {currentAiResponse.prescription.advanceMode}
              </strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
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
