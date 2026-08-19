import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMidi } from './useMidi'

describe('useMidi - Hook de Gestión y Filtrado MIDI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe inicializarse en estado de espera sin errores si Web MIDI no está listo', () => {
    const { result } = renderHook(() => useMidi())
    expect(result.current.pressedNotes).toEqual([])
    expect(result.current.inputs).toEqual([])
    expect(result.current.outputs).toEqual([])
  })

  it('clearAllPressedNotes debe vaciar el array de teclas presionadas de forma inmediata', () => {
    const { result } = renderHook(() => useMidi())

    act(() => {
      result.current.clearAllPressedNotes()
    })

    expect(result.current.pressedNotes).toEqual([])
  })

  it('changeProgram y sendNote no deben fallar si no hay un puerto de salida seleccionado', () => {
    const { result } = renderHook(() => useMidi())

    expect(() => {
      act(() => {
        result.current.changeProgram(0)
        result.current.sendNote(60, 500)
      })
    }).not.toThrow()
  })
})
