import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownRenderer } from './MarkdownRenderer'

describe('MarkdownRenderer - Parser Tipográfico de Textos del Tutor IA', () => {
  it('debe renderizar texto plano correctamente', () => {
    render(<MarkdownRenderer content="Este es un diagnóstico clínico estándar." />)
    expect(screen.getByText('Este es un diagnóstico clínico estándar.')).toBeDefined()
  })

  it('debe transformar **negrita** en elementos <strong>', () => {
    render(<MarkdownRenderer content="Tu **precisión real** es excelente." />)
    const strongElement = screen.getByText('precisión real')
    expect(strongElement.tagName).toBe('STRONG')
  })

  it('debe transformar ### Título en encabezados <h4>', () => {
    render(<MarkdownRenderer content="### 1. Diagnóstico Psicoacústico" />)
    const heading = screen.getByRole('heading', { level: 4 })
    expect(heading.textContent).toBe('1. Diagnóstico Psicoacústico')
  })

  it('debe transformar ## Título en encabezados <h3>', () => {
    render(<MarkdownRenderer content="## Resumen Ejecutivo" />)
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading.textContent).toBe('Resumen Ejecutivo')
  })

  it('debe renderizar elementos de lista con viñetas', () => {
    const listContent = '* Punto de anclaje tonal en C4\n- Reducción de latencia a 1.1s'
    render(<MarkdownRenderer content={listContent} />)
    expect(screen.getByText('Punto de anclaje tonal en C4')).toBeDefined()
    expect(screen.getByText('Reducción de latencia a 1.1s')).toBeDefined()
  })

  it('debe manejar contenido vacío sin lanzar errores', () => {
    const { container } = render(<MarkdownRenderer content="" />)
    expect(container.textContent).toBe('')
  })
})
