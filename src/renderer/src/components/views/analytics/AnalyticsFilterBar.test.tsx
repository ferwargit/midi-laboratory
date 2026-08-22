import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalyticsFilterBar } from './AnalyticsFilterBar'

describe('AnalyticsFilterBar - Barra de Filtros Multidimensionales y Presets Dinámicos', () => {
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
    selectedFormat: 'all' as const,
    onFormatChange: vi.fn(),
    selectedMastery: 'all' as const,
    onMasteryChange: vi.fn(),
    selectedInputSource: 'all' as const,
    onInputSourceChange: vi.fn(),
    selectedBias: 'all' as const,
    onBiasChange: vi.fn(),
    onResetAllFilters: vi.fn()
  }

  it('debe renderizar todos los selectores de filtros y el botón de guía', () => {
    render(<AnalyticsFilterBar {...defaultProps} />)

    expect(screen.getByText('Guía Psicoacústica')).toBeDefined()
    expect(screen.getByPlaceholderText(/Buscar por nombre/i)).toBeDefined()
    expect(screen.getByText('🎵 Todos los Presets')).toBeDefined()
    expect(screen.getByText('🧠 Todos los Motores')).toBeDefined()
    expect(screen.getByText('🔌 Todas las Entradas')).toBeDefined()
    expect(screen.getByText('🎯 Todo Sesgo Tonal')).toBeDefined()
  })

  it('al escribir en el buscador debe invocar onSearchChange', () => {
    const onSearchChange = vi.fn()
    render(<AnalyticsFilterBar {...defaultProps} onSearchChange={onSearchChange} />)

    const input = screen.getByPlaceholderText(/Buscar por nombre/i)
    fireEvent.change(input, { target: { value: 'Nivel 1' } })

    expect(onSearchChange).toHaveBeenCalledWith('Nivel 1')
  })

  it('el botón Limpiar Filtros debe estar deshabilitado si no hay filtros activos y habilitarse al filtrar', () => {
    const { rerender } = render(<AnalyticsFilterBar {...defaultProps} />)

    const resetBtn = screen.getByTitle(/Restablecer todos los filtros/i)
    expect(resetBtn.hasAttribute('disabled')).toBe(true)

    const onResetAllFilters = vi.fn()
    rerender(
      <AnalyticsFilterBar
        {...defaultProps}
        searchQuery="Octava"
        onResetAllFilters={onResetAllFilters}
      />
    )

    expect(resetBtn.hasAttribute('disabled')).toBe(false)
    fireEvent.click(resetBtn)
    expect(onResetAllFilters).toHaveBeenCalledTimes(1)
  })

  it('debe adaptar dinámicamente las opciones del selector de presets según la modalidad activa', () => {
    // 1. Modalidad Single Note -> Muestra "Nivel 3 (Octava Diatónica C4-C5)"
    const { rerender } = render(<AnalyticsFilterBar {...defaultProps} modeFilter="single_note" />)
    expect(screen.getByText('Nivel 3 (Octava Diatónica C4-C5)')).toBeDefined()

    // 2. Modalidad Intervalos -> Muestra "Nivel 1.1: Intervalos Clásicos (2M, 3M, 4J, 5J, 8J)"
    rerender(<AnalyticsFilterBar {...defaultProps} modeFilter="intervals" />)
    expect(screen.getByText('Nivel 1.1: Intervalos Clásicos (2M, 3M, 4J, 5J, 8J)')).toBeDefined()

    // 3. Modalidad Secuencias -> Muestra "Nivel 2.0: 3 Notas por Grados Conjuntos"
    rerender(<AnalyticsFilterBar {...defaultProps} modeFilter="sequences" />)
    expect(screen.getByText('Nivel 2.0: 3 Notas por Grados Conjuntos')).toBeDefined()
  })
})
