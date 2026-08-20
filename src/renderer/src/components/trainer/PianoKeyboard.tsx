import React, { useState, memo } from 'react'
import { isBlackKey, midiNoteToName } from '../../domain/music/noteUtils'
import { NotePerformance } from '../../domain/adaptation/types'

interface PianoKeyboardProps {
  keys: number[]
  activeNotes?: number[]
  pressedNotes?: number[]
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
  ): { bg: string; text: string; dot?: boolean } => {
    const isPhysicallyPressed = Array.isArray(pressedNotes) && pressedNotes.includes(note)
    const isVirtualClicked = clickedNote === note
    const isCurrentlyActive = isPhysicallyPressed || isVirtualClicked

    if (isCurrentlyActive) {
      return {
        bg: black
          ? 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.9)] brightness-125'
          : 'bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.9)] brightness-125',
        text: 'text-black font-extrabold'
      }
    }

    const isNoteActive = Array.isArray(activeNotes) && activeNotes.includes(note)

    if (showHeatmap) {
      const perf = performances?.get(note)
      const attempts = perf?.attempts ?? 0
      const accuracy = perf?.accuracyPercentage ?? 0

      if (attempts > 0) {
        if (accuracy >= 85) {
          return {
            bg: black
              ? 'bg-emerald-600 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.4)]'
              : 'bg-emerald-500 shadow-[inset_0_-6px_8px_rgba(0,0,0,0.15)]',
            text: 'text-white'
          }
        }
        if (accuracy >= 50) {
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

      if (isNoteActive) {
        return {
          bg: black
            ? 'bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[0_4px_6px_rgba(0,0,0,0.6)]'
            : 'bg-gradient-to-b from-white via-zinc-50 to-zinc-200 shadow-[inset_0_-4px_4px_rgba(0,0,0,0.1)]',
          text: black ? 'text-zinc-400' : 'text-zinc-800',
          dot: true
        }
      }

      return {
        bg: black
          ? 'bg-zinc-800/70 border-zinc-800/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
          : 'bg-zinc-300/40 border-zinc-700/40 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.08)]',
        text: black ? 'text-zinc-500 font-medium' : 'text-zinc-400 font-medium'
      }
    }

    if (isNoteActive) {
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

  const getBlackKeyOffsetPercent = (blackNote: number): number | null => {
    const prevWhiteIndex = whiteKeys.indexOf(blackNote - 1)
    if (prevWhiteIndex === -1) return null

    const totalWhiteKeys = Math.max(1, whiteKeys.length)
    const whiteKeyWidthPercent = 100 / totalWhiteKeys

    return (prevWhiteIndex + 1) * whiteKeyWidthPercent - whiteKeyWidthPercent * 0.32
  }

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5 shadow-2xl overflow-hidden select-none">
      <div className="relative w-full h-24 md:h-28 flex">
        {whiteKeys.map((note) => {
          const style = getKeyStyle(note, false)
          return (
            <button
              key={note}
              type="button"
              disabled={disabled}
              onClick={(): void => handleKeyInteraction(note)}
              title={`${midiNoteToName(note)} (${note})`}
              className={`relative flex-1 h-full rounded-b-md border-r border-zinc-300/60 last:border-r-0 flex flex-col justify-end items-center pb-1.5 transition-all duration-75 cursor-pointer ${
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

        {keys
          .filter((k) => isBlackKey(k))
          .map((note) => {
            const leftPercent = getBlackKeyOffsetPercent(note)
            if (leftPercent === null) return null

            const style = getKeyStyle(note, true)
            const totalWhiteKeys = Math.max(1, whiteKeys.length)
            const blackKeyWidthPercent = (100 / totalWhiteKeys) * 0.64

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
                className={`absolute top-0 h-[62%] rounded-b-md z-20 flex flex-col justify-end items-center pb-1 transition-all duration-75 cursor-pointer border-x border-b border-black/40 ${
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

export const PianoKeyboard = memo(PianoKeyboardComponent)
