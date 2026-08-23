import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionsTableTab } from './SessionsTableTab'
import { DetailedSessionAnalysis } from '../../../domain/analytics/historyAnalytics'

describe('SessionsTableTab - Interacciones CRUD, Selección Múltiple y Comparador IA', () => {
  const mockAnalysisList: DetailedSessionAnalysis[] = [
    {
      session: {
        id: 's_ui_1',
        createdAt: new Date('2026-08-21T10:00:00Z').toISOString(),
        strategyId: 'adaptive_v1',
        instrumentId: 'acoustic_grand_piano',
        presetName: 'Nivel 1 (C, D, E) • Cronometrado 1m',
        totalQuestions: 10,
        correctAnswers: 8,
        accuracyPercentage: 80,
        avgResponseTimeMs: 1200,
        durationSeconds: 60
      },
      poolSize: 3,
      entropyBits: 1.58,
      chanceBaseline: 33,
      normalizedAccuracy: 70,
      responsesPerMinute: 10,
      fastPercent: 60,
      mediumPercent: 30,
      slowPercent: 10,
      sharpBiasCount: 1,
      flatBiasCount: 0,
      dominantBias: 'sharp',
      formatType: 'time',
      inputMethod: 'hardware'
    },
    {
      session: {
        id: 's_ui_2',
        createdAt: new Date('2026-08-22T10:00:00Z').toISOString(),
        strategyId: 'adaptive_v1',
        instrumentId: 'acoustic_grand_piano',
        presetName: 'Nivel 1 (C, D, E) • Cronometrado 1m',
        totalQuestions: 15,
        correctAnswers: 14,
        accuracyPercentage: 93,
        avgResponseTimeMs: 1100,
        durationSeconds: 60
      },
      poolSize: 3,
      entropyBits: 1.58,
      chanceBaseline: 33,
      normalizedAccuracy: 90,
      responsesPerMinute: 15,
      fastPercent: 80,
      mediumPercent: 20,
      slowPercent: 0,
      sharpBiasCount: 0,
      flatBiasCount: 0,
      dominantBias: 'balanced',
      formatType: 'time',
      inputMethod: 'hardware'
    }
  ]

  it('debe renderizar las columnas de la tabla y la sesión con sus badges', () => {
    render(
      <SessionsTableTab
        displayedList={mockAnalysisList}
        answers={[]}
        sortKey="date"
        sortDirection="desc"
        onSortClick={vi.fn()}
        onLoadPrescription={vi.fn()}
        onDeleteSession={vi.fn()}
        onDeleteSessions={vi.fn()}
        onCompareSessionsWithAi={vi.fn()}
      />
    )

    expect(screen.getAllByText('Nivel 1 (C, D, E)').length).toBe(2)
    expect(screen.getAllByText('🎹 Roland FP-8').length).toBe(2)
    expect(screen.getAllByText('Re-testar').length).toBe(2)
  })

  it('al marcar 2 casillas debe aparecer el botón de Comparar con IA Local', () => {
    const onCompareSessionsWithAi = vi.fn()

    render(
      <SessionsTableTab
        displayedList={mockAnalysisList}
        answers={[]}
        sortKey="date"
        sortDirection="desc"
        onSortClick={vi.fn()}
        onLoadPrescription={vi.fn()}
        onDeleteSession={vi.fn()}
        onDeleteSessions={vi.fn()}
        onCompareSessionsWithAi={onCompareSessionsWithAi}
      />
    )

    // Marcamos ambas casillas
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1]) // Fila 1
    fireEvent.click(checkboxes[2]) // Fila 2

    // Aparece el botón de comparar con IA
    const compareBtn = screen.getByText(/Comparar con IA Local \(2\)/i)
    expect(compareBtn).toBeDefined()

    fireEvent.click(compareBtn)
    expect(onCompareSessionsWithAi).toHaveBeenCalledWith(['s_ui_1', 's_ui_2'])
  })
})
