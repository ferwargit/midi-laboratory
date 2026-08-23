import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalyticsFilterBar } from './AnalyticsFilterBar'

describe('AnalyticsFilterBar - Barra de Filtros Multidimensionales y Sub-Grupos', () => {
  const defaultProps = {
    modeFilter: 'all' as const,
    onSelectModeFilter: vi.fn(),
    isLmStudioOnline: true,
    onCheckLmStudio: vi.fn(),
    searchQuery: '',
    onSearchChange: vi.fn(),
    selectedInstrument: 'all',
    onInstrumentChange: vi.fn(),
    selectedStrategy: 'all',
    onStrategyChange: vi.fn(),
    selectedPreset: 'all',
    onPresetChange: vi.fn(),
    selectedFormat: 'all',
    onFormatChange: vi.fn(),
    selectedMastery: 'all' as const,
    onMasteryChange: vi.fn(),
    selectedInputSource: 'all' as const,
    onInputSourceChange: vi.fn(),
    selectedBias: 'all' as const,
    onBiasChange: vi.fn(),
    selectedPoolSize: 'all',
    onPoolSizeChange: vi.fn(),
    selectedIsi: 'all' as const,
    onIsiChange: vi.fn(),
    onResetAllFilters: vi.fn()
  }

  it('debe renderizar todos los selectores incluyendo los sub-grupos de tiempo y carga', () => {
    render(<AnalyticsFilterBar {...defaultProps} />)

    expect(screen.getByText('Guía Psicoacústica')).toBeDefined()
    expect(screen.getByPlaceholderText(/Buscar por nombre/i)).toBeDefined()
    expect(screen.getByText('⏱️ Todos los Formatos')).toBeDefined()
    expect(screen.getByText('🧠 Toda Carga (Pool)')).toBeDefined()
    expect(screen.getByText('⏱️ Cronometrado 3 min')).toBeDefined()
  })

  it('al escribir en el buscador debe invocar onSearchChange', () => {
    const onSearchChange = vi.fn()
    render(<AnalyticsFilterBar {...defaultProps} onSearchChange={onSearchChange} />)

    const input = screen.getByPlaceholderText(/Buscar por nombre/i)
    fireEvent.change(input, { target: { value: 'Nivel 1' } })

    expect(onSearchChange).toHaveBeenCalledWith('Nivel 1')
  })

  it('el botón Limpiar Filtros debe habilitarse cuando hay un filtro activo', () => {
    const { rerender } = render(<AnalyticsFilterBar {...defaultProps} />)

    const resetBtn = screen.getByTitle(/Restablecer todos los filtros/i)
    expect(resetBtn.hasAttribute('disabled')).toBe(true)

    const onResetAllFilters = vi.fn()
    rerender(
      <AnalyticsFilterBar
        {...defaultProps}
        selectedFormat="time_3"
        onResetAllFilters={onResetAllFilters}
      />
    )

    expect(resetBtn.hasAttribute('disabled')).toBe(false)
    fireEvent.click(resetBtn)
    expect(onResetAllFilters).toHaveBeenCalledTimes(1)
  })
})
