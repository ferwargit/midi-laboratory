import { describe, it, expect } from 'vitest'
import { reconstructSessionConfig, computeLongitudinalComparisons } from './longitudinal'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'
import { DetailedSessionAnalysis } from './types'

function makeSession(partial: Partial<DbSessionRecord> = {}): DbSessionRecord {
  return {
    id: 's_base',
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
    id: 'a_base',
    sessionId: 's_base',
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

function makeDetail(partial: Partial<DetailedSessionAnalysis> = {}): DetailedSessionAnalysis {
  return {
    session: makeSession(),
    poolSize: 3,
    entropyBits: 1.5,
    chanceBaseline: 0.33,
    normalizedAccuracy: 70,
    responsesPerMinute: 20,
    fastPercent: 40,
    mediumPercent: 40,
    slowPercent: 20,
    sharpBiasCount: 1,
    flatBiasCount: 1,
    dominantBias: 'balanced',
    formatType: 'questions',
    formatLabel: '🔢 Serie 10',
    inputMethod: 'hardware',
    interSessionGapMs: null,
    interSessionGapLabel: 'Inicio',
    cpiScore: 50,
    ...partial
  }
}

describe('longitudinal - reconstructSessionConfig', () => {
  it('mantiene el targetMode explícito de la sesión cuando no es repertoire', () => {
    const session = makeSession({ id: 's_mode', targetMode: 'sequences' })
    const config = reconstructSessionConfig(session, [])
    expect(config.targetMode).toBe('sequences')
  })

  it('cae a single_note cuando targetMode es repertoire', () => {
    const session = makeSession({ id: 's_rep', targetMode: 'repertoire', presetName: 'Partitura' })
    const config = reconstructSessionConfig(session, [])
    expect(config.targetMode).toBe('single_note')
  })

  it('deriva intervals desde la telemetría (regex de semitonos), deduplicando y ordenando', () => {
    const session = makeSession({
      id: 's_int',
      targetMode: 'intervals',
      presetName: 'Nivel 1.1: Intervalos Clásicos'
    })
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'i1', sessionId: 's_int', reasonTelemetry: 'Intervalo de 4 st ascendente' }),
      makeAnswer({ id: 'i2', sessionId: 's_int', reasonTelemetry: 'Intervalo de 2 st' }),
      makeAnswer({ id: 'i3', sessionId: 's_int', reasonTelemetry: 'Intervalo de 4 st repetido' }),
      makeAnswer({ id: 'i4', sessionId: 's_int', reasonTelemetry: 'Intervalo de 12 st' })
    ]

    const config = reconstructSessionConfig(session, answers)
    expect(config.targetMode).toBe('intervals')
    expect(config.recommendedIntervals).toEqual([2, 4, 12])
  })

  it('usa el fallback [2, 4, 5, 7, 12] cuando no hay telemetría de intervalos', () => {
    const session = makeSession({
      id: 's_int_fb',
      targetMode: 'intervals',
      presetName: 'Nivel 1.1: Intervalos Clásicos'
    })
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'fb1', sessionId: 's_int_fb', reasonTelemetry: 'Sin telemetría' })
    ]

    const config = reconstructSessionConfig(session, answers)
    expect(config.recommendedIntervals).toEqual([2, 4, 5, 7, 12])
  })

  it('cae a single_note cuando targetMode es single_note explícito', () => {
    const session = makeSession({ id: 's_sn', targetMode: 'single_note' })
    const config = reconstructSessionConfig(session, [])
    expect(config.targetMode).toBe('single_note')
    expect(config.recommendedNotes).toEqual([60, 62, 64])
  })

  it('cae a intervals por heurística cuando targetMode está vacío', () => {
    const session = makeSession({
      id: 's_int_heur',
      strategyId: 'intervals_v1',
      presetName: 'Intervalos Clásicos'
    })
    const config = reconstructSessionConfig(session, [])
    expect(config.targetMode).toBe('intervals')
  })

  it('extrae recommendedNotes y sequenceLength desde telemetría de secuencias', () => {
    const session = makeSession({
      id: 's_seq',
      targetMode: 'sequences',
      presetName: 'Secuencias (3 notas)'
    })
    const answers: DbAnswerRecord[] = [
      makeAnswer({
        id: 'sq1',
        sessionId: 's_seq',
        reasonTelemetry: 'Secuencia: [60, 62, 64]'
      }),
      makeAnswer({
        id: 'sq2',
        sessionId: 's_seq',
        reasonTelemetry: 'Secuencia: [60, 64, 67, 72]'
      })
    ]

    const config = reconstructSessionConfig(session, answers)
    expect(config.targetMode).toBe('sequences')
    expect(config.recommendedNotes).toEqual([60, 62, 64, 67, 72])
    expect(config.sequenceLength).toBe(4)
  })

  it('conserva sequenceLength de 3 por defecto y añade expectedNote sin telemetría', () => {
    const session = makeSession({
      id: 's_seq_fb',
      targetMode: 'sequences',
      presetName: 'Secuencias (3 notas)'
    })
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'sqf1', sessionId: 's_seq_fb', reasonTelemetry: '', expectedNote: 67 }),
      makeAnswer({ id: 'sqf2', sessionId: 's_seq_fb', reasonTelemetry: '', expectedNote: 69 })
    ]

    const config = reconstructSessionConfig(session, answers)
    expect(config.recommendedNotes).toEqual([67, 69])
    expect(config.sequenceLength).toBe(3)
  })

  it('descarta notas no numéricas de la telemetría de secuencias', () => {
    const session = makeSession({
      id: 's_seq_nan',
      targetMode: 'sequences',
      presetName: 'Secuencias (3 notas)'
    })
    const answers: DbAnswerRecord[] = [
      makeAnswer({
        id: 'sqn1',
        sessionId: 's_seq_nan',
        reasonTelemetry: 'Secuencia: [60, abc, 64]'
      })
    ]

    const config = reconstructSessionConfig(session, answers)
    expect(config.recommendedNotes).toEqual([60, 64])
    expect(config.sequenceLength).toBe(3)
  })

  it('ignora respuestas de secuencias sin telemetría ni expectedNote', () => {
    const session = makeSession({
      id: 's_seq_zero',
      targetMode: 'sequences',
      presetName: 'Secuencias (3 notas)'
    })
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'sqz1', sessionId: 's_seq_zero', reasonTelemetry: '', expectedNote: 0 })
    ]

    const config = reconstructSessionConfig(session, answers)
    expect(config.recommendedNotes).toEqual([60, 62, 64, 65, 67])
    expect(config.sequenceLength).toBe(3)
  })

  it('usa el fallback de notas seguras cuando la secuencia única tiene < 2 notas', () => {
    const session = makeSession({
      id: 's_seq_safe',
      targetMode: 'sequences',
      presetName: 'Secuencias (3 notas)'
    })
    const config = reconstructSessionConfig(session, [])
    expect(config.recommendedNotes).toEqual([60, 62, 64, 65, 67])
    expect(config.sequenceLength).toBe(3)
  })

  it('cae a sequences por heurística cuando targetMode está vacío', () => {
    const session = makeSession({
      id: 's_seq_heur',
      instrumentId: 'piano_sequences',
      presetName: 'Secuencias (3 notas)'
    })
    const config = reconstructSessionConfig(session, [])
    expect(config.targetMode).toBe('sequences')
  })

  it('resuelve notas por preset de nivel 1', () => {
    const session = makeSession({ id: 's_l1', presetName: 'Nivel 1 (C, D, E)' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([60, 62, 64])
  })

  it('resuelve notas por preset de nivel 2', () => {
    const session = makeSession({ id: 's_l2', presetName: 'Nivel 2 (C a G)' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([60, 62, 64, 65, 67])
  })

  it('resuelve notas por preset de nivel 3 / octava diatónica', () => {
    const session = makeSession({ id: 's_l3', presetName: 'Nivel 3 (C4 a C5)' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72
    ])
  })

  it('resuelve notas por preset de nivel 4 / cromático', () => {
    const session = makeSession({ id: 's_l4', presetName: 'Nivel 4 (Cromático C4-C5)' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([
      60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72
    ])
  })

  it('resuelve notas por octava diatónica sin literal "nivel 3"', () => {
    const session = makeSession({ id: 's_oct', presetName: 'Octava Diatónica (C4 a C5)' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72
    ])
  })

  it('resuelve notas por cromático sin literal "nivel 4"', () => {
    const session = makeSession({ id: 's_chrom', presetName: 'Rango Cromático (12 Notas)' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([
      60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72
    ])
  })

  it('resuelve notas por preset pentatónico', () => {
    const session = makeSession({ id: 's_pent', presetName: 'Pentatónica de Do' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([60, 62, 64, 67, 69, 72])
  })

  it('deduce notas únicas desde las respuestas cuando el preset es libre', () => {
    const session = makeSession({ id: 's_free', presetName: 'Entrenamiento Libre' })
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'f1', sessionId: 's_free', expectedNote: 64 }),
      makeAnswer({ id: 'f2', sessionId: 's_free', expectedNote: 62 }),
      makeAnswer({ id: 'f3', sessionId: 's_free', expectedNote: 64 })
    ]
    expect(reconstructSessionConfig(session, answers).recommendedNotes).toEqual([62, 64])
  })

  it('usa el fallback [60, 62, 64] con respuestas repetidas (< 2 notas únicas)', () => {
    const session = makeSession({ id: 's_rep_note', presetName: 'Entrenamiento Libre' })
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'r1', sessionId: 's_rep_note', expectedNote: 60 }),
      makeAnswer({ id: 'r2', sessionId: 's_rep_note', expectedNote: 60 })
    ]
    expect(reconstructSessionConfig(session, answers).recommendedNotes).toEqual([60, 62, 64])
  })

  it('usa el fallback [60, 62, 64] sin respuestas', () => {
    const session = makeSession({ id: 's_no_ans', presetName: 'Entrenamiento Libre' })
    expect(reconstructSessionConfig(session, []).recommendedNotes).toEqual([60, 62, 64])
  })

  it('tolera un presetName vacío (rama defensiva del parser)', () => {
    const session = makeSession({ id: 's_empty_name', presetName: '' })
    const config = reconstructSessionConfig(session, [])
    expect(config.recommendedNotes).toEqual([60, 62, 64])
    expect(config.title).toBe('Re-testeo: ')
  })

  it('resuelve limitType time para presets cronometrados', () => {
    const session = makeSession({
      id: 's_timed',
      presetName: 'Nivel 1 (C, D, E) • Cronometrado 3m',
      durationSeconds: 180
    })
    const config = reconstructSessionConfig(session, [])
    expect(config.limitType).toBe('time')
    expect(config.durationMinutes).toBe(3)
  })

  it('resuelve limitType time por la palabra "tiempo"', () => {
    const session = makeSession({
      id: 's_tiempo',
      presetName: 'Nivel 1 (C, D, E) • Tiempo 5m',
      durationSeconds: 300
    })
    expect(reconstructSessionConfig(session, []).limitType).toBe('time')
  })

  it('resuelve limitType mastery para presets de maestría', () => {
    const session = makeSession({ id: 's_mastery', presetName: 'Maestría de Notas' })
    expect(reconstructSessionConfig(session, []).limitType).toBe('mastery')
  })

  it('resuelve limitType questions y questionsCount por defecto', () => {
    const session = makeSession({ id: 's_q', presetName: 'Nivel 1 (C, D, E)', totalQuestions: 0 })
    const config = reconstructSessionConfig(session, [])
    expect(config.limitType).toBe('questions')
    expect(config.questionsCount).toBe(10)
  })

  it('usa questionsCount de la sesión cuando está disponible', () => {
    const session = makeSession({
      id: 's_q20',
      presetName: 'Nivel 1 (C, D, E)',
      totalQuestions: 20
    })
    expect(reconstructSessionConfig(session, []).questionsCount).toBe(20)
  })

  it('aplica piso de 1 minuto a durationMinutes', () => {
    const session = makeSession({
      id: 's_dur0',
      presetName: 'Nivel 1 (C, D, E)',
      durationSeconds: 0
    })
    expect(reconstructSessionConfig(session, []).durationMinutes).toBe(1)
  })

  it('conserva un instrumento válido', () => {
    const session = makeSession({ id: 's_flute', instrumentId: 'flute' })
    expect(reconstructSessionConfig(session, []).instrumentId).toBe('flute')
  })

  it('normaliza un instrumento no listado a acoustic_grand_piano', () => {
    const session = makeSession({ id: 's_bad_inst', instrumentId: 'piano_sequences' })
    expect(reconstructSessionConfig(session, []).instrumentId).toBe('acoustic_grand_piano')
  })

  it('construye el título y la rationale de re-testeo', () => {
    const session = makeSession({ id: 's_title', presetName: 'Nivel 1 (C, D, E)' })
    const config = reconstructSessionConfig(session, [])
    expect(config.title).toBe('Re-testeo: Nivel 1 (C, D, E)')
    expect(config.rationale).toContain('Sesión clonada de tu registro histórico')
    expect(config.advanceMode).toBe('smart')
    expect(config.noteDurationMs).toBe(500)
  })
})

describe('longitudinal - computeLongitudinalComparisons', () => {
  it('no genera comparación para grupos de una sola sesión', () => {
    const details = [
      makeDetail({
        session: makeSession({ id: 'only', presetName: 'Nivel 1 (C, D, E) • Bloque 10 preguntas' })
      })
    ]
    expect(computeLongitudinalComparisons(details)).toHaveLength(0)
  })

  it('toma la primera sesión cronológica como baseline y la última como latest', () => {
    const details = [
      makeDetail({
        session: makeSession({
          id: 'mid',
          createdAt: new Date('2026-09-05T10:00:00Z').toISOString(),
          accuracyPercentage: 70,
          totalQuestions: 10
        })
      }),
      makeDetail({
        session: makeSession({
          id: 'oldest',
          createdAt: new Date('2026-09-01T10:00:00Z').toISOString(),
          accuracyPercentage: 50,
          totalQuestions: 10
        })
      }),
      makeDetail({
        session: makeSession({
          id: 'newest',
          createdAt: new Date('2026-09-10T10:00:00Z').toISOString(),
          accuracyPercentage: 90,
          totalQuestions: 10
        })
      })
    ]
    details.forEach((d) => {
      d.session.presetName = 'Nivel 1 (C, D, E) • Bloque 10 preguntas'
      d.session.instrumentId = 'acoustic_grand_piano'
    })

    const comparisons = computeLongitudinalComparisons(details)
    expect(comparisons).toHaveLength(1)
    expect(comparisons[0].baselineSession.id).toBe('oldest')
    expect(comparisons[0].latestSession.id).toBe('newest')
    expect(comparisons[0].rawAccuracyDelta).toBe(40)
    expect(comparisons[0].totalAttempts).toBe(30)
    expect(comparisons[0].isImproved).toBe(true)
  })

  it('acumula totalAttempts sobre todas las sesiones del grupo', () => {
    const base = '2026-09-01T10:00:00Z'
    const details = [
      makeDetail({
        session: makeSession({
          id: 'g1',
          createdAt: base,
          totalQuestions: 5,
          presetName: 'Nivel 2 (C a G)'
        })
      }),
      makeDetail({
        session: makeSession({
          id: 'g2',
          createdAt: new Date('2026-09-03T10:00:00Z').toISOString(),
          totalQuestions: 15,
          presetName: 'Nivel 2 (C a G)'
        })
      })
    ]
    const comparisons = computeLongitudinalComparisons(details)
    expect(comparisons[0].totalAttempts).toBe(20)
  })

  it('trata totalQuestions ausente como 0 al acumular totalAttempts', () => {
    const base = '2026-09-01T10:00:00Z'
    const details = [
      makeDetail({
        session: makeSession({
          id: 'z1',
          createdAt: base,
          totalQuestions: 0,
          presetName: 'Nivel 2 (C a G)'
        })
      }),
      makeDetail({
        session: makeSession({
          id: 'z2',
          createdAt: new Date('2026-09-03T10:00:00Z').toISOString(),
          totalQuestions: 10,
          presetName: 'Nivel 2 (C a G)'
        })
      })
    ]
    const comparisons = computeLongitudinalComparisons(details)
    expect(comparisons[0].totalAttempts).toBe(10)
  })

  it('separa el contentName en el separador "•"', () => {
    const base = '2026-09-01T10:00:00Z'
    const details = [
      makeDetail({
        session: makeSession({
          id: 'c1',
          createdAt: base,
          presetName: 'Nivel 1 (C, D, E) • Cronometrado 1m'
        })
      }),
      makeDetail({
        session: makeSession({
          id: 'c2',
          createdAt: new Date('2026-09-02T10:00:00Z').toISOString(),
          presetName: 'Nivel 1 (C, D, E) • Bloque 10 preguntas'
        })
      })
    ]
    const comparisons = computeLongitudinalComparisons(details)
    expect(comparisons[0].contentName).toBe('Nivel 1 (C, D, E)')
  })

  it('mantiene el nombre completo cuando no hay separador "•"', () => {
    const base = '2026-09-01T10:00:00Z'
    const details = [
      makeDetail({
        session: makeSession({ id: 'n1', createdAt: base, presetName: 'Entrenamiento Libre' })
      }),
      makeDetail({
        session: makeSession({
          id: 'n2',
          createdAt: new Date('2026-09-02T10:00:00Z').toISOString(),
          presetName: 'Entrenamiento Libre'
        })
      })
    ]
    const comparisons = computeLongitudinalComparisons(details)
    expect(comparisons[0].contentName).toBe('Entrenamiento Libre')
  })

  it('agrupa con la clave "General" cuando el presetName está vacío', () => {
    const base = '2026-09-01T10:00:00Z'
    const details = [
      makeDetail({ session: makeSession({ id: 'e1', createdAt: base, presetName: '' }) }),
      makeDetail({
        session: makeSession({
          id: 'e2',
          createdAt: new Date('2026-09-02T10:00:00Z').toISOString(),
          presetName: ''
        })
      })
    ]
    const comparisons = computeLongitudinalComparisons(details)
    expect(comparisons).toHaveLength(1)
    expect(comparisons[0].contentName).toBe('')
  })

  it('agrupa por instrumento: mismo preset con distinto instrumento son grupos separados', () => {
    const base = '2026-09-01T10:00:00Z'
    const details = [
      makeDetail({
        session: makeSession({ id: 'p1', createdAt: base, instrumentId: 'flute' })
      }),
      makeDetail({
        session: makeSession({
          id: 'v1',
          createdAt: new Date('2026-09-02T10:00:00Z').toISOString(),
          instrumentId: 'violin'
        })
      })
    ]
    expect(computeLongitudinalComparisons(details)).toHaveLength(0)
  })

  it('marca isImproved false cuando no hay delta de accuracy ni de tiempo', () => {
    const base = '2026-09-01T10:00:00Z'
    const details = [
      makeDetail({
        session: makeSession({
          id: 's1',
          createdAt: base,
          accuracyPercentage: 80,
          avgResponseTimeMs: 1500
        }),
        normalizedAccuracy: 75,
        responsesPerMinute: 20
      }),
      makeDetail({
        session: makeSession({
          id: 's2',
          createdAt: new Date('2026-09-02T10:00:00Z').toISOString(),
          accuracyPercentage: 80,
          avgResponseTimeMs: 1500
        }),
        normalizedAccuracy: 75,
        responsesPerMinute: 20
      })
    ]
    const comparisons = computeLongitudinalComparisons(details)
    expect(comparisons[0].rawAccuracyDelta).toBe(0)
    expect(comparisons[0].responseTimeDeltaMs).toBe(0)
    expect(comparisons[0].isImproved).toBe(false)
  })

  it('marca isImproved true por mejora de tiempo aunque la accuracy no cambie', () => {
    const base = '2026-09-01T10:00:00Z'
    const details = [
      makeDetail({
        session: makeSession({
          id: 't1',
          createdAt: base,
          accuracyPercentage: 80,
          avgResponseTimeMs: 2000
        })
      }),
      makeDetail({
        session: makeSession({
          id: 't2',
          createdAt: new Date('2026-09-02T10:00:00Z').toISOString(),
          accuracyPercentage: 80,
          avgResponseTimeMs: 1500
        })
      })
    ]
    const comparisons = computeLongitudinalComparisons(details)
    expect(comparisons[0].responseTimeDeltaMs).toBe(-500)
    expect(comparisons[0].isImproved).toBe(true)
  })

  it('marca isImproved false cuando la accuracy empeora', () => {
    const base = '2026-09-01T10:00:00Z'
    const details = [
      makeDetail({
        session: makeSession({
          id: 'w1',
          createdAt: base,
          accuracyPercentage: 90,
          avgResponseTimeMs: 1000
        })
      }),
      makeDetail({
        session: makeSession({
          id: 'w2',
          createdAt: new Date('2026-09-02T10:00:00Z').toISOString(),
          accuracyPercentage: 70,
          avgResponseTimeMs: 1000
        })
      })
    ]
    const comparisons = computeLongitudinalComparisons(details)
    expect(comparisons[0].rawAccuracyDelta).toBe(-20)
    expect(comparisons[0].isImproved).toBe(false)
  })

  it('calcula los deltas normalizados y de ritmo (rpm) entre baseline y latest', () => {
    const base = '2026-09-01T10:00:00Z'
    const details = [
      makeDetail({
        session: makeSession({ id: 'd1', createdAt: base, accuracyPercentage: 60 }),
        normalizedAccuracy: 50,
        responsesPerMinute: 15
      }),
      makeDetail({
        session: makeSession({
          id: 'd2',
          createdAt: new Date('2026-09-02T10:00:00Z').toISOString(),
          accuracyPercentage: 75
        }),
        normalizedAccuracy: 65,
        responsesPerMinute: 18.6
      })
    ]
    const comparisons = computeLongitudinalComparisons(details)
    expect(comparisons[0].normalizedAccuracyDelta).toBe(15)
    expect(comparisons[0].rpmDelta).toBe(3.6)
  })
})
