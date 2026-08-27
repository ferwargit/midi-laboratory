import { act } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionsTableTab } from './SessionsTableTab'
import { DetailedSessionAnalysis } from '../../../domain/analytics/historyAnalytics'
import { DbAnswerRecord } from '../../../domain/database/types'

describe('SessionsTableTab - Interacciones CRUD, Detalle, Aislamiento y Zoom', () => {
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
      formatLabel: '⏱️ 1m 0s',
      inputMethod: 'hardware',
      interSessionGapMs: null,
      interSessionGapLabel: 'Inicio',
      cpiScore: 560
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
      formatLabel: '⏱️ 1m 0s',
      inputMethod: 'hardware',
      interSessionGapMs: 86400000,
      interSessionGapLabel: '1 d',
      cpiScore: 890
    }
  ]

  const mockAnswers: DbAnswerRecord[] = [
    {
      id: 'a_ui_1',
      sessionId: 's_ui_1',
      questionIndex: 1,
      expectedNote: 60,
      playedNote: 60,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 950,
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString(),
      inputSource: 'midi_hardware'
    },
    {
      id: 'a_ui_2',
      sessionId: 's_ui_1',
      questionIndex: 2,
      expectedNote: 62,
      playedNote: 62,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 1100,
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString(),
      inputSource: 'midi_hardware'
    }
  ]

  it('debe renderizar las columnas de la tabla y la sesión con sus badges y CPI Score', () => {
    render(
      <SessionsTableTab
        displayedList={mockAnalysisList}
        answers={mockAnswers}
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
    expect(screen.getByText(/🌟 890/i)).toBeDefined()
    expect(screen.getAllByText('Detalle').length).toBe(2)
    expect(screen.getAllByText('Re-testar').length).toBe(2)
  })

  it('al pulsar el botón Detalle debe abrir el Modal Inspector Clínico', async () => {
    render(
      <SessionsTableTab
        displayedList={mockAnalysisList}
        answers={mockAnswers}
        sortKey="date"
        sortDirection="desc"
        onSortClick={vi.fn()}
        onLoadPrescription={vi.fn()}
        onDeleteSession={vi.fn()}
        onDeleteSessions={vi.fn()}
        onCompareSessionsWithAi={vi.fn()}
      />
    )

    const detailButtons = screen.getAllByText('Detalle')
    await act(async () => {
      fireEvent.click(detailButtons[0])
    })

    expect(screen.getByText('Cerrar Inspector')).toBeDefined()
    expect(screen.getByText(/Foco Inicial \(Warm-Up\)/i)).toBeDefined()
  })

  it('al marcar 2 casillas debe aparecer el botón de Aislar en Analítica y llamar a onIsolateSessions', async () => {
    const onIsolateSessions = vi.fn()

    render(
      <SessionsTableTab
        displayedList={mockAnalysisList}
        answers={mockAnswers}
        sortKey="date"
        sortDirection="desc"
        onSortClick={vi.fn()}
        onLoadPrescription={vi.fn()}
        onDeleteSession={vi.fn()}
        onDeleteSessions={vi.fn()}
        onCompareSessionsWithAi={vi.fn()}
        onIsolateSessions={onIsolateSessions}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox')
    await act(async () => {
      fireEvent.click(checkboxes[1])
      fireEvent.click(checkboxes[2])
    })

    const isolateBtn = screen.getByText(/Aislar en Analítica \(2\)/i)
    expect(isolateBtn).toBeDefined()

    await act(async () => {
      fireEvent.click(isolateBtn)
    })
    expect(onIsolateSessions).toHaveBeenCalledWith(['s_ui_1', 's_ui_2'])
  })

  it('al pulsar el selector de Zoom debe cambiar la escala de fuente', async () => {
    render(
      <SessionsTableTab
        displayedList={mockAnalysisList}
        answers={mockAnswers}
        sortKey="date"
        sortDirection="desc"
        onSortClick={vi.fn()}
        onLoadPrescription={vi.fn()}
        onDeleteSession={vi.fn()}
        onDeleteSessions={vi.fn()}
        onCompareSessionsWithAi={vi.fn()}
      />
    )

    const zoomLargeBtn = screen.getByText('A+')
    await act(async () => {
      fireEvent.click(zoomLargeBtn)
    })

    const table = screen.getByRole('table')
    expect(table.className).toContain('text-sm')
  })

  it('al pulsar el botón de eliminar individual debe abrir el modal y llamar a onDeleteSession', async () => {
    const onDeleteSession = vi.fn().mockResolvedValue(undefined)

    render(
      <SessionsTableTab
        displayedList={mockAnalysisList}
        answers={mockAnswers}
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
})
