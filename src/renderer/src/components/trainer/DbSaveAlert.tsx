import React from 'react'

interface DbSaveAlertProps {
  error: string | null
  onDismiss?: () => void
}

export function DbSaveAlert({ error, onDismiss }: DbSaveAlertProps): React.ReactElement | null {
  if (!error) return null

  return (
    <div className="bg-rose-950/90 border border-rose-600 text-rose-200 px-4 py-3 rounded-2xl flex items-center justify-between shadow-2xl animate-in fade-in duration-200 select-none">
      <div className="flex items-center gap-3">
        <span className="text-xl animate-bounce">⚠️</span>
        <div>
          <strong className="block text-xs font-bold text-rose-300">
            Error de Persistencia Local (IndexedDB)
          </strong>
          <span className="text-[11px] text-rose-200/90 leading-tight block">{error}</span>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-mono text-rose-300 hover:text-white bg-rose-900/60 border border-rose-700 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
        >
          ✕ Cerrar
        </button>
      )}
    </div>
  )
}
