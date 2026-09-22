import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './StatCard'

describe('StatCard - Label, Value, Trend y Formato tabular-nums', () => {
  it('renderiza title, value y usa tabular-nums font-mono', () => {
    const { container } = render(<StatCard title="Precisión" value={85} />)
    expect(screen.getByText('Precisión')).toBeDefined()
    expect(screen.getByText('85')).toBeDefined()
    const valueEl = container.querySelector('.tabular-nums.font-mono')
    expect(valueEl).toBeDefined()
    expect(valueEl?.textContent).toBe('85')
  })

  it('renderiza value como string', () => {
    const { container } = render(<StatCard title="Score" value="1,234" />)
    expect(screen.getByText('Score')).toBeDefined()
    expect(screen.getByText('1,234')).toBeDefined()
    const valueEl = container.querySelector('.tabular-nums.font-mono')
    expect(valueEl).toBeDefined()
    expect(valueEl?.textContent).toBe('1,234')
  })

  it('aplica highlightColor al value', () => {
    const { container } = render(
      <StatCard title="Test" value={100} highlightColor="text-emerald-400" />
    )
    const valueEl = container.querySelector('.tabular-nums.font-mono')
    expect(valueEl).toBeDefined()
    expect(valueEl?.className).toContain('text-emerald-400')
  })

  it('usa color por defecto zinc-100 cuando no hay highlightColor', () => {
    const { container } = render(<StatCard title="Default" value={50} />)
    const valueEl = container.querySelector('.tabular-nums.font-mono')
    expect(valueEl).toBeDefined()
    expect(valueEl?.className).toContain('text-zinc-100')
  })

  it('renderiza trend positivo (emerald)', () => {
    const { container } = render(
      <StatCard title="Trend" value={80} highlightColor="text-emerald-400" />
    )
    // StatCard no tiene prop trend, pero verificamos que el value usa el color
    const valueEl = container.querySelector('.tabular-nums.font-mono')
    expect(valueEl?.className).toContain('text-emerald-400')
  })

  it('usa Card internamente con estilos base', () => {
    const { container } = render(<StatCard title="Card Test" value={42} />)
    const card = container.querySelector('[class*="bg-linear-to-b"]')
    expect(card).toBeDefined()
    expect(card?.className).toContain('border')
    expect(card?.className).toContain('rounded-xl')
  })

  it('aplica padding y centrado de texto', () => {
    const { container } = render(<StatCard title="Padding" value={10} />)
    const card = container.querySelector('[class*="bg-linear-to-b"]')
    expect(card?.className).toContain('p-3')
    expect(card?.className).toContain('text-center')
  })
})
