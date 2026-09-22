import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackPanel } from './FeedbackPanel'
import { IntervalFeedbackPanel } from './IntervalFeedbackPanel'
import { SequenceFeedbackPanel } from './SequenceFeedbackPanel'
import { RepertoireFeedbackPanel } from './RepertoireFeedbackPanel'
import { ExerciseResult } from '../../domain/exercise/types'
import {
  IntervalExerciseResult,
  IntervalExerciseStimulus
} from '../../domain/exercise/intervalEvaluator'
import { SequenceExerciseResult } from '../../domain/exercise/sequenceEvaluator'
import { RepertoireExerciseResult } from '../../domain/exercise/repertoireEvaluator'
import { ScorePlaybackEvent } from '../../domain/music/scoreTypes'

describe('s4-ux-feedback - Claridad del Feedback Visual y Prompt Manual', () => {
  const mockWrongResult: ExerciseResult = {
    expectedNote: 60, // C4
    playedNote: 62, // D4
    correct: false,
    semitoneDistance: 2,
    responseTimeMs: 1400
  }

  const mockCorrectResult: ExerciseResult = {
    expectedNote: 60,
    playedNote: 60,
    correct: true,
    semitoneDistance: 0,
    responseTimeMs: 900
  }

  it('shows expected vs actual note: muestra de forma inequívoca la nota esperada y la nota tocada', () => {
    render(
      <FeedbackPanel
        isWaitingAnswer={false}
        lastResult={mockWrongResult}
        isWaitingManualAdvance={false}
      />
    )

    // Debe mostrar la nota esperada C4 y la nota tocada D4
    expect(screen.getByText(/Esperada:/i)).toBeDefined()
    expect(screen.getByText('C4')).toBeDefined()
    expect(screen.getByText(/Tocaste:/i)).toBeDefined()
    expect(screen.getByText('D4')).toBeDefined()
    expect(screen.getByText(/\+2 semitonos/i)).toBeDefined()
  })

  it('manual advance prompt visible when relevant: muestra el prompt y botón de avance manual en pausa de análisis', () => {
    const onAdvanceNext = vi.fn()

    render(
      <FeedbackPanel
        isWaitingAnswer={false}
        lastResult={mockWrongResult}
        isWaitingManualAdvance={true}
        onAdvanceNext={onAdvanceNext}
      />
    )

    // El botón y la indicación de Espacio deben ser visibles
    expect(screen.getByText(/Siguiente Pregunta ➔/i)).toBeDefined()
    expect(screen.getByText(/Espacio/i)).toBeDefined()
  })

  it('shows positive feedback when correct: muestra mensaje afirmativo de acierto', () => {
    render(
      <FeedbackPanel
        isWaitingAnswer={false}
        lastResult={mockCorrectResult}
        isWaitingManualAdvance={false}
      />
    )

    expect(screen.getByText(/¡Correcto!/i)).toBeDefined()
    expect(screen.getByText(/Afinación exacta/i)).toBeDefined()
  })

  it('FeedbackPanel renders unified OLED container classes', () => {
    const { container } = render(
      <FeedbackPanel
        isWaitingAnswer={false}
        lastResult={mockCorrectResult}
        isWaitingManualAdvance={false}
      />
    )

    const root = container.firstChild as HTMLElement
    expect(root?.className).toMatch(/bg-slate-950\/90/)
    expect(root?.className).toMatch(/border-slate-800\/80/)
    expect(root?.className).toMatch(/rounded-xl/)
    expect(root?.className).toMatch(/shadow-inner/)
  })
})

describe('IntervalFeedbackPanel - UI unificada', () => {
  const mockStimulus: IntervalExerciseStimulus = {
    rootNote: 60,
    targetNote: 64,
    semitones: 4,
    direction: 'ascending'
  }

  const mockIntervalResult: IntervalExerciseResult = {
    expectedStimulus: mockStimulus,
    playedNotes: [60, 65],
    playedSemitones: 5,
    playedDirection: 'ascending',
    isIntervalCorrect: false,
    isRootCorrect: true,
    isExactMatch: false,
    isTransposedCorrect: false,
    semitoneDistanceError: 1,
    responseTimeMs: 1200,
    feedbackMessage: '❌ Tocaste 5ma. Era 4ta'
  }

  it('renders fichas de intervalo con paleta unificada', () => {
    render(
      <IntervalFeedbackPanel
        isSessionActive={true}
        stimulus={mockStimulus}
        waitingNoteStep={2}
        firstNotePlayed={60}
        lastResult={mockIntervalResult}
        isWaitingManualAdvance={false}
      />
    )

    expect(screen.getByText(/Intervalo Esperado:/i)).toBeDefined()
    expect(screen.getByText(/Tocaste:/i)).toBeDefined()
    expect(screen.getByText(/4st/i)).toBeDefined()
    expect(screen.getByText(/5st/i)).toBeDefined()
  })

  it('shows manual advance button with primary variant', () => {
    const onAdvanceNext = vi.fn()

    render(
      <IntervalFeedbackPanel
        isSessionActive={true}
        stimulus={mockStimulus}
        waitingNoteStep={2}
        firstNotePlayed={60}
        lastResult={mockIntervalResult}
        isWaitingManualAdvance={true}
        onAdvanceNext={onAdvanceNext}
      />
    )

    expect(screen.getByText(/Siguiente Intervalo ➔/i)).toBeDefined()
    expect(screen.getByText(/Espacio/i)).toBeDefined()
  })

  it('renders unified OLED container', () => {
    const { container } = render(
      <IntervalFeedbackPanel
        isSessionActive={true}
        stimulus={mockStimulus}
        waitingNoteStep={1}
        firstNotePlayed={null}
        lastResult={null}
        isWaitingManualAdvance={false}
      />
    )

    const root = container.firstChild as HTMLElement
    expect(root?.className).toMatch(/bg-slate-950\/90/)
    expect(root?.className).toMatch(/rounded-xl/)
    expect(root?.className).toMatch(/shadow-inner/)
  })
})

describe('SequenceFeedbackPanel - UI unificada', () => {
  const mockSequenceResult: SequenceExerciseResult = {
    expectedNotes: [60, 62, 64],
    playedNotes: [60, 63, 64],
    exactMatchesCount: 2,
    isExactMatch: false,
    expectedContour: ['up', 'up'],
    playedContour: ['up', 'up'],
    isContourCorrect: true,
    levenshteinDistance: 1,
    similarityScorePercentage: 67,
    noteByNoteEvaluation: [
      { expected: 60, played: 60, isCorrect: true },
      { expected: 62, played: 63, isCorrect: false },
      { expected: 64, played: 64, isCorrect: true }
    ],
    responseTimeMs: 2500,
    feedbackMessage: '🎶 ¡Excelente contorno! Reprodujiste la forma de la melodía'
  }

  it('renders fichas de notas por nota con paleta unificada', () => {
    render(
      <SequenceFeedbackPanel
        isSessionActive={true}
        expectedLength={3}
        capturedNotes={[]}
        lastResult={mockSequenceResult}
        isWaitingManualAdvance={false}
      />
    )

    expect(screen.getByText(/Contorno melódico correcto/i)).toBeDefined()
    expect(screen.getByText(/C4/i)).toBeDefined()
    expect(screen.getByText(/E4/i)).toBeDefined()
  })

  it('shows manual advance button with primary variant', () => {
    const onAdvanceNext = vi.fn()

    render(
      <SequenceFeedbackPanel
        isSessionActive={true}
        expectedLength={3}
        capturedNotes={[60]}
        lastResult={mockSequenceResult}
        isWaitingManualAdvance={true}
        onAdvanceNext={onAdvanceNext}
      />
    )

    expect(screen.getByText(/Siguiente ➔ \(Espacio\)/i)).toBeDefined()
  })

  it('renders unified OLED container', () => {
    const { container } = render(
      <SequenceFeedbackPanel
        isSessionActive={true}
        expectedLength={3}
        capturedNotes={[]}
        lastResult={null}
        isWaitingManualAdvance={false}
      />
    )

    const root = container.firstChild as HTMLElement
    expect(root?.className).toMatch(/bg-slate-950\/90/)
    expect(root?.className).toMatch(/rounded-xl/)
  })
})

describe('RepertoireFeedbackPanel - UI unificada', () => {
  const mockScoreEvent: ScorePlaybackEvent = {
    id: '1',
    measureNumber: 1,
    beatPosition: 1.0,
    notes: [],
    midiNotes: [60, 64, 67],
    durationDivisions: 4,
    durationBeats: 1,
    durationMs: 1000,
    isChord: true,
    isRest: false,
    hand: 'RH',
    staff: 1,
    voice: 1
  }

  const mockRepertoireResult: RepertoireExerciseResult = {
    isCompleteSuccess: false,
    pitchAccuracyPercent: 80,
    rhythmAccuracyPercent: 90,
    overallScorePercent: 83,
    evaluatedEvents: [],
    feedbackMessage: '👍 Buen progreso: 80% de acierto de notas. Repetí para consolidar.'
  }

  it('renders streak badge and progreso', () => {
    render(
      <RepertoireFeedbackPanel
        isSessionActive={true}
        activeSlice={[mockScoreEvent]}
        currentStreak={3}
        streakTarget={10}
        lastResult={null}
        isWaitingManualAdvance={false}
        onRepeatSlice={vi.fn()}
      />
    )

    expect(screen.getByText(/Meta de Retención:/i)).toBeDefined()
    expect(screen.getByText(/3 \/ 10 ⭐/i)).toBeDefined()
  })

  it('renders métricas con tabular-nums y paleta', () => {
    render(
      <RepertoireFeedbackPanel
        isSessionActive={true}
        activeSlice={[mockScoreEvent]}
        currentStreak={3}
        streakTarget={10}
        lastResult={mockRepertoireResult}
        isWaitingManualAdvance={false}
      />
    )

    expect(screen.getByText(/Afinación:/i)).toBeDefined()
    // Use getAllByText because feedback message also contains 80%
    const all80percents = screen.getAllByText(/80%/i)
    expect(all80percents.length).toBeGreaterThan(0)
    expect(screen.getByText(/Ritmo:/i)).toBeDefined()
    expect(screen.getByText(/90%/i)).toBeDefined()
  })

  it('shows repeat button with secondary variant', () => {
    render(
      <RepertoireFeedbackPanel
        isSessionActive={true}
        activeSlice={[mockScoreEvent]}
        currentStreak={3}
        streakTarget={10}
        lastResult={null}
        isWaitingManualAdvance={false}
        onRepeatSlice={vi.fn()}
      />
    )

    expect(screen.getByText(/Escuchar \(R\)/i)).toBeDefined()
  })

  it('shows manual advance button with primary variant', () => {
    const onAdvanceNext = vi.fn()

    render(
      <RepertoireFeedbackPanel
        isSessionActive={true}
        activeSlice={[mockScoreEvent]}
        currentStreak={3}
        streakTarget={10}
        lastResult={mockRepertoireResult}
        isWaitingManualAdvance={true}
        onAdvanceNext={onAdvanceNext}
      />
    )

    expect(screen.getByText(/Siguiente Paso ➔ \(Espacio\)/i)).toBeDefined()
  })

  it('renders unified OLED container', () => {
    const { container } = render(
      <RepertoireFeedbackPanel
        isSessionActive={true}
        activeSlice={[mockScoreEvent]}
        currentStreak={3}
        streakTarget={10}
        lastResult={null}
        isWaitingManualAdvance={false}
        onRepeatSlice={vi.fn()}
      />
    )

    const root = container.firstChild as HTMLElement
    expect(root?.className).toMatch(/bg-slate-950\/90/)
    expect(root?.className).toMatch(/rounded-xl/)
    expect(root?.className).toMatch(/shadow-inner/)
  })
})
