import { describe, it, expect, vi } from 'vitest'
import { reconstructSessionConfig } from './longitudinal'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'

// Tras la remediación F21, `reconstructSessionConfig` ya no contiene arrays
// de fallback hardcodeados: las notas se resuelven desde los presets
// canónicos vía el SSOT `sessionModality.ts` y, en su defecto, desde las
// notas esperadas únicas de las respuestas. Este mock ejerce esa rama
// defensiva vaciando el catálogo de presets de notas, siguiendo la
// convención de lmStudioService.mock.test.ts.
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

function makeAnswer(partial: Partial<DbAnswerRecord> = {}): DbAnswerRecord {
  return {
    id: 'a_mock',
    sessionId: 's_mock',
    questionIndex: 0,
    expectedNote: 60,
    playedNote: 60,
    isCorrect: true,
    semitoneDistance: 0,
    responseTimeMs: 1000,
    velocity: 90,
    reasonTelemetry: '',
    createdAt: new Date('2026-09-01T10:01:00Z').toISOString(),
    inputSource: 'midi_hardware',
    ...partial
  }
}

describe('longitudinal - fallback defensivo sin catálogo canónico (SSOT)', () => {
  it('sin catálogo, usa las notas esperadas únicas de las respuestas', () => {
    const session = makeSession({ presetName: 'Nivel 2 (C a G)' })
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'm1', expectedNote: 67 }),
      makeAnswer({ id: 'm2', expectedNote: 69 }),
      makeAnswer({ id: 'm3', expectedNote: 67 })
    ]
    expect(reconstructSessionConfig(session, answers).recommendedNotes).toEqual([67, 69])
  })

  it('sin catálogo ni respuestas (o < 2 notas únicas), usa el fallback seguro [60, 62, 64]', () => {
    const session = makeSession({ presetName: 'Nivel 1 (C, D, E)' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([60, 62, 64])

    const repeated: DbAnswerRecord[] = [
      makeAnswer({ id: 'r1', expectedNote: 60 }),
      makeAnswer({ id: 'r2', expectedNote: 60 })
    ]
    expect(reconstructSessionConfig(session, repeated).recommendedNotes).toEqual([60, 62, 64])
  })
})
