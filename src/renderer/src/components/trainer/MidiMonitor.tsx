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

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <div className="text-xs text-zinc-400 mb-2 font-medium">Monitor MIDI en tiempo real:</div>
      <div className="h-48 overflow-y-auto font-mono text-xs space-y-1 bg-zinc-950 p-2 rounded border border-zinc-900">
        {logs.map((log) => (
          <div key={log.id} className={log.type === 'IN' ? 'text-emerald-400' : 'text-sky-400'}>
            [{log.time}] [{log.type}] {log.message}{' '}
            {log.velocity !== undefined ? `(Vel: ${log.velocity})` : ''}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
