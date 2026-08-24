import React, { useState, useRef } from 'react'
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
  const exportBackupJson = useDatabaseStore((state) => state.exportBackupJson)
  const importBackupJson = useDatabaseStore((state) => state.importBackupJson)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [backupStatus, setBackupStatus] = useState<string | null>(null)

  const handleExport = async (): Promise<void> => {
    try {
      const jsonContent = await exportBackupJson()
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `midi-laboratory-backup-${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setBackupStatus('✅ Backup exportado')
      setTimeout(() => setBackupStatus(null), 3000)
    } catch (err) {
      setBackupStatus(`❌ Error: ${err instanceof Error ? err.message : String(err)}`)
      setTimeout(() => setBackupStatus(null), 4000)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      const content = evt.target?.result as string
      if (!content) return

      const result = await importBackupJson(content, 'merge')
      if (result.success) {
        setBackupStatus(`✅ Importadas ${result.sessionsImported} sesiones`)
      } else {
        setBackupStatus(`❌ Error: ${result.error || 'Archivo corrupto'}`)
      }
      setTimeout(() => setBackupStatus(null), 4000)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <footer className="w-full bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl transition-all font-mono select-none">
      {/* BARRA STATUS COMPACTA PERMANENTE */}
      <div className="flex flex-col sm:flex-row justify-between items-center px-4 py-2 text-xs gap-2">
        {/* Métricas rápidas en línea */}
        <div className="flex items-center gap-4 text-zinc-400 flex-wrap">
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

          {backupStatus && (
            <span className="text-[11px] text-sky-400 bg-sky-950/80 border border-sky-800 px-2 py-0.5 rounded animate-in fade-in">
              {backupStatus}
            </span>
          )}
        </div>

        {/* BOTONES DE ACCIÓN: BACKUP + RESET + MONITOR */}
        <div className="flex items-center gap-2">
          {/* Botón Exportar */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 px-2.5 py-1 rounded-lg text-zinc-300 hover:text-white text-[11px] cursor-pointer transition-colors shadow-sm"
            title="Descargar copia de seguridad completa en formato JSON"
          >
            <span>📥</span>
            <span>Exportar Backup</span>
          </button>

          {/* Botón Importar */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 px-2.5 py-1 rounded-lg text-zinc-300 hover:text-white text-[11px] cursor-pointer transition-colors shadow-sm"
            title="Restaurar sesiones desde un archivo JSON previo"
          >
            <span>📤</span>
            <span>Importar Backup</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={onOpenResetModal}
            className="text-[11px] text-zinc-500 hover:text-rose-400 px-2 py-1 transition-colors cursor-pointer"
            title="Borrar base de datos"
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

      {/* DRAWER DESPLEGABLE CON EL MONITOR TELEMÉTRICO */}
      {isOpen && (
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/90 animate-in slide-in-from-bottom-2 duration-150">
          <MidiMonitor logs={logs} />
        </div>
      )}
    </footer>
  )
}
