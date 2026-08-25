import React, { useState } from 'react'
import { VisualCueMode } from '../../domain/exercise/visualAudioSync'

type AppMode = 'single_note' | 'intervals' | 'sequences' | 'repertoire' | 'analytics'

interface StudioTopBarProps {
  appMode: AppMode
  onSelectMode: (mode: AppMode) => void
  isSessionActive: boolean
  visualCueMode: VisualCueMode
  onToggleVisualCue: (mode: VisualCueMode) => void
  status: string
  inputs: MIDIInput[]
  outputs: MIDIOutput[]
  selectedInputId: string
  selectedOutputId: string
  onSelectInput: (id: string) => void
  onSelectOutput: (id: string) => void
}

export function StudioTopBar({
  appMode,
  onSelectMode,
  isSessionActive,
  visualCueMode,
  onToggleVisualCue,
  status,
  inputs,
  outputs,
  selectedInputId,
  selectedOutputId,
  onSelectInput,
  onSelectOutput
}: StudioTopBarProps): React.ReactElement {
  const [isMidiMenuOpen, setIsMidiMenuOpen] = useState(false)
  const isOk = status.toLowerCase().includes('conectado')

  const currentInName = inputs.find((i) => i.id === selectedInputId)?.name || 'Sin Entrada'
  const currentOutName = outputs.find((o) => o.id === selectedOutputId)?.name || 'Sin Salida'

  return (
    <header className="relative z-30 bg-zinc-950/80 backdrop-blur-2xl border border-zinc-800/80 rounded-2xl p-2 shadow-2xl flex items-center justify-between gap-3">
      {/* 1. BRANDING & STATUS LED */}
      <div className="flex items-center gap-3 pl-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center font-bold text-zinc-950 shadow-[0_0_15px_rgba(56,189,248,0.3)] text-sm">
            🎹
          </div>
          <div>
            <h1 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono m-0 leading-none">
              MIDI LAB
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOk
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse'
                    : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                }`}
              />
              <span className="text-[10px] text-zinc-400 font-mono leading-none">
                {isOk ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SELECTOR DE MODOS (PILL SEGMENTADA CENTRAL) */}
      <nav className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/80 gap-1">
        {[
          { id: 'single_note', label: 'Notas', code: '01' },
          { id: 'intervals', label: 'Intervalos', code: '02' },
          { id: 'sequences', label: 'Secuencias', code: '03' },
          { id: 'repertoire', label: 'Repertorio', code: '04' },
          { id: 'analytics', label: 'Diagnóstico IA', code: 'AI' }
        ].map((tab) => {
          const active = appMode === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              disabled={isSessionActive}
              onClick={(): void => onSelectMode(tab.id as AppMode)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${
                active
                  ? tab.id === 'analytics'
                    ? 'bg-purple-600 text-white font-bold shadow-[0_0_15px_rgba(168,85,247,0.35)] border border-purple-400/30'
                    : 'bg-gradient-to-b from-sky-500 to-sky-600 text-white font-bold shadow-[0_0_15px_rgba(56,189,248,0.3)] border border-sky-400/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <span
                className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded ${
                  active ? 'bg-black/30 text-white' : 'text-zinc-500 bg-zinc-950'
                }`}
              >
                {tab.code}
              </span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* 3. HARDWARE & PISTAS TOGGLES */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Toggle Pistas */}
        <div className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/80 text-[10px] font-mono">
          <button
            type="button"
            onClick={(): void => onToggleVisualCue('blind')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              visualCueMode === 'blind'
                ? 'bg-amber-400/15 border border-amber-400/40 text-amber-300 font-bold shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Modo a ciegas: el piano no ilumina la nota al sonar"
          >
            👂 Oído
          </button>
          <button
            type="button"
            onClick={(): void => onToggleVisualCue('assisted')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              visualCueMode === 'assisted'
                ? 'bg-cyan-400/15 border border-cyan-400/40 text-cyan-300 font-bold shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Modo asistido: ilumina la tecla al sonar"
          >
            👁️ LED
          </button>
        </div>

        {/* Popover de Puertos MIDI */}
        <div className="relative">
          <button
            type="button"
            onClick={(): void => setIsMidiMenuOpen(!isMidiMenuOpen)}
            title={`IN: ${currentInName} | OUT: ${currentOutName}`}
            className="flex items-center gap-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800/80 px-2.5 py-1.5 rounded-xl text-xs font-mono text-zinc-300 transition-all cursor-pointer"
          >
            <span className="text-sky-400 font-bold">DIN-5</span>
            <span className="text-[11px] text-zinc-400 max-w-[110px] truncate">
              {currentInName}
            </span>
            <span className="text-[9px] text-zinc-500">⚙️</span>
          </button>

          {isMidiMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 rounded-xl p-3 shadow-2xl space-y-3 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex justify-between items-center pb-1.5 border-b border-zinc-800">
                <span className="text-xs font-bold text-zinc-200">Puertos MIDI Físicos</span>
                <button
                  type="button"
                  onClick={(): void => setIsMidiMenuOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-zinc-400 mb-1">
                  Entrada (Roland FP-8 IN):
                </label>
                <select
                  value={selectedInputId}
                  onChange={(e): void => onSelectInput(e.target.value)}
                  disabled={isSessionActive}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
                >
                  {inputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-zinc-400 mb-1">
                  Salida (Korg NS5R OUT):
                </label>
                <select
                  value={selectedOutputId}
                  onChange={(e): void => onSelectOutput(e.target.value)}
                  disabled={isSessionActive}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
                >
                  {outputs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-1.5 border-t border-zinc-800/80 text-[10px] font-mono text-zinc-500 flex justify-between">
                <span>IN: {currentInName}</span>
                <span>OUT: {currentOutName}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
