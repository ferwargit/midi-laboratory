import React, { useState } from 'react'
import { useDatabaseStore } from '../../stores/useDatabaseStore'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { StatCard } from '../ui/StatCard'
import { Badge } from '../ui/Badge'
import { AnalyticsCharts } from '../trainer/AnalyticsCharts'
import { AiExercisePrescription } from '../../domain/ai/types'

interface AnalyticsViewProps {
  onLoadPrescription: (prescription: AiExercisePrescription) => void
}

export function AnalyticsView({ onLoadPrescription }: AnalyticsViewProps): React.ReactElement {
  const {
    summary,
    sessions,
    answers,
    metrics,
    aiResponse,
    isLmStudioOnline,
    isAiAnalyzing,
    runAiDiagnostic,
    checkLmStudioStatus
  } = useDatabaseStore()

  const [activeTab, setActiveTab] = useState<'ai_report' | 'charts' | 'confusions' | 'sessions'>(
    'ai_report'
  )

  return (
    <div className="space-y-4">
      {/* CABECERA DE MÉTRICAS GLOBALES */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard title="Total Sesiones" value={summary.totalSessions} />
        <StatCard
          title="Precisión Histórica"
          value={`${summary.overallAccuracy}%`}
          highlightColor={
            summary.overallAccuracy >= 80
              ? 'text-emerald-400'
              : summary.overallAccuracy >= 50
                ? 'text-amber-400'
                : 'text-red-400'
          }
        />
        <StatCard title="Ejercicios Realizados" value={summary.totalExercises} />
        <StatCard title="Tiempo Medio" value={`${(summary.overallAvgTimeMs / 1000).toFixed(2)}s`} />
      </div>

      {/* PESTAÑAS DE ANALÍTICA & ESTADO LM STUDIO */}
      <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(): void => setActiveTab('ai_report')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'ai_report'
                ? 'bg-purple-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            🧠 Diagnóstico & Prescripción con IA
          </button>
          <button
            type="button"
            onClick={(): void => setActiveTab('charts')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'charts'
                ? 'bg-sky-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            📈 Gráficos & Tendencias
          </button>
          <button
            type="button"
            onClick={(): void => setActiveTab('confusions')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'confusions'
                ? 'bg-sky-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            📊 Matriz de Confusión
          </button>
          <button
            type="button"
            onClick={(): void => setActiveTab('sessions')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'sessions'
                ? 'bg-sky-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            📜 Historial ({sessions.length})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={(): void => {
              checkLmStudioStatus()
            }}
            title="Hacer clic para re-comprobar conexión con LM Studio"
            className="cursor-pointer text-zinc-400 hover:text-white"
          >
            🔄
          </button>
          <span className="text-zinc-500">LM Studio Local:</span>
          <Badge variant={isLmStudioOnline ? 'success' : 'warning'}>
            {isLmStudioOnline ? '🟢 Conectado (RTX 4060)' : '🟡 Apagado (Usando Motor Local)'}
          </Badge>
        </div>
      </div>

      {/* 1. INFORME DE IA & PRESCRIPCIÓN EJECUTABLE */}
      {activeTab === 'ai_report' && (
        <Card className="space-y-4 bg-zinc-900/90 border-purple-900/40">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-purple-400 m-0">
                ✨ Diagnóstico Asistido por Inteligencia Artificial
              </h3>
              <span className="text-[11px] text-zinc-500">
                Modelo: {aiResponse?.modelName || 'Iniciando...'}
              </span>
            </div>

            <Button
              size="sm"
              variant="primary"
              disabled={isAiAnalyzing}
              onClick={runAiDiagnostic}
              className="bg-purple-600 hover:bg-purple-500 font-bold text-xs"
            >
              {isAiAnalyzing ? '⏳ Analizando en GPU RTX 4060...' : '🔄 Re-analizar con IA'}
            </Button>
          </div>

          <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-300 leading-relaxed whitespace-pre-line font-sans">
            {aiResponse?.analysisText || 'Generando análisis de rendimiento...'}
          </div>

          {aiResponse?.prescription && (
            <div className="p-4 bg-purple-950/30 border border-purple-800/60 rounded-xl space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-purple-400 font-mono uppercase tracking-wider font-bold">
                    🎯 Prescripción Pedagógica Diseñada por la IA:
                  </span>
                  <h4 className="text-sm font-bold text-zinc-100 mt-0.5 m-0">
                    {aiResponse.prescription.title}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-normal">
                    {aiResponse.prescription.rationale}
                  </p>
                </div>

                <Button
                  variant="success"
                  onClick={(): void => onLoadPrescription(aiResponse.prescription)}
                  className="shrink-0 font-bold text-xs shadow-lg animate-pulse"
                >
                  🚀 Cargar y Comenzar Ejercicio
                </Button>
              </div>

              <div className="flex gap-2 text-[11px] font-mono text-zinc-300 pt-1 border-t border-purple-900/40">
                <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                  Modalidad: {aiResponse.prescription.targetMode}
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                  Timbre: {aiResponse.prescription.instrumentId}
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                  Criterio: {aiResponse.prescription.limitType}
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 2. GRÁFICOS & TENDENCIAS HISTÓRICAS */}
      {activeTab === 'charts' && <AnalyticsCharts sessions={sessions} answers={answers} />}

      {/* 3. MATRIZ DE CONFUSIÓN */}
      {activeTab === 'confusions' && (
        <Card className="space-y-4 bg-zinc-900/90 border-zinc-800">
          <div>
            <h3 className="text-base font-bold text-zinc-100 m-0">
              Psicometría de Confusión y Latencia
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Desglose analítico de errores y tiempos de respuesta acumulados:
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-2">
              <span className="text-xs font-bold text-red-400 block">
                Top 5 Pares de Confusión:
              </span>
              {metrics.topConfusions.length === 0 ? (
                <div className="text-zinc-600 text-xs italic">
                  No hay suficientes errores registrados.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {metrics.topConfusions.map((c, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center text-xs p-2 bg-zinc-900 rounded border border-zinc-800"
                    >
                      <span>
                        Esperada: <strong className="text-white">{c.expected}</strong> ➔ Tocada:{' '}
                        <strong className="text-red-300">{c.played}</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 font-bold font-mono text-[10px]">
                        {c.count} {c.count === 1 ? 'vez' : 'veces'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-3 text-xs">
              <span className="font-bold text-sky-400 block">
                Distribución de Velocidad Cognitiva:
              </span>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-emerald-400 font-semibold">
                      ⚡ Reflejo Inmediato (&lt; 1.2s)
                    </span>
                    <span className="font-mono font-bold">{metrics.fastResponsesCount} resp.</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-900 rounded overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${metrics.totalAnswers > 0 ? (metrics.fastResponsesCount / metrics.totalAnswers) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-amber-400 font-semibold">
                      🤔 Deducción Activa (1.2s - 2.8s)
                    </span>
                    <span className="font-mono font-bold">
                      {metrics.mediumResponsesCount} resp.
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-900 rounded overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{
                        width: `${metrics.totalAnswers > 0 ? (metrics.mediumResponsesCount / metrics.totalAnswers) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-red-400 font-semibold">⏳ Inseguridad (&gt; 2.8s)</span>
                    <span className="font-mono font-bold">{metrics.slowResponsesCount} resp.</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-900 rounded overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{
                        width: `${metrics.totalAnswers > 0 ? (metrics.slowResponsesCount / metrics.totalAnswers) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 4. HISTORIAL DE SESIONES */}
      {activeTab === 'sessions' && (
        <Card className="space-y-3 bg-zinc-900/90 border-zinc-800">
          <h3 className="text-base font-bold text-zinc-100 m-0">Historial Completo de Sesiones</h3>
          {sessions.length === 0 ? (
            <div className="text-center py-6 text-zinc-600 text-xs italic">
              No hay sesiones registradas en la base de datos local.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-[11px]">
                    <th className="pb-2">Fecha y Hora</th>
                    <th className="pb-2">Modalidad / Preset</th>
                    <th className="pb-2 text-center">Preguntas</th>
                    <th className="pb-2 text-center">Precisión</th>
                    <th className="pb-2 text-right">Tiempo Medio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-950/40">
                      <td className="py-2.5 text-zinc-400 font-sans text-[11px]">
                        {new Date(s.createdAt).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-2.5 font-sans font-medium text-zinc-200">{s.presetName}</td>
                      <td className="py-2.5 text-center">
                        <span className="text-emerald-400 font-bold">{s.correctAnswers}</span> /{' '}
                        <span className="text-zinc-400">{s.totalQuestions}</span>
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`font-bold ${
                            s.accuracyPercentage >= 80
                              ? 'text-emerald-400'
                              : s.accuracyPercentage >= 50
                                ? 'text-amber-400'
                                : 'text-red-400'
                          }`}
                        >
                          {s.accuracyPercentage}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-zinc-300">
                        {(s.avgResponseTimeMs / 1000).toFixed(2)}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
