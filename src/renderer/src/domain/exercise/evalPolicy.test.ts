import { describe, it, expect } from 'vitest'
import { DEFAULT_EVALUATION_POLICY, checkNoteMatch, sanitizeResponseTime } from './evalPolicy'

describe('s1-eval-policy - Política Musical Determinista', () => {
  it('checkNoteMatch debe exigir octava exacta cuando strictOctave es true', () => {
    // C4 (60) vs C5 (72)
    expect(checkNoteMatch(60, 60, DEFAULT_EVALUATION_POLICY)).toBe(true)
    expect(checkNoteMatch(60, 72, DEFAULT_EVALUATION_POLICY)).toBe(false)
  })

  it('checkNoteMatch debe aceptar equivalencia de octava cuando strictOctave es false', () => {
    const flexiblePolicy = { ...DEFAULT_EVALUATION_POLICY, strictOctave: false }
    // C4 (60) y C5 (72) tienen la misma clase de altura (C)
    expect(checkNoteMatch(60, 72, flexiblePolicy)).toBe(true)
    expect(checkNoteMatch(60, 61, flexiblePolicy)).toBe(false)
  })

  it('sanitizeResponseTime debe acotar tiempos inválidos o menores al umbral mínimo', () => {
    expect(sanitizeResponseTime(-500)).toBe(50)
    expect(sanitizeResponseTime(NaN)).toBe(50)
    expect(sanitizeResponseTime(45000)).toBe(30000)
    expect(sanitizeResponseTime(1450.7)).toBe(1451)
  })
})
