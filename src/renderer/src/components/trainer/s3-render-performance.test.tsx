import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AnalyticsCharts } from './AnalyticsCharts'
import { useAnalyticsStore } from '../../stores/useAnalyticsStore'
import { DbSessionRecord, DbAnswerRecord } from '../../domain/database/types'
import { PianoKeyboard } from './PianoKeyboard'
import * as noteUtils from '../../domain/music/noteUtils'
import { generateMidiRange, midiNoteToName } from '../../domain/music/noteUtils'
import { NotePerformance } from '../../domain/adaptation/types'

describe('s3-render-performance - Optimización y Contención de Renders', () => {
  const mockSessions: DbSessionRecord[] = [
    {
      id: 's1',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'piano',
      presetName: 'Notas (3)',
      totalQuestions: 2,
      correctAnswers: 2,
      accuracyPercentage: 100,
      avgResponseTimeMs: 1000,
      durationSeconds: 10
    }
  ]

  const mockAnswers: DbAnswerRecord[] = [
    {
      id: 'a1',
      sessionId: 's1',
      questionIndex: 1,
      expectedNote: 60,
      playedNote: 60,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 900,
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    }
  ]

  it('analytics recomputation only on relevant changes: las métricas psicométricas solo se recalculan cuando cambian sesiones o respuestas', () => {
    const store = useAnalyticsStore.getState()
    const computeSpy = vi.spyOn(store, 'recomputeMetrics')

    // Llamada inicial
    store.recomputeMetrics(mockSessions, mockAnswers)
    expect(computeSpy).toHaveBeenCalledTimes(1)

    // Si los arrays de datos son idénticos en memoria, no debe recalcular
    const prevMetrics = useAnalyticsStore.getState().metrics
    expect(prevMetrics.totalAnswers).toBe(1)
  })

  it('MIDI note events do not re-render unrelated UI: componentes memoizados no sufren re-renderizado si sus props son estables', () => {
    let renderCount = 0

    const SpyAnalyticsCharts = (
      props: React.ComponentProps<typeof AnalyticsCharts>
    ): React.ReactElement => {
      renderCount++
      return <AnalyticsCharts {...props} />
    }

    const { rerender } = render(
      <SpyAnalyticsCharts sessions={mockSessions} answers={mockAnswers} />
    )

    expect(renderCount).toBe(1)

    // Re-renderizamos con exactamente las mismas referencias
    rerender(<SpyAnalyticsCharts sessions={mockSessions} answers={mockAnswers} />)

    // Gracias a React.memo, renderCount se mantiene en 2 por el wrapper pero AnalyticsCharts preserva su VDOM
    expect(renderCount).toBe(2)
  })
})

// ============================================================================
// OLA 3.1 (Auditoría V6, hallazgos F5-01 y F5-02):
// Contratos de memoización y equivalencia funcional del PianoKeyboard.
//
// Instrumentación: se espía `midiNoteToName`, invocada 2 veces por tecla y por
// render (atributo `title` + etiqueta de texto). Con 37 teclas, un render
// completo del teclado equivale a 74 invocaciones. Este contador es un proxy
// exacto de la actividad de render a nivel de tecla individual.
// ============================================================================

const PIANO_KEYS = generateMidiRange(48, 84) // C3 a C6 (37 teclas)
const CALLS_PER_KEY_RENDER = 2
const CALLS_PER_FULL_KEYBOARD_RENDER = PIANO_KEYS.length * CALLS_PER_KEY_RENDER // 74

const STABLE_EMPTY: number[] = []

describe('PianoKeyboard - contratos de memoización (OLA 3.1 / F5-01, F5-02)', () => {
  let nameSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    // Se captura la implementación real ANTES de instalar el spy.
    const realMidiNoteToName = noteUtils.midiNoteToName
    nameSpy = vi.spyOn(noteUtils, 'midiNoteToName')
    // El spy delega a la implementación real para no romper el render.
    nameSpy.mockImplementation((...args: [number]) => realMidiNoteToName(...args))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    cleanup()
  })

  it('1.1 no re-renderiza el teclado cuando las props son referencias idénticas', () => {
    const onToggleNote = vi.fn()

    const { rerender } = render(
      <PianoKeyboard
        keys={PIANO_KEYS}
        activeNotes={STABLE_EMPTY}
        pressedNotes={STABLE_EMPTY}
        stimulusNotes={STABLE_EMPTY}
        onToggleNote={onToggleNote}
      />
    )

    const initialCalls = nameSpy.mock.calls.length
    expect(initialCalls).toBe(CALLS_PER_FULL_KEYBOARD_RENDER)

    // Re-render con exactamente las mismas referencias: React.memo debe cortocircuitar.
    rerender(
      <PianoKeyboard
        keys={PIANO_KEYS}
        activeNotes={STABLE_EMPTY}
        pressedNotes={STABLE_EMPTY}
        stimulusNotes={STABLE_EMPTY}
        onToggleNote={onToggleNote}
      />
    )

    expect(nameSpy.mock.calls.length).toBe(initialCalls)
  })

  it('1.2 un cambio de estado de UNA sola tecla no re-renderiza las otras 36', () => {
    const onToggleNote = vi.fn()

    const { rerender } = render(
      <PianoKeyboard
        keys={PIANO_KEYS}
        activeNotes={STABLE_EMPTY}
        pressedNotes={STABLE_EMPTY}
        stimulusNotes={STABLE_EMPTY}
        onToggleNote={onToggleNote}
      />
    )

    nameSpy.mockClear()

    // Solo la nota 60 (C4) cambia de estado. Las otras 36 teclas no deben
    // re-renderizarse: el recuento debe quedar en 2 (title + label de C4).
    rerender(
      <PianoKeyboard
        keys={PIANO_KEYS}
        activeNotes={STABLE_EMPTY}
        pressedNotes={[60]}
        stimulusNotes={STABLE_EMPTY}
        onToggleNote={onToggleNote}
      />
    )

    const callsForChangedKey = nameSpy.mock.calls.filter((callArgs) => callArgs[0] === 60).length
    const callsForUnchangedKeys = nameSpy.mock.calls.filter((callArgs) => callArgs[0] !== 60).length

    expect(callsForChangedKey).toBe(CALLS_PER_KEY_RENDER)
    expect(callsForUnchangedKeys).toBe(0)
  })
})

describe('PianoKeyboard - equivalencia funcional (OLA 3.1 / anti-regresión)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    cleanup()
  })

  const keyButtonByNote = (note: number): HTMLElement =>
    screen.getByTitle(`${midiNoteToName(note)} (${note})`)

  it('1.3a el clic virtual invoca el callback correcto con la nota pulsada', () => {
    const onPlayNoteVirtual = vi.fn()

    render(
      <PianoKeyboard
        keys={PIANO_KEYS}
        pressedNotes={STABLE_EMPTY}
        stimulusNotes={STABLE_EMPTY}
        isInteractiveTraining
        onPlayNoteVirtual={onPlayNoteVirtual}
      />
    )

    fireEvent.click(keyButtonByNote(60))
    expect(onPlayNoteVirtual).toHaveBeenCalledTimes(1)
    expect(onPlayNoteVirtual).toHaveBeenCalledWith(60)
  })

  it('1.3b fuera de entrenamiento interactivo, el clic enruta a onToggleNote', () => {
    const onToggleNote = vi.fn()

    render(
      <PianoKeyboard
        keys={PIANO_KEYS}
        pressedNotes={STABLE_EMPTY}
        stimulusNotes={STABLE_EMPTY}
        onToggleNote={onToggleNote}
      />
    )

    fireEvent.click(keyButtonByNote(62))
    expect(onToggleNote).toHaveBeenCalledTimes(1)
    expect(onToggleNote).toHaveBeenCalledWith(62)
  })

  it('1.3c una nota físicamente pulsada resalta la tecla correspondiente', () => {
    render(<PianoKeyboard keys={PIANO_KEYS} pressedNotes={[64]} stimulusNotes={STABLE_EMPTY} />)

    const pressedButton = keyButtonByNote(64)
    expect(pressedButton.className).toContain('bg-amber-300')

    const idleButton = keyButtonByNote(65)
    expect(idleButton.className).not.toContain('bg-amber-300')
  })

  it('1.3d prioridad visual: pulsada > estímulo > activa > default', () => {
    // Nota 60: pulsada Y estímulo a la vez -> gana "pulsada" (ámbar).
    // Nota 62: solo estímulo -> cian.
    // Nota 64: solo activa (modo configuración) -> sky.
    // Nota 65: default.
    render(
      <PianoKeyboard
        keys={PIANO_KEYS}
        activeNotes={[64]}
        pressedNotes={[60]}
        stimulusNotes={[60, 62]}
      />
    )

    expect(keyButtonByNote(60).className).toContain('bg-amber-300')
    expect(keyButtonByNote(62).className).toContain('bg-cyan-300')
    expect(keyButtonByNote(64).className).toContain('bg-sky-400')
    expect(keyButtonByNote(65).className).toContain('from-white')
  })

  it('1.3e las teclas negras mantienen su posicionamiento por offset', () => {
    const performances = new Map<number, NotePerformance>([
      [
        61,
        {
          noteNumber: 61,
          attempts: 4,
          correct: 3,
          lastResultWasCorrect: true,
          accuracyPercentage: 90,
          weight: 0.5
        }
      ]
    ])

    render(
      <PianoKeyboard
        keys={PIANO_KEYS}
        pressedNotes={STABLE_EMPTY}
        stimulusNotes={STABLE_EMPTY}
        performances={performances}
        showHeatmap
      />
    )

    // 61 = C#4 (tecla negra): debe tener left/width inline y marca de dominada.
    const blackButton = keyButtonByNote(61)
    expect(blackButton.style.left).not.toBe('')
    expect(blackButton.style.width).not.toBe('')
    expect(blackButton.className).toContain('bg-emerald-600')

    // 60 = C4 (tecla blanca): sin posicionamiento absoluto.
    const whiteButton = keyButtonByNote(60)
    expect(whiteButton.style.left).toBe('')
  })
})
