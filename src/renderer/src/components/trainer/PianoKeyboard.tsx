import React from 'react'
import { isBlackKey, midiNoteToName } from '../../domain/music/noteUtils'
import { NotePerformance } from '../../domain/adaptation/types'

interface PianoKeyboardProps {
  keys: number[]
  activeNotes: number[]
  onToggleNote: (note: number) => void
  performances?: Map<number, NotePerformance>
  showHeatmap?: boolean
  disabled?: boolean
}

export function PianoKeyboard({
  keys,
  activeNotes,
  onToggleNote,
  performances,
  showHeatmap = false,
  disabled = false
}: PianoKeyboardProps): React.ReactElement {
  // Separamos teclas blancas (base) de las notas totales
  const whiteKeys = keys.filter((k) => !isBlackKey(k))

  // Función para determinar el color de cada tecla
  const getKeyStyle = (
    note: number,
    black: boolean
  ): { bg: string; text: string; ring?: string; dot?: boolean } => {
    const active = activeNotes.includes(note)
    const perf = performances?.get(note)
    const hasAttempts = perf && perf.attempts > 0

    // Modo HEATMAP (Diagnóstico final o en vivo)
    if (showHeatmap) {
      if (hasAttempts) {
        if (perf.accuracyPercentage >= 85) {
          return {
            bg: black
              ? 'bg-emerald-600 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.4)]'
              : 'bg-emerald-500 shadow-[inset_0_-6px_8px_rgba(0,0,0,0.15)]',
            text: 'text-white'
          }
        }
        if (perf.accuracyPercentage >= 50) {
          return {
            bg: black
              ? 'bg-amber-600 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.4)]'
              : 'bg-amber-400 shadow-[inset_0_-6px_8px_rgba(0,0,0,0.15)]',
            text: 'text-black font-extrabold'
          }
        }
        return {
          bg: black
            ? 'bg-red-600 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.4)]'
            : 'bg-red-500 shadow-[inset_0_-6px_8px_rgba(0,0,0,0.15)]',
          text: 'text-white'
        }
      }

      // Si estaba activa en la sesión pero no se llegó a preguntar
      if (active) {
        return {
          bg: black ? 'bg-zinc-800' : 'bg-zinc-100',
          text: black ? 'text-zinc-400' : 'text-zinc-700',
          dot: true // Muestra un pequeño punto sutil
        }
      }

      // Nota no incluida en la sesión
      return {
        bg: black ? 'bg-zinc-900 opacity-60' : 'bg-zinc-200 opacity-60',
        text: black ? 'text-zinc-600' : 'text-zinc-400'
      }
    }

    // Modo CONFIGURACIÓN / SELECCIÓN NORMAL
    if (active) {
      return {
        bg: black
          ? 'bg-sky-600 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.5)]'
          : 'bg-sky-400 shadow-[inset_0_-6px_8px_rgba(0,0,0,0.2)]',
        text: black ? 'text-white' : 'text-zinc-950 font-bold'
      }
    }

    if (black) {
      return {
        bg: 'bg-gradient-to-b from-zinc-800 to-zinc-950 hover:from-zinc-700 hover:to-zinc-900 shadow-[0_4px_6px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)]',
        text: 'text-zinc-400'
      }
    }

    return {
      bg: 'bg-gradient-to-b from-white via-zinc-50 to-zinc-200 hover:from-zinc-100 hover:to-zinc-300 shadow-[inset_0_-4px_4px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.3)]',
      text: 'text-zinc-800'
    }
  }

  // Calcula la posición horizontal (left %) de cada tecla negra respecto a las blancas
  const getBlackKeyOffsetPercent = (blackNote: number): number | null => {
    // Busca la tecla blanca inmediatamente anterior
    const prevWhiteIndex = whiteKeys.indexOf(blackNote - 1)
    if (prevWhiteIndex === -1) return null

    const totalWhiteKeys = whiteKeys.length
    const whiteKeyWidthPercent = 100 / totalWhiteKeys

    // Se posiciona en la frontera derecha de la tecla blanca previa menos la mitad de su ancho
    return (prevWhiteIndex + 1) * whiteKeyWidthPercent - whiteKeyWidthPercent * 0.32
  }

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5 shadow-2xl overflow-hidden select-none">
      {/* Contenedor del Teclado con perspectiva */}
      <div className="relative w-full h-24 md:h-28 flex">
        {/* 1. CAPA DE TECLAS BLANCAS (Base continua) */}
        {whiteKeys.map((note) => {
          const style = getKeyStyle(note, false)
          return (
            <button
              key={note}
              type="button"
              disabled={disabled}
              onClick={(): void => onToggleNote(note)}
              title={`${midiNoteToName(note)} (${note})`}
              className={`relative flex-1 h-full rounded-b-md border-r border-zinc-300/60 last:border-r-0 flex flex-col justify-end items-center pb-1.5 transition-all duration-100 cursor-pointer ${
                style.bg
              } ${style.text} ${disabled ? 'cursor-default' : 'active:brightness-95'}`}
            >
              <span className="text-[10px] md:text-[11px] font-semibold tracking-tighter leading-none">
                {midiNoteToName(note)}
              </span>
              {style.dot && (
                <span className="absolute top-2 w-1.5 h-1.5 rounded-full bg-sky-500/70" />
              )}
            </button>
          )
        })}

        {/* 2. CAPA DE TECLAS NEGRAS (Superpuestas por encima) */}
        {keys
          .filter((k) => isBlackKey(k))
          .map((note) => {
            const leftPercent = getBlackKeyOffsetPercent(note)
            if (leftPercent === null) return null

            const style = getKeyStyle(note, true)
            const totalWhiteKeys = whiteKeys.length
            const blackKeyWidthPercent = (100 / totalWhiteKeys) * 0.64

            return (
              <button
                key={note}
                type="button"
                disabled={disabled}
                onClick={(): void => onToggleNote(note)}
                title={`${midiNoteToName(note)} (${note})`}
                style={{
                  left: `${leftPercent}%`,
                  width: `${blackKeyWidthPercent}%`
                }}
                className={`absolute top-0 h-[62%] rounded-b-md z-20 flex flex-col justify-end items-center pb-1 transition-all duration-100 cursor-pointer border-x border-b border-black/40 ${
                  style.bg
                } ${style.text} ${disabled ? 'cursor-default' : 'active:scale-[0.98]'}`}
              >
                <span className="text-[8px] md:text-[9px] font-medium tracking-tighter leading-none scale-90">
                  {midiNoteToName(note)}
                </span>
                {style.dot && <span className="absolute top-1.5 w-1 h-1 rounded-full bg-sky-400" />}
              </button>
            )
          })}
      </div>
    </div>
  )
}
