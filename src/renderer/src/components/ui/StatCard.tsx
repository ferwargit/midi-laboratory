import React from 'react'
import { Card } from './Card'

interface StatCardProps {
  title: string
  value: string | number
  highlightColor?: string
}

export function StatCard({ title, value, highlightColor }: StatCardProps): React.ReactElement {
  return (
    <Card className="text-center p-3">
      <div className="text-xs text-zinc-400 mb-1">{title}</div>
      <div className={`text-xl font-bold ${highlightColor || 'text-zinc-100'}`}>{value}</div>
    </Card>
  )
}
