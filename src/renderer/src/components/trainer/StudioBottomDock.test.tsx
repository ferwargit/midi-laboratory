import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { StudioBottomDock } from './StudioBottomDock'
import { useTelemetryStore } from '../../stores/useTelemetryStore'
import { useDatabaseStore } from '../../stores/useDatabaseStore'

// Detector de renders del impl del dock: el impl invoca el hook
// useDatabaseStore 3 veces por render (summary, export, import). Envolver el
// hook con un contador detecta TODOS sus renders, incluidos los internos
// (cambio de estado isOpen) y los provocados por hipotéticas suscripciones
// propias al store de telemetría — que un wrapper externo no vería.
vi.mock('../../stores/useDatabaseStore', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../stores/useDatabaseStore')>()
  let dockHookCalls = 0
  const wrapped = ((selector: Parameters<typeof mod.useDatabaseStore>[0]) => {
    dockHookCalls++
    return mod.useDatabaseStore(selector)
  }) as typeof mod.useDatabaseStore & { __getDockHookCalls: () => number }
  Object.assign(wrapped, mod.useDatabaseStore)
  wrapped.__getDockHookCalls = (): number => dockHookCalls
  return { ...mod, useDatabaseStore: wrapped }
})

const dockRenders = (): number =>
  (useDatabaseStore as unknown as { __getDockHookCalls: () => number }).__getDockHookCalls()

describe('StudioBottomDock - Aislamiento de Render ante el Stream de Telemetría (F12.2)', () => {
  beforeEach(() => {
    // Reset del buffer de telemetría global entre tests
    useTelemetryStore.setState({ logs: [] })
    // jsdom no implementa scrollIntoView (usado por MidiMonitor)
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('el cuerpo del dock NO se re-renderiza ante eventos de log ni re-renders del padre con props estables (drawer cerrado)', () => {
    const stableFn = vi.fn()
    const { rerender } = render(<StudioBottomDock onOpenResetModal={stableFn} />)
    const baseline = dockRenders()
    expect(baseline).toBeGreaterThan(0)

    // Eventos de log en el store: el dock no depende del buffer
    act(() => {
      useTelemetryStore.getState().addLog({ type: 'IN', message: 'Evento A' })
    })
    act(() => {
      useTelemetryStore.getState().addLog({ type: 'OUT', message: 'Evento B' })
    })
    expect(dockRenders()).toBe(baseline)

    // Re-render del padre con props de identidad estable: memo cortocircuita
    rerender(<StudioBottomDock onOpenResetModal={stableFn} />)
    expect(dockRenders()).toBe(baseline)

    // Control del detector: prop inestable → memo falla → el impl re-renderiza
    rerender(<StudioBottomDock onOpenResetModal={(): void => undefined} />)
    expect(dockRenders()).toBe(baseline + 3)
  })

  it('el badge de conteo se actualiza por suscripción propia sin prop logs', () => {
    render(<StudioBottomDock onOpenResetModal={vi.fn()} />)

    expect(screen.getByText(/Telemetría \(0\)/)).toBeTruthy()

    act(() => {
      useTelemetryStore.getState().addLog({ type: 'IN', message: 'Evento A' })
    })
    expect(screen.getByText(/Telemetría \(1\)/)).toBeTruthy()
  })

  it('MidiMonitor se actualiza por suscripción propia sin prop logs y sin re-renderizar el cuerpo del dock (drawer abierto)', () => {
    render(<StudioBottomDock onOpenResetModal={vi.fn()} />)
    const baseline = dockRenders()

    // Abrir el drawer: re-render legítimo del impl por cambio de estado interno
    fireEvent.click(screen.getByText(/Telemetría \(0\)/))
    expect(dockRenders()).toBe(baseline + 3)
    expect(screen.getByText(/Esperando eventos en el bus MIDI/)).toBeTruthy()

    // Evento de log: el monitor se actualiza por su propia suscripción,
    // el cuerpo del dock NO se re-renderiza
    act(() => {
      useTelemetryStore
        .getState()
        .addLog({ type: 'OUT', message: '🎼 Evento visible en el monitor' })
    })
    expect(dockRenders()).toBe(baseline + 3)
    expect(screen.getByText('🎼 Evento visible en el monitor')).toBeTruthy()
  })
})
