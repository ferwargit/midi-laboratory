import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Card } from './Card'

describe('Card - Variantes Glow y Micro-interacciones', () => {
  it('renderiza variante glow none (default)', () => {
    const { container } = render(
      <Card glow="none" data-testid="card">
        Contenido
      </Card>
    )
    const card = container.querySelector('[data-testid="card"]')
    expect(card).toBeDefined()
    expect(card?.className).toContain('border-slate-800/80')
    expect(card?.className).not.toContain('border-cyan-500/30')
    expect(card?.className).not.toContain('border-purple-500/30')
  })

  it('renderiza variante glow cyan', () => {
    const { container } = render(
      <Card glow="cyan" data-testid="card">
        Cyan Glow
      </Card>
    )
    const card = container.querySelector('[data-testid="card"]')
    expect(card).toBeDefined()
    expect(card?.className).toContain('border-cyan-500/30')
    expect(card?.className).toContain('shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)]')
  })

  it('renderiza variante glow purple', () => {
    const { container } = render(
      <Card glow="purple" data-testid="card">
        Purple Glow
      </Card>
    )
    const card = container.querySelector('[data-testid="card"]')
    expect(card).toBeDefined()
    expect(card?.className).toContain('border-purple-500/30')
    expect(card?.className).toContain('shadow-[0_0_20px_-5px_rgba(168,85,247,0.15)]')
  })

  it('aplica className personalizada', () => {
    const { container } = render(
      <Card className="custom-card-class" data-testid="card">
        Custom
      </Card>
    )
    const card = container.querySelector('[data-testid="card"]')
    expect(card).toBeDefined()
    expect(card?.className).toContain('custom-card-class')
  })

  it('tiene transiciones y estilos base', () => {
    const { container } = render(<Card data-testid="card">Base</Card>)
    const card = container.querySelector('[data-testid="card"]')
    expect(card).toBeDefined()
    expect(card?.className).toContain('bg-linear-to-b')
    expect(card?.className).toContain('from-slate-900/95')
    expect(card?.className).toContain('to-slate-950/95')
    expect(card?.className).toContain('border')
    expect(card?.className).toContain('rounded-xl')
    expect(card?.className).toContain('transition-all')
    expect(card?.className).toContain('duration-150')
  })

  it('pasa props adicionales al div', () => {
    const { container } = render(
      <Card data-testid="my-card" id="card-1">
        Props
      </Card>
    )
    const card = container.querySelector('[data-testid="my-card"]')
    expect(card).toBeDefined()
    expect(card?.id).toBe('card-1')
  })

  // REGRESIÓN ARQUITECTÓNICA (bug del modal Detalle que no abría):
  // Un Card es un contenedor de panel (rack) de gran tamaño que aloja elementos
  // interactivos en toda su superficie, incluidos los bordes (checkbox en el
  // extremo izquierdo, botones de Acciones en el extremo derecho de las tablas).
  // Una transformación de escala en :active desplaza cada hijo hacia el centro
  // del Card hasta un 1% de su distancia al centro (7-15px en paneles anchos).
  // Como el navegador solo dispara `click` cuando mousedown y mouseup caen en el
  // mismo elemento, ese desplazamiento animado durante la transición saca el
  // target de debajo del cursor y CANCELA el evento click. Por lo tanto, el Card
  // NUNCA debe incluir clases de transformación interactiva.
  it('NO incluye clases de transformación interactiva en :active (regresión de clicks cancelados)', () => {
    const { container } = render(
      <Card glow="cyan" className="p-4" data-testid="card">
        Contenido interactivo
      </Card>
    )
    const card = container.querySelector('[data-testid="card"]')
    expect(card).toBeDefined()

    const className = card?.className ?? ''
    expect(className).not.toMatch(/active:scale/)
    expect(className).not.toMatch(/active:rotate/)
    expect(className).not.toMatch(/active:translate/)
    expect(className).not.toMatch(/active:skew/)
    expect(className).not.toMatch(/active:transform/)
  })
})
