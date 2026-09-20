import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PedagogicalTooltip } from './PedagogicalTooltip'
import { computeTooltipPlacement } from './tooltipPlacement'

describe('PedagogicalTooltip - Trigger accesible por teclado (F5-05)', () => {
  it('expone role="button", tabIndex 0 y aria-expanded="false" estando cerrado', () => {
    render(<PedagogicalTooltip conceptId="irt_normalized_accuracy">Oído Real</PedagogicalTooltip>)

    const trigger = screen.getByRole('button')
    expect(trigger.getAttribute('tabindex')).toBe('0')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    // Cerrado: no vincula ningún tooltip
    expect(trigger.getAttribute('aria-controls')).toBeNull()
  })

  it('se abre con la tecla Enter (contenido del portal en document.body) y conmuta aria-expanded', () => {
    render(<PedagogicalTooltip conceptId="irt_normalized_accuracy">Oído Real</PedagogicalTooltip>)
    const trigger = screen.getByRole('button')

    fireEvent.keyDown(trigger, { key: 'Enter' })

    // El portal se rendera en document.body: el título del concepto es visible
    expect(screen.getByText('Oído Real (IRT Normalizado)')).toBeDefined()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('se abre con la tecla Espacio y suprime el scroll nativo (preventDefault)', () => {
    render(<PedagogicalTooltip conceptId="irt_normalized_accuracy">Oído Real</PedagogicalTooltip>)
    const trigger = screen.getByRole('button')

    // Dispatch manual para inspeccionar defaultPrevented del evento nativo,
    // envuelto en act() para que React flushing la actualización de estado.
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true
    })
    act(() => {
      trigger.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(true)
    expect(screen.getByText('Oído Real (IRT Normalizado)')).toBeDefined()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('cierra el tooltip abierto con la tecla Escape (F5-06)', () => {
    render(<PedagogicalTooltip conceptId="irt_normalized_accuracy">Oído Real</PedagogicalTooltip>)
    const trigger = screen.getByRole('button')

    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.getByText('Oído Real (IRT Normalizado)')).toBeDefined()

    // El listener de Escape vive en window mientras el tooltip está abierto
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByText('Oído Real (IRT Normalizado)')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('computeTooltipPlacement - Clamping vertical bidireccional (F5-06)', () => {
  it('coloca debajo con top = rect.bottom + 8 cuando sobra espacio abajo (viewport normal)', () => {
    // spaceBelow (800-220=580) >= spaceAbove (200) → placeBelow
    const placement = computeTooltipPlacement(
      { top: 200, bottom: 220, left: 100, width: 80 },
      { innerWidth: 1280, innerHeight: 800 },
      260
    )

    expect(placement.placeBelow).toBe(true)
    expect(placement.top).toBe(228) // 220 + 8
    expect(placement.top + 260).toBeLessThanOrEqual(800 - 16)
  })

  it('clampa el borde inferior en viewports bajos: nunca desborda innerHeight - 16', () => {
    // Trigger cerca del borde superior de una ventana muy baja
    const placement = computeTooltipPlacement(
      { top: 180, bottom: 200, left: 100, width: 80 },
      { innerWidth: 1280, innerHeight: 400 },
      260
    )

    expect(placement.top + 260).toBeLessThanOrEqual(400 - 16)
    expect(placement.top).toBeGreaterThanOrEqual(16)
  })

  it('coloca encima sin un top negativo cuando el trigger está al final de un viewport normal', () => {
    const placement = computeTooltipPlacement(
      { top: 700, bottom: 720, left: 100, width: 80 },
      { innerWidth: 1280, innerHeight: 800 },
      260
    )

    expect(placement.placeBelow).toBe(false)
    // top es el borde superior del tooltip: rect.top - 8 - height, clampeado a >= 16
    expect(placement.top).toBeGreaterThanOrEqual(16)
    expect(placement.top + 260).toBeLessThanOrEqual(800 - 16)
  })

  it('clampa el borde superior en viewports donde el tooltip no cabe ni arriba', () => {
    // Ventana extremadamente baja: el tooltip no cabe completo; el borde superior
    // nunca es negativo y queda anclado al margen seguro.
    const placement = computeTooltipPlacement(
      { top: 60, bottom: 80, left: 100, width: 80 },
      { innerWidth: 1280, innerHeight: 200 },
      260
    )

    expect(placement.top).toBe(16)
  })

  it('centra horizontalmente dentro de los límites seguros de la ventana', () => {
    const centered = computeTooltipPlacement(
      { top: 400, bottom: 420, left: 600, width: 80 },
      { innerWidth: 1280, innerHeight: 800 },
      260
    )
    // rect.left + rect.width/2 - 320/2 = 600 + 40 - 160 = 480
    expect(centered.left).toBe(480)

    // Trigger pegado a la izquierda: clamp a >= 16
    const leftEdge = computeTooltipPlacement(
      { top: 400, bottom: 420, left: 0, width: 10 },
      { innerWidth: 1280, innerHeight: 800 },
      260
    )
    expect(leftEdge.left).toBe(16)

    // Trigger pegado a la derecha: clamp a <= innerWidth - 320 - 16
    const rightEdge = computeTooltipPlacement(
      { top: 400, bottom: 420, left: 1270, width: 10 },
      { innerWidth: 1280, innerHeight: 800 },
      260
    )
    expect(rightEdge.left).toBe(1280 - 320 - 16)
  })
})
