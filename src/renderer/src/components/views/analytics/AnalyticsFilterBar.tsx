import React, { useState } from 'react'
import {
  AnalyticsModeFilter,
  AnalyticsMasteryFilter,
  MASTERY_THRESHOLDS
} from '../../../domain/analytics/historyAnalytics'
import { INSTRUMENT_CATALOG } from '../../../domain/music/instruments'
import { AVAILABLE_STRATEGIES } from '../../../domain/adaptation/adaptiveEngine'
import { EXERCISE_PRESETS } from '../../../domain/music/presets'
import { INTERVAL_PRESETS } from '../../../domain/music/intervals'
import { SEQUENCE_PRESETS } from '../../../domain/music/sequences'
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
  selectedFormat: string
  onFormatChange: (f: string) => void
  selectedMastery: AnalyticsMasteryFilter
  onMasteryChange: (m: AnalyticsMasteryFilter) => void
  selectedInputSource: 'all' | 'hardware' | 'virtual'
  onInputSourceChange: (s: 'all' | 'hardware' | 'virtual') => void
  selectedBias: 'all' | 'sharp' | 'flat' | 'balanced'
  onBiasChange: (b: 'all' | 'sharp' | 'flat' | 'balanced') => void
  selectedPoolSize: string
  onPoolSizeChange: (p: string) => void
  selectedIsi: 'all' | 'massed' | 'optimal' | 'spaced'
  onIsiChange: (isi: 'all' | 'massed' | 'optimal' | 'spaced') => void
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
  selectedPoolSize,
  onPoolSizeChange,
  selectedIsi,
  onIsiChange,
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
    selectedBias !== 'all' ||
    selectedPoolSize !== 'all' ||
    selectedIsi !== 'all'

  const dynamicPresets =
    modeFilter === 'intervals'
      ? INTERVAL_PRESETS.map((p) => ({ id: p.id, name: p.name }))
      : modeFilter === 'sequences'
        ? SEQUENCE_PRESETS.map((p) => ({ id: p.id, name: p.name }))
        : modeFilter === 'repertoire'
          ? [{ id: 'partitura_1', name: 'Partitura 1 (Félix Dumont)' }]
          : EXERCISE_PRESETS.map((p) => ({ id: p.id, name: p.name }))

  return (
    <>
      <div className="bg-zinc-900/80 backdrop-blur-2xl p-3.5 rounded-2xl border border-zinc-800/80 space-y-3 shadow-xl font-mono text-xs w-full">
        {/* FILA 1: MODALIDAD PRINCIPAL (INCLUYE REPERTORIO) + GUÍA PSICOACÚSTICA + ESTADO GPU */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-500 text-xs uppercase font-bold px-1">Modalidad:</span>
            {(
              [
                ['all', 'Global'],
                ['single_note', 'Notas'],
                ['intervals', 'Intervalos'],
                ['sequences', 'Secuencias'],
                ['repertoire', 'Repertorio']
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

            <span className="text-zinc-500 text-xs ml-1">LM Studio:</span>
            <span
              className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold ${
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

        {/* FILA 2: BÚSQUEDA, PRESETS, TIMBRES Y MOTORES */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800/80 text-xs">
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
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">🎵 Todos los Presets / Obras</option>
            {dynamicPresets.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
            <option value="Personalizadas">Notas Personalizadas</option>
          </select>

          <select
            value={selectedInstrument}
            onChange={(e): void => onInstrumentChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
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
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">🧠 Todos los Motores</option>
            {AVAILABLE_STRATEGIES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        {/* FILA 3: FORMATO, CARGA, MAESTRÍA, ENTRADA, SESGO, DESCANSO ISI Y LIMPIEZA */}
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 pt-1 text-xs">
          <select
            value={selectedFormat}
            onChange={(e): void => onFormatChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500 font-semibold"
          >
            <option value="all">⏱️ Todos los Formatos</option>
            <optgroup label="⏱️ Cronometrado por Tiempo">
              <option value="time_all">⏱️ Cualquier Tiempo</option>
              <option value="time_1">⏱️ Cronometrado 1 min</option>
              <option value="time_3">⏱️ Cronometrado 3 min</option>
              <option value="time_5">⏱️ Cronometrado 5 min</option>
              <option value="time_10">⏱️ Cronometrado 10 min</option>
            </optgroup>
            <optgroup label="🔢 Por Volumen de Preguntas">
              <option value="questions_all">🔢 Cualquier Serie</option>
              <option value="questions_5">🔢 Bloque 5 preguntas</option>
              <option value="questions_10">🔢 Bloque 10 preguntas</option>
              <option value="questions_20">🔢 Bloque 20 preguntas</option>
            </optgroup>
            <optgroup label="🎯 Criterios Especiales">
              <option value="mastery">🎯 Modo Maestría (≥85%)</option>
            </optgroup>
          </select>

          <select
            value={selectedPoolSize}
            onChange={(e): void => onPoolSizeChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">🧠 Toda Carga (Pool)</option>
            <option value="3">3 notas (1.58 bits)</option>
            <option value="4">4 notas (2.00 bits)</option>
            <option value="5">5 notas (2.32 bits)</option>
            <option value="6">6 notas (2.58 bits)</option>
            <option value="7">7 notas (2.81 bits)</option>
            <option value="8">8 notas (3.00 bits)</option>
            <option value="13">13 notas (3.70 bits)</option>
          </select>

          <select
            value={selectedMastery}
            onChange={(e): void => onMasteryChange(e.target.value as AnalyticsMasteryFilter)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">🎯 Todo Nivel de Éxito</option>
            <option value="mastered">🟢 Dominadas (≥{MASTERY_THRESHOLDS.MASTERED_MIN}%)</option>
            <option value="learning">
              🟡 En Progreso ({MASTERY_THRESHOLDS.LEARNING_MIN}-{MASTERY_THRESHOLDS.MASTERED_MIN}%)
            </option>
            <option value="critical">🔴 Críticas (&lt;{MASTERY_THRESHOLDS.CRITICAL_MAX}%)</option>
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

          <select
            value={selectedIsi}
            onChange={(e): void => onIsiChange(e.target.value as typeof selectedIsi)}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">⏳ Todo Descanso (ISI)</option>
            <option value="massed">⚠️ Práctica Masiva (&lt; 15 min)</option>
            <option value="optimal">🌙 Consolidación Óptima (12h - 48h)</option>
            <option value="spaced">📅 Espaciada Larga (&gt; 48h)</option>
          </select>

          <button
            type="button"
            disabled={!hasActiveFilters}
            onClick={onResetAllFilters}
            className="col-span-2 sm:col-span-1 px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-rose-950/80 border border-zinc-800 hover:border-rose-700/60 text-zinc-400 hover:text-rose-300 font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            title="Restablecer todos los filtros a sus valores predeterminados"
          >
            <span>✕</span>
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      <KnowledgeGuideModal isOpen={isGuideOpen} onClose={(): void => setIsGuideOpen(false)} />
    </>
  )
}
