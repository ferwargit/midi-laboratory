import React from 'react'
import {
  AnalyticsModeFilter,
  AnalyticsMasteryFilter
} from '../../../domain/analytics/historyAnalytics'
import { INSTRUMENT_CATALOG } from '../../../domain/music/instruments'

interface AnalyticsFilterBarProps {
  modeFilter: AnalyticsModeFilter
  onSelectModeFilter: (mode: AnalyticsModeFilter) => void
  isLmStudioOnline: boolean
  onCheckLmStudio: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedInstrument: string
  onInstrumentChange: (id: string) => void
  selectedFormat: 'all' | 'time' | 'questions' | 'mastery'
  onFormatChange: (f: 'all' | 'time' | 'questions' | 'mastery') => void
  selectedMastery: AnalyticsMasteryFilter
  onMasteryChange: (m: AnalyticsMasteryFilter) => void
}

export function AnalyticsFilterBar({
  modeFilter,
  onSelectModeFilter,
  isLmStudioOnline,
  onCheckLmStudio,
  searchQuery,
  onSearchChange,
  selectedInstrument,
  onInstrumentChange,
  selectedFormat,
  onFormatChange,
  selectedMastery,
  onMasteryChange
}: AnalyticsFilterBarProps): React.ReactElement {
  return (
    <div className="bg-zinc-900/70 backdrop-blur-2xl p-3 rounded-2xl border border-zinc-800/80 space-y-2.5 shadow-xl font-mono text-xs">
      {/* Fila 1: Modalidades y estado de IA */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-zinc-500 text-[10px] uppercase font-bold px-1">Modalidad:</span>
          {(
            [
              ['all', 'Global'],
              ['single_note', 'Notas'],
              ['intervals', 'Intervalos'],
              ['sequences', 'Secuencias']
            ] as [AnalyticsModeFilter, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={(): void => onSelectModeFilter(val)}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer border ${
                modeFilter === val
                  ? 'bg-sky-600 border-sky-400 text-white font-bold shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <span className="text-zinc-500 text-[11px]">LM Studio:</span>
          <span
            className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-bold ${
              isLmStudioOnline
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
            }`}
          >
            {isLmStudioOnline ? '🟢 GPU Activa' : '🟡 Motor Local'}
          </span>
          <button
            type="button"
            onClick={onCheckLmStudio}
            title="Re-comprobar conexión"
            className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Fila 2: Filtros cruzados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800/80 text-[11px]">
        <input
          type="text"
          placeholder="🔍 Buscar sesión o preset..."
          value={searchQuery}
          onChange={(e): void => onSearchChange(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-sky-500"
        />

        <select
          value={selectedInstrument}
          onChange={(e): void => onInstrumentChange(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
        >
          <option value="all">🎹 Todos los Timbres</option>
          {INSTRUMENT_CATALOG.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.name}
            </option>
          ))}
        </select>

        <select
          value={selectedFormat}
          onChange={(e): void => onFormatChange(e.target.value as typeof selectedFormat)}
          className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
        >
          <option value="all">⏱️ Todos los Formatos</option>
          <option value="time">⏱️ Cronometrado</option>
          <option value="mastery">🎯 Modo Maestría</option>
          <option value="questions">🔢 Por Preguntas</option>
        </select>

        <select
          value={selectedMastery}
          onChange={(e): void => onMasteryChange(e.target.value as AnalyticsMasteryFilter)}
          className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
        >
          <option value="all">🎯 Todo Nivel de Éxito</option>
          <option value="mastered">🟢 Dominadas (≥85%)</option>
          <option value="learning">🟡 En Progreso (50-85%)</option>
          <option value="critical">🔴 Críticas (&lt;50%)</option>
        </select>
      </div>
    </div>
  )
}
