import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMidi } from './useMidi'

interface MockMidiInput {
  id: string
  name: string
  state: string
  type: string
  onmidimessage: ((e: { data: Uint8Array }) => void) | null
}

interface MockMidiOutput {
  id: string
  name: string
  state: string
  type: string
  send: (data: number[]) => void
}

interface MockMidiAccessResult {
  access: {
    inputs: Map<string, MockMidiInput>
    outputs: Map<string, MockMidiOutput>
    onstatechange: (() => void) | null
  }
  mockInput: MockMidiInput
  mockOutput: MockMidiOutput
}

function createMockMidiAccess(): MockMidiAccessResult {
  const mockInput: MockMidiInput = {
    id: 'um-one-in-id',
    name: 'Roland UM-ONE',
    state: 'connected',
    type: 'input',
    onmidimessage: null
  }

  const mockOutput: MockMidiOutput = {
    id: 'um-one-out-id',
    name: 'Roland UM-ONE',
    state: 'connected',
    type: 'output',
    send: vi.fn()
  }

  const inputsMap = new Map<string, MockMidiInput>([['um-one-in-id', mockInput]])
  const outputsMap = new Map<string, MockMidiOutput>([['um-one-out-id', mockOutput]])

  const access = {
    inputs: inputsMap,
    outputs: outputsMap,
    onstatechange: null
  }

  return { access, mockInput, mockOutput }
}

describe('useMidi - Cobertura Integral de Hardware, Eventos y MIDI Panic', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete (navigator as unknown as { requestMIDIAccess?: unknown }).requestMIDIAccess
  })

  it('debe inicializarse con estado de error si Web MIDI API no está disponible', () => {
    const { result } = renderHook(() => useMidi())
    expect(result.current.pressedNotes).toEqual([])
    expect(result.current.inputs).toEqual([])
    expect(result.current.outputs).toEqual([])
    expect(result.current.status).toContain('no disponible')
  })

  it('debe manejar rechazo de promesa en requestMIDIAccess', async () => {
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockRejectedValue(new Error('Permiso denegado por el sistema'))

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.status).toContain('Error MIDI: Permiso denegado')
  })

  it('debe auto-detectar y seleccionar el Roland UM-ONE mk2 cuando requestMIDIAccess resuelve', async () => {
    const { access, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const onDeviceReconnected = vi.fn()
    const { result } = renderHook(() =>
      useMidi({
        onDeviceReconnected
      })
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.status).toContain('conectado')
    expect(result.current.selectedInputId).toBe('um-one-in-id')
    expect(result.current.selectedOutputId).toBe('um-one-out-id')
    expect(result.current.inputs.length).toBe(1)
    expect(result.current.outputs.length).toBe(1)

    act(() => {
      result.current.sendNote(60, 500, 100)
    })
    expect(mockOutput.send).toHaveBeenCalledWith([0x90, 60, 100])

    act(() => {
      result.current.changeProgram(73, 1)
    })
    expect(mockOutput.send).toHaveBeenCalledWith([0xc0, 73])
  })

  it('sendAllNotesOff debe emitir CC 120 (Sound Off), CC 123 (Notes Off) y CC 64 (Sustain Off)', async () => {
    const { access, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      result.current.sendAllNotesOff(1)
    })

    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 120, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 123, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 64, 0])
  })

  it('clearAllPressedNotes debe invocar sendAllNotesOff y limpiar el buffer', async () => {
    const { access, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      result.current.clearAllPressedNotes()
    })

    expect(result.current.pressedNotes).toEqual([])
    expect(result.current.activeStimulusNotes).toEqual([])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 120, 0])
  })

  it('debe reenviar mensajes por Software THRU si está habilitado y hay salida seleccionada', async () => {
    const { access, mockInput, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi({ enableSoftwareThru: true }))

    await act(async () => {
      await Promise.resolve()
    })

    const rawData = new Uint8Array([0x90, 64, 100])
    act(() => {
      mockInput.onmidimessage?.({ data: rawData })
    })

    expect(mockOutput.send).toHaveBeenCalledWith(rawData)
    expect(result.current.pressedNotes).toContain(64)
  })

  it('watchdog de notas colgadas debe liberar notas no liberadas tras 6000ms', async () => {
    vi.useFakeTimers()
    const { access, mockInput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      mockInput.onmidimessage?.({ data: new Uint8Array([0x90, 60, 90]) })
    })
    expect(result.current.pressedNotes).toContain(60)

    // Avanzamos 6001ms sin Note Off
    act(() => {
      vi.advanceTimersByTime(6001)
    })
    expect(result.current.pressedNotes).not.toContain(60)

    vi.useRealTimers()
  })

  it('sendNote cancela temporizador previo si se envía la misma nota en ráfaga rápida', async () => {
    vi.useFakeTimers()
    const { access, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      result.current.sendNote(60, 500)
    })
    expect(result.current.activeStimulusNotes).toContain(60)

    // A los 200ms se vuelve a disparar la misma nota (reinicio del timer de Note Off)
    act(() => {
      vi.advanceTimersByTime(200)
      result.current.sendNote(60, 500)
    })

    // A los 400ms todavía sigue activa
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current.activeStimulusNotes).toContain(60)

    // A los 501ms posteriores expira
    act(() => {
      vi.advanceTimersByTime(105)
    })
    expect(result.current.activeStimulusNotes).not.toContain(60)
    expect(mockOutput.send).toHaveBeenCalledWith([0x80, 60, 0])

    vi.useRealTimers()
  })

  it('detecta desconexión física de hardware y dispara onDeviceDisconnected', async () => {
    const { access } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const onDeviceDisconnected = vi.fn()
    const { result } = renderHook(() => useMidi({ onDeviceDisconnected }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.isDeviceDisconnected).toBe(false)

    // Simulamos que el cable UM-ONE se desenchufó (inputs vacíos)
    access.inputs.clear()
    act(() => {
      access.onstatechange?.()
    })

    expect(result.current.isDeviceDisconnected).toBe(true)
    expect(result.current.status).toContain('desconectado')
    expect(onDeviceDisconnected).toHaveBeenCalledTimes(1)
  })

  it('addLog formatea adecuadamente los mensajes con timestamp y recorta historial a 35 items', () => {
    const { result } = renderHook(() => useMidi())

    act(() => {
      for (let i = 0; i < 40; i++) {
        result.current.addLog({ type: 'IN', message: `Evento ${i}` })
      }
    })

    expect(result.current.logs.length).toBe(35)
    expect(result.current.logs[result.current.logs.length - 1].message).toBe('Evento 39')
  })
})
