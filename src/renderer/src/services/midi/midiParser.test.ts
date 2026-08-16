import { describe, it, expect } from 'vitest'
import { parseMidiData } from './midiParser'

describe('midiParser - Parser binario de mensajes MIDI', () => {
  it('debe parsear un Note On estándar en canal 1', () => {
    // 0x90 = Note On canal 1, 60 = C4, 100 = Velocity
    const raw = new Uint8Array([0x90, 60, 100])
    const parsed = parseMidiData(raw)

    expect(parsed).not.toBeNull()
    expect(parsed?.isNoteOn).toBe(true)
    expect(parsed?.isNoteOff).toBe(false)
    expect(parsed?.noteNumber).toBe(60)
    expect(parsed?.velocity).toBe(100)
    expect(parsed?.channel).toBe(1)
  })

  it('debe reconocer Note On con velocity 0 como Note Off', () => {
    const raw = new Uint8Array([0x90, 60, 0])
    const parsed = parseMidiData(raw)

    expect(parsed?.isNoteOn).toBe(false)
    expect(parsed?.isNoteOff).toBe(true)
  })

  it('debe devolver null si el paquete de datos es incompleto', () => {
    const raw = new Uint8Array([0x90])
    expect(parseMidiData(raw)).toBeNull()
  })
})
