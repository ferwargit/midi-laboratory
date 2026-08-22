import React from 'react'
import { AnalyticsModeFilter } from '../../../domain/analytics/historyAnalytics'
import { DbAiReportRecord } from '../../../domain/database/types'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { AiExercisePrescription } from '../../../domain/ai/types'

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
    <Card className="space-y-3 bg-zinc-900/80 backdrop-blur-2xl border-zinc-800/80 shadow-2xl">
      <h3 className="text-sm font-bold text-zinc-100 font-mono uppercase tracking-wider">
        Informes Históricos ({modeFilter}: {filteredReports.length})
      </h3>
      {filteredReports.length === 0 ? (
        <div className="text-center py-8 text-zinc-600 text-xs italic font-mono">
          No hay informes guardados en la modalidad activa ({modeFilter}).
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((rep) => (
            <div
              key={rep.id}
              className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 space-y-2.5"
            >
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-bold text-purple-400">{rep.prescription.title}</span>
                <span className="text-zinc-500 text-[11px]">
                  {new Date(rep.createdAt).toLocaleString('es-AR')}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed line-clamp-3 m-0">
                {rep.analysisText}
              </p>
              <div className="flex justify-between items-center pt-2 border-t border-zinc-900 text-[10px] font-mono">
                <span className="text-zinc-500">
                  Modo: {rep.modeFilter} | {rep.modelName}
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
