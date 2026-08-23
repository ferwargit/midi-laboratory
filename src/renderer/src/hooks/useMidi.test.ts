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

    // CC 120: All Sound Off
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 120, 0])
    // CC 123: All Notes Off
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 123, 0])
    // CC 64: Sustain Off
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
})
