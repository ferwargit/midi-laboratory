import { describe, it, expect, beforeEach } from 'vitest'
import { useTelemetryStore, MidiLogEntry } from './useTelemetryStore'

type LogInput = Omit<MidiLogEntry, 'id' | 'time'>

describe('useTelemetryStore - Contrato del Buffer de Telemetría MIDI', () => {
  beforeEach(() => {
    // Reset del store entre tests para evitar contaminación cruzada por el
    // orden de ejecución (el buffer es global y efímero, en memoria).
    useTelemetryStore.setState({ logs: [] })
  })

  it('addLog preserva el tipo y el mensaje de la entrada y añade sello temporal HH:MM:SS.mmm', () => {
    const input: LogInput = {
      type: 'IN',
      message: '🎹 Tecla pulsada -> 60',
      noteNumber: 60,
      velocity: 90
    }

    useTelemetryStore.getState().addLog(input)

    const logs = useTelemetryStore.getState().logs
    expect(logs).toHaveLength(1)

    const entry = logs[0]
    expect(entry.type).toBe('IN')
    expect(entry.message).toBe('🎹 Tecla pulsada -> 60')
    expect(entry.noteNumber).toBe(60)
    expect(entry.velocity).toBe(90)

    // Sello temporal con formato HH:MM:SS.mmm
    expect(entry.time).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/)
  })

  it('addLog acepta las cuatro categorías tipadas IN | OUT | AI | EVAL', () => {
    const types: LogInput['type'][] = ['IN', 'OUT', 'AI', 'EVAL']

    types.forEach((type) => {
      useTelemetryStore.getState().addLog({ type, message: `Evento ${type}` })
    })

    const logs = useTelemetryStore.getState().logs
    expect(logs.map((l) => l.type)).toEqual(['IN', 'OUT', 'AI', 'EVAL'])
  })

  it('dos entradas consecutivas nunca comparten identificador', () => {
    useTelemetryStore.getState().addLog({ type: 'OUT', message: 'A' })
    useTelemetryStore.getState().addLog({ type: 'OUT', message: 'B' })
    useTelemetryStore.getState().addLog({ type: 'OUT', message: 'C' })

    const logs = useTelemetryStore.getState().logs
    const ids = logs.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('la ventana deslizante recorta el historial a los últimos 35 eventos', () => {
    for (let i = 1; i <= 40; i++) {
      useTelemetryStore.getState().addLog({ type: 'EVAL', message: `Evento ${i}` })
    }

    const logs = useTelemetryStore.getState().logs
    expect(logs).toHaveLength(35)
    expect(logs[0].message).toBe('Evento 6')
    expect(logs[logs.length - 1].message).toBe('Evento 40')
  })
})
