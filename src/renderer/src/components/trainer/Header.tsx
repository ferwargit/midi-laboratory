import React from 'react'
import { Badge } from '../ui/Badge'

interface HeaderProps {
  status: string
}

export function Header({ status }: HeaderProps): React.ReactElement {
  const isOk = status.includes('conectado')
  return (
    <header className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-bold text-sky-400 m-0">🎹 Entrenador Auditivo MIDI</h2>
      <Badge variant={isOk ? 'success' : 'warning'}>{status}</Badge>
    </header>
  )
}
