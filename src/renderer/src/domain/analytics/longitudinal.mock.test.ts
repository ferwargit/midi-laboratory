import { describe, it, expect, vi } from 'vitest'
import { reconstructSessionConfig } from './longitudinal'
import { DbSessionRecord } from '../database/types'

// Los presets reales siempre existen en EXERCISE_PRESETS, por lo que las
// ramas `|| [...]` de reconstructSessionConfig son defensivas. Este mock las
// ejerce vaciando el catálogo, siguiendo la convención de
// lmStudioService.mock.test.ts.
vi.mock('../music/presets', () => ({ EXERCISE_PRESETS: [] }))

function makeSession(partial: Partial<DbSessionRecord> = {}): DbSessionRecord {
  return {
    id: 's_mock',
    createdAt: new Date('2026-09-01T10:00:00Z').toISOString(),
    strategyId: 'adaptive_v1',
    instrumentId: 'acoustic_grand_piano',
    presetName: 'Nivel 1 (C, D, E)',
    totalQuestions: 10,
    correctAnswers: 8,
    accuracyPercentage: 80,
    avgResponseTimeMs: 1200,
    durationSeconds: 60,
    ...partial
  }
}

describe('longitudinal - fallbacks de presets documentados', () => {
  it('nivel 1 usa el fallback [60, 62, 64]', () => {
    const session = makeSession({ presetName: 'Nivel 1 (C, D, E)' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([60, 62, 64])
  })

  it('nivel 2 usa el fallback [60, 62, 64, 65, 67]', () => {
    const session = makeSession({ presetName: 'Nivel 2 (C a G)' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([60, 62, 64, 65, 67])
  })

  it('nivel 3 / octava diatónica usa el fallback de 8 notas', () => {
    const session = makeSession({ presetName: 'Nivel 3 (C4 a C5)' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72
    ])
  })

  it('nivel 4 / cromático usa el fallback de 13 notas', () => {
    const session = makeSession({ presetName: 'Nivel 4 (Cromático C4-C5)' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([
      60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72
    ])
  })

  it('pentatónica usa el fallback [60, 62, 64, 67, 69, 72]', () => {
    const session = makeSession({ presetName: 'Pentatónica de Do' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([60, 62, 64, 67, 69, 72])
  })
})
