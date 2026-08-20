import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMidi } from './useMidi'

describe('useMidi - Hook de Gestión y Filtrado MIDI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe inicializarse con estado por defecto y sin bucles de eventos', () => {
    const onDeviceReconnected = vi.fn()
    const { result } = renderHook(() =>
      useMidi({
        onDeviceReconnected
      })
    )

    expect(result.current.pressedNotes).toEqual([])
    expect(result.current.inputs).toEqual([])
    expect(result.current.outputs).toEqual([])
    // Al inicializar sin cambio de desconexión previo no debe disparar reconexión falsa
    expect(onDeviceReconnected).not.toHaveBeenCalled()
  })

  it('clearAllPressedNotes debe vaciar el array de teclas presionadas de forma inmediata', () => {
    const { result } = renderHook(() => useMidi())

    act(() => {
      result.current.clearAllPressedNotes()
    })

    expect(result.current.pressedNotes).toEqual([])
  })

  it('changeProgram y sendNote no deben lanzar error si el dispositivo está desconectado o no hay puerto', () => {
    const { result } = renderHook(() => useMidi())

    expect(() => {
      act(() => {
        result.current.changeProgram(0)
        result.current.sendNote(60, 500)
      })
    }).not.toThrow()
  })

  it('debe aceptar callbacks opcionales de desconexión y reconexión sin fallar', () => {
    const onDeviceDisconnected = vi.fn()
    const onDeviceReconnected = vi.fn()

    const { result } = renderHook(() =>
      useMidi({
        onDeviceDisconnected,
        onDeviceReconnected
      })
    )

    expect(result.current).toBeDefined()
  })
})
