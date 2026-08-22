import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionsTableTab } from './SessionsTableTab'
import { DetailedSessionAnalysis } from '../../../domain/analytics/historyAnalytics'

describe('SessionsTableTab - Interacciones CRUD, Selección Múltiple y Re-testeo', () => {
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
      />
    )

    expect(screen.getByText('Nivel 1 (C, D, E)')).toBeDefined()
    expect(screen.getByText('🎹 Roland FP-8')).toBeDefined()
    expect(screen.getByText('3 notas')).toBeDefined()
    expect(screen.getByText('Re-testar')).toBeDefined()
  })

  it('al marcar el checkbox debe aparecer la barra flotante de acciones por lote', () => {
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
      />
    )

    // Al inicio no hay barra flotante
    expect(screen.queryByText(/sesión seleccionada/i)).toBeNull()

    // Marcamos la casilla de la fila
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1]) // Checkbox de la primera fila

    // Aparece la barra flotante con el botón de eliminar seleccionadas
    expect(screen.getByText('1 sesión seleccionada')).toBeDefined()
    expect(screen.getByText('🗑️ Eliminar Seleccionadas (1)')).toBeDefined()
  })

  it('hacer clic en Re-testar debe invocar onLoadPrescription con la configuración clonada', () => {
    const onLoadPrescription = vi.fn()

    render(
      <SessionsTableTab
        displayedList={mockAnalysisList}
        answers={[]}
        sortKey="date"
        sortDirection="desc"
        onSortClick={vi.fn()}
        onLoadPrescription={onLoadPrescription}
        onDeleteSession={vi.fn()}
        onDeleteSessions={vi.fn()}
      />
    )

    const retestBtn = screen.getByTitle(/Clonar y repetir esta sesión idéntica/i)
    fireEvent.click(retestBtn)

    expect(onLoadPrescription).toHaveBeenCalledTimes(1)
    const passedConfig = onLoadPrescription.mock.calls[0][0]
    expect(passedConfig.targetMode).toBe('single_note')
    expect(passedConfig.recommendedNotes).toEqual([60, 62, 64])
  })
})
