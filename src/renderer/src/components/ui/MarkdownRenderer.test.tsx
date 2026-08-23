import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownRenderer } from './MarkdownRenderer'

describe('MarkdownRenderer - Parser Estructurado con Tablas, Listas y Código', () => {
  it('debe renderizar texto plano correctamente', () => {
    render(<MarkdownRenderer content="Este es un diagnóstico clínico estándar." />)
    expect(screen.getByText('Este es un diagnóstico clínico estándar.')).toBeDefined()
  })

  it('debe transformar **negrita** en elementos <strong> y `código` en <code>', () => {
    render(<MarkdownRenderer content="Tu **precisión real** en la nota `F4` es excelente." />)
    const strongElement = screen.getByText('precisión real')
    expect(strongElement.tagName).toBe('STRONG')

    const codeElement = screen.getByText('F4')
    expect(codeElement.tagName).toBe('CODE')
  })

  it('debe transformar ### Título en encabezados <h4>', () => {
    render(<MarkdownRenderer content="### 1. Diagnóstico Psicoacústico" />)
    const heading = screen.getByRole('heading', { level: 4 })
    expect(heading.textContent).toBe('1. Diagnóstico Psicoacústico')
  })

  // NUEVO TEST: Certificación de Tablas Markdown
  it('debe parsear y renderizar tablas Markdown con cabeceras y celdas estructuradas', () => {
    const tableMarkdown = `
| Paso | Acción | Tiempo |
|------|--------|--------|
| 1 | Coloca el dedo índice sobre **F4** | 5s |
| 2 | Presiona suavemente y escucha | 3s |
    `.trim()

    render(<MarkdownRenderer content={tableMarkdown} />)

    // Cabeceras de tabla <th>
    expect(screen.getByText('Paso')).toBeDefined()
    expect(screen.getByText('Acción')).toBeDefined()
    expect(screen.getByText('Tiempo')).toBeDefined()

    // Celdas de datos <td> con negrita interna
    expect(screen.getByText('F4')).toBeDefined()
    expect(screen.getByText('5s')).toBeDefined()
    expect(screen.getByText('Presiona suavemente y escucha')).toBeDefined()
  })

  it('debe renderizar listas ordenadas numeradas', () => {
    const listContent = '1. Primer paso de anclaje\n2. Segundo paso de discriminación'
    render(<MarkdownRenderer content={listContent} />)
    expect(screen.getByText('Primer paso de anclaje')).toBeDefined()
    expect(screen.getByText('Segundo paso de discriminación')).toBeDefined()
  })

  it('debe manejar bloques de código y comillas de cita', () => {
    const blockContent = '> Cita pedagógica importante\n```\nconst nota = 60;\n```'
    render(<MarkdownRenderer content={blockContent} />)
    expect(screen.getByText('Cita pedagógica importante')).toBeDefined()
    expect(screen.getByText('const nota = 60;')).toBeDefined()
  })
})
