import React, { useEffect, useState, useRef, useCallback } from 'react'

interface MidiLog {
  id: number
  time: string
  type: 'IN' | 'OUT'
  message: string
  noteName?: string
  noteNumber?: number
  velocity?: number
}

function midiNoteToName(midiNumber: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midiNumber / 12) - 1
  const noteIndex = midiNumber % 12
  return `${noteNames[noteIndex]}${octave}`
}

export default function App(): React.ReactElement {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null)
  const [inputs, setInputs] = useState<MIDIInput[]>([])
  const [outputs, setOutputs] = useState<MIDIOutput[]>([])
  const [selectedInputId, setSelectedInputId] = useState<string>('')
  const [selectedOutputId, setSelectedOutputId] = useState<string>('')
  const [status, setStatus] = useState<string>(() =>
    typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
      ? 'Iniciando Web MIDI...'
      : 'Error: Web MIDI API no está disponible en este entorno.'
  )
  const [lastNote, setLastNote] = useState<{
    name: string
    number: number
    velocity: number
  } | null>(null)
  const [logs, setLogs] = useState<MidiLog[]>([])

  const logsEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((entry: Omit<MidiLog, 'id' | 'time'>): void => {
    const now = new Date()
    const time = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now
      .getMilliseconds()
      .toString()
      .padStart(3, '0')}`

    setLogs((prev) => [...prev.slice(-20), { id: Date.now() + Math.random(), time, ...entry }])
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
    if (!navigator.requestMIDIAccess) {
      return
    }

    let isMounted = true

    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        if (!isMounted) return
        setMidiAccess(access)
        setStatus('Web MIDI conectado exitosamente.')
        refreshPorts(access)

        access.onstatechange = (): void => {
          if (isMounted) {
            refreshPorts(access)
          }
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setStatus(`Error al solicitar acceso MIDI: ${err.message}`)
        }
      })

    return (): void => {
      isMounted = false
    }
  }, [refreshPorts])

  useEffect(() => {
    if (!midiAccess || !selectedInputId) return

    const inputPort = midiAccess.inputs.get(selectedInputId)
    if (!inputPort) return

    const handleMidiMessage = (event: MIDIMessageEvent): void => {
      const data = event.data
      if (!data || data.length < 3) return

      const statusByte = data[0]
      const command = statusByte >> 4
      const noteNumber = data[1]
      const velocity = data[2]

      // Reenvío inmediato al Korg (MIDI Thru por software)
      const outPort = selectedOutputId ? midiAccess.outputs.get(selectedOutputId) : null
      if (outPort) {
        outPort.send(data)
      }

      if (command === 9 && velocity > 0) {
        const noteName = midiNoteToName(noteNumber)
        setLastNote({ name: noteName, number: noteNumber, velocity })
        addLog({
          type: 'IN',
          message: `Note ON -> ${noteName} (${noteNumber})`,
          noteName,
          noteNumber,
          velocity
        })
      } else if (command === 8 || (command === 9 && velocity === 0)) {
        const noteName = midiNoteToName(noteNumber)
        addLog({
          type: 'IN',
          message: `Note OFF -> ${noteName} (${noteNumber})`,
          noteName,
          noteNumber,
          velocity: 0
        })
      }
    }

    inputPort.onmidimessage = handleMidiMessage

    return (): void => {
      inputPort.onmidimessage = null
    }
  }, [midiAccess, selectedInputId, selectedOutputId, addLog])

  const sendTestNote = (noteNumber = 60): void => {
    if (!midiAccess || !selectedOutputId) {
      setStatus('No hay puerto de salida seleccionado.')
      return
    }

    const outputPort = midiAccess.outputs.get(selectedOutputId)
    if (!outputPort) {
      setStatus('Puerto de salida no encontrado.')
      return
    }

    const noteName = midiNoteToName(noteNumber)
    outputPort.send([0x90, noteNumber, 100])
    addLog({
      type: 'OUT',
      message: `Enviado Note ON -> ${noteName} (${noteNumber})`,
      noteName,
      noteNumber,
      velocity: 100
    })

    setTimeout(() => {
      outputPort.send([0x80, noteNumber, 0])
      addLog({
        type: 'OUT',
        message: `Enviado Note OFF -> ${noteName} (${noteNumber})`,
        noteName,
        noteNumber,
        velocity: 0
      })
    }, 600)
  }

  return (
    <div
      style={{
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
        color: '#e0e0e0',
        backgroundColor: '#18181b',
        minHeight: '100vh'
      }}
    >
      <h2 style={{ margin: '0 0 16px 0', color: '#60a5fa' }}>🎹 MIDI Laboratory</h2>

      <div
        style={{
          background: '#27272a',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px'
        }}
      >
        <strong>Estado:</strong>{' '}
        <span style={{ color: status.includes('Error') ? '#ef4444' : '#4ade80' }}>{status}</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              color: '#a1a1aa'
            }}
          >
            Dispositivo de Entrada (FP-8 IN):
          </label>
          <select
            value={selectedInputId}
            onChange={(e): void => setSelectedInputId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              background: '#27272a',
              color: '#fff',
              border: '1px solid #3f3f46',
              borderRadius: '6px'
            }}
          >
            {inputs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '13px',
              color: '#a1a1aa'
            }}
          >
            Dispositivo de Salida (Korg OUT):
          </label>
          <select
            value={selectedOutputId}
            onChange={(e): void => setSelectedOutputId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              background: '#27272a',
              color: '#fff',
              border: '1px solid #3f3f46',
              borderRadius: '6px'
            }}
          >
            {outputs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          background: '#27272a',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}
      >
        <h4 style={{ margin: '0 0 12px 0', color: '#38bdf8' }}>
          1. Prueba de Salida (PC → FP-8 → Korg → Monitor):
        </h4>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={(): void => sendTestNote(60)}
            style={{
              padding: '10px 18px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Enviar C4 (Do Central)
          </button>
          <button
            onClick={(): void => sendTestNote(64)}
            style={{
              padding: '10px 18px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Enviar E4 (Mi)
          </button>
          <button
            onClick={(): void => sendTestNote(67)}
            style={{
              padding: '10px 18px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Enviar G4 (Sol)
          </button>
        </div>
      </div>

      <div
        style={{
          background: '#27272a',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}
      >
        <h4 style={{ margin: '0 0 12px 0', color: '#4ade80' }}>
          2. Prueba de Entrada (Tocá una tecla en el FP-8):
        </h4>
        {lastNote ? (
          <div style={{ fontSize: '20px' }}>
            Última tecla pulsada: <strong style={{ color: '#fbbf24' }}>{lastNote.name}</strong>
            <span style={{ fontSize: '14px', color: '#a1a1aa', marginLeft: '12px' }}>
              (MIDI Note: {lastNote.number} | Velocity: {lastNote.velocity})
            </span>
          </div>
        ) : (
          <div style={{ color: '#71717a' }}>
            Esperando a que toques alguna tecla en el teclado físico...
          </div>
        )}
      </div>

      <div
        style={{
          background: '#1c1917',
          padding: '14px',
          borderRadius: '8px',
          border: '1px solid #292524'
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#a8a29e' }}>
          Monitor MIDI en tiempo real:
        </h4>
        <div
          style={{
            height: '415px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}
        >
          {logs.map((log) => (
            <div
              key={log.id}
              style={{
                color: log.type === 'IN' ? '#86efac' : '#93c5fd',
                marginBottom: '3px'
              }}
            >
              [{log.time}] [{log.type}] {log.message}{' '}
              {log.velocity !== undefined ? `(Vel: ${log.velocity})` : ''}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  )
}
