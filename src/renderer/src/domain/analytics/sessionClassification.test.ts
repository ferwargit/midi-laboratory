import { describe, it, expect } from 'vitest'
import { resolveNominalPoolSize } from './sessionClassification'
import { DbSessionRecord } from '../database/types'

function makeSession(presetName: string): DbSessionRecord {
  return {
    id: 'test-session',
    createdAt: new Date().toISOString(),
    strategyId: 'intervals_v1',
    instrumentId: 'piano_intervals',
    presetName,
    totalQuestions: 10,
    correctAnswers: 8,
    accuracyPercentage: 80,
    avgResponseTimeMs: 1200,
    durationSeconds: 60
  }
}

describe('sessionClassification - resolveNominalPoolSize', () => {
  describe('Intervalos (N activos) nomenclature', () => {
    it('resuelve "Intervalos (6 activos)" → 6', () => {
      const session = makeSession('Intervalos (6 activos)')
      expect(resolveNominalPoolSize(session, 0)).toBe(6)
    })

    it('resuelve "Intervalos (4 activos)" → 4', () => {
      const session = makeSession('Intervalos (4 activos)')
      expect(resolveNominalPoolSize(session, 0)).toBe(4)
    })

    it('resuelve "Intervalos (12 activos)" → 12', () => {
      const session = makeSession('Intervalos (12 activos)')
      expect(resolveNominalPoolSize(session, 0)).toBe(12)
    })

    it('resuelve "Intervalos (2 activos)" → 2', () => {
      const session = makeSession('Intervalos (2 activos)')
      expect(resolveNominalPoolSize(session, 0)).toBe(2)
    })
  })

  describe('Presets de intervalos nivel 1.x', () => {
    it('resuelve "nivel 1.0: contraste" → 2', () => {
      const session = makeSession('nivel 1.0: contraste')
      expect(resolveNominalPoolSize(session, 0)).toBe(2)
    })

    it('resuelve "nivel 1.0 contraste" → 2', () => {
      const session = makeSession('nivel 1.0 contraste')
      expect(resolveNominalPoolSize(session, 0)).toBe(2)
    })

    it('resuelve "contraste" → 2', () => {
      const session = makeSession('Contraste de Intervalos')
      expect(resolveNominalPoolSize(session, 0)).toBe(2)
    })

    it('resuelve "nivel 1.1: referencia" → 5', () => {
      const session = makeSession('nivel 1.1: referencia')
      expect(resolveNominalPoolSize(session, 0)).toBe(5)
    })

    it('resuelve "nivel 1.1 referencia" → 5', () => {
      const session = makeSession('nivel 1.1 referencia')
      expect(resolveNominalPoolSize(session, 0)).toBe(5)
    })

    it('resuelve "nivel 1.2" → 5', () => {
      const session = makeSession('nivel 1.2')
      expect(resolveNominalPoolSize(session, 0)).toBe(5)
    })

    it('resuelve "referencia" → 5', () => {
      const session = makeSession('Referencia de Intervalos')
      expect(resolveNominalPoolSize(session, 0)).toBe(5)
    })

    it('resuelve "nivel 1.3: cromático completo" → 12', () => {
      const session = makeSession('nivel 1.3: cromático completo')
      expect(resolveNominalPoolSize(session, 0)).toBe(12)
    })

    it('resuelve "nivel 1.3 cromático completo" → 12', () => {
      const session = makeSession('nivel 1.3 cromático completo')
      expect(resolveNominalPoolSize(session, 0)).toBe(12)
    })

    it('resuelve "nivel 1.4" → 12', () => {
      const session = makeSession('nivel 1.4')
      expect(resolveNominalPoolSize(session, 0)).toBe(12)
    })

    it('resuelve "cromático completo" → 12', () => {
      const session = makeSession('Cromático Completo de Intervalos')
      expect(resolveNominalPoolSize(session, 0)).toBe(12)
    })
  })

  describe('Casos existentes (regresión)', () => {
    it('resuelve "Nivel 1 (C, D, E)" → 3 (nivel 1 entero)', () => {
      const session = makeSession('Nivel 1 (C, D, E)')
      expect(resolveNominalPoolSize(session, 0)).toBe(3)
    })

    it('resuelve "Nivel 2 (C a G)" → 5 (nivel 2 entero)', () => {
      const session = makeSession('Nivel 2 (C a G)')
      expect(resolveNominalPoolSize(session, 0)).toBe(5)
    })

    it('resuelve "Nivel 3 (C4 a C5)" → 8 (nivel 3 entero)', () => {
      const session = makeSession('Nivel 3 (C4 a C5)')
      expect(resolveNominalPoolSize(session, 0)).toBe(8)
    })

    it('resuelve "Nivel 4 (Cromático)" → 13 (nivel 4 entero)', () => {
      const session = makeSession('Nivel 4 (Cromático)')
      expect(resolveNominalPoolSize(session, 0)).toBe(13)
    })

    it('resuelve "Pentatónica de Do" → 6', () => {
      const session = makeSession('Pentatónica de Do')
      expect(resolveNominalPoolSize(session, 0)).toBe(6)
    })

    it('resuelve "Notas Personalizadas (4)" → 4', () => {
      const session = makeSession('Notas Personalizadas (4)')
      expect(resolveNominalPoolSize(session, 0)).toBe(4)
    })

    it('aplica piso mínimo 2 para casos desconocidos', () => {
      const session = makeSession('Entrenamiento Libre')
      expect(resolveNominalPoolSize(session, 0)).toBe(2)
      expect(resolveNominalPoolSize(session, 1)).toBe(2)
    })

    it('usa empiricalUniqueCount cuando es mayor que 2', () => {
      const session = makeSession('Sesión Desconocida')
      expect(resolveNominalPoolSize(session, 5)).toBe(5)
      expect(resolveNominalPoolSize(session, 10)).toBe(10)
    })
  })
})
