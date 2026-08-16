import React from 'react'

interface MidiDeviceSelectProps {
  inputs: MIDIInput[]
  outputs: MIDIOutput[]
  selectedInputId: string
  selectedOutputId: string
  onSelectInput: (id: string) => void
  onSelectOutput: (id: string) => void
  disabled?: boolean
}

export function MidiDeviceSelect({
  inputs,
  outputs,
  selectedInputId,
  selectedOutputId,
  onSelectInput,
  onSelectOutput,
  disabled
}: MidiDeviceSelectProps): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Entrada (FP-8 IN):</label>
        <select
          value={selectedInputId}
          onChange={(e): void => onSelectInput(e.target.value)}
          disabled={disabled}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-sky-500"
        >
          {inputs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.id}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-1">Salida (Korg OUT):</label>
        <select
          value={selectedOutputId}
          onChange={(e): void => onSelectOutput(e.target.value)}
          disabled={disabled}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-sky-500"
        >
          {outputs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.id}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
