import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-sm shadow-cyan-500/20 active:scale-[0.98]',
  secondary:
    'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 shadow-sm active:scale-[0.98]',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]',
  danger: 'bg-rose-600 hover:bg-rose-500 text-white active:scale-[0.98]',
  ghost:
    'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 active:scale-[0.98]'
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
      className={`inline-flex items-center justify-center transition-all duration-150 ease-out cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
