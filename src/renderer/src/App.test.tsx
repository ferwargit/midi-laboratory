import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import App from './App'
import { useTelemetryStore } from './stores/useTelemetryStore'

// Captura de la identidad de la prop onOpenResetModal entregada al dock en
// cada render de App. El stub NO está memoizado a propósito: se invoca en
// cada render del componente raíz, exactamente lo que un React.memo real
// recibiría como props. vi.hoisted evita el TDZ: el factory de vi.mock se
// eleva por encima de los imports del módulo.
const { onOpenResetModalCaptures } = vi.hoisted(() => ({
  onOpenResetModalCaptures: [] as Array<() => void>
}))

vi.mock('./components/trainer/StudioBottomDock', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./components/trainer/StudioBottomDock')>()
  return {
    ...mod,
    StudioBottomDock: (props: { onOpenResetModal: () => void }): null => {
      onOpenResetModalCaptures.push(props.onOpenResetModal)
      return null
    }
  }
})

describe('App - Estabilidad de la prop onOpenResetModal del dock (F12.2)', () => {
  beforeEach(() => {
    onOpenResetModalCaptures.length = 0
    useTelemetryStore.setState({ logs: [] })
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('la prop onOpenResetModal conserva la misma referencia entre re-renders de App', () => {
    const { rerender } = render(<App />)

    // Re-renders forzados del componente raíz por motivos ajenos al dock
    rerender(<App />)
    rerender(<App />)

    expect(onOpenResetModalCaptures.length).toBeGreaterThanOrEqual(2)
    expect(onOpenResetModalCaptures.every((fn) => fn === onOpenResetModalCaptures[0])).toBe(true)
  })
})
