import { useState, useEffect, useCallback, useRef } from 'react'
import { parseMidiData, ParsedMidiMessage } from '../services/midi/midiParser'
import { MidiInputFilter } from '../services/midi/midiInputFilter'

export interface MidiLogEntry {
  id: number
  time: string
  type: 'IN' | 'OUT' | 'AI' | 'EVAL'
  message: string
  noteNumber?: number
  velocity?: number
}

interface UseMidiOptions {
  onNoteOn?: (noteNumber: number, velocity: number) => void
  onNoteOff?: (noteNumber: number) => void
  onDeviceDisconnected?: () => void
  onDeviceReconnected?: () => void
  enableSoftwareThru?: boolean
}

export interface UseMidiReturn {
  status: string
  inputs: MIDIInput[]
  outputs: MIDIOutput[]
  selectedInputId: string
  selectedOutputId: string
  isDeviceDisconnected: boolean
  setSelectedInputId: (id: string) => void
  setSelectedOutputId: (id: string) => void
  pressedNotes: number[]
  logs: MidiLogEntry[]
  addLog: (entry: Omit<MidiLogEntry, 'id' | 'time'>) => void
  sendNote: (noteNumber: number, durationMs?: number, velocity?: number) => void
  changeProgram: (programNumber: number, channel?: number) => void
  clearAllPressedNotes: () => void
}

export function useMidi({
  onNoteOn,
  onNoteOff,
  onDeviceDisconnected,
  onDeviceReconnected,
  enableSoftwareThru = true
}: UseMidiOptions = {}): UseMidiReturn {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null)
  const [inputs, setInputs] = useState<MIDIInput[]>([])
  const [outputs, setOutputs] = useState<MIDIOutput[]>([])
  const [selectedInputId, setSelectedInputId] = useState<string>('')
  const [selectedOutputId, setSelectedOutputId] = useState<string>('')
  const [isDeviceDisconnected, setIsDeviceDisconnected] = useState<boolean>(false)
  const [pressedNotes, setPressedNotes] = useState<number[]>([])
  const [status, setStatus] = useState<string>(() =>
    typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
      ? 'Iniciando Web MIDI...'
      : 'Error: Web MIDI API no disponible'
  )
  const [logs, setLogs] = useState<MidiLogEntry[]>([])

  const filterRef = useRef<MidiInputFilter>(new MidiInputFilter(35))
  const hungNotesTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map())
  const lastKnownInputNameRef = useRef<string>('UM-ONE')
  const previousConnectionStateRef = useRef<boolean | null>(null) // null = inicio, true = conectado, false = desconectado

  // Guardamos los callbacks en refs para evitar re-creación de refreshPorts
  const onNoteOnRef = useRef(onNoteOn)
  const onNoteOffRef = useRef(onNoteOff)
  const onDisconnectedRef = useRef(onDeviceDisconnected)
  const onReconnectedRef = useRef(onDeviceReconnected)

  useEffect(() => {
    onNoteOnRef.current = onNoteOn
    onNoteOffRef.current = onNoteOff
    onDisconnectedRef.current = onDeviceDisconnected
    onReconnectedRef.current = onDeviceReconnected
  })

  const addLog = useCallback((entry: Omit<MidiLogEntry, 'id' | 'time'>): void => {
    const now = new Date()
    const time = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now
      .getMilliseconds()
      .toString()
      .padStart(3, '0')}`

    setLogs((prev) => [...prev.slice(-35), { id: Date.now() + Math.random(), time, ...entry }])
  }, [])

  const clearAllPressedNotes = useCallback((): void => {
    setPressedNotes([])
    hungNotesTimersRef.current.forEach((t) => clearTimeout(t))
    hungNotesTimersRef.current.clear()
    filterRef.current.clearHistory()
  }, [])

  const refreshPorts = useCallback(
    (access: MIDIAccess): void => {
      const inPorts: MIDIInput[] = []
      const outPorts: MIDIOutput[] = []

      access.inputs.forEach((port) => inPorts.push(port))
      access.outputs.forEach((port) => outPorts.push(port))

      setInputs(inPorts)
      setOutputs(outPorts)

      // CASO 1: Desconexión de dispositivos
      if (inPorts.length === 0) {
        setIsDeviceDisconnected(true)
        setStatus('⚠️ Dispositivo MIDI desconectado')
        if (previousConnectionStateRef.current !== false) {
          previousConnectionStateRef.current = false
          if (onDisconnectedRef.current) onDisconnectedRef.current()
        }
        return
      }

      // CASO 2: Dispositivos presentes / Conectados
      const preferredIn =
        inPorts.find((p) =>
          p.name?.toUpperCase().includes(lastKnownInputNameRef.current.toUpperCase())
        ) || inPorts[0]

      const preferredOut =
        outPorts.find((p) =>
          p.name?.toUpperCase().includes(lastKnownInputNameRef.current.toUpperCase())
        ) || outPorts[0]

      if (preferredIn) {
        setSelectedInputId(preferredIn.id)
        if (preferredIn.name) lastKnownInputNameRef.current = preferredIn.name
      }
      if (preferredOut) {
        setSelectedOutputId(preferredOut.id)
      }

      setIsDeviceDisconnected(false)
      setStatus('Web MIDI conectado.')

      // Solo disparar evento de reconexión si PREVIAMENTE estaba desconectado (evita bucle al iniciar)
      if (previousConnectionStateRef.current === false) {
        if (onReconnectedRef.current) onReconnectedRef.current()
      }
      previousConnectionStateRef.current = true
    },
    [] // Array de dependencias vacío y estable
  )

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return

    let isMounted = true
    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        if (!isMounted) return
        setMidiAccess(access)
        setStatus('Web MIDI conectado.')
        refreshPorts(access)

        access.onstatechange = (): void => {
          if (isMounted) refreshPorts(access)
        }
      })
      .catch((err: Error) => {
        if (isMounted) setStatus(`Error MIDI: ${err.message}`)
      })

    return (): void => {
      isMounted = false
    }
  }, [refreshPorts])

  useEffect(() => {
    if (!midiAccess || !selectedInputId || isDeviceDisconnected) return

    const inputPort = midiAccess.inputs.get(selectedInputId)
    if (!inputPort) return

    const handleMessage = (event: MIDIMessageEvent): void => {
      const data = event.data
      if (!data) return

      if (enableSoftwareThru && selectedOutputId) {
        const outPort = midiAccess.outputs.get(selectedOutputId)
        if (outPort) outPort.send(data)
      }

      const parsed: ParsedMidiMessage | null = parseMidiData(data)
      if (!parsed) return

      if (parsed.isNoteOn) {
        const filtered = filterRef.current.processNoteOn(parsed.noteNumber, parsed.velocity)
        if (filtered.isDebouncedDuplicate) {
          return
        }

        if (hungNotesTimersRef.current.has(parsed.noteNumber)) {
          clearTimeout(hungNotesTimersRef.current.get(parsed.noteNumber)!)
        }

        const watchdog = setTimeout(() => {
          setPressedNotes((prev) => prev.filter((n) => n !== parsed.noteNumber))
          hungNotesTimersRef.current.delete(parsed.noteNumber)
        }, 6000)

        hungNotesTimersRef.current.set(parsed.noteNumber, watchdog)

        setPressedNotes((prev) =>
          prev.includes(parsed.noteNumber) ? prev : [...prev, parsed.noteNumber]
        )
        addLog({
          type: 'IN',
          message: `🎹 Tecla pulsada -> ${parsed.noteNumber}`,
          noteNumber: parsed.noteNumber,
          velocity: parsed.velocity
        })
        if (onNoteOnRef.current) onNoteOnRef.current(parsed.noteNumber, parsed.velocity)
      } else if (parsed.isNoteOff) {
        if (hungNotesTimersRef.current.has(parsed.noteNumber)) {
          clearTimeout(hungNotesTimersRef.current.get(parsed.noteNumber)!)
          hungNotesTimersRef.current.delete(parsed.noteNumber)
        }
        setPressedNotes((prev) => prev.filter((n) => n !== parsed.noteNumber))
        if (onNoteOffRef.current) onNoteOffRef.current(parsed.noteNumber)
      }
    }

    inputPort.onmidimessage = handleMessage
    return (): void => {
      inputPort.onmidimessage = null
    }
  }, [
    midiAccess,
    selectedInputId,
    selectedOutputId,
    isDeviceDisconnected,
    enableSoftwareThru,
    addLog
  ])

  const changeProgram = useCallback(
    (programNumber: number, channel = 1): void => {
      if (!midiAccess || !selectedOutputId || isDeviceDisconnected) return
      const outputPort = midiAccess.outputs.get(selectedOutputId)
      if (!outputPort) return

      const statusByte = 0xc0 | ((channel - 1) & 0x0f)
      outputPort.send([statusByte, programNumber])
    },
    [midiAccess, selectedOutputId, isDeviceDisconnected]
  )

  const sendNote = useCallback(
    (noteNumber: number, durationMs = 600, velocity = 100): void => {
      if (!midiAccess || !selectedOutputId || isDeviceDisconnected) return
      const outputPort = midiAccess.outputs.get(selectedOutputId)
      if (!outputPort) return

      outputPort.send([0x90, noteNumber, velocity])

      setTimeout(() => {
        outputPort.send([0x80, noteNumber, 0])
      }, durationMs)
    },
    [midiAccess, selectedOutputId, isDeviceDisconnected]
  )

  return {
    status,
    inputs,
    outputs,
    selectedInputId,
    selectedOutputId,
    isDeviceDisconnected,
    setSelectedInputId,
    setSelectedOutputId,
    pressedNotes,
    logs,
    addLog,
    sendNote,
    changeProgram,
    clearAllPressedNotes
  }
}
