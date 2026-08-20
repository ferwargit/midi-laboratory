import React, { memo } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { useDatabaseStore } from '../../stores/useDatabaseStore'

interface DatabaseCardProps {
  onOpenResetModal: () => void
}

function DatabaseCardComponent({ onOpenResetModal }: DatabaseCardProps): React.ReactElement {
  const summary = useDatabaseStore((state) => state.summary)

  return (
    <Card className="bg-zinc-900/60 border-zinc-800/80 select-none">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-zinc-400 font-medium">
          💾 Memoria a Largo Plazo (Base de Datos Persistente con Zustand):
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer"
          onClick={onOpenResetModal}
        >
          🗑️ Resetear Datos de Prueba
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="bg-zinc-950 p-2 rounded border border-zinc-900">
          <span className="text-zinc-500 block text-[10px]">Sesiones Totales</span>
          <strong className="text-sm text-zinc-200">{summary.totalSessions}</strong>
        </div>
        <div className="bg-zinc-950 p-2 rounded border border-zinc-900">
          <span className="text-zinc-500 block text-[10px]">Total Ejercicios</span>
          <strong className="text-sm text-zinc-200">{summary.totalExercises}</strong>
        </div>
        <div className="bg-zinc-950 p-2 rounded border border-zinc-900">
          <span className="text-zinc-500 block text-[10px]">Precisión Global</span>
          <strong className="text-sm text-sky-400">{summary.overallAccuracy}%</strong>
        </div>
        <div className="bg-zinc-950 p-2 rounded border border-zinc-900">
          <span className="text-zinc-500 block text-[10px]">Tiempo Promedio</span>
          <strong className="text-sm text-zinc-200">
            {(summary.overallAvgTimeMs / 1000).toFixed(2)}s
          </strong>
        </div>
      </div>
    </Card>
  )
}

export const DatabaseCard = memo(DatabaseCardComponent)
