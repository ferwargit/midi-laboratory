import { describe, it, expect } from 'vitest'
import {
  TONAL_CONTEXT_OPTIONS,
  getTonalContextSteps,
  getTotalContextDurationMs,
  generateCadenceSteps,
  getTonalContextDescription
} from './tonalContext'

describe('tonalContext - Protocolo de Anclaje Tonal Dinámico y Transportable', () => {
  it('debe contener las 4 opciones formales de contexto tonal', () => {
    expect(TONAL_CONTEXT_OPTIONS.length).toBe(4)
    const ids = TONAL_CONTEXT_OPTIONS.map((o) => o.id)
    expect(ids).toContain('none')
    expect(ids).toContain('cadence')
    expect(ids).toContain('tonic')
    expect(ids).toContain('drone')
  })

  it('generateCadenceSteps en Do Mayor (60) debe generar acordes I-IV-V7-I de C', () => {
    const cadenceC = generateCadenceSteps(60)
    expect(cadenceC.length).toBe(4)
    expect(cadenceC[0].notes).toEqual([60, 64, 67]) // C Mayor
    expect(cadenceC[1].notes).toEqual([57, 60, 65]) // F Mayor
    expect(cadenceC[2].notes).toEqual([59, 62, 65, 67]) // G7
    expect(cadenceC[3].notes).toEqual([60, 64, 67]) // C Mayor
  })

  it('generateCadenceSteps en Re Mayor (62) debe transportar exactamente los acordes a D Major', () => {
    const cadenceD = generateCadenceSteps(62)
    expect(cadenceD.length).toBe(4)
    expect(cadenceD[0].notes).toEqual([62, 66, 69]) // D Mayor (D, F#, A)
    expect(cadenceD[1].notes).toEqual([59, 62, 67]) // G Mayor (B, D, G)
    expect(cadenceD[2].notes).toEqual([61, 64, 67, 69]) // A7 (C#, E, G, A)
    expect(cadenceD[3].notes).toEqual([62, 66, 69]) // D Mayor
  })

  it('getTonalContextSteps debe retornar la secuencia adecuada según el modo y raíz', () => {
    expect(getTonalContextSteps('none')).toEqual([])
    expect(getTonalContextSteps('tonic', 60).length).toBe(1)
    expect(getTonalContextSteps('drone', 60).length).toBe(1)
    expect(getTonalContextSteps('cadence', 62).length).toBe(4)
  })

  it('getTonalContextDescription debe describir dinámicamente la tonalidad activa', () => {
    expect(getTonalContextDescription('cadence', 60)).toBe('Cadencia en C4 Mayor')
    expect(getTonalContextDescription('cadence', 62)).toBe('Cadencia en D4 Mayor')
    expect(getTonalContextDescription('tonic', 60)).toBe('Tónica C4')
    expect(getTonalContextDescription('none', 60)).toBe('Aislado')
  })

  it('getTotalContextDurationMs debe calcular la duración exacta del pre-roll', () => {
    expect(getTotalContextDurationMs('none')).toBe(0)
    expect(getTotalContextDurationMs('cadence', 60)).toBeGreaterThan(1500)
  })
})
