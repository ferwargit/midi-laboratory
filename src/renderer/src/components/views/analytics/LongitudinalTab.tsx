import React from 'react'
import {
  LongitudinalComparison,
  reconstructSessionConfig
} from '../../../domain/analytics/historyAnalytics'
import { DbAnswerRecord } from '../../../domain/database/types'
import { Card } from '../../ui/Card'
import { AiExercisePrescription } from '../../../domain/ai/types'

interface LongitudinalTabProps {
  comparisons: LongitudinalComparison[]
  answers: DbAnswerRecord[]
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

export function LongitudinalTab({
  comparisons,
  answers,
  onLoadPrescription
}: LongitudinalTabProps): React.ReactElement {
  if (comparisons.length === 0) {
    return (
      <Card className="space-y-4 bg-zinc-900/80 backdrop-blur-2xl border-zinc-800/80 shadow-2xl p-8 text-center font-mono">
        <div className="text-3xl">📈</div>
        <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wider m-0">
          Sin Comparativas Test-Retest Disponibles
        </h3>
        <p className="text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Para evaluar tu evolución longitudinal, ve a la pestaña{' '}
          <strong>📋 Registro Clínico</strong> y haz clic en el botón <strong>🔁 Re-testar</strong>{' '}
          en cualquier sesión que desees repetir bajo las mismas condiciones.
        </p>
      </Card>
    )
  }

  return (
    <Card className="space-y-4 bg-zinc-900/80 backdrop-blur-2xl border-sky-950/60 shadow-2xl">
      <div className="flex justify-between items-center pb-2 border-b border-zinc-800 font-mono">
        <div>
          <h3 className="text-base font-bold text-sky-400 m-0 tracking-tight flex items-center gap-2">
            <span>📈 Evolución Longitudinal (Test-Retest de Sesiones Repetidas)</span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Análisis comparativo de plasticidad perceptual entre el primer intento histórico
            (Baseline) y el retest actual:
          </p>
        </div>
        <span className="text-xs text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
          {comparisons.length} comparativa(s) activa(s)
        </span>
      </div>

      <div className="space-y-4 font-mono">
        {comparisons.map((c, i) => {
          const interp = getPsychoacousticInterpretation(c)
          const baselineDate = new Date(c.baselineSession.createdAt).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
          const latestDate = new Date(c.latestSession.createdAt).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })

          return (
            <div
              key={i}
              className="p-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 space-y-3.5 text-xs shadow-xl"
            >
              {/* Cabecera del Contenido y Botón para Re-testear de nuevo */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2.5">
                  <strong className="text-zinc-100 font-sans text-sm">{c.contentName}</strong>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold font-mono ${interp.badgeColor}`}
                  >
                    {interp.badge}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(): void => {
                    const config = reconstructSessionConfig(c.latestSession, answers)
                    onLoadPrescription(config)
                  }}
                  className="px-3 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-600/60 hover:border-sky-400 text-sky-200 text-xs font-mono font-bold transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1.5"
                >
                  <span>🔁</span>
                  <span>Volver a Re-testar</span>
                </button>
              </div>

              {/* Cuadrícula Comparativa: Baseline vs Retest vs Deltas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 text-[11px] font-mono">
                {/* 1. Baseline */}
                <div className="space-y-1.5 p-2.5 bg-zinc-950 rounded-lg border border-zinc-800/60">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold block">
                    1. Baseline (Primer Intento: {baselineDate})
                  </span>
                  <div className="text-zinc-300">
                    Precisión:{' '}
                    <strong className="text-white">{c.baselineSession.accuracyPercentage}%</strong>{' '}
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

                {/* 2. Retest */}
                <div className="space-y-1.5 p-2.5 bg-zinc-950 rounded-lg border border-zinc-800/60">
                  <span className="text-[9px] uppercase tracking-wider text-sky-400 font-bold block">
                    2. Retest (Último Intento: {latestDate})
                  </span>
                  <div className="text-zinc-300">
                    Precisión:{' '}
                    <strong className="text-white">{c.latestSession.accuracyPercentage}%</strong> (
                    {c.latestSession.correctAnswers}/{c.latestSession.totalQuestions})
                  </div>
                  <div className="text-zinc-300">
                    Latencia:{' '}
                    <strong className="text-white">
                      {(c.latestSession.avgResponseTimeMs / 1000).toFixed(2)}s
                    </strong>{' '}
                    ({c.latestSession.avgResponseTimeMs}ms)
                  </div>
                </div>

                {/* 3. Deltas Matemáticos */}
                <div className="space-y-1.5 p-2.5 bg-zinc-950 rounded-lg border border-zinc-800/60">
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
                      {c.latestSession.accuracyPercentage}% - {c.baselineSession.accuracyPercentage}
                      % = {c.rawAccuracyDelta >= 0 ? `+${c.rawAccuracyDelta}` : c.rawAccuracyDelta}%
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
                      {c.latestSession.avgResponseTimeMs}ms - {c.baselineSession.avgResponseTimeMs}
                      ms ={' '}
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

              {/* Interpretación Psicoacústica y Consejo */}
              <div className="p-3.5 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-1.5 font-sans">
                <div className="text-xs text-zinc-200 leading-relaxed">
                  <strong className="text-sky-300 font-mono text-[11px] uppercase mr-1.5">
                    Diagnóstico Psicoacústico:
                  </strong>
                  {interp.explanation}
                </div>
                <div className="text-xs text-emerald-300/90 font-medium pt-1 border-t border-zinc-800/60">
                  💡 {interp.actionableTip}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
