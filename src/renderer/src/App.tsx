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

interface ExerciseResult {
  expectedNote: number
  playedNote: number
  correct: boolean
  semitoneDistance: number
  responseTimeMs: number
}

function midiNoteToName(midiNumber: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midiNumber / 12) - 1
  const noteIndex = midiNumber % 12
  return `${noteNames[noteIndex]}${octave}`
}

function isBlackKey(midiNumber: number): boolean {
  const noteIndex = midiNumber % 12
  return [1, 3, 6, 8, 10].includes(noteIndex)
}

// Rango de teclas disponibles en el selector visual: C3 (48) a C6 (84)
const PIANO_KEYS = Array.from({ length: 37 }, (_, i) => 48 + i)

export default function App(): React.ReactElement {
  // 1. Estado MIDI
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null)
  const [inputs, setInputs] = useState<MIDIInput[]>([])
  const [outputs, setOutputs] = useState<MIDIOutput[]>([])
  const [selectedInputId, setSelectedInputId] = useState<string>('')
  const [selectedOutputId, setSelectedOutputId] = useState<string>('')
  const [status, setStatus] = useState<string>(() =>
    typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
      ? 'Iniciando Web MIDI...'
      : 'Error: Web MIDI API no está disponible.'
  )
  const [logs, setLogs] = useState<MidiLog[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  // 2. Configuración de Notas Activas
  const [activeNotes, setActiveNotes] = useState<number[]>([60, 62, 64, 65, 67, 69, 71, 72]) // C4 a C5 por defecto
  const [sessionLength, setSessionLength] = useState<number>(10)

  // 3. Estado de la Sesión de Entrenamiento
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [currentExpectedNote, setCurrentExpectedNote] = useState<number | null>(null)
  const [stimulusStartTime, setStimulusStartTime] = useState<number>(0)
  const [isWaitingAnswer, setIsWaitingAnswer] = useState<boolean>(false)
  const [lastResult, setLastResult] = useState<ExerciseResult | null>(null)
  const [sessionHistory, setSessionHistory] = useState<ExerciseResult[]>([])

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

  // Inicializar Web MIDI
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

  // Emitir sonido MIDI hacia el Korg
  const playMidiNote = useCallback(
    (noteNumber: number, durationMs = 600): void => {
      if (!midiAccess || !selectedOutputId) return
      const outputPort = midiAccess.outputs.get(selectedOutputId)
      if (!outputPort) return

      const noteName = midiNoteToName(noteNumber)
      outputPort.send([0x90, noteNumber, 100])
      addLog({
        type: 'OUT',
        message: `Estímulo -> ${noteName} (${noteNumber})`,
        noteName,
        noteNumber,
        velocity: 100
      })

      setTimeout(() => {
        outputPort.send([0x80, noteNumber, 0])
      }, durationMs)
    },
    [midiAccess, selectedOutputId, addLog]
  )

  // Generar siguiente ejercicio
  const triggerNextQuestion = useCallback((): void => {
    if (activeNotes.length < 2) return

    const randomNote = activeNotes[Math.floor(Math.random() * activeNotes.length)]
    setCurrentExpectedNote(randomNote)
    setLastResult(null)
    setIsWaitingAnswer(true)
    setStimulusStartTime(Date.now())

    playMidiNote(randomNote)
  }, [activeNotes, playMidiNote])

  // Iniciar Sesión
  const startSession = (): void => {
    if (activeNotes.length < 2) {
      alert('Debes seleccionar al menos 2 notas para entrenar.')
      return
    }
    setSessionHistory([])
    setCurrentQuestionIndex(1)
    setIsSessionActive(true)
    triggerNextQuestion()
  }

  // Detener Sesión
  const stopSession = (): void => {
    setIsSessionActive(false)
    setIsWaitingAnswer(false)
    setCurrentExpectedNote(null)
  }

  // Repetir nota actual
  const repeatCurrentNote = (): void => {
    if (currentExpectedNote !== null) {
      playMidiNote(currentExpectedNote)
    }
  }

  // Manejo de eventos MIDI entrantes (desde Roland FP-8)
  useEffect(() => {
    if (!midiAccess || !selectedInputId) return

    const inputPort = midiAccess.inputs.get(selectedInputId)
    if (!inputPort) return

    const handleMidiMessage = (event: MIDIMessageEvent): void => {
      const data = event.data
      if (!data || data.length < 3) return

      // MIDI Echo hacia el Korg para escuchar lo que se toca
      const outPort = selectedOutputId ? midiAccess.outputs.get(selectedOutputId) : null
      if (outPort) {
        outPort.send(data)
      }

      const statusByte = data[0]
      const command = statusByte >> 4
      const noteNumber = data[1]
      const velocity = data[2]

      if (command === 9 && velocity > 0) {
        const noteName = midiNoteToName(noteNumber)
        addLog({
          type: 'IN',
          message: `Pulsada -> ${noteName} (${noteNumber})`,
          noteName,
          noteNumber,
          velocity
        })

        // Evaluación si estamos esperando respuesta en la sesión
        if (isSessionActive && isWaitingAnswer && currentExpectedNote !== null) {
          const responseTimeMs = Date.now() - stimulusStartTime
          const correct = noteNumber === currentExpectedNote
          const semitoneDistance = noteNumber - currentExpectedNote

          const result: ExerciseResult = {
            expectedNote: currentExpectedNote,
            playedNote: noteNumber,
            correct,
            semitoneDistance,
            responseTimeMs
          }

          setLastResult(result)
          setSessionHistory((prev) => [...prev, result])
          setIsWaitingAnswer(false)

          // Avanzar o finalizar sesión
          setTimeout(() => {
            if (sessionLength > 0 && currentQuestionIndex >= sessionLength) {
              setIsSessionActive(false)
              setIsWaitingAnswer(false)
            } else {
              setCurrentQuestionIndex((prev) => prev + 1)
              triggerNextQuestion()
            }
          }, 1400)
        }
      }
    }

    inputPort.onmidimessage = handleMidiMessage
    return (): void => {
      inputPort.onmidimessage = null
    }
  }, [
    midiAccess,
    selectedInputId,
    selectedOutputId,
    addLog,
    isSessionActive,
    isWaitingAnswer,
    currentExpectedNote,
    stimulusStartTime,
    currentQuestionIndex,
    sessionLength,
    triggerNextQuestion
  ])

  // Presets de selección de notas
  const applyPreset = (notes: number[]): void => {
    setActiveNotes(notes)
  }

  const toggleNote = (note: number): void => {
    setActiveNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note].sort((a, b) => a - b)
    )
  }

  // Cálculos de estadísticas
  const totalAnswers = sessionHistory.length
  const correctAnswers = sessionHistory.filter((h) => h.correct).length
  const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0
  const avgResponseTime =
    totalAnswers > 0
      ? Math.round(sessionHistory.reduce((acc, h) => acc + h.responseTimeMs, 0) / totalAnswers)
      : 0

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: 'system-ui, sans-serif',
        color: '#e4e4e7',
        backgroundColor: '#09090b',
        minHeight: '100vh',
        boxSizing: 'border-box'
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}
      >
        <h2 style={{ margin: 0, color: '#38bdf8' }}>🎹 Entrenador Auditivo MIDI</h2>
        <div
          style={{
            fontSize: '13px',
            background: '#18181b',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #27272a'
          }}
        >
          <strong>MIDI:</strong>{' '}
          <span style={{ color: status.includes('Error') ? '#ef4444' : '#4ade80' }}>{status}</span>
        </div>
      </header>

      {/* Selectores de puertos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        <div>
          <label
            style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}
          >
            Entrada (FP-8 IN):
          </label>
          <select
            value={selectedInputId}
            onChange={(e): void => setSelectedInputId(e.target.value)}
            disabled={isSessionActive}
            style={{
              width: '100%',
              padding: '6px',
              background: '#18181b',
              color: '#fff',
              border: '1px solid #27272a',
              borderRadius: '4px'
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
            style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}
          >
            Salida (Korg OUT):
          </label>
          <select
            value={selectedOutputId}
            onChange={(e): void => setSelectedOutputId(e.target.value)}
            disabled={isSessionActive}
            style={{
              width: '100%',
              padding: '6px',
              background: '#18181b',
              color: '#fff',
              border: '1px solid #27272a',
              borderRadius: '4px'
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

      {/* PANEL DE ENTRENAMIENTO */}
      <div
        style={{
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}
        >
          <h3 style={{ margin: 0, color: '#f4f4f5' }}>
            {isSessionActive
              ? `Pregunta ${currentQuestionIndex} / ${sessionLength === 0 ? '∞' : sessionLength}`
              : 'Configuración del Entrenamiento'}
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            {!isSessionActive ? (
              <button
                onClick={startSession}
                style={{
                  padding: '8px 18px',
                  background: '#22c55e',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ▶ Comenzar Sesión
              </button>
            ) : (
              <>
                <button
                  onClick={repeatCurrentNote}
                  style={{
                    padding: '8px 14px',
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  🔊 Repetir Nota
                </button>
                <button
                  onClick={stopSession}
                  style={{
                    padding: '8px 14px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  ⏹ Detener
                </button>
              </>
            )}
          </div>
        </div>

        {/* FEEDBACK DEL RESULTADO */}
        {isSessionActive && (
          <div
            style={{
              textAlign: 'center',
              padding: '18px',
              background: '#09090b',
              borderRadius: '6px',
              marginBottom: '14px',
              border: '1px solid #27272a'
            }}
          >
            {isWaitingAnswer ? (
              <div style={{ fontSize: '18px', color: '#fbbf24' }}>
                👂 Escuchá el sonido y tocá la tecla en tu Roland FP-8...
              </div>
            ) : lastResult ? (
              <div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: lastResult.correct ? '#4ade80' : '#f87171'
                  }}
                >
                  {lastResult.correct ? '✅ ¡Correcto!' : '❌ Incorrecto'}
                </div>
                <div style={{ marginTop: '8px', fontSize: '15px', color: '#d4d4d8' }}>
                  Esperada: <strong>{midiNoteToName(lastResult.expectedNote)}</strong> | Tocaste:{' '}
                  <strong>{midiNoteToName(lastResult.playedNote)}</strong>
                  {!lastResult.correct && (
                    <span style={{ color: '#f87171', marginLeft: '10px' }}>
                      (Distancia:{' '}
                      {lastResult.semitoneDistance > 0
                        ? `+${lastResult.semitoneDistance}`
                        : lastResult.semitoneDistance}{' '}
                      semitonos)
                    </span>
                  )}
                  <span style={{ color: '#a1a1aa', marginLeft: '14px' }}>
                    ({(lastResult.responseTimeMs / 1000).toFixed(2)}s)
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* SELECTOR DE NOTAS Y PRESETS (Visible cuando no está activa la sesión) */}
        {!isSessionActive && (
          <>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>
                Presets Rápidos:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  onClick={(): void => applyPreset([60, 62, 64])}
                  style={{
                    padding: '6px 10px',
                    background: '#27272a',
                    color: '#fff',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Nivel 1 (C, D, E)
                </button>
                <button
                  onClick={(): void => applyPreset([60, 62, 64, 65, 67])}
                  style={{
                    padding: '6px 10px',
                    background: '#27272a',
                    color: '#fff',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Nivel 2 (C a G)
                </button>
                <button
                  onClick={(): void => applyPreset([60, 62, 64, 65, 67, 69, 71, 72])}
                  style={{
                    padding: '6px 10px',
                    background: '#27272a',
                    color: '#fff',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Nivel 3 (C4 a C5)
                </button>
                <button
                  onClick={(): void => applyPreset(Array.from({ length: 13 }, (_, i) => 60 + i))}
                  style={{
                    padding: '6px 10px',
                    background: '#27272a',
                    color: '#fff',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Nivel 4 (C4-C5 Cromático)
                </button>
                <button
                  onClick={(): void => applyPreset([60, 62, 64, 67, 69, 72])}
                  style={{
                    padding: '6px 10px',
                    background: '#27272a',
                    color: '#fff',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Pentatónica C Mayor
                </button>
                <button
                  onClick={(): void => applyPreset(Array.from({ length: 13 }, (_, i) => 67 + i))}
                  style={{
                    padding: '6px 10px',
                    background: '#27272a',
                    color: '#fff',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Rango G4 a G5
                </button>
                <button
                  onClick={(): void => setActiveNotes([])}
                  style={{
                    padding: '6px 10px',
                    background: '#7f1d1d',
                    color: '#fca5a5',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Limpiar Todo
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>
                Selección Libre de Teclas (C3 a C6 - {activeNotes.length} notas seleccionadas):
              </div>
              <div
                style={{
                  display: 'flex',
                  overflowX: 'auto',
                  padding: '8px 0',
                  gap: '3px',
                  background: '#09090b',
                  borderRadius: '6px',
                  border: '1px solid #27272a'
                }}
              >
                {PIANO_KEYS.map((note) => {
                  const active = activeNotes.includes(note)
                  const black = isBlackKey(note)
                  return (
                    <button
                      key={note}
                      onClick={(): void => toggleNote(note)}
                      title={`${midiNoteToName(note)} (${note})`}
                      style={{
                        flex: '0 0 28px',
                        height: black ? '65px' : '90px',
                        background: active ? '#0284c7' : black ? '#27272a' : '#f4f4f5',
                        color: active ? '#fff' : black ? '#a1a1aa' : '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '0 0 4px 4px',
                        cursor: 'pointer',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        paddingBottom: '4px',
                        textAlign: 'center'
                      }}
                    >
                      {midiNoteToName(note)}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '12px', color: '#a1a1aa' }}>Ejercicios por sesión:</label>
              <select
                value={sessionLength}
                onChange={(e): void => setSessionLength(Number(e.target.value))}
                style={{
                  padding: '4px 8px',
                  background: '#09090b',
                  color: '#fff',
                  border: '1px solid #27272a',
                  borderRadius: '4px'
                }}
              >
                <option value={5}>5 ejercicios</option>
                <option value={10}>10 ejercicios</option>
                <option value={20}>20 ejercicios</option>
                <option value={0}>Infinito (Práctica libre)</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* DASHBOARD DE ESTADÍSTICAS EN TIEMPO REAL */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        <div
          style={{
            background: '#18181b',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #27272a',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Respuestas</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{totalAnswers}</div>
        </div>
        <div
          style={{
            background: '#18181b',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #27272a',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Precisión</div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: accuracy >= 80 ? '#4ade80' : accuracy >= 50 ? '#facc15' : '#f87171'
            }}
          >
            {accuracy}%
          </div>
        </div>
        <div
          style={{
            background: '#18181b',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #27272a',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Aciertos / Fallos</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            <span style={{ color: '#4ade80' }}>{correctAnswers}</span> /{' '}
            <span style={{ color: '#f87171' }}>{totalAnswers - correctAnswers}</span>
          </div>
        </div>
        <div
          style={{
            background: '#18181b',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #27272a',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Tiempo Medio</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
            {(avgResponseTime / 1000).toFixed(2)}s
          </div>
        </div>
      </div>

      {/* MONITOR MIDI */}
      <div
        style={{
          background: '#18181b',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid #27272a'
        }}
      >
        <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>
          Monitor MIDI en tiempo real:
        </div>
        <div
          style={{ height: '140px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px' }}
        >
          {logs.map((log) => (
            <div
              key={log.id}
              style={{ color: log.type === 'IN' ? '#86efac' : '#93c5fd', marginBottom: '2px' }}
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
