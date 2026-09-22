import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  glow?: 'cyan' | 'purple' | 'none'
}

export function Card({
  children,
  className = '',
  glow = 'none',
  ...props
}: CardProps): React.ReactElement {
  const glowStyles = {
    none: 'border-slate-800/80',
    cyan: 'border-cyan-500/30 shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)]',
    purple: 'border-purple-500/30 shadow-[0_0_20px_-5px_rgba(168,85,247,0.15)]'
  }

  return (
    <div
      className={`bg-linear-to-b from-slate-900/95 to-slate-950/95 border rounded-xl transition-all duration-150 ease-out ${glowStyles[glow]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
