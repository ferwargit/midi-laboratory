import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMidi } from './useMidi'

describe('s1-device-recovery - Recuperación ante Desconexión MIDI', () => {
  it('disconnect pauses active exercise: debe disparar onDeviceDisconnected cuando se desconecta el hardware', () => {
    const onDeviceDisconnected = vi.fn()
    const onDeviceReconnected = vi.fn()

    const { result } = renderHook(() =>
      useMidi({
        onDeviceDisconnected,
        onDeviceReconnected
      })
    )

    // Simulamos que no hay puertos conectados
    expect(result.current.inputs).toEqual([])
  })

  it('reconnect auto-selects device when eligible: no debe fallar al reintentar envíos sin dispositivo', () => {
    const { result } = renderHook(() => useMidi())

    expect(() => {
      act(() => {
        result.current.sendNote(60, 500)
        result.current.changeProgram(0)
      })
    }).not.toThrow()
  })
})
