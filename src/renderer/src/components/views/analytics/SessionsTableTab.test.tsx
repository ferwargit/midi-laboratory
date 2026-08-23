import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

  it('al marcar 2 casillas debe aparecer el botón de Comparar con IA Local e invocar onCompareSessionsWithAi', async () => {
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

    const checkboxes = screen.getAllByRole('checkbox')
    await act(async () => {
      fireEvent.click(checkboxes[1])
      fireEvent.click(checkboxes[2])
    })

    const compareBtn = screen.getByText(/Comparar con IA Local \(2\)/i)
    expect(compareBtn).toBeDefined()

    await act(async () => {
      fireEvent.click(compareBtn)
    })
    expect(onCompareSessionsWithAi).toHaveBeenCalledWith(['s_ui_1', 's_ui_2'])
  })

  it('al pulsar el botón de eliminar individual debe abrir el modal y llamar a onDeleteSession', async () => {
    const onDeleteSession = vi.fn().mockResolvedValue(undefined)

    render(
      <SessionsTableTab
        displayedList={mockAnalysisList}
        answers={[]}
        sortKey="date"
        sortDirection="desc"
        onSortClick={vi.fn()}
        onLoadPrescription={vi.fn()}
        onDeleteSession={onDeleteSession}
        onDeleteSessions={vi.fn()}
        onCompareSessionsWithAi={vi.fn()}
      />
    )

    const deleteButtons = screen.getAllByTitle('Eliminar esta sesión de la base de datos')
    await act(async () => {
      fireEvent.click(deleteButtons[0])
    })

    expect(screen.getByText('¿Eliminar Sesión de Entrenamiento?')).toBeDefined()

    const confirmBtn = screen.getByText('Sí, Eliminar')
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    expect(onDeleteSession).toHaveBeenCalledWith('s_ui_1')
  })

  it('al marcar sesiones y pulsar eliminar en lote debe llamar a onDeleteSessions con todos los IDs', async () => {
    const onDeleteSessions = vi.fn().mockResolvedValue(undefined)

    render(
      <SessionsTableTab
        displayedList={mockAnalysisList}
        answers={[]}
        sortKey="date"
        sortDirection="desc"
        onSortClick={vi.fn()}
        onLoadPrescription={vi.fn()}
        onDeleteSession={vi.fn()}
        onDeleteSessions={onDeleteSessions}
        onCompareSessionsWithAi={vi.fn()}
      />
    )

    const masterCheckbox = screen.getByTitle('Seleccionar todas las visibles')
    await act(async () => {
      fireEvent.click(masterCheckbox)
    })

    const batchDeleteBtn = screen.getByText(/Eliminar Seleccionadas \(2\)/i)
    await act(async () => {
      fireEvent.click(batchDeleteBtn)
    })

    expect(screen.getByText('¿Eliminar 2 Sesiones Seleccionadas?')).toBeDefined()

    const confirmBtn = screen.getByText('Sí, Eliminar')
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    expect(onDeleteSessions).toHaveBeenCalledWith(['s_ui_1', 's_ui_2'])
  })
})
