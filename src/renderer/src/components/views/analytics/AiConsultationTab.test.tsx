import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

// Espía del MarkdownRenderer: cuenta cuántas veces se renderiza el markdown.
// Si el ticker de reasoningSeconds re-renderiza los items del historial,
// este contador crece en cada tick. Es la señal directa del defecto F5-03.
let markdownRenderCount = 0
const markdownRenderCalls: string[] = []

vi.mock('../../ui/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }): React.ReactElement => {
    markdownRenderCount++
    markdownRenderCalls.push(content)
    return <div data-testid="mocked-markdown">{content}</div>
  }
}))

import { AiConsultationTab } from './AiConsultationTab'
import { LmStudioService } from '../../../domain/ai/lmStudioService'
import { useAnalyticsStore } from '../../../stores/useAnalyticsStore'
import { DbAiConsultationRecord } from '../../../domain/database/types'
import { AnalyticsMetrics } from '../../../domain/analytics/historyAnalytics'

function makeConsultation(id: string, query: string): DbAiConsultationRecord {
  return {
    id,
    createdAt: new Date('2026-09-15T10:00:00Z').toISOString(),
    modelName: 'Qwen 3.5',
    modeFilter: 'all',
    userQuery: query,
    aiResponse: `## Respuesta ${id}\n\nTu **precisión** en F4 es del 80%.`,
    associatedMetricsSnapshot: {
      overallAccuracy: 80,
      normalizedAccuracy: 75,
      avgLatencyMs: 1200,
      poolEntropyBits: 3.5
    }
  }
}

describe('AiConsultationTab - Aislamiento del Ticker de IA (F5-03)', () => {
  const consultations: DbAiConsultationRecord[] = [
    makeConsultation('c1', '¿Por qué falla F4?'),
    makeConsultation('c2', '¿Cómo interpreto la entropía?')
  ]

  let metrics = useAnalyticsStore.getState().metrics
  let pendingConsultation: (userQuery: string, metrics: AnalyticsMetrics) => Promise<never>

  beforeEach(() => {
    vi.useFakeTimers()

    const store = useAnalyticsStore.getState()
    store.recomputeMetrics([], [])
    metrics = useAnalyticsStore.getState().metrics

    // La consulta queda pendiente para siempre: isAnswering === true y el
    // setInterval del ticker sigue vivo durante toda la prueba.
    pendingConsultation = vi.fn().mockImplementation(() => new Promise(() => {}))
    vi.spyOn(LmStudioService.prototype, 'askCustomConsultation').mockImplementation(
      pendingConsultation
    )

    markdownRenderCount = 0
    markdownRenderCalls.length = 0
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    cleanup()
  })

  it('renderiza el historial persistente en la carga inicial', () => {
    render(
      <AiConsultationTab
        modeFilter="all"
        metrics={metrics}
        consultations={consultations}
        onSaveConsultation={vi.fn()}
      />
    )

    expect(screen.getByText(/Por qué falla F4/)).toBeDefined()
    expect(screen.getByText(/Cómo interpreto la entropía/)).toBeDefined()
    expect(markdownRenderCount).toBe(2)
  })

  it('NO re-renderiza el markdown del historial cuando el ticker de reasoningSeconds avanza', () => {
    render(
      <AiConsultationTab
        modeFilter="all"
        metrics={metrics}
        consultations={consultations}
        onSaveConsultation={vi.fn()}
      />
    )

    // Disparamos una consulta: el HUD de razonamiento se activa y arranca el
    // setInterval de 1s. (El botón principal está deshabilitado sin texto;
    // usamos el botón de pregunta rápida sugerida.)
    fireEvent.click(screen.getByText(/aumenta mi latencia/))

    expect(screen.getByText(/Razonando/)).toBeDefined()
    expect(markdownRenderCount).toBe(2)

    // Avanzamos 3 ticks del ticker (3 segundos de razonamiento).
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // El HUD avanza (el ticker sí se actualiza)...
    expect(screen.getByText(/Razonando \(3s\)/)).toBeDefined()

    // ...pero el markdown del historial NO se vuelve a renderizar ni parsear.
    expect(markdownRenderCount).toBe(2)
    expect(markdownRenderCalls.filter((c) => c.includes('Respuesta c1')).length).toBe(1)
    expect(markdownRenderCalls.filter((c) => c.includes('Respuesta c2')).length).toBe(1)
  })

  it('mantiene el aislamiento aunque el historial crezca', () => {
    const bigHistory: DbAiConsultationRecord[] = [
      makeConsultation('h1', 'Pregunta 1'),
      makeConsultation('h2', 'Pregunta 2'),
      makeConsultation('h3', 'Pregunta 3'),
      makeConsultation('h4', 'Pregunta 4'),
      makeConsultation('h5', 'Pregunta 5')
    ]

    render(
      <AiConsultationTab
        modeFilter="all"
        metrics={metrics}
        consultations={bigHistory}
        onSaveConsultation={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText(/aumenta mi latencia/))

    expect(markdownRenderCount).toBe(5)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.getByText(/Razonando \(5s\)/)).toBeDefined()
    expect(markdownRenderCount).toBe(5)
  })
})
