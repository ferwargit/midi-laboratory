import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackPanel } from './FeedbackPanel'
import { ExerciseResult } from '../../domain/exercise/types'

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
})
