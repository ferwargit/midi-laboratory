import React from 'react'

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

const badgeStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30',
  danger: 'bg-rose-950/60 text-rose-300 border border-rose-500/30',
  warning: 'bg-amber-950/60 text-amber-300 border border-amber-500/30',
  info: 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
}

export function Badge({ children, variant = 'info' }: BadgeProps): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${badgeStyles[variant]}`}
    >
      {children}
    </span>
  )
}
