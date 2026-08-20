import React from 'react'

interface MidiDisconnectAlertProps {
  isDisconnected: boolean
}

export function MidiDisconnectAlert({
  isDisconnected
}: MidiDisconnectAlertProps): React.ReactElement | null {
  if (!isDisconnected) return null

  return (
    <div className="bg-amber-950/80 border border-amber-600 text-amber-200 px-4 py-3 rounded-lg flex items-center justify-between shadow-xl animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <span className="text-xl animate-bounce">⚠️</span>
        <div>
          <strong className="block text-xs font-bold text-amber-300">
            Dispositivo MIDI desconectado
          </strong>
          <span className="text-[11px] text-amber-200/80">
            La sesión está en pausa. Conecta tu cable Roland UM-ONE mk2 para reanudar
            automáticamente.
          </span>
        </div>
      </div>
      <span className="text-[10px] font-mono bg-amber-900/60 border border-amber-700 px-2 py-1 rounded">
        Esperando reconexión...
      </span>
    </div>
  )
}
