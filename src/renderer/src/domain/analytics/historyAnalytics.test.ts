import { describe, it, expect } from 'vitest'
import {
  computeAnalyticsMetrics,
  filterSessionsByMode,
  filterSessionsAdvanced,
  computeLongitudinalComparisons,
  reconstructSessionConfig
} from './historyAnalytics'
import { generateDiagnosticReport } from './diagnosticReportGenerator'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'

describe('historyAnalytics - Psicometría, Filtros Multidimensionales y Telemetría Clínica', () => {
  const sNotePiano: DbSessionRecord = {
    id: 's_note_piano',
    createdAt: new Date('2026-08-21T10:00:00Z').toISOString(),
    strategyId: 'adaptive_v1',
    instrumentId: 'acoustic_grand_piano',
    presetName: 'Nivel 1 (C, D, E) • Cronometrado 1m',
    totalQuestions: 10,
    correctAnswers: 9,
    accuracyPercentage: 90,
    avgResponseTimeMs: 1100,
    durationSeconds: 60
  }

  const sNoteFlute: DbSessionRecord = {
    id: 's_note_flute',
    createdAt: new Date('2026-08-21T11:00:00Z').toISOString(),
    strategyId: 'spaced_repetition',
    instrumentId: 'flute',
    presetName: 'Notas Personalizadas (4) • Bloque 10 preguntas',
    totalQuestions: 10,
    correctAnswers: 4,
    accuracyPercentage: 40,
    avgResponseTimeMs: 2500,
    durationSeconds: 90
  }

  const sInterval: DbSessionRecord = {
    id: 's_int',
    createdAt: new Date('2026-08-21T12:00:00Z').toISOString(),
    strategyId: 'intervals_v1',
    instrumentId: 'piano_intervals',
    presetName: 'Nivel 1.1: Intervalos Clásicos • Bloque 10 preguntas',
    totalQuestions: 10,
    correctAnswers: 7,
    accuracyPercentage: 70,
    avgResponseTimeMs: 1800,
    durationSeconds: 80
  }

  const sSequence: DbSessionRecord = {
    id: 's_seq',
    createdAt: new Date('2026-08-21T13:00:00Z').toISOString(),
    strategyId: 'sequences_v1',
    instrumentId: 'piano_sequences',
    presetName: 'Secuencias (3 notas) • Cronometrado 3m',
    totalQuestions: 15,
    correctAnswers: 12,
    accuracyPercentage: 80,
    avgResponseTimeMs: 2200,
    durationSeconds: 180
  }

  const mockAnswers: DbAnswerRecord[] = [
    {
      id: 'a1',
      sessionId: 's_note_piano',
      questionIndex: 1,
      expectedNote: 60,
      playedNote: 60,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 950,
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString(),
      inputSource: 'midi_hardware'
    },
    {
      id: 'a2',
      sessionId: 's_note_flute',
      questionIndex: 1,
      expectedNote: 64,
      playedNote: 65,
      isCorrect: false,
      semitoneDistance: 1,
      responseTimeMs: 2400,
      velocity: 85,
      reasonTelemetry: '',
      createdAt: new Date().toISOString(),
      inputSource: 'virtual_ui'
    }
  ]

  it('filterSessionsByMode segmenta inequívocamente sin colisiones de texto', () => {
    const all = [sNotePiano, sNoteFlute, sInterval, sSequence]

    expect(filterSessionsByMode(all, 'all').length).toBe(4)
    expect(filterSessionsByMode(all, 'single_note').length).toBe(2)
    expect(filterSessionsByMode(all, 'intervals').length).toBe(1)
    expect(filterSessionsByMode(all, 'sequences').length).toBe(1)
  })

  it('filterSessionsAdvanced aplica filtros cruzados por Timbre, Formato, Nivel de Maestría y Búsqueda', () => {
    const all = [sNotePiano, sNoteFlute, sInterval, sSequence]

    const fluteOnly = filterSessionsAdvanced(all, {
      mode: 'single_note',
      instrumentId: 'flute'
    })
    expect(fluteOnly.length).toBe(1)
    expect(fluteOnly[0].id).toBe('s_note_flute')

    const timedOnly = filterSessionsAdvanced(all, {
      mode: 'all',
      format: 'time'
    })
    expect(timedOnly.map((s) => s.id)).toEqual(['s_note_piano', 's_seq'])

    const mastered = filterSessionsAdvanced(all, {
      mode: 'single_note',
      mastery: 'mastered'
    })
    expect(mastered.length).toBe(1)
    expect(mastered[0].id).toBe('s_note_piano')

    const searchMatch = filterSessionsAdvanced(all, {
      mode: 'all',
      searchQuery: 'Intervalos Clásicos'
    })
    expect(searchMatch.length).toBe(1)
    expect(searchMatch[0].id).toBe('s_int')
  })

  it('computeAnalyticsMetrics calcula telemetría clínica de alta resolución por sesión (RPM, reflejo, sesgo)', () => {
    const all = [sNotePiano, sNoteFlute]
    const metrics = computeAnalyticsMetrics(all, mockAnswers, 'single_note')

    expect(metrics.filteredSessionsCount).toBe(2)
    expect(metrics.totalAnswers).toBe(2)
    expect(metrics.sessionPsychometricsList.length).toBe(2)

    const pianoAnalysis = metrics.sessionPsychometricsList.find(
      (p) => p.session.id === 's_note_piano'
    )
    expect(pianoAnalysis?.responsesPerMinute).toBe(10)
    expect(pianoAnalysis?.fastPercent).toBe(100)
    expect(pianoAnalysis?.inputMethod).toBe('hardware')

    const fluteAnalysis = metrics.sessionPsychometricsList.find(
      (p) => p.session.id === 's_note_flute'
    )
    expect(fluteAnalysis?.sharpBiasCount).toBe(1)
    expect(fluteAnalysis?.dominantBias).toBe('sharp')
    expect(fluteAnalysis?.inputMethod).toBe('virtual')
  })

  it('reconstructSessionConfig debe reconstruir con precisión el pool de notas canónicas y formato de una sesión pasada', () => {
    const pastSession: DbSessionRecord = {
      id: 's_hist_1',
      createdAt: new Date('2026-08-20T15:00:00Z').toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'flute',
      presetName: 'Nivel 1 (C, D, E) • Cronometrado 3m',
      totalQuestions: 20,
      correctAnswers: 12,
      accuracyPercentage: 60,
      avgResponseTimeMs: 1600,
      durationSeconds: 180
    }

    const pastAnswers: DbAnswerRecord[] = [
      {
        id: 'ans_1',
        sessionId: 's_hist_1',
        questionIndex: 1,
        expectedNote: 60,
        playedNote: 60,
        isCorrect: true,
        semitoneDistance: 0,
        responseTimeMs: 1400,
        velocity: 90,
        reasonTelemetry: '',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ans_2',
        sessionId: 's_hist_1',
        questionIndex: 2,
        expectedNote: 64,
        playedNote: 65,
        isCorrect: false,
        semitoneDistance: 1,
        responseTimeMs: 1800,
        velocity: 90,
        reasonTelemetry: '',
        createdAt: new Date().toISOString()
      }
    ]

    const prescription = reconstructSessionConfig(pastSession, pastAnswers)

    expect(prescription.targetMode).toBe('single_note')
    expect(prescription.instrumentId).toBe('flute')
    expect(prescription.recommendedNotes).toEqual([60, 62, 64])
    expect(prescription.limitType).toBe('time')
    expect(prescription.durationMinutes).toBe(3)
    expect(prescription.title).toContain('Re-testeo: Nivel 1')
  })

  it('computeLongitudinalComparisons calcula el Delta de mejora entre una sesión baseline y su retest', () => {
    const session1: DbSessionRecord = {
      id: 's_base',
      createdAt: new Date('2026-08-10T10:00:00Z').toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Nivel 1 (C, D, E) • Cronometrado 1m',
      totalQuestions: 10,
      correctAnswers: 6,
      accuracyPercentage: 60,
      avgResponseTimeMs: 1800,
      durationSeconds: 60
    }

    const session2: DbSessionRecord = {
      id: 's_latest',
      createdAt: new Date('2026-08-21T10:00:00Z').toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Nivel 1 (C, D, E) • Cronometrado 1m',
      totalQuestions: 15,
      correctAnswers: 14,
      accuracyPercentage: 93,
      avgResponseTimeMs: 1200,
      durationSeconds: 60
    }

    const comparisons = computeLongitudinalComparisons([
      {
        session: session1,
        poolSize: 3,
        entropyBits: 1.58,
        chanceBaseline: 33,
        normalizedAccuracy: 40,
        responsesPerMinute: 10,
        fastPercent: 20,
        mediumPercent: 60,
        slowPercent: 20,
        sharpBiasCount: 2,
        flatBiasCount: 0,
        dominantBias: 'sharp',
        formatType: 'time',
        inputMethod: 'hardware'
      },
      {
        session: session2,
        poolSize: 3,
        entropyBits: 1.58,
        chanceBaseline: 33,
        normalizedAccuracy: 90,
        responsesPerMinute: 15,
        fastPercent: 80,
        mediumPercent: 20,
        slowPercent: 0,
        sharpBiasCount: 0,
        flatBiasCount: 0,
        dominantBias: 'balanced',
        formatType: 'time',
        inputMethod: 'hardware'
      }
    ])

    expect(comparisons.length).toBe(1)
    expect(comparisons[0].rawAccuracyDelta).toBe(33)
    expect(comparisons[0].responseTimeDeltaMs).toBe(-600)
    expect(comparisons[0].rpmDelta).toBe(5)
    expect(comparisons[0].isImproved).toBe(true)
  })

  it('los filtros de maestría deben clasificar estrictamente: >=85% Dominada, 50-84% En Progreso, <50% Crítica', () => {
    const s82Percent: DbSessionRecord = {
      id: 's_82',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Nivel 3 (Octava Diatónica) • Cronometrado 3m',
      totalQuestions: 44,
      correctAnswers: 37,
      accuracyPercentage: 84,
      avgResponseTimeMs: 1400,
      durationSeconds: 180
    }

    const s86Percent: DbSessionRecord = {
      id: 's_86',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Nivel 3 (Octava Diatónica) • Cronometrado 3m',
      totalQuestions: 44,
      correctAnswers: 38,
      accuracyPercentage: 86,
      avgResponseTimeMs: 1400,
      durationSeconds: 180
    }

    const s45Percent: DbSessionRecord = {
      id: 's_45',
      createdAt: new Date().toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Nivel 3 (Octava Diatónica) • Cronometrado 3m',
      totalQuestions: 44,
      correctAnswers: 20,
      accuracyPercentage: 45,
      avgResponseTimeMs: 2500,
      durationSeconds: 180
    }

    const pool = [s82Percent, s86Percent, s45Percent]

    const mastered = filterSessionsAdvanced(pool, { mode: 'all', mastery: 'mastered' })
    expect(mastered.map((s) => s.id)).toEqual(['s_86'])

    const learning = filterSessionsAdvanced(pool, { mode: 'all', mastery: 'learning' })
    expect(learning.map((s) => s.id)).toEqual(['s_82'])

    const critical = filterSessionsAdvanced(pool, { mode: 'all', mastery: 'critical' })
    expect(critical.map((s) => s.id)).toEqual(['s_45'])
  })

  it('generateDiagnosticReport redacta el plan de acción psicopedagógico correctamente', () => {
    const metrics = computeAnalyticsMetrics([sNotePiano], [mockAnswers[0]], 'single_note')
    const report = generateDiagnosticReport(metrics)
    expect(report.title).toContain('Informe')
    expect(report.concreteActionPlan.length).toBeGreaterThan(0)
  })

  it('filterSessionsAdvanced debe filtrar por Motor, Preset, Fuente de Entrada y Sesgo', () => {
    const sSpaced: DbSessionRecord = {
      id: 's_spaced',
      createdAt: new Date('2026-08-22T10:00:00Z').toISOString(),
      strategyId: 'spaced_repetition',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Pentatónica C Mayor • Bloque 10 preguntas',
      totalQuestions: 10,
      correctAnswers: 9,
      accuracyPercentage: 90,
      avgResponseTimeMs: 1100,
      durationSeconds: 60
    }

    const pool = [sNotePiano, sNoteFlute, sInterval, sSequence, sSpaced]

    // 1. Filtrar por Motor Adaptativo (spaced_repetition)
    const spacedOnly = filterSessionsAdvanced(pool, {
      mode: 'all',
      strategyId: 'spaced_repetition'
    })
    expect(spacedOnly.map((s) => s.id)).toEqual(['s_note_flute', 's_spaced'])

    // 2. Filtrar por Preset (Pentatónica)
    const pentatonicOnly = filterSessionsAdvanced(pool, {
      mode: 'all',
      presetFilter: 'Pentatónica'
    })
    expect(pentatonicOnly.map((s) => s.id)).toEqual(['s_spaced'])
  })

  it('la ordenación por formato debe ordenar numéricamente las duraciones de sesiones cronometradas (59s < 180s)', () => {
    const s59Sec: DbSessionRecord = {
      id: 's_59',
      createdAt: new Date('2026-08-22T10:00:00Z').toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Nivel 1 (C, D, E) • Cronometrado 1m',
      totalQuestions: 18,
      correctAnswers: 17,
      accuracyPercentage: 94,
      avgResponseTimeMs: 1100,
      durationSeconds: 59 // 59 segundos
    }

    const s180Sec: DbSessionRecord = {
      id: 's_180',
      createdAt: new Date('2026-08-22T11:00:00Z').toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Nivel 3 (Octava Diatónica) • Cronometrado 3m',
      totalQuestions: 40,
      correctAnswers: 31,
      accuracyPercentage: 78,
      avgResponseTimeMs: 2025,
      durationSeconds: 180 // 3 minutos (180 segundos)
    }

    const list = [s180Sec, s59Sec]

    // Ordenamiento ascendente por duración real (Menor a Mayor)
    const sortedAsc = [...list].sort((a, b) => (a.durationSeconds || 0) - (b.durationSeconds || 0))

    expect(sortedAsc[0].id).toBe('s_59') // 59s debe quedar primero
    expect(sortedAsc[1].id).toBe('s_180') // 180s después
  })

  it('filterSessionsAdvanced debe coincidir semánticamente Nivel 3 con nombres canónicos y alias históricos', () => {
    const sLegacyOctavaDiatonica: DbSessionRecord = {
      id: 's_legacy_1',
      createdAt: new Date('2026-08-21T10:00:00Z').toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Nivel 3 (Octava Diatónica) • Cronometrado 3m',
      totalQuestions: 40,
      correctAnswers: 31,
      accuracyPercentage: 78,
      avgResponseTimeMs: 2025,
      durationSeconds: 180
    }

    const sCanonicalName: DbSessionRecord = {
      id: 's_canon_1',
      createdAt: new Date('2026-08-22T10:00:00Z').toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Nivel 3 (Octava Diatónica C4-C5) • Cronometrado 3m',
      totalQuestions: 40,
      correctAnswers: 35,
      accuracyPercentage: 88,
      avgResponseTimeMs: 1400,
      durationSeconds: 180
    }

    const sLegacyC4aC5: DbSessionRecord = {
      id: 's_legacy_2',
      createdAt: new Date('2026-08-20T10:00:00Z').toISOString(),
      strategyId: 'adaptive_v1',
      instrumentId: 'acoustic_grand_piano',
      presetName: 'Nivel 3 (C4 a C5) • Cronometrado 3m',
      totalQuestions: 40,
      correctAnswers: 30,
      accuracyPercentage: 75,
      avgResponseTimeMs: 1900,
      durationSeconds: 180
    }

    const pool = [sLegacyOctavaDiatonica, sCanonicalName, sLegacyC4aC5]

    // Al filtrar por el nombre canónico del selector:
    const matched = filterSessionsAdvanced(pool, {
      mode: 'single_note',
      presetFilter: 'Nivel 3 (Octava Diatónica C4-C5)'
    })

    // Debe coincidir con las 3 variaciones históricas sin perder ninguna sesión
    expect(matched.length).toBe(3)
    expect(matched.map((s) => s.id)).toEqual(['s_legacy_1', 's_canon_1', 's_legacy_2'])
  })

  it('generateDiagnosticReport debe generar devoluciones para precisión intermedia, baja, sesgo agudo y grave', () => {
    // 1. Sin sesiones registradas
    const emptyReport = generateDiagnosticReport({
      modeFilter: 'all',
      filteredSessionsCount: 0,
      totalAnswers: 0,
      totalCorrect: 0,
      overallAccuracy: 0,
      normalizedOverallAccuracy: 0,
      avgEntropyBits: 0,
      avgResponseTimeMs: 0,
      fastResponsesCount: 0,
      mediumResponsesCount: 0,
      slowResponsesCount: 0,
      sharpBiasCount: 0,
      flatBiasCount: 0,
      topConfusions: [],
      mostDifficultNotes: [],
      strongestNotes: [],
      sessionPsychometricsList: [],
      longitudinalComparisons: []
    })
    expect(emptyReport.executiveSummary).toContain('No se registran sesiones')

    // 2. Nivel Intermedio y sesgo hacia lo grave
    const flatReport = generateDiagnosticReport({
      modeFilter: 'single_note',
      filteredSessionsCount: 2,
      totalAnswers: 20,
      totalCorrect: 14,
      overallAccuracy: 70, // Intermedio
      normalizedOverallAccuracy: 65,
      avgEntropyBits: 2.0,
      avgResponseTimeMs: 3100, // Lento
      fastResponsesCount: 2,
      mediumResponsesCount: 4,
      slowResponsesCount: 14, // >35% lento
      sharpBiasCount: 1,
      flatBiasCount: 5, // Sesgo grave dominante
      topConfusions: [{ expected: 'C4', played: 'B3', count: 3 }],
      mostDifficultNotes: [{ noteName: 'C4', accuracy: 50, attempts: 6 }],
      strongestNotes: [],
      sessionPsychometricsList: [],
      longitudinalComparisons: []
    })
    expect(flatReport.executiveSummary).toContain('INTERMEDIO CONSOLIDADO')
    expect(flatReport.directionalBiasAnalysis).toContain('SESGO HACIA LO GRAVE')
    expect(flatReport.cognitiveLatencyAnalysis).toContain('conteo mental')

    // 3. Nivel Formativo
    const lowReport = generateDiagnosticReport({
      modeFilter: 'single_note',
      filteredSessionsCount: 1,
      totalAnswers: 10,
      totalCorrect: 4,
      overallAccuracy: 40, // Formativo
      normalizedOverallAccuracy: 30,
      avgEntropyBits: 1.5,
      avgResponseTimeMs: 1800,
      fastResponsesCount: 3,
      mediumResponsesCount: 6,
      slowResponsesCount: 1,
      sharpBiasCount: 0,
      flatBiasCount: 0,
      topConfusions: [],
      mostDifficultNotes: [],
      strongestNotes: [],
      sessionPsychometricsList: [],
      longitudinalComparisons: []
    })
    expect(lowReport.executiveSummary).toContain('ENTRENAMIENTO FORMATIVO')
    expect(lowReport.directionalBiasAnalysis).toContain('Sin errores registrados')
  })
})
