import React from 'react'
import { isBlackKey, midiNoteToName } from '../../domain/music/noteUtils'

interface PianoKeyboardProps {
  keys: number[]
  activeNotes: number[]
  onToggleNote: (note: number) => void
  disabled?: boolean
}

export function PianoKeyboard({
  keys,
  activeNotes,
  onToggleNote,
  disabled
}: PianoKeyboardProps): React.ReactElement {
  return (
    <div className="flex overflow-x-auto p-2 gap-0.5 bg-zinc-950 border border-zinc-800 rounded-lg">
      {keys.map((note) => {
        const active = activeNotes.includes(note)
        const black = isBlackKey(note)

        return (
          <button
            key={note}
            type="button"
            disabled={disabled}
            onClick={(): void => onToggleNote(note)}
            title={`${midiNoteToName(note)} (${note})`}
            className={`flex-none w-7 rounded-b transition-colors cursor-pointer flex flex-col justify-end pb-1 text-center font-bold text-[9px] ${
              black ? 'h-16 z-10' : 'h-24 z-0'
            } ${
              active
                ? 'bg-sky-500 text-white'
                : black
                  ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
            }`}
          >
            {midiNoteToName(note)}
          </button>
        )
      })}
    </div>
  )
}
