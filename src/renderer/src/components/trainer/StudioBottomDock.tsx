import React, { useState } from 'react'
import { useDatabaseStore } from '../../stores/useDatabaseStore'
import { MidiLogEntry } from '../../hooks/useMidi'
import { MidiMonitor } from './MidiMonitor'

interface StudioBottomDockProps {
  logs: MidiLogEntry[]
  onOpenResetModal: () => void
}

export function StudioBottomDock({
  logs,
  onOpenResetModal
}: StudioBottomDockProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const summary = useDatabaseStore((state) => state.summary)

  return (
    <footer className="w-full bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl transition-all">
      {/* BARRA STATUS COMPACTA PERMANENTE */}
      <div className="flex justify-between items-center px-4 py-2 text-xs font-mono select-none">
        {/* Métricas rápidas en línea */}
        <div className="flex items-center gap-4 text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">SESIONES:</span>
            <strong className="text-zinc-200">{summary.totalSessions}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">EJERCICIOS:</span>
            <strong className="text-zinc-200">{summary.totalExercises}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">PRECISIÓN GLOBAL:</span>
            <strong
              className={
                summary.overallAccuracy >= 80
                  ? 'text-emerald-400'
                  : summary.overallAccuracy >= 50
                    ? 'text-amber-400'
                    : 'text-rose-400'
              }
            >
              {summary.overallAccuracy}%
            </strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">TIEMPO MEDIO:</span>
            <strong className="text-zinc-200">
              {(summary.overallAvgTimeMs / 1000).toFixed(2)}s
            </strong>
          </div>
        </div>

        {/* Botón toggle monitor + reset */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenResetModal}
            className="text-[11px] text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
          >
            Reset DB
          </button>
          <button
            type="button"
            onClick={(): void => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 px-2.5 py-1 rounded-lg text-zinc-300 text-[11px] cursor-pointer transition-colors"
          >
            <span>📡 Telemetría ({logs.length})</span>
            <span className="text-[10px] text-zinc-500">{isOpen ? '▼' : '▲'}</span>
          </button>
        </div>
      </div>

      {/* DRAWER DESPLEGABLE CON EL MONITOR */}
      {isOpen && (
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/90 animate-in slide-in-from-bottom-2 duration-150">
          <MidiMonitor logs={logs} />
        </div>
      )}
    </footer>
  )
}
