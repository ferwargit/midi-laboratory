export interface ParsedMidiMessage {
  command: number
  channel: number
  noteNumber: number
  velocity: number
  isNoteOn: boolean
  isNoteOff: boolean
}

/**
 * Parsea un array de bytes MIDI en una estructura tipada.
 */
export function parseMidiData(data: Uint8Array): ParsedMidiMessage | null {
  if (!data || data.length < 3) return null

  const statusByte = data[0]
  const command = statusByte >> 4
  const channel = (statusByte & 0x0f) + 1
  const noteNumber = data[1]
  const velocity = data[2]

  const isNoteOn = command === 9 && velocity > 0
  const isNoteOff = command === 8 || (command === 9 && velocity === 0)

  return {
    command,
    channel,
    noteNumber,
    velocity,
    isNoteOn,
    isNoteOff
  }
}
