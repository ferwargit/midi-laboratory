import React, { useState } from 'react'
import {
  AnalyticsModeFilter,
  AnalyticsMasteryFilter
} from '../../../domain/analytics/historyAnalytics'
import { INSTRUMENT_CATALOG } from '../../../domain/music/instruments'
import { AVAILABLE_STRATEGIES } from '../../../domain/adaptation/adaptiveEngine'
import { EXERCISE_PRESETS } from '../../../domain/music/presets'
import { KnowledgeGuideModal } from '../guide/KnowledgeGuideModal'

interface AnalyticsFilterBarProps {
  modeFilter: AnalyticsModeFilter
  onSelectModeFilter: (mode: AnalyticsModeFilter) => void
  isLmStudioOnline: boolean
  onCheckLmStudio: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedInstrument: string
  onInstrumentChange: (id: string) => void
  selectedStrategy: string
  onStrategyChange: (id: string) => void
  selectedPreset: string
  onPresetChange: (preset: string) => void
  selectedFormat: 'all' | 'time' | 'questions' | 'mastery'
  onFormatChange: (f: 'all' | 'time' | 'questions' | 'mastery') => void
  selectedMastery: AnalyticsMasteryFilter
  onMasteryChange: (m: AnalyticsMasteryFilter) => void
  selectedInputSource: 'all' | 'hardware' | 'virtual'
  onInputSourceChange: (s: 'all' | 'hardware' | 'virtual') => void
  selectedBias: 'all' | 'sharp' | 'flat' | 'balanced'
  onBiasChange: (b: 'all' | 'sharp' | 'flat' | 'balanced') => void
  onResetAllFilters: () => void
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
  selectedStrategy,
  onStrategyChange,
  selectedPreset,
  onPresetChange,
  selectedFormat,
  onFormatChange,
  selectedMastery,
  onMasteryChange,
  selectedInputSource,
  onInputSourceChange,
  selectedBias,
  onBiasChange,
  onResetAllFilters
}: AnalyticsFilterBarProps): React.ReactElement {
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedInstrument !== 'all' ||
    selectedStrategy !== 'all' ||
    selectedPreset !== 'all' ||
    selectedFormat !== 'all' ||
    selectedMastery !== 'all' ||
    selectedInputSource !== 'all' ||
    selectedBias !== 'all'

  return (
    <>
      <div className="bg-zinc-900/80 backdrop-blur-2xl p-3.5 rounded-2xl border border-zinc-800/80 space-y-3 shadow-xl font-mono text-xs">
        {/* FILA 1: MODALIDAD PRINCIPAL + GUÍA PSICOACÚSTICA + ESTADO GPU */}
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
            <button
              type="button"
              onClick={(): void => setIsGuideOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-600/60 hover:border-purple-400 text-purple-200 text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            >
              <span>📖</span>
              <span>Guía Psicoacústica</span>
            </button>

            <span className="text-zinc-500 text-[11px] ml-1">LM Studio:</span>
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

        {/* FILA 2: BÚSQUEDA Y FILTROS DE CONTENIDO MUSICAL */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800/80 text-[11px]">
          <input
            type="text"
            placeholder="🔍 Buscar por nombre, nota o fecha..."
            value={searchQuery}
            onChange={(e): void => onSearchChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          />

          <select
            value={selectedPreset}
            onChange={(e): void => onPresetChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">🎵 Todos los Presets</option>
            {EXERCISE_PRESETS.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
            <option value="Personalizadas">Notas Personalizadas</option>
          </select>

          <select
            value={selectedInstrument}
            onChange={(e): void => onInstrumentChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">🎹 Todos los Timbres</option>
            {INSTRUMENT_CATALOG.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStrategy}
            onChange={(e): void => onStrategyChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">🧠 Todos los Motores</option>
            {AVAILABLE_STRATEGIES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        {/* FILA 3: FILTROS PSICOMÉTRICOS, ENTRADA, SESGO Y BOTÓN DE RESET */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
          <select
            value={selectedFormat}
            onChange={(e): void => onFormatChange(e.target.value as typeof selectedFormat)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">⏱️ Todos los Formatos</option>
            <option value="time">⏱️ Cronometrado</option>
            <option value="mastery">🎯 Modo Maestría</option>
            <option value="questions">🔢 Por Preguntas</option>
          </select>

          <select
            value={selectedMastery}
            onChange={(e): void => onMasteryChange(e.target.value as AnalyticsMasteryFilter)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">🎯 Todo Nivel de Éxito</option>
            <option value="mastered">🟢 Dominadas (≥85%)</option>
            <option value="learning">🟡 En Progreso (50-85%)</option>
            <option value="critical">🔴 Críticas (&lt;50%)</option>
          </select>

          <select
            value={selectedInputSource}
            onChange={(e): void =>
              onInputSourceChange(e.target.value as typeof selectedInputSource)
            }
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">🔌 Todas las Entradas</option>
            <option value="hardware">🎹 Roland FP-8 Físico</option>
            <option value="virtual">🖱️ Ratón Virtual</option>
          </select>

          <select
            value={selectedBias}
            onChange={(e): void => onBiasChange(e.target.value as typeof selectedBias)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">🎯 Todo Sesgo Tonal</option>
            <option value="sharp">▲ Agudo (+st)</option>
            <option value="flat">▼ Grave (-st)</option>
            <option value="balanced">● Neutro / Equilibrado</option>
          </select>

          {/* Botón de Limpieza Rápida */}
          <button
            type="button"
            disabled={!hasActiveFilters}
            onClick={onResetAllFilters}
            className="col-span-2 sm:col-span-1 px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-rose-950/80 border border-zinc-800 hover:border-rose-700/60 text-zinc-400 hover:text-rose-300 font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            title="Restablecer todos los filtros a sus valores predeterminados"
          >
            <span>✕</span>
            <span>Limpiar Filtros</span>
          </button>
        </div>
      </div>

      <KnowledgeGuideModal isOpen={isGuideOpen} onClose={(): void => setIsGuideOpen(false)} />
    </>
  )
}
