import React from 'react'
import { AnalyticsModeFilter } from '../../../domain/analytics/historyAnalytics'
import { DbAiReportRecord } from '../../../domain/database/types'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { AiExercisePrescription } from '../../../domain/ai/types'
import { MarkdownRenderer } from '../../ui/MarkdownRenderer'

interface AiHistoryTabProps {
  modeFilter: AnalyticsModeFilter
  filteredReports: DbAiReportRecord[]
  onLoadPrescription: (p: AiExercisePrescription) => void
}

export function AiHistoryTab({
  modeFilter,
  filteredReports,
  onLoadPrescription
}: AiHistoryTabProps): React.ReactElement {
  return (
    <Card className="space-y-4 bg-zinc-900/80 backdrop-blur-2xl border-zinc-800/80 shadow-2xl">
      <div className="flex justify-between items-center pb-2 border-b border-zinc-800 font-mono">
        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider m-0">
          Informes Históricos ({modeFilter}: {filteredReports.length})
        </h3>
        <span className="text-xs text-zinc-400">Lectura completa sin recortes</span>
      </div>

      {filteredReports.length === 0 ? (
        <div className="text-center py-8 text-zinc-600 text-xs italic font-mono">
          No hay informes guardados en la modalidad activa ({modeFilter}).
        </div>
      ) : (
        <div className="space-y-4 max-h-[650px] overflow-y-auto pr-2">
          {filteredReports.map((rep) => (
            <div
              key={rep.id}
              className="p-5 bg-zinc-950/80 rounded-2xl border border-zinc-800 space-y-3 shadow-md"
            >
              <div className="flex justify-between items-start text-xs font-mono">
                <div>
                  <span className="font-bold text-purple-400 text-sm font-sans block">
                    {rep.prescription.title}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono mt-0.5 block">
                    🏷️ Modelo: <strong className="text-zinc-200">{rep.modelName}</strong>
                  </span>
                </div>
                <span className="text-zinc-400 text-xs font-mono">
                  {new Date(rep.createdAt).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {/* Texto completo sin line-clamp */}
              <div className="pt-2 border-t border-zinc-900">
                <MarkdownRenderer content={rep.analysisText} />
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t border-zinc-900 text-xs font-mono">
                <span className="text-zinc-400">
                  Modalidad: <strong className="text-sky-300">{rep.modeFilter}</strong>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(): void => onLoadPrescription(rep.prescription)}
                  className="text-xs cursor-pointer"
                >
                  🚀 Re-ejecutar Prescripción
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
