import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button - Variantes, Tamaños, Estados e Interacción', () => {
  it('renderiza todas las variantes correctamente', () => {
    render(
      <div>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="success">Success</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
    )

    expect(screen.getByText('Primary')).toBeDefined()
    expect(screen.getByText('Secondary')).toBeDefined()
    expect(screen.getByText('Success')).toBeDefined()
    expect(screen.getByText('Danger')).toBeDefined()
    expect(screen.getByText('Ghost')).toBeDefined()
  })

  it('renderiza todos los tamaños correctamente', () => {
    render(
      <div>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
    )

    expect(screen.getByText('Small')).toBeDefined()
    expect(screen.getByText('Medium')).toBeDefined()
    expect(screen.getByText('Large')).toBeDefined()
  })

  it('dispara onClick al hacer click', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    fireEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('estado disabled deshabilita click y aplica estilos', () => {
    const handleClick = vi.fn()
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    )

    const button = screen.getByText('Disabled')
    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  it('tiene focus-visible ring cyan para accesibilidad', () => {
    render(<Button>Focusable</Button>)
    const button = screen.getByText('Focusable')
    expect(button.className).toContain('focus-visible:ring-2')
    expect(button.className).toContain('focus-visible:ring-cyan-500')
    expect(button.className).toContain('focus-visible:outline-none')
  })

  it('aplica className personalizada', () => {
    render(<Button className="custom-class">Custom</Button>)
    expect(screen.getByText('Custom').className).toContain('custom-class')
  })

  it('renderiza children correctamente', () => {
    render(
      <Button>
        <span>Icon</span> Texto
      </Button>
    )
    expect(screen.getByText('Icon')).toBeDefined()
    expect(screen.getByText('Texto')).toBeDefined()
  })
})
