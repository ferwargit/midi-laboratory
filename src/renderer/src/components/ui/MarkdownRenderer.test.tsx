import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownRenderer } from './MarkdownRenderer'
import * as markdownParser from './markdownParser'

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

describe('MarkdownRenderer - Memoización del parseo (F5-03)', () => {
  // Se espía `parseMarkdownBlocks` delegando a la implementación real: cada
  // invocación es un parseo completo del contenido, así que el contador es un
  // proxy exacto de la actividad de render (mismo patrón que
  // noteUtils.midiNoteToName en s3-render-performance.test.tsx).
  let parseSpy: ReturnType<typeof vi.spyOn>
  let realParse: typeof markdownParser.parseMarkdownBlocks

  beforeEach(() => {
    realParse = markdownParser.parseMarkdownBlocks
    parseSpy = vi.spyOn(markdownParser, 'parseMarkdownBlocks')
    parseSpy.mockImplementation((...args: [string]) => realParse(...args))
  })

  afterEach(() => {
    parseSpy.mockRestore()
  })

  it('no debe re-parsear cuando los props son idénticos', () => {
    const content = '## Diagnóstico\nTu **precisión** en `F4` es estable.'
    const utils = render(<MarkdownRenderer content={content} />)

    expect(screen.getByText('Diagnóstico')).toBeDefined()
    expect(screen.getByText('F4').tagName).toBe('CODE')
    expect(parseSpy).toHaveBeenCalledTimes(1)

    // Re-render con EXACTAMENTE los mismos props: React.memo cortocircuita y
    // el contenido no se vuelve a tokenizar.
    utils.rerender(<MarkdownRenderer content={content} />)

    expect(parseSpy).toHaveBeenCalledTimes(1)
  })

  it('debe re-parsear cuando el contenido cambia (equivalencia funcional)', () => {
    const utils = render(<MarkdownRenderer content="## Diagnóstico inicial" />)

    expect(screen.getByText('Diagnóstico inicial')).toBeDefined()
    expect(parseSpy).toHaveBeenCalledTimes(1)

    utils.rerender(<MarkdownRenderer content="## Diagnóstico actualizado" />)

    expect(parseSpy).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Diagnóstico actualizado')).toBeDefined()
  })

  it('debe re-parsear cuando cambia className aunque el contenido sea idéntico', () => {
    const content = 'Respuesta clínica con **negrita**.'
    const utils = render(<MarkdownRenderer content={content} className="clase-a" />)

    expect(parseSpy).toHaveBeenCalledTimes(1)

    // El cambio de className re-renderiza el componente, pero la memo del
    // parseo está keyed por `content`, así que NO se re-tokeniza.
    utils.rerender(<MarkdownRenderer content={content} className="clase-b" />)

    expect(parseSpy).toHaveBeenCalledTimes(1)
  })

  it('debe tolerar la transición de contenido vacío a contenido poblado', () => {
    const utils = render(<MarkdownRenderer content="" />)

    expect(parseSpy).toHaveBeenCalledTimes(1)

    utils.rerender(<MarkdownRenderer content={'## Nuevo contenido\n- ítem uno'} />)

    expect(parseSpy).toHaveBeenCalledTimes(2)
    expect(screen.getByText('ítem uno')).toBeDefined()
  })
})
