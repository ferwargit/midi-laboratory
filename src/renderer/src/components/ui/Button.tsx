import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-sky-600 hover:bg-sky-500 text-white font-medium',
  secondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-black font-bold',
  danger: 'bg-red-600 hover:bg-red-500 text-white font-medium',
  ghost: 'bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white'
}

const sizeStyles = {
  sm: 'px-2.5 py-1 text-xs rounded',
  md: 'px-3.5 py-1.5 text-sm rounded-md',
  lg: 'px-5 py-2.5 text-base rounded-md'
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
      className={`inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
