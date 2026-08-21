import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.3)] border border-sky-400/30 font-semibold',
  secondary:
    'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 hover:border-zinc-500/80 shadow-sm',
  success:
    'bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-zinc-950 font-bold shadow-[0_0_20px_rgba(16,185,129,0.35)] border border-emerald-300/40',
  danger:
    'bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] border border-red-400/30',
  ghost: 'bg-transparent hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-100'
}

const sizeStyles = {
  sm: 'px-2.5 py-1 text-xs rounded-md gap-1.5',
  md: 'px-3.5 py-1.5 text-xs md:text-sm rounded-lg gap-2',
  lg: 'px-5 py-2.5 text-sm md:text-base rounded-xl gap-2.5'
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled,
  ...props
}: ButtonProps): React.ReactElement {
  return (
    <button
      className={`inline-flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-[0.97] active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
