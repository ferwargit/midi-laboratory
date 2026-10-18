import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { parseMidiData, ParsedMidiMessage } from '../services/midi/midiParser'
import { MidiInputFilter } from '../services/midi/midiInputFilter'
import { DEFAULT_APP_CONFIG } from '../domain/ai/appConfig'
import { useTelemetryStore, MidiLogEntry } from '../stores/useTelemetryStore'

// Compatibilidad de imports: el tipo canónico vive en el store de telemetría
// (fuente única de verdad del buffer), pero los consumidores existentes lo
// importan desde este módulo.
export type { MidiLogEntry }

export interface UseMidiOptions {
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
  addLog: (entry: Omit<MidiLogEntry, 'id' | 'time'>) => void
  sendNote: (noteNumber: number, durationMs?: number, velocity?: number, channel?: number) => void
  changeProgram: (programNumber: number, channel?: number) => void
  clearAllPressedNotes: () => void
  sendAllNotesOff: (channel?: number) => void
}

const ACTIVE_MIDI_CHANNELS = [1, 10] as const

// Canal melódico canónico (Piano Acústico). Solo sus notas constituyen pista
// visual de estímulo (activeStimulusNotes); el Canal 10 (Metrónomo GM) suena
// pero nunca ilumina el teclado.
const MELODIC_CHANNEL = 1

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

  // SSOT: Consumo de constantes centralizadas
  const filterRef = useRef<MidiInputFilter>(
    new MidiInputFilter(DEFAULT_APP_CONFIG.midi.debounceWindowMs)
  )
  const hungNotesTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const stimulusTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
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

  // Fachada de escritura sobre el store de telemetría: el buffer NO vive en
  // el estado de este hook ni del componente raíz, de modo que un evento de
  // log no re-renderiza el árbol (auditoría V8, F12.1). Se usa getState()
  // para no suscribir el hook al buffer.
  const addLog = useCallback((entry: Omit<MidiLogEntry, 'id' | 'time'>): void => {
    useTelemetryStore.getState().addLog(entry)
  }, [])

  const sendAllNotesOff = useCallback(
    (channel?: number): void => {
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

      const channels = channel === undefined ? ACTIVE_MIDI_CHANNELS : [channel]

      try {
        for (const ch of channels) {
          const chByte = (ch - 1) & 0x0f
          const ccStatus = 0xb0 | chByte

          outputPort.send([ccStatus, 120, 0])
          outputPort.send([ccStatus, 123, 0])
          outputPort.send([ccStatus, 64, 0])
          outputPort.send([ccStatus, 121, 0])
          outputPort.send([0xe0 | chByte, 0x00, 0x40])

          for (let note = 21; note <= 108; note++) {
            outputPort.send([0x80 | chByte, note, 0])
          }
        }
      } catch (err) {
        console.warn('[useMidi] Error al emitir MIDI Panic:', err)
      }
    },
    [midiAccess, selectedOutputId, isDeviceDisconnected]
  )

  // Referencia siempre vigente a la última versión de sendAllNotesOff: el
  // efecto de pánico de desmontaje (deps []) la invoca sin re-ejecutarse en
  // cada transición de dispositivo (hallazgo F11.3 de la auditoría V8).
  const sendAllNotesOffRef = useRef(sendAllNotesOff)

  // Sincronización en cada render (efecto sin guard de montaje), siguiendo el
  // patrón de las refs de callbacks del hook. Declarado tras sendAllNotesOff
  // para no acceder a la variable antes de su declaración (react-hooks).
  useEffect(() => {
    sendAllNotesOffRef.current = sendAllNotesOff
  })

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
    let access: MIDIAccess | null = null

    // Handler nombrado y estable: la misma referencia se usa en el registro y
    // en el desregistro, garantizando la simetría del par add/remove.
    const handleStateChange = (): void => {
      if (isMounted && access) refreshPorts(access)
    }

    navigator
      .requestMIDIAccess({ sysex: false })
      .then((resolvedAccess) => {
        if (!isMounted) return
        access = resolvedAccess
        setMidiAccess(access)
        setStatus('Web MIDI conectado.')
        refreshPorts(access)

        access.addEventListener('statechange', handleStateChange)
      })
      .catch((err: Error) => {
        if (isMounted) setStatus(`Error MIDI: ${err.message}`)
      })

    return (): void => {
      isMounted = false
      // Desregistro simétrico: sin listeners zombi sobre el MIDIAccess.
      if (access) access.removeEventListener('statechange', handleStateChange)
    }
  }, [refreshPorts])

  // Pánico de seguridad exclusivo del desmonte final del hook: dependencias
  // vacías garantizan que el cleanup NO se re-ejecute ante cambios de
  // identidad de sendAllNotesOff (cambio de puerto, reconexión o fluctuación
  // del estado de conexión), eliminando la tormenta de ~180 mensajes MIDI por
  // transición (hallazgo F11.3 de la auditoría V8).
  useEffect(() => {
    return (): void => {
      sendAllNotesOffRef.current()
    }
  }, [])

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
      const timerKey = `${channel}_${noteNumber}` // 👈 Clave única por canal y nota
      const isMelodicStimulus = channel === MELODIC_CHANNEL

      if (stimulusTimersRef.current.has(timerKey)) {
        clearTimeout(stimulusTimersRef.current.get(timerKey)!)
        try {
          outputPort.send([0x80 | chByte, noteNumber, 0])
        } catch {
          // No-op
        }
      }

      // Note ON
      outputPort.send([0x90 | chByte, noteNumber, velocity])
      if (isMelodicStimulus) {
        setActiveStimulusNotes((prev) => (prev.includes(noteNumber) ? prev : [...prev, noteNumber]))
      }

      // Note OFF programado
      const timer = setTimeout(() => {
        try {
          outputPort.send([0x80 | chByte, noteNumber, 0])
        } catch {
          // No-op
        }
        if (isMelodicStimulus) {
          setActiveStimulusNotes((prev) => prev.filter((n) => n !== noteNumber))
        }
        stimulusTimersRef.current.delete(timerKey)
      }, durationMs)

      stimulusTimersRef.current.set(timerKey, timer)
    },
    [midiAccess, selectedOutputId, isDeviceDisconnected]
  )

  // Estabilidad referencial del retorno (auditoría V8, F12.3/R1): el objeto
  // UseMidiReturn se memoiza con las dependencias reactivas reales, de modo que
  // los consumidores (App, callbacks con `midi` en sus deps) no se invaliden en
  // cada ciclo de render. Los setters de useState son estables por garantía de
  // React y no figuran en las deps.
  return useMemo(
    () => ({
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
      addLog,
      sendNote,
      changeProgram,
      clearAllPressedNotes,
      sendAllNotesOff
    }),
    [
      status,
      inputs,
      outputs,
      selectedInputId,
      selectedOutputId,
      isDeviceDisconnected,
      pressedNotes,
      activeStimulusNotes,
      addLog,
      sendNote,
      changeProgram,
      clearAllPressedNotes,
      sendAllNotesOff
    ]
  )
}
