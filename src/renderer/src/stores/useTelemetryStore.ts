import { create } from 'zustand'

export interface MidiLogEntry {
  id: number
  time: string
  type: 'IN' | 'OUT' | 'AI' | 'EVAL'
  message: string
  noteNumber?: number
  velocity?: number
}

interface TelemetryState {
  logs: MidiLogEntry[]
  addLog: (entry: Omit<MidiLogEntry, 'id' | 'time'>) => void
}

// Límite canónico del historial de telemetría (ventana deslizante).
const MAX_LOG_ENTRIES = 35

function formatTimestamp(now: Date): string {
  return `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now
    .getMilliseconds()
    .toString()
    .padStart(3, '0')}`
}

// SSOT del buffer de telemetría MIDI: vive fuera del ciclo de render del
// componente raíz (App) para que un evento de log no re-renderice el árbol
// (auditoría V8, F12.1). Los consumidores se suscriben directamente al store.
export const useTelemetryStore = create<TelemetryState>((set) => ({
  logs: [],

  addLog: (entry: Omit<MidiLogEntry, 'id' | 'time'>): void => {
    const now = new Date()
    const log: MidiLogEntry = {
      id: Date.now() + Math.random(),
      time: formatTimestamp(now),
      ...entry
    }

    set((state) => ({ logs: [...state.logs, log].slice(-MAX_LOG_ENTRIES) }))
  }
}))
