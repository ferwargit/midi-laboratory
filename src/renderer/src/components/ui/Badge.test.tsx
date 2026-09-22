import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge - Variantes y Formato Numérico', () => {
  it('renderiza variante success', () => {
    const { container } = render(<Badge variant="success">Success</Badge>)
    const badge = container.querySelector('span') as HTMLElement
    expect(badge).toBeDefined()
    expect(badge.className).toContain('bg-emerald-950/60')
    expect(badge.className).toContain('text-emerald-300')
    expect(badge.className).toContain('border-emerald-500/30')
  })

  it('renderiza variante danger', () => {
    const { container } = render(<Badge variant="danger">Danger</Badge>)
    const badge = container.querySelector('span') as HTMLElement
    expect(badge).toBeDefined()
    expect(badge.className).toContain('bg-rose-950/60')
    expect(badge.className).toContain('text-rose-300')
    expect(badge.className).toContain('border-rose-500/30')
  })

  it('renderiza variante warning', () => {
    const { container } = render(<Badge variant="warning">Warning</Badge>)
    const badge = container.querySelector('span') as HTMLElement
    expect(badge).toBeDefined()
    expect(badge.className).toContain('bg-amber-950/60')
    expect(badge.className).toContain('text-amber-300')
    expect(badge.className).toContain('border-amber-500/30')
  })

  it('renderiza variante info (default)', () => {
    const { container } = render(<Badge variant="info">Info</Badge>)
    const badge = container.querySelector('span') as HTMLElement
    expect(badge).toBeDefined()
    expect(badge.className).toContain('bg-cyan-950/60')
    expect(badge.className).toContain('text-cyan-300')
    expect(badge.className).toContain('border-cyan-500/30')
  })

  it('renderiza children numéricos correctamente', () => {
    const { container } = render(<Badge variant="success">123</Badge>)
    const badge = container.querySelector('span') as HTMLElement
    expect(badge).toBeDefined()
    expect(badge.textContent).toBe('123')
  })

  it('renderiza children con elementos anidados correctamente', () => {
    const { container } = render(
      <Badge>
        <strong>Bold</strong> Text
      </Badge>
    )
    const badge = container.querySelector('span') as HTMLElement
    expect(badge).toBeDefined()
    expect(badge.textContent).toContain('Bold')
    expect(badge.textContent).toContain('Text')
  })

  it('tiene estilos base inline-flex items-center px-2 py-0.5 rounded text-xs border', () => {
    const { container } = render(<Badge>Base</Badge>)
    const badge = container.querySelector('span') as HTMLElement
    expect(badge).toBeDefined()
    expect(badge.className).toContain('inline-flex')
    expect(badge.className).toContain('items-center')
    expect(badge.className).toContain('px-2')
    expect(badge.className).toContain('py-0.5')
    expect(badge.className).toContain('rounded')
    expect(badge.className).toContain('text-xs')
    expect(badge.className).toContain('border')
  })
})
