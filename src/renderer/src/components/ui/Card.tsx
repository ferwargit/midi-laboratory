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
    none: 'border-zinc-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.4)]',
    cyan: 'border-sky-500/30 shadow-[0_0_35px_rgba(56,189,248,0.12)]',
    purple: 'border-purple-500/30 shadow-[0_0_35px_rgba(168,85,247,0.12)]'
  }

  return (
    <div
      className={`bg-zinc-900/60 backdrop-blur-xl border rounded-2xl p-4.5 transition-all duration-200 ${glowStyles[glow]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
