import React, { useState, useMemo, useCallback, memo } from 'react'
import { isBlackKey, midiNoteToName } from '../../domain/music/noteUtils'
import { NotePerformance } from '../../domain/adaptation/types'

export type KeyboardVisualTheme = 'ghost_neon' | 'ambient_glow' | 'pool_heatmap'

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
  visualTheme?: KeyboardVisualTheme
}

interface KeyStyle {
  bg: string
  text: string
  dot?: boolean
  opacity?: string
}

/**
 * Calcula el estilo visual de una tecla. Es una función pura a nivel de módulo:
 * se invoca desde la hoja memoizada `PianoKey`, de modo que solo la tecla cuyo
 * estado cambió vuelve a computar su estilo (OLA 3.1 / F5-02).
 */
function computeKeyStyle(params: {
  black: boolean
  isPressed: boolean
  isVirtualClicked: boolean
  isStimulus: boolean
  isActive: boolean
  showHeatmap: boolean
  performance?: NotePerformance
  visualTheme: KeyboardVisualTheme
}): KeyStyle {
  const {
    black,
    isPressed,
    isVirtualClicked,
    isStimulus,
    isActive,
    showHeatmap,
    performance,
    visualTheme
  } = params

  const isCurrentlyActive = isPressed || isVirtualClicked

  // 1. PRIORIDAD MÁXIMA: Tecla pulsada por el usuario (Ámbar Neón)
  if (isCurrentlyActive) {
    return {
      bg: black
        ? 'bg-amber-400 shadow-[0_0_25px_rgba(251,191,36,1)] brightness-125'
        : 'bg-amber-300 shadow-[0_0_28px_rgba(251,191,36,1)] brightness-125',
      text: 'text-zinc-950 font-black'
    }
  }

  // 2. ESTÍMULO SONANDO EN MODO ASISTIDO (Cian Eléctrico)
  if (isStimulus) {
    return {
      bg: black
        ? 'bg-cyan-400 shadow-[0_0_25px_rgba(34,211,238,1)] brightness-125'
        : 'bg-cyan-300 shadow-[0_0_28px_rgba(34,211,238,1)] brightness-125',
      text: 'text-zinc-950 font-black'
    }
  }

  // 3. MODO HEATMAP DURANTE LA SESIÓN / RESUMEN
  if (showHeatmap) {
    const attempts = performance?.attempts ?? 0
    const accuracy = performance?.accuracyPercentage ?? 0

    // Si ya tiene intentos evaluados
    if (attempts > 0) {
      if (accuracy >= 85) {
        return {
          bg: black
            ? 'bg-emerald-600 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.5),0_0_12px_rgba(16,185,129,0.5)]'
            : 'bg-emerald-500 shadow-[inset_0_-6px_8px_rgba(0,0,0,0.2),0_0_12px_rgba(16,185,129,0.4)]',
          text: 'text-white font-bold'
        }
      }
      if (accuracy >= 50) {
        return {
          bg: black
            ? 'bg-amber-600 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.5),0_0_12px_rgba(245,158,11,0.5)]'
            : 'bg-amber-400 shadow-[inset_0_-6px_8px_rgba(0,0,0,0.2),0_0_12px_rgba(245,158,11,0.4)]',
          text: 'text-zinc-950 font-black'
        }
      }
      return {
        bg: black
          ? 'bg-rose-600 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.5),0_0_12px_rgba(244,63,94,0.5)]'
          : 'bg-rose-500 shadow-[inset_0_-6px_8px_rgba(0,0,0,0.2),0_0_12px_rgba(244,63,94,0.4)]',
        text: 'text-white font-bold'
      }
    }

    // Si es una tecla activa pero aún con 0 intentos: aplicamos el tema visual elegido
    if (isActive) {
      if (visualTheme === 'ghost_neon') {
        return {
          bg: black
            ? 'bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 border-b-4 border-sky-400 shadow-[0_4px_12px_rgba(56,189,248,0.3)]'
            : 'bg-gradient-to-b from-white via-zinc-100 to-zinc-200 border-b-4 border-sky-500 shadow-[0_4px_12px_rgba(56,189,248,0.25)]',
          text: black ? 'text-white font-bold' : 'text-zinc-950 font-black',
          dot: true
        }
      }

      if (visualTheme === 'ambient_glow') {
        return {
          bg: black
            ? 'bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[inset_0_4px_10px_rgba(56,189,248,0.5)]'
            : 'bg-gradient-to-b from-white via-zinc-50 to-zinc-200 shadow-[inset_0_4px_12px_rgba(56,189,248,0.35)]',
          text: 'text-sky-400 font-black',
          dot: true
        }
      }

      // pool_heatmap
      return {
        bg: black
          ? 'bg-sky-900 border border-sky-500/60 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
          : 'bg-sky-950/70 border border-sky-500/50 text-sky-200',
        text: black ? 'text-sky-100 font-bold' : 'text-sky-300 font-bold'
      }
    }

    // Teclas inactivas durante la sesión
    if (visualTheme === 'ghost_neon') {
      return {
        bg: black ? 'bg-zinc-900/60 border-zinc-900' : 'bg-zinc-800/40 border-zinc-800/50',
        text: 'text-zinc-600 font-normal',
        opacity: 'opacity-25'
      }
    }

    return {
      bg: black ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-300/30 border-zinc-700/30',
      text: 'text-zinc-600 font-medium',
      opacity: 'opacity-40'
    }
  }

  // 4. MODO CONFIGURACIÓN PREVIA
  if (isActive) {
    return {
      bg: black
        ? 'bg-sky-600 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.5),0_0_15px_rgba(2,132,199,0.5)]'
        : 'bg-sky-400 shadow-[inset_0_-6px_8px_rgba(0,0,0,0.2),0_0_18px_rgba(56,189,248,0.4)]',
      text: black ? 'text-white font-bold' : 'text-zinc-950 font-black'
    }
  }

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

interface PianoKeyProps {
  note: number
  black: boolean
  isPressed: boolean
  isVirtualClicked: boolean
  isStimulus: boolean
  isActive: boolean
  showHeatmap: boolean
  performance?: NotePerformance
  visualTheme: KeyboardVisualTheme
  disabled: boolean
  onClick: (note: number) => void
  leftPercent?: number | null
  widthPercent?: number
}

/**
 * Tecla individual memoizada. Recibe props planas y comparables por valor, de
 * modo que un cambio de estado de UNA tecla (ej. note-on MIDI) solo re-renderiza
 * esa tecla y reutiliza las otras 36 sin computar su estilo (OLA 3.1 / F5-02).
 */
const PianoKey = memo(function PianoKey({
  note,
  black,
  isPressed,
  isVirtualClicked,
  isStimulus,
  isActive,
  showHeatmap,
  performance,
  visualTheme,
  disabled,
  onClick,
  leftPercent,
  widthPercent
}: PianoKeyProps): React.ReactElement | null {
  const style = computeKeyStyle({
    black,
    isPressed,
    isVirtualClicked,
    isStimulus,
    isActive,
    showHeatmap,
    performance,
    visualTheme
  })

  if (black) {
    // El posicionamiento por offset solo aplica a teclas negras con offset definido.
    if (leftPercent === undefined || leftPercent === null) return null

    return (
      <button
        key={note}
        type="button"
        disabled={disabled}
        onClick={(): void => onClick(note)}
        title={`${midiNoteToName(note)} (${note})`}
        style={{
          left: `${leftPercent}%`,
          width: `${widthPercent}%`
        }}
        className={`absolute top-0 h-[64%] rounded-b-md z-20 flex flex-col justify-end items-center pb-1.5 transition-all duration-100 cursor-pointer border-x border-b border-black/80 active:translate-y-[2px] ${
          style.bg
        } ${style.text} ${style.opacity || 'opacity-100'} ${disabled ? 'cursor-default' : ''}`}
      >
        <span className="text-[8px] md:text-[9px] font-semibold tracking-tight leading-none scale-90">
          {midiNoteToName(note)}
        </span>
        {style.dot && (
          <span className="absolute top-2 w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,1)]" />
        )}
      </button>
    )
  }

  return (
    <button
      key={note}
      type="button"
      disabled={disabled}
      onClick={(): void => onClick(note)}
      title={`${midiNoteToName(note)} (${note})`}
      className={`relative flex-1 h-full rounded-b-lg border-r border-zinc-400/40 last:border-r-0 flex flex-col justify-end items-center pb-2 transition-all duration-100 cursor-pointer active:translate-y-[2px] ${
        style.bg
      } ${style.text} ${style.opacity || 'opacity-100'} ${disabled ? 'cursor-default' : ''}`}
    >
      <span className="text-[10px] md:text-xs font-bold tracking-tighter leading-none">
        {midiNoteToName(note)}
      </span>
      {style.dot && (
        <span className="absolute top-2.5 w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
      )}
    </button>
  )
})

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
  disabled = false,
  visualTheme = 'ghost_neon'
}: PianoKeyboardProps): React.ReactElement {
  // Particiones precomputadas: dependen solo de `keys` (referencia estable).
  const whiteKeys = useMemo(() => keys.filter((k) => !isBlackKey(k)), [keys])
  const blackKeys = useMemo(() => keys.filter((k) => isBlackKey(k)), [keys])

  // Membresía O(1) por tecla: se reconstruye solo cuando cambia la prop.
  const pressedSet = useMemo(() => new Set(pressedNotes), [pressedNotes])
  const stimulusSet = useMemo(() => new Set(stimulusNotes), [stimulusNotes])
  const activeSet = useMemo(() => new Set(activeNotes), [activeNotes])

  const [clickedNote, setClickedNote] = useState<number | null>(null)

  const handleKeyInteraction = useCallback(
    (note: number): void => {
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
    },
    [disabled, isInteractiveTraining, onPlayNoteVirtual, onToggleNote]
  )

  const getBlackKeyOffsetPercent = useCallback(
    (blackNote: number): number | null => {
      const prevWhiteIndex = whiteKeys.indexOf(blackNote - 1)
      if (prevWhiteIndex === -1) return null

      const totalWhiteKeys = Math.max(1, whiteKeys.length)
      const whiteKeyWidthPercent = 100 / totalWhiteKeys

      return (prevWhiteIndex + 1) * whiteKeyWidthPercent - whiteKeyWidthPercent * 0.33
    },
    [whiteKeys]
  )

  const blackKeyWidthPercent = (100 / Math.max(1, whiteKeys.length)) * 0.66

  return (
    <div className="w-full bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-2 md:p-3 shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl overflow-hidden select-none">
      <div className="relative w-full h-24 md:h-32 flex rounded-lg overflow-hidden bg-black/40 p-0.5">
        {/* TECLAS BLANCAS */}
        {whiteKeys.map((note) => (
          <PianoKey
            key={note}
            note={note}
            black={false}
            isPressed={pressedSet.has(note)}
            isVirtualClicked={clickedNote === note}
            isStimulus={stimulusSet.has(note)}
            isActive={activeSet.has(note)}
            showHeatmap={showHeatmap}
            performance={performances?.get(note)}
            visualTheme={visualTheme}
            disabled={disabled}
            onClick={handleKeyInteraction}
          />
        ))}

        {/* TECLAS NEGRAS */}
        {blackKeys.map((note) => (
          <PianoKey
            key={note}
            note={note}
            black
            isPressed={pressedSet.has(note)}
            isVirtualClicked={clickedNote === note}
            isStimulus={stimulusSet.has(note)}
            isActive={activeSet.has(note)}
            showHeatmap={showHeatmap}
            performance={performances?.get(note)}
            visualTheme={visualTheme}
            disabled={disabled}
            onClick={handleKeyInteraction}
            leftPercent={getBlackKeyOffsetPercent(note)}
            widthPercent={blackKeyWidthPercent}
          />
        ))}
      </div>
    </div>
  )
}

export const PianoKeyboard = memo(PianoKeyboardComponent)
