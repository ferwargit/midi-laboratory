import React, { memo, useRef, useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { useDatabaseStore } from '../../stores/useDatabaseStore'

interface DatabaseCardProps {
  onOpenResetModal: () => void
}

function DatabaseCardComponent({ onOpenResetModal }: DatabaseCardProps): React.ReactElement {
  const summary = useDatabaseStore((state) => state.summary)
  const exportBackupJson = useDatabaseStore((state) => state.exportBackupJson)
  const importBackupJson = useDatabaseStore((state) => state.importBackupJson)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(null)

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

      setBackupStatusMessage('✅ Respaldo JSON exportado exitosamente.')
      setTimeout(() => setBackupStatusMessage(null), 4000)
    } catch (err) {
      setBackupStatusMessage(
        `❌ Error al exportar: ${err instanceof Error ? err.message : String(err)}`
      )
      setTimeout(() => setBackupStatusMessage(null), 5000)
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
        setBackupStatusMessage(
          `✅ Importadas ${result.sessionsImported} sesiones y ${result.answersImported} respuestas.`
        )
      } else {
        setBackupStatusMessage(`❌ Fallo en importación: ${result.error || 'Archivo inválido'}`)
      }
      setTimeout(() => setBackupStatusMessage(null), 5000)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <Card className="bg-zinc-900/60 border-zinc-800/80 select-none space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span className="text-xs text-zinc-400 font-medium font-mono">
          💾 Memoria a Largo Plazo (IndexedDB v5):
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="text-xs flex items-center gap-1 cursor-pointer font-mono"
            onClick={handleExport}
            title="Exportar archivo de respaldo JSON con todas las sesiones y diagnósticos"
          >
            📥 Exportar Backup
          </Button>

          <Button
            size="sm"
            variant="secondary"
            className="text-xs flex items-center gap-1 cursor-pointer font-mono"
            onClick={() => fileInputRef.current?.click()}
            title="Importar un archivo de respaldo previo"
          >
            📤 Importar Backup
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />

          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer font-mono"
            onClick={onOpenResetModal}
          >
            🗑️ Resetear DB
          </Button>
        </div>
      </div>

      {backupStatusMessage && (
        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 animate-in fade-in duration-150">
          {backupStatusMessage}
        </div>
      )}

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
