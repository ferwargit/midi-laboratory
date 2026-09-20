import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KnowledgeGuideModal } from './KnowledgeGuideModal'

const noop = vi.fn()

describe('KnowledgeGuideModal - Semántica de diálogo (F5-07)', () => {
  it('no renderiza nada cuando está cerrado', () => {
    render(<KnowledgeGuideModal isOpen={false} onClose={noop} />)

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('expone role="dialog" y aria-modal="true" en el panel cuando está abierto', () => {
    render(<KnowledgeGuideModal isOpen={true} onClose={noop} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('etiqueta el diálogo con el título del centro de conocimiento (aria-label)', () => {
    render(<KnowledgeGuideModal isOpen={true} onClose={noop} />)

    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe(
      'Centro de Conocimiento Psicoacústico & Metacognición'
    )
  })
})

describe('KnowledgeGuideModal - Cierre con Escape (F5-07)', () => {
  it('invoca onClose al pulsar Escape estando abierto', () => {
    const onClose = vi.fn()
    render(<KnowledgeGuideModal isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('no registra el listener de Escape estando cerrado', () => {
    const onClose = vi.fn()
    render(<KnowledgeGuideModal isOpen={false} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
  })
})
