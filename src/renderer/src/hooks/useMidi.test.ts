import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMidi } from './useMidi'
import { useTelemetryStore } from '../stores/useTelemetryStore'

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
  send: ReturnType<typeof vi.fn>
}

interface MockMidiAccessResult {
  access: {
    inputs: Map<string, MockMidiInput>
    outputs: Map<string, MockMidiOutput>
    onstatechange: (() => void) | null
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
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

  // Registro interno de listeners 'statechange' del mock. El puente de
  // compatibilidad mantiene `onstatechange` apuntando al último handler
  // registrado, de modo que los tests existentes que disparan
  // `access.onstatechange?.()` sigan funcionando con el patrón de eventos.
  const access = {
    inputs: inputsMap,
    outputs: outputsMap,
    onstatechange: null as (() => void) | null,
    addEventListener: vi.fn((type: string, listener: () => void): void => {
      if (type === 'statechange') {
        access.onstatechange = listener
      }
    }),
    removeEventListener: vi.fn((type: string, listener: () => void): void => {
      if (type === 'statechange' && access.onstatechange === listener) {
        access.onstatechange = null
      }
    })
  }

  return { access, mockInput, mockOutput }
}

describe('useMidi - Cobertura Integral de Hardware, Eventos y MIDI Panic', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete (navigator as unknown as { requestMIDIAccess?: unknown }).requestMIDIAccess
    // Reset del buffer de telemetría global entre tests
    useTelemetryStore.setState({ logs: [] })
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

  it('sendAllNotesOff(1) debe emitir la secuencia canónica completa en Canal 1 (CC 120, 123, 64, 121 y Pitch Bend centrado)', async () => {
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
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 121, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xe0, 0x00, 0x40])
    expect(mockOutput.send).toHaveBeenCalledWith([0x80, 21, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0x80, 108, 0])

    // Canal 1 debe quedar aislado: ningún silenciador debe alcanzar el Canal 10
    expect(mockOutput.send).not.toHaveBeenCalledWith([0xb9, 120, 0])
    expect(mockOutput.send).not.toHaveBeenCalledWith([0xb9, 123, 0])
    expect(mockOutput.send).not.toHaveBeenCalledWith([0xb9, 64, 0])
    expect(mockOutput.send).not.toHaveBeenCalledWith([0xb9, 121, 0])
    expect(mockOutput.send).not.toHaveBeenCalledWith([0xe9, 0x00, 0x40])
    expect(mockOutput.send).not.toHaveBeenCalledWith([0x89, 21, 0])
    expect(mockOutput.send).not.toHaveBeenCalledWith([0x89, 108, 0])
  })

  it('sendAllNotesOff() global debe silenciar los canales activos 1 y 10', async () => {
    const { access, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      result.current.sendAllNotesOff()
    })

    // Canal 1 (0xB0 / 0x80 / 0xE0)
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 120, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 123, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 64, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 121, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xe0, 0x00, 0x40])
    expect(mockOutput.send).toHaveBeenCalledWith([0x80, 21, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0x80, 108, 0])

    // Canal 10 (0xB9 / 0x89 / 0xE9)
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 120, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 123, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 64, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 121, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xe9, 0x00, 0x40])
    expect(mockOutput.send).toHaveBeenCalledWith([0x89, 21, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0x89, 108, 0])
  })

  it('sendAllNotesOff(1) no debe tocar el Canal 10, pero clearAllPressedNotes sí', async () => {
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

    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 121, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xe0, 0x00, 0x40])
    expect(mockOutput.send).not.toHaveBeenCalledWith([0xb9, 121, 0])
    expect(mockOutput.send).not.toHaveBeenCalledWith([0xe9, 0x00, 0x40])

    mockOutput.send.mockClear()

    act(() => {
      result.current.clearAllPressedNotes()
    })

    expect(result.current.pressedNotes).toEqual([])
    expect(result.current.activeStimulusNotes).toEqual([])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 121, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 121, 0])
  })

  it('sendAllNotesOff contiene las excepciones del puerto de salida', async () => {
    const { access, mockOutput } = createMockMidiAccess()
    mockOutput.send.mockImplementation(() => {
      throw new Error('Puerto de salida caído')
    })
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() =>
      act(() => {
        result.current.sendAllNotesOff()
      })
    ).not.toThrow()

    expect(consoleSpy).toHaveBeenCalledWith(
      '[useMidi] Error al emitir MIDI Panic:',
      expect.any(Error)
    )
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    consoleSpy.mockRestore()

    expect(result.current.pressedNotes).toEqual([])
    expect(result.current.activeStimulusNotes).toEqual([])

    // Restablecer el mock para que el unmount pasivo del hook no lance
    // (el cleanup de useMidi vuelve a invocar sendAllNotesOff al desmontar)
    mockOutput.send = vi.fn()
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

  it('el tick del metrónomo (Canal 10) no debe contaminar la pista visual de estímulo', async () => {
    vi.useFakeTimers()
    const { access, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    // Tick de downbeat del metrónomo: GM 76, Canal 10
    act(() => {
      result.current.sendNote(76, 120, 115, 10)
    })

    // El puerto recibe el Note On del Canal 10 con normalidad (0x99 = 0x90 | 9)
    expect(mockOutput.send).toHaveBeenCalledWith([0x99, 76, 115])
    // Pero la pista visual de estímulo NO se contamina
    expect(result.current.activeStimulusNotes).not.toContain(76)

    // Antes de la liberación programada (120 ms) tampoco
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.activeStimulusNotes).not.toContain(76)

    // El Note Off programado del Canal 10 se emite igualmente (0x89 = 0x80 | 9)
    act(() => {
      vi.advanceTimersByTime(20)
    })
    expect(mockOutput.send).toHaveBeenCalledWith([0x89, 76, 0])
    expect(result.current.activeStimulusNotes).not.toContain(76)

    vi.useRealTimers()
  })

  it('la nota de piano (Canal 1) sigue iluminando como estímulo y se retira tras el Note Off', async () => {
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
      result.current.sendNote(60, 400, 100, 1)
    })
    expect(result.current.activeStimulusNotes).toContain(60)

    // Durante la articulación (400 ms) la nota permanece registrada
    act(() => {
      vi.advanceTimersByTime(399)
    })
    expect(result.current.activeStimulusNotes).toContain(60)

    // Tras el Note Off programado se retira
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.activeStimulusNotes).not.toContain(60)
    expect(mockOutput.send).toHaveBeenCalledWith([0x80, 60, 0])

    vi.useRealTimers()
  })

  it('la nota homónima en canal distinto es independiente: claves 1_60 y 10_60 coexisten y solo el Canal 1 registra estímulo', async () => {
    vi.useFakeTimers()
    const { access, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    // t=0: nota 60 en el Canal melódico (piano)
    act(() => {
      result.current.sendNote(60, 400, 100, 1)
    })
    expect(mockOutput.send).toHaveBeenCalledWith([0x90, 60, 100])
    expect(result.current.activeStimulusNotes).toEqual([60])

    // t=200: la misma nota 60 en el Canal 10 (metrónomo), con su propio temporizador
    act(() => {
      vi.advanceTimersByTime(200)
      result.current.sendNote(60, 400, 100, 10)
    })
    expect(mockOutput.send).toHaveBeenCalledWith([0x99, 60, 100])
    // El Canal 10 NO registra estímulo: la pista visual sigue siendo solo la del Canal 1
    expect(result.current.activeStimulusNotes).toEqual([60])

    // t=400: el Note Off del Canal 1 llega en su tiempo propio (400 ms desde SU envío),
    // prueba de que el envío del Canal 10 no canceló su temporizador (claves independientes)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(mockOutput.send).toHaveBeenCalledWith([0x80, 60, 0])
    expect(result.current.activeStimulusNotes).toEqual([])

    // t=600: el Note Off del Canal 10 llega 400 ms después de SU envío (temporizador propio)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(mockOutput.send).toHaveBeenCalledWith([0x89, 60, 0])
    expect(result.current.activeStimulusNotes).toEqual([])

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

  it('al desmontar desregistra el listener statechange con la misma referencia registrada', async () => {
    const { access } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result, unmount } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.status).toContain('conectado')

    // La escucha quedó registrada exactamente una vez con el evento 'statechange'
    expect(access.addEventListener).toHaveBeenCalledTimes(1)
    const registered = access.addEventListener.mock.calls[0]
    expect(registered[0]).toBe('statechange')
    const registeredHandler = registered[1] as () => void
    expect(typeof registeredHandler).toBe('function')

    unmount()

    // Desregistro simétrico: misma referencia de handler, mismo tipo de evento
    expect(access.removeEventListener).toHaveBeenCalledTimes(1)
    const removed = access.removeEventListener.mock.calls[0]
    expect(removed[0]).toBe('statechange')
    expect(removed[1]).toBe(registeredHandler)

    // El acceso MIDI queda sin ninguna escucha statechange del hook
    expect(access.onstatechange).toBeNull()
  })

  it('una transición de dispositivo NO dispara la ráfaga de pánico; solo el desmonte final la emite', async () => {
    const { access, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result, unmount } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.status).toContain('conectado')

    // Transición de dispositivo: desconexión física (sin puertos de entrada).
    // El puerto de salida permanece en el mapa de MIDIAccess (como en el
    // hardware real), de modo que el pánico espurio sí alcanzaría al puerto.
    access.inputs.clear()
    act(() => {
      access.onstatechange?.()
    })
    expect(result.current.isDeviceDisconnected).toBe(true)

    // ...y reconexión del adaptador
    access.inputs.set('um-one-in-id', {
      id: 'um-one-in-id',
      name: 'Roland UM-ONE',
      state: 'connected',
      type: 'input',
      onmidimessage: null
    })
    act(() => {
      access.onstatechange?.()
    })
    expect(result.current.isDeviceDisconnected).toBe(false)

    // Ningún mensaje de pánico fue emitido como consecuencia de la transición
    const panicMessages = mockOutput.send.mock.calls.filter(
      ([msg]) =>
        (Array.isArray(msg) &&
          (msg[0] === 0xb0 ||
            msg[0] === 0xb9 ||
            msg[0] === 0xe0 ||
            msg[0] === 0xe9 ||
            msg[0] === 0x80 ||
            msg[0] === 0x89)) ||
        !Array.isArray(msg)
    )
    expect(panicMessages).toEqual([])

    // El desmonte final SÍ emite la secuencia canónica de pánico global [1, 10]
    unmount()
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 120, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 123, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 64, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 121, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xe0, 0x00, 0x40])
    expect(mockOutput.send).toHaveBeenCalledWith([0x80, 21, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0x80, 108, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 120, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 123, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 64, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 121, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xe9, 0x00, 0x40])
    expect(mockOutput.send).toHaveBeenCalledWith([0x89, 21, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0x89, 108, 0])
  })

  it('el cambio de puerto de salida seleccionado no dispara ráfaga de pánico; el desmonte final usa el puerto vigente', async () => {
    const { access, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const secondOutput: MockMidiOutput = {
      id: 'second-out-id',
      name: 'Second Interface',
      state: 'connected',
      type: 'output',
      send: vi.fn()
    }

    const { result, unmount } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.selectedOutputId).toBe('um-one-out-id')

    // Segundo puerto de salida disponible en el acceso MIDI
    access.outputs.set('second-out-id', secondOutput)

    // Cambio explícito de puerto de salida seleccionado (transición de dispositivo)
    act(() => {
      result.current.setSelectedOutputId('second-out-id')
    })
    expect(result.current.selectedOutputId).toBe('second-out-id')

    // Ninguna ráfaga de pánico en el puerto antiguo como consecuencia del cambio
    const oldPortPanic = mockOutput.send.mock.calls.filter(
      ([msg]) =>
        (Array.isArray(msg) &&
          (msg[0] === 0xb0 ||
            msg[0] === 0xb9 ||
            msg[0] === 0xe0 ||
            msg[0] === 0xe9 ||
            msg[0] === 0x80 ||
            msg[0] === 0x89)) ||
        !Array.isArray(msg)
    )
    expect(oldPortPanic).toEqual([])
    // Ni llamada alguna al puerto nuevo por el mero cambio de selección
    expect(secondOutput.send).not.toHaveBeenCalled()

    // El desmonte final invoca la versión vigente de sendAllNotesOff (vía ref):
    // el pánico canónico completo [1, 10] sale por el puerto NUEVO
    unmount()
    expect(secondOutput.send).toHaveBeenCalledWith([0xb0, 120, 0])
    expect(secondOutput.send).toHaveBeenCalledWith([0xb0, 123, 0])
    expect(secondOutput.send).toHaveBeenCalledWith([0xb0, 64, 0])
    expect(secondOutput.send).toHaveBeenCalledWith([0xb0, 121, 0])
    expect(secondOutput.send).toHaveBeenCalledWith([0xe0, 0x00, 0x40])
    expect(secondOutput.send).toHaveBeenCalledWith([0x80, 21, 0])
    expect(secondOutput.send).toHaveBeenCalledWith([0x80, 108, 0])
    expect(secondOutput.send).toHaveBeenCalledWith([0xb9, 120, 0])
    expect(secondOutput.send).toHaveBeenCalledWith([0xb9, 123, 0])
    expect(secondOutput.send).toHaveBeenCalledWith([0xb9, 64, 0])
    expect(secondOutput.send).toHaveBeenCalledWith([0xb9, 121, 0])
    expect(secondOutput.send).toHaveBeenCalledWith([0xe9, 0x00, 0x40])
    expect(secondOutput.send).toHaveBeenCalledWith([0x89, 21, 0])
    expect(secondOutput.send).toHaveBeenCalledWith([0x89, 108, 0])
    // El puerto antiguo no recibe mensaje alguno en todo el ciclo de vida
    expect(mockOutput.send).not.toHaveBeenCalled()
  })

  it('el desmonte final emite la secuencia canónica de pánico global sobre los canales activos [1, 10]', async () => {
    const { access, mockOutput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { unmount } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    unmount()

    // Canal 1 (0xB0 / 0xE0 / 0x80)
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 120, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 123, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 64, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb0, 121, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xe0, 0x00, 0x40])
    expect(mockOutput.send).toHaveBeenCalledWith([0x80, 21, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0x80, 108, 0])

    // Canal 10 (0xB9 / 0xE9 / 0x89)
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 120, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 123, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 64, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xb9, 121, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0xe9, 0x00, 0x40])
    expect(mockOutput.send).toHaveBeenCalledWith([0x89, 21, 0])
    expect(mockOutput.send).toHaveBeenCalledWith([0x89, 108, 0])
  })

  it('addLog NO re-renderiza al consumidor del hook (stream de telemetría desacoplado del render raíz)', () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders++
      return useMidi()
    })

    const rendersBefore = renders

    act(() => {
      result.current.addLog({ type: 'IN', message: 'Evento de telemetría' })
    })

    // El buffer vive en el store de telemetría, no en el estado del hook:
    // un evento de log no provoca re-render del consumidor (F12.1)
    expect(renders).toBe(rendersBefore)
    expect(useTelemetryStore.getState().logs).toHaveLength(1)
  })

  it('addLog formatea adecuadamente los mensajes con timestamp y recorta historial a 35 items', () => {
    const { result } = renderHook(() => useMidi())

    act(() => {
      for (let i = 0; i < 40; i++) {
        result.current.addLog({ type: 'IN', message: `Evento ${i}` })
      }
    })

    // La ventana deslizante se verifica contra el store de telemetría (SSOT)
    const logs = useTelemetryStore.getState().logs
    expect(logs.length).toBe(35)
    expect(logs[logs.length - 1].message).toBe('Evento 39')
  })
})

describe('useMidi - Estabilidad Referencial del Retorno (F12.3/R1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete (navigator as unknown as { requestMIDIAccess?: unknown }).requestMIDIAccess
    useTelemetryStore.setState({ logs: [] })
  })

  it('dos re-renders sin cambios de estado devuelven la misma referencia de objeto y de métodos clave', async () => {
    const { access } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result, rerender } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    const first = result.current
    rerender()

    expect(result.current).toBe(first)
    expect(result.current.sendNote).toBe(first.sendNote)
    expect(result.current.sendAllNotesOff).toBe(first.sendAllNotesOff)
    expect(result.current.changeProgram).toBe(first.changeProgram)
    expect(result.current.clearAllPressedNotes).toBe(first.clearAllPressedNotes)
    expect(result.current.addLog).toBe(first.addLog)
  })

  it('un cambio de estado reactivo (Note On) produce identidad nueva y pressedNotes fresco', async () => {
    const { access, mockInput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    const before = result.current

    act(() => {
      mockInput.onmidimessage?.({ data: new Uint8Array([0x90, 64, 100]) })
    })

    expect(result.current).not.toBe(before)
    expect(result.current.pressedNotes).toContain(64)
  })

  it('sendNote emite por el puerto vigente tras cambiar selectedOutputId y mantiene identidad ante cambios de estado ajenos', async () => {
    const { access, mockInput, mockOutput } = createMockMidiAccess()

    const secondOutput: MockMidiOutput = {
      id: 'second-out-id',
      name: 'Second Interface',
      state: 'connected',
      type: 'output',
      send: vi.fn()
    }
    access.outputs.set('second-out-id', secondOutput)

    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    const beforePortChange = result.current

    act(() => {
      result.current.setSelectedOutputId('second-out-id')
    })

    // El cambio de puerto reactivo invalida la identidad del retorno (valor fresco)
    expect(result.current).not.toBe(beforePortChange)
    expect(result.current.selectedOutputId).toBe('second-out-id')

    act(() => {
      result.current.sendNote(60, 500)
    })
    // El método opera sobre el puerto vigente, no sobre el capturado previamente
    expect(secondOutput.send).toHaveBeenCalledWith([0x90, 60, 100])
    expect(mockOutput.send).not.toHaveBeenCalledWith([0x90, 60, 100])

    // Un cambio de estado ajeno a las deps de sendNote (pressedNotes) NO altera
    // la identidad del método: este sigue operando correctamente
    const sendNoteAfterPortChange = result.current.sendNote

    act(() => {
      mockInput.onmidimessage?.({ data: new Uint8Array([0x90, 72, 100]) })
    })

    expect(result.current.sendNote).toBe(sendNoteAfterPortChange)

    act(() => {
      result.current.sendNote(72, 500)
    })
    expect(secondOutput.send).toHaveBeenCalledWith([0x90, 72, 100])
  })

  it('cada valor reactivo restante invalida la identidad del retorno con valor fresco', async () => {
    const { access, mockInput } = createMockMidiAccess()
    ;(navigator as unknown as { requestMIDIAccess: unknown }).requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access)

    const { result } = renderHook(() => useMidi())

    await act(async () => {
      await Promise.resolve()
    })

    // selectedInputId
    const beforeInput = result.current
    act(() => {
      result.current.setSelectedInputId('other-in-id')
    })
    expect(result.current).not.toBe(beforeInput)
    expect(result.current.selectedInputId).toBe('other-in-id')

    // activeStimulusNotes (sendNote en Canal 1 melódico)
    const beforeStimulus = result.current
    act(() => {
      result.current.sendNote(60, 500)
    })
    expect(result.current).not.toBe(beforeStimulus)
    expect(result.current.activeStimulusNotes).toContain(60)

    // Desconexión total: status, isDeviceDisconnected e inputs cambian juntos
    // (transición real de dispositivo)
    const beforeDisconnect = result.current
    act(() => {
      access.inputs.clear()
      access.onstatechange?.()
    })
    expect(result.current).not.toBe(beforeDisconnect)
    expect(result.current.isDeviceDisconnected).toBe(true)
    expect(result.current.inputs).toEqual([])
    expect(result.current.status).toContain('desconectado')

    // Reconexión: status, isDeviceDisconnected, inputs y outputs frescos
    const beforeReconnect = result.current
    act(() => {
      access.inputs.set('um-one-in-id', mockInput)
      access.onstatechange?.()
    })
    expect(result.current).not.toBe(beforeReconnect)
    expect(result.current.isDeviceDisconnected).toBe(false)
    expect(result.current.inputs.length).toBe(1)
    expect(result.current.outputs.length).toBe(1)
    expect(result.current.status).toContain('conectado')
  })
})
