import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function Card({ children, className = '', ...props }: CardProps): React.ReactElement {
  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 rounded-lg p-4 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
