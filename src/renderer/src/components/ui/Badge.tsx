import React from 'react'

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

const badgeStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-950/60 text-emerald-400 border-emerald-800',
  danger: 'bg-red-950/60 text-red-400 border-red-800',
  warning: 'bg-amber-950/60 text-amber-400 border-amber-800',
  info: 'bg-sky-950/60 text-sky-400 border-sky-800'
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
