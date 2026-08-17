import React from 'react'
import { Button } from './Button'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel
}: ConfirmModalProps): React.ReactElement | null {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400 text-lg shrink-0">
            ⚠️
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100 m-0">{title}</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-800">
          <Button variant="secondary" size="md" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant="danger" size="md" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
