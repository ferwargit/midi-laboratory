import React from 'react'
import {
  Table,
  Sparkles,
  MessageSquare,
  TrendingUp,
  Grid3X3,
  LineChart,
  History
} from 'lucide-react'
import { AnalyticsTabKey } from './types'

interface AnalyticsTabNavProps {
  activeTab: AnalyticsTabKey
  onSelectTab: (tab: AnalyticsTabKey) => void
  sessionsCount: number
  longitudinalCount: number
  aiHistoryCount: number
}

const tabDefs: Array<{
  id: AnalyticsTabKey
  label: string
  Icon: React.ComponentType<any>
  count?: number
}> = [
  { id: 'sessions', label: 'Sesiones', Icon: Table, count: 0 },
  { id: 'ai_report', label: 'Diagnóstico', Icon: Sparkles },
  { id: 'ai_consultation', label: 'Tutor', Icon: MessageSquare },
  { id: 'longitudinal', label: 'Longitudinal', Icon: TrendingUp, count: 0 },
  { id: 'confusions', label: 'Matriz', Icon: Grid3X3 },
  { id: 'charts', label: 'Curvas', Icon: LineChart },
  { id: 'ai_history', label: 'Historial', Icon: History, count: 0 }
]

export function AnalyticsTabNav({
  activeTab,
  onSelectTab,
  sessionsCount,
  longitudinalCount,
  aiHistoryCount
}: AnalyticsTabNavProps): React.ReactElement {
  const getCount = (id: AnalyticsTabKey): number | undefined => {
    if (id === 'sessions') return sessionsCount
    if (id === 'longitudinal') return longitudinalCount
    if (id === 'ai_history') return aiHistoryCount
    return undefined
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-2 select-none">
      {tabDefs.map((tab) => {
        const active = activeTab === tab.id
        const count = getCount(tab.id)
        const Icon = tab.Icon
        return (
          <button
            key={tab.id}
            type="button"
            onClick={(): void => onSelectTab(tab.id)}
            className={`h-9 px-3.5 rounded-xl font-medium transition-all duration-150 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
              active
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border-transparent'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-xs">{tab.label}</span>
            {typeof count === 'number' && (
              <span className="tabular-nums font-mono text-[10px] text-slate-400 ml-1">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
