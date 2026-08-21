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

describe('useMidi - Cobertura Integral de Hardware y Eventos MIDI', () => {
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

  it('debe procesar Note On y Note Off actualizando pressedNotes y llamando a los callbacks', async () => {
    const { access, mockInput, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const onNoteOn = vi.fn()
    const onNoteOff = vi.fn()

    const { result } = renderHook(() =>
      useMidi({
        onNoteOn,
        onNoteOff,
        enableSoftwareThru: true
      })
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Note On
    act(() => {
      if (mockInput.onmidimessage) {
        mockInput.onmidimessage({
          data: new Uint8Array([0x90, 60, 90])
        })
      }
    })

    expect(result.current.pressedNotes).toContain(60)
    expect(onNoteOn).toHaveBeenCalledWith(60, 90)
    expect(mockOutput.send).toHaveBeenCalled()

    // Note Off
    act(() => {
      if (mockInput.onmidimessage) {
        mockInput.onmidimessage({
          data: new Uint8Array([0x80, 60, 0])
        })
      }
    })

    expect(result.current.pressedNotes).not.toContain(60)
    expect(onNoteOff).toHaveBeenCalledWith(60)
  })

  it('clearAllPressedNotes debe vaciar teclas presionadas y cancelar buffers', () => {
    const { result } = renderHook(() => useMidi())

    act(() => {
      result.current.clearAllPressedNotes()
    })

    expect(result.current.pressedNotes).toEqual([])
    expect(result.current.activeStimulusNotes).toEqual([])
  })
})
