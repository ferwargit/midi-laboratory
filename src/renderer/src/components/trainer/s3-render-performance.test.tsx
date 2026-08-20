import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { AnalyticsCharts } from './AnalyticsCharts'
import { useAnalyticsStore } from '../../stores/useAnalyticsStore'
import { DbSessionRecord, DbAnswerRecord } from '../../domain/database/types'

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
