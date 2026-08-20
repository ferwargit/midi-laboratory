import { describe, it, expect } from 'vitest'
import {
  calculateActiveStimulusNotes,
  StimulusSyncEvent,
  VISUAL_CUE_OPTIONS
} from './visualAudioSync'

describe('s4-visual-audio-sync - Sincronización Audiovisual del Estímulo', () => {
  const baseTime = 1000
  const mockEvent: StimulusSyncEvent = {
    noteNumber: 60, // C4
    durationMs: 500,
    startedAt: baseTime,
    expiresAt: baseTime + 500
  }

  it('blind mode suppresses stimulus highlight: en modo a ciegas nunca se ilumina la tecla durante el sonido', () => {
    // Mientras la nota está sonando (a los 200 ms)
    const activeNotes = calculateActiveStimulusNotes([mockEvent], 'blind', baseTime + 200)
    expect(activeNotes).toEqual([])
  })

  it('assisted mode enables stimulus highlight: en modo asistido la tecla se ilumina mientras suena', () => {
    // A los 250 ms (dentro de los 500 ms de duración)
    const activeNotes = calculateActiveStimulusNotes([mockEvent], 'assisted', baseTime + 250)
    expect(activeNotes).toEqual([60])
  })

  it('stimulus off clears visual highlight: una vez expirada la duración (Note Off), la tecla se apaga', () => {
    // A los 501 ms (después del Note Off)
    const activeNotes = calculateActiveStimulusNotes([mockEvent], 'assisted', baseTime + 501)
    expect(activeNotes).toEqual([])
  })

  it('debe contener las opciones pedagógicas formalmente declaradas', () => {
    expect(VISUAL_CUE_OPTIONS.length).toBe(2)
    expect(VISUAL_CUE_OPTIONS.map((o) => o.id)).toContain('blind')
    expect(VISUAL_CUE_OPTIONS.map((o) => o.id)).toContain('assisted')
  })
})
