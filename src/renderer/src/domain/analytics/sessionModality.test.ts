import { describe, it, expect } from 'vitest'
import {
  resolveSessionMode,
  resolveNominalPoolSize,
  resolveSessionPresetNotes,
  matchesSessionPreset
} from './sessionModality'
import { EXERCISE_PRESETS } from '../music/presets'
import { INTERVAL_PRESETS } from '../music/intervals'
import { SEQUENCE_PRESETS } from '../music/sequences'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'

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

/** Genera `uniqueCount` respuestas con notas esperadas únicas para la sesión dada. */
function makeUniqueExpectedAnswers(sessionId: string, uniqueCount: number): DbAnswerRecord[] {
  return Array.from({ length: uniqueCount }, (_, i) =>
    makeAnswer({ id: `a_${sessionId}_${i}`, sessionId, expectedNote: 60 + i })
  )
}

describe('sessionModality - resolveNominalPoolSize (data-driven contra catálogos canónicos)', () => {
  it.each(EXERCISE_PRESETS.map((p) => [p.name, p.notes.length] as const))(
    'EXERCISE_PRESETS "%s" → pool %i (notes.length)',
    (presetName, expected) => {
      expect(resolveNominalPoolSize(makeSession({ presetName }))).toBe(expected)
    }
  )

  it.each(EXERCISE_PRESETS.map((p) => [p.name, p.notes.length] as const))(
    'EXERCISE_PRESETS "%s" con sufijo de formato → pool %i (segmento de contenido)',
    (presetName, expected) => {
      expect(
        resolveNominalPoolSize(makeSession({ presetName: `${presetName} • Bloque 10 preguntas` }))
      ).toBe(expected)
    }
  )

  it.each(INTERVAL_PRESETS.map((p) => [p.name, p.intervalSemitones.length] as const))(
    'INTERVAL_PRESETS "%s" → pool %i (intervalSemitones.length)',
    (presetName, expected) => {
      expect(resolveNominalPoolSize(makeSession({ presetName }))).toBe(expected)
    }
  )

  it.each(SEQUENCE_PRESETS.map((p) => [p.name, p.candidateNotes.length] as const))(
    'SEQUENCE_PRESETS "%s" → pool %i (candidateNotes.length)',
    (presetName, expected) => {
      expect(resolveNominalPoolSize(makeSession({ presetName }))).toBe(expected)
    }
  )
})

describe('sessionModality - resolveSessionMode', () => {
  it('prioriza el targetMode canónico sobre cualquier heurística de nombre', () => {
    expect(
      resolveSessionMode(makeSession({ targetMode: 'intervals', presetName: 'Nivel 1 (C, D, E)' }))
    ).toBe('intervals')
    expect(
      resolveSessionMode(
        makeSession({ targetMode: 'single_note', presetName: 'Secuencias (3 notas)' })
      )
    ).toBe('single_note')
    expect(
      resolveSessionMode(makeSession({ targetMode: 'sequences', presetName: 'Partitura' }))
    ).toBe('sequences')
    expect(
      resolveSessionMode(makeSession({ targetMode: 'repertoire', presetName: 'Nivel 1' }))
    ).toBe('repertoire')
  })

  it('fallback legacy: repertorio gana sobre intervalos y secuencias', () => {
    const session = makeSession({
      presetName: 'Partitura con intervalos y secuencias'
    })
    expect(resolveSessionMode(session)).toBe('repertoire')
  })

  it('fallback legacy: intervalos gana sobre secuencias (prioridad única)', () => {
    const session = makeSession({
      strategyId: 'intervals_v1',
      presetName: 'Secuencia de intervalos'
    })
    expect(resolveSessionMode(session)).toBe('intervals')
  })

  it('fallback legacy: clasifica secuencias por instrumento', () => {
    expect(
      resolveSessionMode(
        makeSession({ strategyId: 'desconocido', instrumentId: 'piano_sequences', presetName: 'X' })
      )
    ).toBe('sequences')
  })

  it('fallback legacy: clasifica notas sueltas por estrategia canónica', () => {
    expect(
      resolveSessionMode(makeSession({ strategyId: 'spaced_repetition', presetName: 'Sesión' }))
    ).toBe('single_note')
  })

  it('devuelve null cuando ninguna señal clasifica la sesión', () => {
    expect(
      resolveSessionMode(
        makeSession({ strategyId: 'desconocido', instrumentId: 'otro', presetName: 'Test' })
      )
    ).toBeNull()
  })
})

describe('sessionModality - resolveNominalPoolSize (fallback heurístico histórico)', () => {
  it('resuelve "Intervalos (6 activos) • Bloque 10 preguntas" → 6', () => {
    expect(
      resolveNominalPoolSize(
        makeSession({ presetName: 'Intervalos (6 activos) • Bloque 10 preguntas' })
      )
    ).toBe(6)
  })

  it('resuelve "Nivel 1 (C, D, E) • Cronometrado 1m" → 3', () => {
    expect(
      resolveNominalPoolSize(makeSession({ presetName: 'Nivel 1 (C, D, E) • Cronometrado 1m' }))
    ).toBe(3)
  })

  it('resuelve "Notas Personalizadas (4) • Bloque 10 preguntas" → 4', () => {
    expect(
      resolveNominalPoolSize(
        makeSession({ presetName: 'Notas Personalizadas (4) • Bloque 10 preguntas' })
      )
    ).toBe(4)
  })

  it('F-06/F-14: "Nivel 10 (Custom) • Notas personalizadas (11)" → 11 (sin colisión de dos dígitos)', () => {
    expect(
      resolveNominalPoolSize(
        makeSession({ presetName: 'Nivel 10 (Custom) • Notas personalizadas (11)' })
      )
    ).toBe(11)
  })

  it('F-06: "Notas Personalizadas (1)" aplica piso → 2', () => {
    expect(resolveNominalPoolSize(makeSession({ presetName: 'Notas Personalizadas (1)' }))).toBe(2)
  })

  it('usa el conteo empírico de notas únicas esperadas como último recurso', () => {
    const session = makeSession({ id: 's_emp', presetName: 'Entrenamiento Libre' })
    expect(resolveNominalPoolSize(session, makeUniqueExpectedAnswers('s_emp', 4))).toBe(4)
  })

  it('sin respuestas el conteo empírico aplica piso 2', () => {
    expect(resolveNominalPoolSize(makeSession({ presetName: 'Entrenamiento Libre' }))).toBe(2)
  })

  it('ignora respuestas de otras sesiones en el conteo empírico', () => {
    const session = makeSession({ id: 's_emp', presetName: 'Entrenamiento Libre' })
    const answers = [
      ...makeUniqueExpectedAnswers('s_otra', 9),
      ...makeUniqueExpectedAnswers('s_emp', 3)
    ]
    expect(resolveNominalPoolSize(session, answers)).toBe(3)
  })
})

describe('sessionModality - resolveSessionPresetNotes', () => {
  it('resuelve las notas del preset canónico exacto', () => {
    const preset = EXERCISE_PRESETS[0]
    expect(resolveSessionPresetNotes(makeSession({ presetName: preset.name }))).toEqual(
      preset.notes
    )
  })

  it('resuelve el alias "Octava Diatónica (C4 a C5)" al preset de nivel 3', () => {
    const level3 = EXERCISE_PRESETS.find((p) => p.id === 'level_3_octave_diatonic')
    expect(
      resolveSessionPresetNotes(makeSession({ presetName: 'Octava Diatónica (C4 a C5)' }))
    ).toEqual(level3?.notes)
  })

  it('resuelve el alias "Rango Cromático (12 Notas)" al preset de nivel 4', () => {
    const level4 = EXERCISE_PRESETS.find((p) => p.id === 'level_4_octave_chromatic')
    expect(
      resolveSessionPresetNotes(makeSession({ presetName: 'Rango Cromático (12 Notas)' }))
    ).toEqual(level4?.notes)
  })

  it('resuelve el alias "Pentatónica de Do" al preset pentatónico', () => {
    const pent = EXERCISE_PRESETS.find((p) => p.id === 'pentatonic_c_major')
    expect(resolveSessionPresetNotes(makeSession({ presetName: 'Pentatónica de Do' }))).toEqual(
      pent?.notes
    )
  })

  it('F-06: "Nivel 10 (Custom)" no colisiona con el nivel 1 (devuelve null)', () => {
    expect(resolveSessionPresetNotes(makeSession({ presetName: 'Nivel 10 (Custom)' }))).toBeNull()
  })

  it('devuelve null para nombres sin alias ni coincidencia canónica', () => {
    expect(resolveSessionPresetNotes(makeSession({ presetName: 'Entrenamiento Libre' }))).toBeNull()
  })
})

describe('sessionModality - matchesSessionPreset', () => {
  it('matching canónico con sufijo de formato (segmento de contenido)', () => {
    expect(
      matchesSessionPreset(
        makeSession({ presetName: 'Nivel 1 (C, D, E) • Cronometrado 1m' }),
        'Nivel 1 (C, D, E)'
      )
    ).toBe(true)
  })

  it('matching canónico exacto sin sufijo', () => {
    expect(
      matchesSessionPreset(makeSession({ presetName: 'Nivel 2 (C a G)' }), 'Nivel 2 (C a G)')
    ).toBe(true)
  })

  it('fallback heurístico: registro heredado de intervalos matchea el nombre canónico completo', () => {
    expect(
      matchesSessionPreset(
        makeSession({ presetName: 'Nivel 1.1: Intervalos Clásicos • Bloque 10 preguntas' }),
        'Nivel 1.1: Intervalos Clásicos (2M, 3M, 4J, 5J, 8J)'
      )
    ).toBe(true)
  })

  it('fallback heurístico: alias "Personalizadas" matchea notas personalizadas', () => {
    expect(
      matchesSessionPreset(
        makeSession({ presetName: 'Notas Personalizadas (4)' }),
        'Personalizadas'
      )
    ).toBe(true)
  })

  it('no matchea presets distintos', () => {
    expect(
      matchesSessionPreset(makeSession({ presetName: 'Nivel 2 (C a G)' }), 'Nivel 1 (C, D, E)')
    ).toBe(false)
  })

  it('un presetName vacío nunca matchea un alias de nivel', () => {
    expect(matchesSessionPreset(makeSession({ presetName: '' }), 'Nivel 1 (C, D, E)')).toBe(false)
  })
})
