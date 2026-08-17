import React, { useRef, useEffect } from 'react'
import { MidiLogEntry } from '../../hooks/useMidi'

interface MidiMonitorProps {
  logs: MidiLogEntry[]
}

export function MidiMonitor({ logs }: MidiMonitorProps): React.ReactElement {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const getLogStyle = (type: MidiLogEntry['type']): string => {
    switch (type) {
      case 'AI':
        return 'text-purple-400 font-medium'
      case 'EVAL':
        return 'text-amber-300 font-medium'
      case 'OUT':
        return 'text-sky-400'
      case 'IN':
        return 'text-emerald-400'
      default:
        return 'text-zinc-400'
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-zinc-400 font-medium">
          📡 Telemetría en Tiempo Real (MIDI + Motor Adaptativo):
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">Últimos {logs.length} eventos</span>
      </div>
      <div className="h-44 overflow-y-auto font-mono text-xs space-y-1 bg-zinc-950 p-2.5 rounded border border-zinc-900">
        {logs.length === 0 ? (
          <div className="text-zinc-600 italic">Esperando inicio de sesión...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`${getLogStyle(log.type)} flex items-start gap-2`}>
              <span className="text-zinc-600 shrink-0">[{log.time}]</span>
              <span className="shrink-0 font-bold opacity-80">[{log.type}]</span>
              <span className="break-all">{log.message}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
