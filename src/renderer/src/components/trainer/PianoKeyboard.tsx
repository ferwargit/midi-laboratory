import React, { useState, memo } from 'react'
import { isBlackKey, midiNoteToName } from '../../domain/music/noteUtils'
import { NotePerformance } from '../../domain/adaptation/types'

interface PianoKeyboardProps {
  keys: number[]
  activeNotes?: number[]
  pressedNotes?: number[]
  stimulusNotes?: number[]
  onToggleNote?: (note: number) => void
  onPlayNoteVirtual?: (note: number) => void
  performances?: Map<number, NotePerformance>
  showHeatmap?: boolean
  isInteractiveTraining?: boolean
  disabled?: boolean
}

function PianoKeyboardComponent({
  keys = [],
  activeNotes = [],
  pressedNotes = [],
  stimulusNotes = [],
  onToggleNote,
  onPlayNoteVirtual,
  performances,
  showHeatmap = false,
  isInteractiveTraining = false,
  disabled = false
}: PianoKeyboardProps): React.ReactElement {
  const whiteKeys = keys.filter((k) => !isBlackKey(k))
  const [clickedNote, setClickedNote] = useState<number | null>(null)

  const handleKeyInteraction = (note: number): void => {
    if (disabled) return

    if (isInteractiveTraining && onPlayNoteVirtual) {
      setClickedNote(note)
      onPlayNoteVirtual(note)
      setTimeout(() => setClickedNote(null), 250)
      return
    }

    if (onToggleNote) {
      onToggleNote(note)
    }
  }

  const getKeyStyle = (
    note: number,
    black: boolean
  ): { bg: string; text: string; dot?: boolean; border?: string } => {
    const isPhysicallyPressed = Array.isArray(pressedNotes) && pressedNotes.includes(note)
    const isVirtualClicked = clickedNote === note
    const isCurrentlyActive = isPhysicallyPressed || isVirtualClicked
    const isStimulusPlaying = Array.isArray(stimulusNotes) && stimulusNotes.includes(note)

    // 1. PRIORIDAD: Tecla pulsada por el usuario (Ámbar Neón)
    if (isCurrentlyActive) {
      return {
        bg: black
          ? 'bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,1)] brightness-125'
          : 'bg-amber-300 shadow-[0_0_25px_rgba(251,191,36,1)] brightness-125',
        text: 'text-zinc-950 font-black'
      }
    }

    // 2. ESTÍMULO SONANDO EN MODO ASISTIDO (Cian Eléctrico)
    if (isStimulusPlaying) {
      return {
        bg: black
          ? 'bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,1)] brightness-125'
          : 'bg-cyan-300 shadow-[0_0_25px_rgba(34,211,238,1)] brightness-125',
        text: 'text-zinc-950 font-black'
      }
    }

    const isNoteActive = Array.isArray(activeNotes) && activeNotes.includes(note)

    // 3. HEATMAP ANALÍTICO
    if (showHeatmap) {
      const perf = performances?.get(note)
      const attempts = perf?.attempts ?? 0
      const accuracy = perf?.accuracyPercentage ?? 0

      if (attempts > 0) {
        if (accuracy >= 85) {
          return {
            bg: black ? 'bg-emerald-600 shadow-inner' : 'bg-emerald-500 shadow-inner',
            text: 'text-white font-bold'
          }
        }
        if (accuracy >= 50) {
          return {
            bg: black ? 'bg-amber-600 shadow-inner' : 'bg-amber-400 shadow-inner',
            text: 'text-zinc-950 font-bold'
          }
        }
        return {
          bg: black ? 'bg-rose-600 shadow-inner' : 'bg-rose-500 shadow-inner',
          text: 'text-white font-bold'
        }
      }

      if (isNoteActive) {
        return {
          bg: black
            ? 'bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-md'
            : 'bg-gradient-to-b from-zinc-100 via-zinc-200 to-zinc-300 shadow-sm',
          text: black ? 'text-zinc-400' : 'text-zinc-700',
          dot: true
        }
      }

      return {
        bg: black
          ? 'bg-zinc-900 border-zinc-800 text-zinc-600'
          : 'bg-zinc-300/30 border-zinc-700/30 text-zinc-500',
        text: black ? 'text-zinc-600' : 'text-zinc-500'
      }
    }

    // 4. MODO CONFIGURACIÓN PREVIA (Pool Activo)
    if (isNoteActive) {
      return {
        bg: black
          ? 'bg-sky-600 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.5),0_0_12px_rgba(2,132,199,0.5)]'
          : 'bg-sky-400 shadow-[inset_0_-6px_8px_rgba(0,0,0,0.2),0_0_15px_rgba(56,189,248,0.4)]',
        text: black ? 'text-white font-bold' : 'text-zinc-950 font-black'
      }
    }

    // 5. ESTADO EN REPOSO ESTÁNDAR
    if (black) {
      return {
        bg: 'bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 shadow-[0_8px_14px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.15)]',
        text: 'text-zinc-400 hover:text-zinc-200'
      }
    }

    return {
      bg: 'bg-gradient-to-b from-white via-zinc-100 to-zinc-300 hover:from-zinc-50 hover:to-zinc-200 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.12),0_2px_5px_rgba(0,0,0,0.35)]',
      text: 'text-zinc-800 hover:text-zinc-950'
    }
  }

  const getBlackKeyOffsetPercent = (blackNote: number): number | null => {
    const prevWhiteIndex = whiteKeys.indexOf(blackNote - 1)
    if (prevWhiteIndex === -1) return null

    const totalWhiteKeys = Math.max(1, whiteKeys.length)
    const whiteKeyWidthPercent = 100 / totalWhiteKeys

    return (prevWhiteIndex + 1) * whiteKeyWidthPercent - whiteKeyWidthPercent * 0.33
  }

  return (
    <div className="w-full bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-2 md:p-3 shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl overflow-hidden select-none">
      <div className="relative w-full h-24 md:h-32 flex rounded-lg overflow-hidden bg-black/40 p-0.5">
        {/* TECLAS BLANCAS */}
        {whiteKeys.map((note) => {
          const style = getKeyStyle(note, false)
          return (
            <button
              key={note}
              type="button"
              disabled={disabled}
              onClick={(): void => handleKeyInteraction(note)}
              title={`${midiNoteToName(note)} (${note})`}
              className={`relative flex-1 h-full rounded-b-lg border-r border-zinc-400/40 last:border-r-0 flex flex-col justify-end items-center pb-2 transition-all duration-75 cursor-pointer active:translate-y-[2px] ${
                style.bg
              } ${style.text} ${disabled ? 'cursor-default' : ''}`}
            >
              <span className="text-[10px] md:text-xs font-bold tracking-tighter leading-none">
                {midiNoteToName(note)}
              </span>
              {style.dot && (
                <span className="absolute top-2.5 w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              )}
            </button>
          )
        })}

        {/* TECLAS NEGRAS */}
        {keys
          .filter((k) => isBlackKey(k))
          .map((note) => {
            const leftPercent = getBlackKeyOffsetPercent(note)
            if (leftPercent === null) return null

            const style = getKeyStyle(note, true)
            const totalWhiteKeys = Math.max(1, whiteKeys.length)
            const blackKeyWidthPercent = (100 / totalWhiteKeys) * 0.66

            return (
              <button
                key={note}
                type="button"
                disabled={disabled}
                onClick={(): void => handleKeyInteraction(note)}
                title={`${midiNoteToName(note)} (${note})`}
                style={{
                  left: `${leftPercent}%`,
                  width: `${blackKeyWidthPercent}%`
                }}
                className={`absolute top-0 h-[64%] rounded-b-md z-20 flex flex-col justify-end items-center pb-1.5 transition-all duration-75 cursor-pointer border-x border-b border-black/80 active:translate-y-[2px] ${
                  style.bg
                } ${style.text} ${disabled ? 'cursor-default' : ''}`}
              >
                <span className="text-[8px] md:text-[9px] font-semibold tracking-tight leading-none scale-90">
                  {midiNoteToName(note)}
                </span>
                {style.dot && (
                  <span className="absolute top-2 w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.9)]" />
                )}
              </button>
            )
          })}
      </div>
    </div>
  )
}

export const PianoKeyboard = memo(PianoKeyboardComponent)
