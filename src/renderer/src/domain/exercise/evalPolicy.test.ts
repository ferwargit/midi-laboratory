import { describe, it, expect } from 'vitest'
import {
  DEFAULT_EVALUATION_POLICY,
  checkNoteMatch,
  checkEnharmonicTextMatch,
  calculateNormalizedDistance,
  sanitizeResponseTime
} from './evalPolicy'

describe('s1-eval-policy - Política Musical Determinista', () => {
  it('enharmonic accepted when policy says so: acepta equivalencia enarmónica por defecto', () => {
    // C# y Db son enarmónicamente equivalentes
    expect(checkEnharmonicTextMatch('C#4', 'Db4', DEFAULT_EVALUATION_POLICY)).toBe(true)
    expect(checkEnharmonicTextMatch('F#', 'Gb', DEFAULT_EVALUATION_POLICY)).toBe(true)
    // Coincidencia acústica por nota MIDI 61
    expect(checkNoteMatch(61, 61, DEFAULT_EVALUATION_POLICY)).toBe(true)
  })

  it('enharmonic rejected when policy is strict: rechaza enarmonía si la política es estricta', () => {
    const strictPolicy = { ...DEFAULT_EVALUATION_POLICY, acceptEnharmonics: false }
    expect(checkEnharmonicTextMatch('C#4', 'Db4', strictPolicy)).toBe(false)
    expect(checkEnharmonicTextMatch('C#4', 'C#4', strictPolicy)).toBe(true)
  })

  it('distance normalized: calcula la distancia lineal y la distancia normalizada de clase de tono (mod 12)', () => {
    // C4 (60) a D4 (62) -> +2 semitonos
    const d1 = calculateNormalizedDistance(60, 62)
    expect(d1.rawDistance).toBe(2)
    expect(d1.pitchClassDistance).toBe(2)

    // C4 (60) a B3 (59) -> -1 semitono
    const d2 = calculateNormalizedDistance(60, 59)
    expect(d2.rawDistance).toBe(-1)
    expect(d2.pitchClassDistance).toBe(-1)

    // C4 (60) a C5 (72) -> 12 semitonos absolutos, pero 0 distancia de clase de tono
    const d3 = calculateNormalizedDistance(60, 72)
    expect(d3.rawDistance).toBe(12)
    expect(d3.pitchClassDistance).toBe(0)
  })

  it('invalid response time clamped: acota tiempos negativos, NaN, infinitos y extremos', () => {
    expect(sanitizeResponseTime(-300)).toBe(50)
    expect(sanitizeResponseTime(NaN)).toBe(50)
    expect(sanitizeResponseTime(Infinity)).toBe(30000)
    expect(sanitizeResponseTime(45000)).toBe(30000)
    expect(sanitizeResponseTime(1250.4)).toBe(1250)
  })
})
