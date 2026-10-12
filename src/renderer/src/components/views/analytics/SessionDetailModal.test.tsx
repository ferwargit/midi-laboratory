import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionDetailModal } from './SessionDetailModal'
import { clampChartTooltipLeftEdge, CHART_TOOLTIP_WIDTH } from './chartTooltipPlacement'
import { DbSessionRecord, DbAnswerRecord } from '../../../domain/database/types'
import {
  calculateSessionCPI,
  resolveNominalPoolSize,
  resolveSessionInputMethod
} from '../../../domain/analytics/historyAnalytics'

const session: DbSessionRecord = {
  id: 'session-1',
  createdAt: '2026-09-20T12:00:00.000Z',
  strategyId: 'note-mastery',
  instrumentId: 'piano',
  presetName: 'Sesión de Prueba',
  totalQuestions: 5,
  correctAnswers: 3,
  accuracyPercentage: 60,
  avgResponseTimeMs: 1200,
  durationSeconds: 60,
  targetMode: 'single_note'
}

function buildAnswers(count: number): DbAnswerRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `answer-${i}`,
    sessionId: session.id,
    questionIndex: i + 1,
    expectedNote: 60 + i,
    playedNote: 60 + i,
    isCorrect: true,
    semitoneDistance: 0,
    responseTimeMs: 900 + i * 100,
    velocity: 80,
    reasonTelemetry: 'manual',
    createdAt: '2026-09-20T12:00:00.000Z',
    inputSource: 'virtual_ui',
    preAnswerListens: 1,
    postErrorListens: 0,
    postErrorDwellTimeMs: 0
  }))
}

const noop = vi.fn()

describe('SessionDetailModal - Semántica de diálogo (F5-07)', () => {
  it('no renderiza nada cuando está cerrado', () => {
    render(
      <SessionDetailModal
        session={session}
        answers={buildAnswers(5)}
        isOpen={false}
        onClose={noop}
        onReTest={noop}
      />
    )

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('expone role="dialog" y aria-modal="true" en la rama sin respuestas (vacía)', () => {
    render(
      <SessionDetailModal
        session={session}
        answers={[]}
        isOpen={true}
        onClose={noop}
        onReTest={noop}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Sesión de Prueba')
  })

  it('expone role="dialog" y aria-modal="true" en la rama poblada (con respuestas)', () => {
    render(
      <SessionDetailModal
        session={session}
        answers={buildAnswers(5)}
        isOpen={true}
        onClose={noop}
        onReTest={noop}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Sesión de Prueba')
  })
})

describe('SessionDetailModal - Cierre con Escape (F5-07)', () => {
  it('invoca onClose al pulsar Escape estando abierto', () => {
    const onClose = vi.fn()
    render(
      <SessionDetailModal
        session={session}
        answers={buildAnswers(5)}
        isOpen={true}
        onClose={onClose}
        onReTest={noop}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('no registra el listener de Escape estando cerrado', () => {
    const onClose = vi.fn()
    render(
      <SessionDetailModal
        session={session}
        answers={[]}
        isOpen={false}
        onClose={onClose}
        onReTest={noop}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('clampChartTooltipLeftEdge - Contención horizontal (F5-09)', () => {
  it('nunca produce un borde izquierdo negativo para las preguntas iniciales', () => {
    // hoveredPoint.x ≈ 50 (unidades del viewBox 900) → centerX escalado ≈ 45px
    const left = clampChartTooltipLeftEdge(45, 900, CHART_TOOLTIP_WIDTH)

    expect(left).toBeGreaterThanOrEqual(8)
    expect(left).toBeGreaterThanOrEqual(0)
  })

  it('centra el tooltip cuando hay espacio de sobra a ambos lados', () => {
    const centerX = 500
    const left = clampChartTooltipLeftEdge(centerX, 900, CHART_TOOLTIP_WIDTH)

    // naturalLeft = 500 - 130 = 370, dentro de [8, 900-260-8]
    expect(left).toBe(370)
  })

  it('clampa dentro del contenedor cuando el punto está junto al borde derecho', () => {
    const left = clampChartTooltipLeftEdge(880, 900, CHART_TOOLTIP_WIDTH)

    expect(left).toBeLessThanOrEqual(900 - CHART_TOOLTIP_WIDTH - 8)
    expect(left).toBeGreaterThanOrEqual(8)
  })

  it('degrada al margen (no a un valor negativo) cuando el contenedor es más estrecho que el tooltip', () => {
    const left = clampChartTooltipLeftEdge(50, 100, CHART_TOOLTIP_WIDTH)

    expect(left).toBe(8)
    expect(left).toBeGreaterThanOrEqual(0)
  })
})

describe('SessionDetailModal - Coherencia Score CPI con la tabla (F5-09)', () => {
  // Sesión de ejemplo: 'Nivel 2 (C a G)', 60 preguntas en 180s, 97% precisión, Roland FP-8
  const session: DbSessionRecord = {
    id: 'session-cpi-test',
    createdAt: '2026-09-20T12:00:00.000Z',
    strategyId: 'note-mastery',
    instrumentId: 'piano',
    presetName: 'Nivel 2 (C a G)',
    totalQuestions: 60,
    correctAnswers: 58,
    accuracyPercentage: 97,
    avgResponseTimeMs: 1000,
    durationSeconds: 180,
    targetMode: 'single_note'
  }

  function buildHardwareAnswers(count: number): DbAnswerRecord[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `answer-${i}`,
      sessionId: session.id,
      questionIndex: i + 1,
      expectedNote: 60 + (i % 5),
      playedNote: 60 + (i % 5),
      isCorrect: i < 58,
      semitoneDistance: 0,
      responseTimeMs: 900 + (i % 10) * 100,
      velocity: 80,
      reasonTelemetry: 'manual',
      createdAt: '2026-09-20T12:00:00.000Z',
      inputSource: 'midi_hardware',
      preAnswerListens: 1,
      postErrorListens: 0,
      postErrorDwellTimeMs: 0
    }))
  }

  it('el badge de cabecera Score CPI muestra el valor canónico de calculateSessionCPI (sin discrepancia con la tabla)', () => {
    const answers = buildHardwareAnswers(60)

    // Calcular el CPI canónico con los mismos parámetros que la tabla
    const uniqueExpected = new Set(answers.map((a) => a.expectedNote))
    const poolSize = resolveNominalPoolSize(session, uniqueExpected.size)
    const chanceBaseline = 1 / poolSize
    const rawAccuracy = session.accuracyPercentage / 100
    const normalizedAccuracy =
      rawAccuracy <= chanceBaseline
        ? 0
        : Math.round(((rawAccuracy - chanceBaseline) / (1 - chanceBaseline)) * 100)
    const entropyBits = Number(Math.log2(poolSize).toFixed(2))
    const responsesPerMinute = Number(
      ((session.totalQuestions / Math.max(1, session.durationSeconds)) * 60).toFixed(1)
    )
    const inputMethod = resolveSessionInputMethod(session, answers)
    const expectedCpi = calculateSessionCPI(
      normalizedAccuracy,
      entropyBits,
      responsesPerMinute,
      session.avgResponseTimeMs,
      inputMethod
    )

    render(
      <SessionDetailModal
        session={session}
        answers={answers}
        isOpen={true}
        onClose={noop}
        onReTest={noop}
      />
    )

    // Buscar el badge de Score CPI en la cabecera
    const cpiBadge = screen.getByText(/Score CPI:/)
    expect(cpiBadge).not.toBeNull()

    // El valor mostrado debe ser exactamente el canónico (no la fórmula local divergente)
    const cpiText = cpiBadge.textContent || ''
    const displayedValue = parseInt(cpiText.replace(/[^0-9]/g, ''), 10)

    expect(displayedValue).toBe(expectedCpi)
    // Verificar que NO es el valor divergente de la fórmula local (correctAnswers * 12 + totalQuestions * 2)
    const divergentValue = session.correctAnswers * 12 + session.totalQuestions * 2
    expect(displayedValue).not.toBe(divergentValue)
  })
})
