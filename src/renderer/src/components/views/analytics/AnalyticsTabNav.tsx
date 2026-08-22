import React from 'react'
import { AnalyticsTabKey } from './types'

interface AnalyticsTabNavProps {
  activeTab: AnalyticsTabKey
  onSelectTab: (tab: AnalyticsTabKey) => void
  sessionsCount: number
  longitudinalCount: number
  aiHistoryCount: number
}

export function AnalyticsTabNav({
  activeTab,
  onSelectTab,
  sessionsCount,
  longitudinalCount,
  aiHistoryCount
}: AnalyticsTabNavProps): React.ReactElement {
  const tabs: Array<{ id: AnalyticsTabKey; label: string }> = [
    { id: 'sessions', label: `📋 Registro Clínico (${sessionsCount})` },
    { id: 'ai_report', label: '🧠 Diagnóstico & Prescripción' },
    { id: 'ai_consultation', label: '💬 Consultas & Tutor' },
    { id: 'longitudinal', label: `📈 Evolución Test-Retest (${longitudinalCount})` },
    { id: 'confusions', label: '📊 Matriz de Confusión' },
    { id: 'charts', label: '📉 Curvas Psicométricas' },
    { id: 'ai_history', label: `📜 Historial IA (${aiHistoryCount})` }
  ]

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800/80 pb-2 font-mono text-xs select-none">
      {tabs.map((tab) => {
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={(): void => onSelectTab(tab.id)}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              active
                ? tab.id === 'ai_report' ||
                  tab.id === 'ai_consultation' ||
                  tab.id === 'longitudinal'
                  ? 'bg-purple-600 text-white font-bold shadow-[0_0_15px_rgba(168,85,247,0.35)]'
                  : 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
