import React, { useRef, useEffect, memo } from 'react'
import { useTelemetryStore, MidiLogEntry } from '../../stores/useTelemetryStore'

function MidiMonitorComponent(): React.ReactElement {
  // Suscripción directa al buffer del store de telemetría (SSOT): el monitor
  // se re-renderiza por sí solo ante eventos de log, sin props del dock.
  const logs = useTelemetryStore((state) => state.logs)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [logs])

  const getLogBadgeStyle = (type: MidiLogEntry['type']): string => {
    switch (type) {
      case 'IN':
        return 'bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 font-mono'
      case 'OUT':
        return 'bg-purple-950/40 text-purple-400 border border-purple-500/30 font-mono'
      case 'EVAL':
        return 'bg-amber-950/40 text-amber-400 border border-amber-500/30 font-mono'
      case 'AI':
        return 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 font-mono'
      default:
        return 'bg-zinc-950/40 text-zinc-400 border border-zinc-500/30 font-mono'
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 select-none">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-zinc-400 font-medium">
          📡 Telemetría en Tiempo Real (MIDI + Motor Adaptativo):
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">Últimos {logs.length} eventos</span>
      </div>
      <div className="h-40 overflow-y-auto font-mono text-xs space-y-1 bg-zinc-950 p-2.5 rounded border border-zinc-900">
        {logs.length === 0 ? (
          <div className="text-zinc-600 italic">Esperando eventos en el bus MIDI...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2">
              <span className="text-zinc-600 shrink-0 font-mono">{log.time}</span>
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${getLogBadgeStyle(log.type)}`}
              >
                {log.type}
              </span>
              <span className="break-all">{log.message}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}

export const MidiMonitor = memo(MidiMonitorComponent)
