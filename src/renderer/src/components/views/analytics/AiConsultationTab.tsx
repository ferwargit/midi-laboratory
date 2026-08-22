import React, { useState } from 'react'
import { AnalyticsMetrics, AnalyticsModeFilter } from '../../../domain/analytics/historyAnalytics'
import { DbAiConsultationRecord } from '../../../domain/database/types'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { LmStudioService } from '../../../domain/ai/lmStudioService'
import { MarkdownRenderer } from '../../ui/MarkdownRenderer'

interface AiConsultationTabProps {
  modeFilter: AnalyticsModeFilter
  metrics: AnalyticsMetrics
  consultations: DbAiConsultationRecord[]
  onSaveConsultation: (c: DbAiConsultationRecord) => Promise<void>
}

const aiService = new LmStudioService()

function formatReasoningTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function AiConsultationTab({
  modeFilter,
  metrics,
  consultations,
  onSaveConsultation
}: AiConsultationTabProps): React.ReactElement {
  const [userQuery, setUserQuery] = useState('')
  const [isAnswering, setIsAnswering] = useState(false)
  const [reasoningSeconds, setReasoningSeconds] = useState(0)
  const [currentResponse, setCurrentResponse] = useState<string | null>(null)
  const [activeModel, setActiveModel] = useState<string>('Qwen 3.5 en GPU')

  const suggestedQueries = [
    '¿Por qué aumenta mi latencia en la segunda mitad de mis sesiones?',
    '¿Cómo interpreto la diferencia entre mi precisión cruda y mi oído real IRT?',
    '¿Cómo puedo resolver los errores recurrentes entre F4 y E4?',
    'Explícame cómo influye la entropía de bits cuando paso de 3 notas a 8 notas.'
  ]

  const handleSendQuery = async (queryText?: string): Promise<void> => {
    const textToSend = queryText || userQuery
    if (!textToSend.trim() || isAnswering) return

    setIsAnswering(true)
    setReasoningSeconds(0)
    setCurrentResponse(null)

    const timer = setInterval(() => {
      setReasoningSeconds((prev) => prev + 1)
    }, 1000)

    try {
      const res = await aiService.askCustomConsultation(textToSend, metrics)
      clearInterval(timer)
      setIsAnswering(false)
      setCurrentResponse(res.content)
      setActiveModel(res.modelName)

      const record: DbAiConsultationRecord = {
        id: `ai_consult_${Date.now()}`,
        createdAt: new Date().toISOString(),
        modelName: res.modelName,
        modeFilter,
        userQuery: textToSend,
        aiResponse: res.content,
        associatedMetricsSnapshot: {
          overallAccuracy: metrics.overallAccuracy,
          normalizedAccuracy: metrics.normalizedOverallAccuracy,
          avgLatencyMs: metrics.avgResponseTimeMs,
          poolEntropyBits: metrics.avgEntropyBits
        }
      }
      await onSaveConsultation(record)
      setUserQuery('')
    } catch {
      clearInterval(timer)
      setIsAnswering(false)
    }
  }

  const filteredConsultations = consultations.filter(
    (c) => modeFilter === 'all' || c.modeFilter === modeFilter
  )

  return (
    <Card className="space-y-4 bg-zinc-900/80 backdrop-blur-2xl border-purple-900/40 shadow-2xl">
      <div className="flex justify-between items-center pb-2.5 border-b border-zinc-800 font-mono">
        <div>
          <h3 className="text-base font-bold text-purple-400 m-0 tracking-tight flex items-center gap-2">
            <span>💬 Tutor Psicoacústico Interactivo (Consultas con IA Local)</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Hazle cualquier pregunta teórica o consulta sobre tu oído. Qwen utilizará tus métricas
            reales para responder:
          </p>
        </div>
        <span className="text-xs text-zinc-400 bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800 font-bold">
          {filteredConsultations.length} consulta(s) guardada(s)
        </span>
      </div>

      {/* 1. CAJA DE ENTRADA DE PREGUNTAS */}
      <div className="space-y-2.5">
        <div className="relative">
          <textarea
            value={userQuery}
            onChange={(e): void => setUserQuery(e.target.value)}
            placeholder="Escribe tu duda psicoacústica aquí (ej: ¿Por qué tengo sesgo hacia lo agudo en Piano Acústico?)..."
            rows={3}
            disabled={isAnswering}
            className="w-full bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-sans transition-all resize-none shadow-inner"
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={isAnswering || !userQuery.trim()}
              onClick={(): void => {
                void handleSendQuery()
              }}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold text-xs shadow-[0_0_15px_rgba(168,85,247,0.3)]"
            >
              {isAnswering
                ? `Razonando (${formatReasoningTime(reasoningSeconds)})...`
                : 'Enviar Pregunta ➔'}
            </Button>
          </div>
        </div>

        {/* Sugerencias Rápidas */}
        <div className="space-y-1">
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider block font-semibold">
            Preguntas Rápidas de Estudio:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {suggestedQueries.map((q, i) => (
              <button
                key={i}
                type="button"
                disabled={isAnswering}
                onClick={(): void => {
                  void handleSendQuery(q)
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 text-xs text-zinc-300 hover:text-purple-300 font-sans transition-all cursor-pointer text-left disabled:opacity-40"
              >
                💡 {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. HUD DE RAZONAMIENTO */}
      {isAnswering && (
        <div className="p-4 bg-purple-950/30 border border-purple-500/50 rounded-2xl space-y-2.5 font-mono animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-purple-400 animate-ping" />
            <span className="text-sm font-bold text-purple-200">
              Qwen 3.5 en GPU NVIDIA está analizando tu telemetría y razonando la respuesta (
              {formatReasoningTime(reasoningSeconds)})...
            </span>
          </div>
          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-sky-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* 3. RESPUESTA RECIÉN GENERADA */}
      {currentResponse && !isAnswering && (
        <div className="p-5 bg-zinc-950/90 rounded-2xl border border-purple-500/40 space-y-3 text-sm text-zinc-200 font-sans shadow-xl">
          <div className="flex justify-between items-center font-mono pb-2 border-b border-zinc-800 text-xs">
            <span className="text-purple-300 font-bold">
              ✨ Devolución del Tutor (🏷️ {activeModel}):
            </span>
            <span className="text-emerald-400 text-xs font-bold">💾 Guardada en Base de Datos</span>
          </div>
          <MarkdownRenderer content={currentResponse} />
        </div>
      )}

      {/* 4. HISTORIAL PERSISTENTE CON PARSER MARKDOWN */}
      <div className="space-y-3 pt-3 border-t border-zinc-800/80 font-mono">
        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider m-0">
          Historial de Consultas Guardadas ({filteredConsultations.length})
        </h4>

        {filteredConsultations.length === 0 ? (
          <div className="text-center py-6 text-zinc-600 text-xs italic font-sans">
            Aún no has guardado consultas. Escribe una pregunta o haz clic en una sugerencia arriba.
          </div>
        ) : (
          <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1.5">
            {filteredConsultations.map((c) => (
              <div
                key={c.id}
                className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800 space-y-2.5 text-sm shadow-md"
              >
                <div className="flex justify-between items-start">
                  <div className="font-bold text-purple-300 font-sans text-sm md:text-base">
                    ❓ {c.userQuery}
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[11px] text-zinc-400 font-mono block">
                      {new Date(c.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="text-[10px] text-purple-400 font-mono">🏷️ {c.modelName}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-900">
                  <MarkdownRenderer content={c.aiResponse} />
                </div>

                {c.associatedMetricsSnapshot && (
                  <div className="pt-2 border-t border-zinc-900/60 flex gap-4 text-xs font-mono text-zinc-400">
                    <span>
                      Precisión:{' '}
                      <strong className="text-zinc-200">
                        {c.associatedMetricsSnapshot.overallAccuracy}%
                      </strong>
                    </span>
                    <span>
                      Oído Real:{' '}
                      <strong className="text-emerald-400">
                        {c.associatedMetricsSnapshot.normalizedAccuracy}%
                      </strong>
                    </span>
                    <span>
                      Latencia:{' '}
                      <strong className="text-sky-400">
                        {(c.associatedMetricsSnapshot.avgLatencyMs / 1000).toFixed(2)}s
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
