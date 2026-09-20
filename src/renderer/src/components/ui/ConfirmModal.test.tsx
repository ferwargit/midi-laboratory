import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmModal } from './ConfirmModal'

const defaultProps = {
  isOpen: true,
  title: '¿Eliminar sesión?',
  message: 'Esta acción no se puede deshacer.',
  onConfirm: vi.fn(),
  onCancel: vi.fn()
}

describe('ConfirmModal - Semántica de diálogo (F5-07)', () => {
  it('no renderiza nada cuando está cerrado', () => {
    render(<ConfirmModal {...defaultProps} isOpen={false} />)

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('expone role="dialog" y aria-modal="true" en el panel cuando está abierto', () => {
    render(<ConfirmModal {...defaultProps} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('etiqueta el diálogo con el título (aria-label)', () => {
    render(<ConfirmModal {...defaultProps} />)

    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('¿Eliminar sesión?')
  })
})

describe('ConfirmModal - Cierre con Escape (F5-07)', () => {
  it('invoca onCancel exactamente una vez al pulsar Escape', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('no invoca onConfirm al pulsar Escape (la acción destructiva no dispara por teclado)', () => {
    const onConfirm = vi.fn()
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('no registra el listener de Escape estando cerrado (no invoca onCancel)', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal {...defaultProps} isOpen={false} onCancel={onCancel} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCancel).not.toHaveBeenCalled()
  })
})
