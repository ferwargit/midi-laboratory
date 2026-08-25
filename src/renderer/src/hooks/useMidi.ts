import { useState, useEffect, useCallback, useRef } from 'react'
import { parseMidiData, ParsedMidiMessage } from '../services/midi/midiParser'
import { MidiInputFilter } from '../services/midi/midiInputFilter'
import { DEFAULT_APP_CONFIG } from '../domain/ai/appConfig'

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
  activeStimulusNotes: number[]
  logs: MidiLogEntry[]
  addLog: (entry: Omit<MidiLogEntry, 'id' | 'time'>) => void
  sendNote: (noteNumber: number, durationMs?: number, velocity?: number, channel?: number) => void
  changeProgram: (programNumber: number, channel?: number) => void
  clearAllPressedNotes: () => void
  sendAllNotesOff: (channel?: number) => void
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
  const [activeStimulusNotes, setActiveStimulusNotes] = useState<number[]>([])
  const [status, setStatus] = useState<string>(() =>
    typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
      ? 'Iniciando Web MIDI...'
      : 'Error: Web MIDI API no disponible'
  )
  const [logs, setLogs] = useState<MidiLogEntry[]>([])

  // SSOT: Consumo de constantes centralizadas
  const filterRef = useRef<MidiInputFilter>(
    new MidiInputFilter(DEFAULT_APP_CONFIG.midi.debounceWindowMs)
  )
  const hungNotesTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map())
  const stimulusTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map())
  const lastKnownInputNameRef = useRef<string>('UM-ONE')
  const previousConnectionStateRef = useRef<boolean | null>(null)

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

    setLogs((prev) => [...prev, { id: Date.now() + Math.random(), time, ...entry }].slice(-35))
  }, [])

  const sendAllNotesOff = useCallback(
    (channel = 1): void => {
      stimulusTimersRef.current.forEach((t) => clearTimeout(t))
      stimulusTimersRef.current.clear()

      hungNotesTimersRef.current.forEach((t) => clearTimeout(t))
      hungNotesTimersRef.current.clear()

      filterRef.current.clearHistory()
      setPressedNotes([])
      setActiveStimulusNotes([])

      if (!midiAccess || !selectedOutputId || isDeviceDisconnected) return
      const outputPort = midiAccess.outputs.get(selectedOutputId)
      if (!outputPort) return

      const chByte = (channel - 1) & 0x0f
      const ccStatus = 0xb0 | chByte

      try {
        outputPort.send([ccStatus, 120, 0])
        outputPort.send([ccStatus, 123, 0])
        outputPort.send([ccStatus, 64, 0])

        for (let note = 21; note <= 108; note++) {
          outputPort.send([0x80 | chByte, note, 0])
        }
      } catch (err) {
        console.warn('[useMidi] Error al emitir MIDI Panic:', err)
      }
    },
    [midiAccess, selectedOutputId, isDeviceDisconnected]
  )

  const clearAllPressedNotes = useCallback((): void => {
    sendAllNotesOff()
  }, [sendAllNotesOff])

  const refreshPorts = useCallback((access: MIDIAccess): void => {
    const inPorts: MIDIInput[] = []
    const outPorts: MIDIOutput[] = []

    access.inputs.forEach((port) => inPorts.push(port))
    access.outputs.forEach((port) => outPorts.push(port))

    setInputs(inPorts)
    setOutputs(outPorts)

    if (inPorts.length === 0) {
      setIsDeviceDisconnected(true)
      setStatus('⚠️ Dispositivo MIDI desconectado')
      if (previousConnectionStateRef.current !== false) {
        previousConnectionStateRef.current = false
        if (onDisconnectedRef.current) onDisconnectedRef.current()
      }
      return
    }

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

    if (previousConnectionStateRef.current === false) {
      if (onReconnectedRef.current) onReconnectedRef.current()
    }
    previousConnectionStateRef.current = true
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
    return (): void => {
      sendAllNotesOff()
    }
  }, [sendAllNotesOff])

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

        // Watchdog configurado desde appConfig
        const watchdog = setTimeout(() => {
          setPressedNotes((prev) => prev.filter((n) => n !== parsed.noteNumber))
          hungNotesTimersRef.current.delete(parsed.noteNumber)
        }, DEFAULT_APP_CONFIG.midi.hungNoteWatchdogMs)

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

      sendAllNotesOff(channel)

      const statusByte = 0xc0 | ((channel - 1) & 0x0f)
      outputPort.send([statusByte, programNumber])
    },
    [midiAccess, selectedOutputId, isDeviceDisconnected, sendAllNotesOff]
  )

  const sendNote = useCallback(
    (noteNumber: number, durationMs = 600, velocity = 100, channel = 1): void => {
      if (!midiAccess || !selectedOutputId || isDeviceDisconnected) return
      const outputPort = midiAccess.outputs.get(selectedOutputId)
      if (!outputPort) return

      const chByte = (channel - 1) & 0x0f

      // Si esta misma nota ya estaba sonando, enviamos Note Off inmediato para evitar solapamiento
      if (stimulusTimersRef.current.has(noteNumber)) {
        clearTimeout(stimulusTimersRef.current.get(noteNumber)!)
        try {
          outputPort.send([0x80 | chByte, noteNumber, 0])
        } catch {
          // No-op
        }
      }

      // Note ON
      outputPort.send([0x90 | chByte, noteNumber, velocity])
      setActiveStimulusNotes((prev) => (prev.includes(noteNumber) ? prev : [...prev, noteNumber]))

      // Note OFF programado
      const timer = setTimeout(() => {
        try {
          outputPort.send([0x80 | chByte, noteNumber, 0])
        } catch {
          // No-op
        }
        setActiveStimulusNotes((prev) => prev.filter((n) => n !== noteNumber))
        stimulusTimersRef.current.delete(noteNumber)
      }, durationMs)

      stimulusTimersRef.current.set(noteNumber, timer)
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
    activeStimulusNotes,
    logs,
    addLog,
    sendNote,
    changeProgram,
    clearAllPressedNotes,
    sendAllNotesOff
  }
}
