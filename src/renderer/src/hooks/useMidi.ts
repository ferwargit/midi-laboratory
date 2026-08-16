import { useState, useEffect, useCallback } from 'react'
import { parseMidiData, ParsedMidiMessage } from '../services/midi/midiParser'

export interface MidiLogEntry {
  id: number
  time: string
  type: 'IN' | 'OUT'
  message: string
  noteNumber?: number
  velocity?: number
}

interface UseMidiOptions {
  onNoteOn?: (noteNumber: number, velocity: number) => void
  enableSoftwareThru?: boolean
}

export interface UseMidiReturn {
  status: string
  inputs: MIDIInput[]
  outputs: MIDIOutput[]
  selectedInputId: string
  selectedOutputId: string
  setSelectedInputId: (id: string) => void
  setSelectedOutputId: (id: string) => void
  logs: MidiLogEntry[]
  sendNote: (noteNumber: number, durationMs?: number, velocity?: number) => void
}

export function useMidi({
  onNoteOn,
  enableSoftwareThru = true
}: UseMidiOptions = {}): UseMidiReturn {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null)
  const [inputs, setInputs] = useState<MIDIInput[]>([])
  const [outputs, setOutputs] = useState<MIDIOutput[]>([])
  const [selectedInputId, setSelectedInputId] = useState<string>('')
  const [selectedOutputId, setSelectedOutputId] = useState<string>('')
  const [status, setStatus] = useState<string>(() =>
    typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
      ? 'Iniciando Web MIDI...'
      : 'Error: Web MIDI API no disponible'
  )
  const [logs, setLogs] = useState<MidiLogEntry[]>([])

  const addLog = useCallback((entry: Omit<MidiLogEntry, 'id' | 'time'>): void => {
    const now = new Date()
    const time = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now
      .getMilliseconds()
      .toString()
      .padStart(3, '0')}`

    setLogs((prev) => [...prev.slice(-25), { id: Date.now() + Math.random(), time, ...entry }])
  }, [])

  const refreshPorts = useCallback((access: MIDIAccess): void => {
    const inPorts: MIDIInput[] = []
    const outPorts: MIDIOutput[] = []

    access.inputs.forEach((port) => inPorts.push(port))
    access.outputs.forEach((port) => outPorts.push(port))

    setInputs(inPorts)
    setOutputs(outPorts)

    if (inPorts.length > 0) {
      const umOneIn = inPorts.find((p) => p.name?.toUpperCase().includes('UM-ONE'))
      setSelectedInputId(umOneIn ? umOneIn.id : inPorts[0].id)
    }

    if (outPorts.length > 0) {
      const umOneOut = outPorts.find((p) => p.name?.toUpperCase().includes('UM-ONE'))
      setSelectedOutputId(umOneOut ? umOneOut.id : outPorts[0].id)
    }
  }, [])

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
    if (!midiAccess || !selectedInputId) return

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
        addLog({
          type: 'IN',
          message: `Note ON -> ${parsed.noteNumber}`,
          noteNumber: parsed.noteNumber,
          velocity: parsed.velocity
        })
        if (onNoteOn) onNoteOn(parsed.noteNumber, parsed.velocity)
      } else if (parsed.isNoteOff) {
        addLog({
          type: 'IN',
          message: `Note OFF -> ${parsed.noteNumber}`,
          noteNumber: parsed.noteNumber,
          velocity: 0
        })
      }
    }

    inputPort.onmidimessage = handleMessage
    return (): void => {
      inputPort.onmidimessage = null
    }
  }, [midiAccess, selectedInputId, selectedOutputId, enableSoftwareThru, onNoteOn, addLog])

  const sendNote = useCallback(
    (noteNumber: number, durationMs = 600, velocity = 100): void => {
      if (!midiAccess || !selectedOutputId) return
      const outputPort = midiAccess.outputs.get(selectedOutputId)
      if (!outputPort) return

      outputPort.send([0x90, noteNumber, velocity])
      addLog({
        type: 'OUT',
        message: `Estímulo -> ${noteNumber}`,
        noteNumber,
        velocity
      })

      setTimeout(() => {
        outputPort.send([0x80, noteNumber, 0])
      }, durationMs)
    },
    [midiAccess, selectedOutputId, addLog]
  )

  return {
    status,
    inputs,
    outputs,
    selectedInputId,
    selectedOutputId,
    setSelectedInputId,
    setSelectedOutputId,
    logs,
    sendNote
  }
}
