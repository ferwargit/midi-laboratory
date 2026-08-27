import { describe, it, expect } from 'vitest'
import {
  computeAnalyticsMetrics,
  filterSessionsByMode,
  filterSessionsAdvanced,
  computeLongitudinalComparisons,
  reconstructSessionConfig,
  calculateSessionCPI,
  formatInterSessionGap,
  resolveSessionFormat,
  computeNotePerformancesFromAnswers,
  analyzeSessionTimeline,
  computePitchClassConfusionMatrix,
  isIntervalSession,
  isSingleNoteSession,
  isSequenceSession
} from './historyAnalytics'
import { generateDiagnosticReport } from './diagnosticReportGenerator'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'

describe('historyAnalytics - Psicometría, Micro-Telemetría, Matriz 2D y Filtros', () => {
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

  describe('resolveSessionFormat - Resolución Canónica de Formatos (SSOT)', () => {
    it('debe resolver Modo Maestría con su etiqueta', () => {
      const s = { ...sNotePiano, presetName: 'Nivel 1 • Modo Maestría' }
      const res = resolveSessionFormat(s)
      expect(res.formatType).toBe('mastery')
      expect(res.formatLabel).toBe('🎯 Maestría')
    })

    it('debe extraer minutos nominales explícitos de sesiones cronometradas', () => {
      const s1 = { ...sNotePiano, presetName: 'Nivel 1 • Cronometrado 3m' }
      const s2 = { ...sNotePiano, presetName: 'Nivel 1 • Tiempo 5 min' }
      expect(resolveSessionFormat(s1).nominalMinutes).toBe(3)
      expect(resolveSessionFormat(s1).formatLabel).toBe('⏱️ 3m 0s')
      expect(resolveSessionFormat(s2).nominalMinutes).toBe(5)
      expect(resolveSessionFormat(s2).formatLabel).toBe('⏱️ 5m 0s')
    })

    it('debe estimar minutos nominales desde durationSeconds cuando no están en el nombre', () => {
      expect(
        resolveSessionFormat({ ...sNotePiano, presetName: 'Tiempo', durationSeconds: 50 })
          .nominalMinutes
      ).toBe(1)
      expect(
        resolveSessionFormat({ ...sNotePiano, presetName: 'Tiempo', durationSeconds: 180 })
          .nominalMinutes
      ).toBe(3)
      expect(
        resolveSessionFormat({ ...sNotePiano, presetName: 'Tiempo', durationSeconds: 300 })
          .nominalMinutes
      ).toBe(5)
      expect(
        resolveSessionFormat({ ...sNotePiano, presetName: 'Tiempo', durationSeconds: 600 })
          .nominalMinutes
      ).toBe(10)
    })

    it('debe resolver series de preguntas', () => {
      const s = { ...sNotePiano, presetName: 'Nivel 1 • Bloque 20 preguntas' }
      const res = resolveSessionFormat(s)
      expect(res.formatType).toBe('questions')
      expect(res.nominalQuestions).toBe(20)
      expect(res.formatLabel).toBe('🔢 Serie 20')
    })
  })

  describe('computeNotePerformancesFromAnswers - Mapa de Rendimiento por Nota', () => {
    it('debe calcular estadísticas por cada nota individual', () => {
      const answers: DbAnswerRecord[] = [
        {
          id: '1',
          sessionId: 's1',
          questionIndex: 1,
          expectedNote: 60,
          playedNote: 60,
          isCorrect: true,
          semitoneDistance: 0,
          responseTimeMs: 1000,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: ''
        },
        {
          id: '2',
          sessionId: 's1',
          questionIndex: 2,
          expectedNote: 60,
          playedNote: 62,
          isCorrect: false,
          semitoneDistance: 2,
          responseTimeMs: 1200,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: ''
        },
        {
          id: '3',
          sessionId: 's1',
          questionIndex: 3,
          expectedNote: 64,
          playedNote: 64,
          isCorrect: true,
          semitoneDistance: 0,
          responseTimeMs: 800,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: ''
        }
      ]

      const perfs = computeNotePerformancesFromAnswers(answers)
      expect(perfs.size).toBe(2)
      expect(perfs.get(60)?.attempts).toBe(2)
      expect(perfs.get(60)?.correct).toBe(1)
      expect(perfs.get(60)?.accuracyPercentage).toBe(50)
      expect(perfs.get(60)?.lastResultWasCorrect).toBe(false)
      expect(perfs.get(64)?.accuracyPercentage).toBe(100)
    })
  })

  describe('analyzeSessionTimeline - Micro-Telemetría, Calentamiento, Fatiga y PES', () => {
    it('debe detectar foco inicial sin errores (warm-up = 0) y sin fatiga', () => {
      const answers: DbAnswerRecord[] = Array.from({ length: 6 }, (_, i) => ({
        id: `a_${i}`,
        sessionId: 's_test',
        questionIndex: i + 1,
        expectedNote: 60,
        playedNote: 60,
        isCorrect: true,
        semitoneDistance: 0,
        responseTimeMs: 1000,
        velocity: 90,
        reasonTelemetry: '',
        createdAt: new Date().toISOString()
      }))

      const timeline = analyzeSessionTimeline(sNotePiano, answers)
      expect(timeline.totalQuestions).toBe(6)
      expect(timeline.warmUpErrorsCount).toBe(0)
      expect(timeline.postErrorSlowingAvgDeltaMs).toBeNull()
      expect(timeline.fatigueDetected).toBe(false)
    })

    it('debe calcular desaceleración post-error (PES) y detectar fatiga cuando la latencia se dispara en 2da mitad', () => {
      // 6 preguntas en 1era mitad rápidas (800ms) + 6 preguntas en 2da mitad lentas (1500ms) con errores
      const firstHalf: DbAnswerRecord[] = Array.from({ length: 6 }, (_, i) => ({
        id: `fh_${i}`,
        sessionId: 's_fatigue',
        questionIndex: i + 1,
        expectedNote: 60,
        playedNote: 60,
        isCorrect: true,
        semitoneDistance: 0,
        responseTimeMs: 800,
        velocity: 90,
        reasonTelemetry: '',
        createdAt: ''
      }))

      const secondHalf: DbAnswerRecord[] = [
        {
          id: 'sh_1',
          sessionId: 's_fatigue',
          questionIndex: 7,
          expectedNote: 62,
          playedNote: 64,
          isCorrect: false,
          semitoneDistance: 2,
          responseTimeMs: 1200,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: ''
        },
        {
          id: 'sh_2',
          sessionId: 's_fatigue',
          questionIndex: 8,
          expectedNote: 60,
          playedNote: 60,
          isCorrect: true,
          semitoneDistance: 0,
          responseTimeMs: 1900,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: ''
        },
        {
          id: 'sh_3',
          sessionId: 's_fatigue',
          questionIndex: 9,
          expectedNote: 60,
          playedNote: 60,
          isCorrect: true,
          semitoneDistance: 0,
          responseTimeMs: 1800,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: ''
        },
        {
          id: 'sh_4',
          sessionId: 's_fatigue',
          questionIndex: 10,
          expectedNote: 60,
          playedNote: 60,
          isCorrect: true,
          semitoneDistance: 0,
          responseTimeMs: 1700,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: ''
        },
        {
          id: 'sh_5',
          sessionId: 's_fatigue',
          questionIndex: 11,
          expectedNote: 60,
          playedNote: 60,
          isCorrect: true,
          semitoneDistance: 0,
          responseTimeMs: 1800,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: ''
        },
        {
          id: 'sh_6',
          sessionId: 's_fatigue',
          questionIndex: 12,
          expectedNote: 60,
          playedNote: 60,
          isCorrect: true,
          semitoneDistance: 0,
          responseTimeMs: 1900,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: ''
        }
      ]

      const timeline = analyzeSessionTimeline(sNotePiano, [...firstHalf, ...secondHalf])
      expect(timeline.totalQuestions).toBe(12)
      expect(timeline.fatigueDetected).toBe(true)
      expect(timeline.postErrorSlowingAvgDeltaMs).toBeGreaterThan(0)
    })
  })

  describe('computePitchClassConfusionMatrix - Matriz 2D de Confusión', () => {
    it('debe mapear aciertos a la diagonal y confusiones fuera de la diagonal', () => {
      const answers: DbAnswerRecord[] = [
        {
          id: '1',
          sessionId: 's1',
          questionIndex: 1,
          expectedNote: 60,
          playedNote: 60,
          isCorrect: true,
          semitoneDistance: 0,
          responseTimeMs: 1000,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: ''
        },
        {
          id: '2',
          sessionId: 's1',
          questionIndex: 2,
          expectedNote: 64,
          playedNote: 65,
          isCorrect: false,
          semitoneDistance: 1,
          responseTimeMs: 1000,
          velocity: 90,
          reasonTelemetry: '',
          createdAt: ''
        }
      ]

      const matrix = computePitchClassConfusionMatrix(answers)
      expect(matrix.pitchClasses.length).toBe(12)
      expect(matrix.grid[0][0].count).toBe(1) // C -> C
      expect(matrix.grid[0][0].isDiagonal).toBe(true)
      expect(matrix.grid[4][5].count).toBe(1) // E -> F (+1st)
      expect(matrix.grid[4][5].isDiagonal).toBe(false)
      expect(matrix.maxOffDiagonalCount).toBe(1)
    })
  })

  describe('formatInterSessionGap & calculateSessionCPI', () => {
    it('formatInterSessionGap debe formatear descansos en minutos, horas y días', () => {
      expect(formatInterSessionGap(null)).toBe('Inicio')
      expect(formatInterSessionGap(-10)).toBe('Inicio')
      expect(formatInterSessionGap(30000)).toBe('Inmediato')
      expect(formatInterSessionGap(900000)).toBe('15 min')
      expect(formatInterSessionGap(7200000)).toBe('2 h')
      expect(formatInterSessionGap(172800000)).toBe('2 d')
    })

    it('calculateSessionCPI debe retornar 0 si la precisión es <= 0 y ponderar entradas', () => {
      expect(calculateSessionCPI(0, 2.0, 15, 1000, 'hardware')).toBe(0)
      const hwScore = calculateSessionCPI(90, 2.0, 20, 1000, 'hardware')
      const virtScore = calculateSessionCPI(90, 2.0, 20, 1000, 'virtual')
      expect(hwScore).toBeGreaterThan(virtScore)
    })
  })

  describe('Filtros Avanzados y Clasificadores', () => {
    it('filterSessionsByMode segmenta sin colisiones', () => {
      const all = [sNotePiano, sNoteFlute, sInterval, sSequence]
      expect(filterSessionsByMode(all, 'all').length).toBe(4)
      expect(filterSessionsByMode(all, 'single_note').length).toBe(2)
      expect(filterSessionsByMode(all, 'intervals').length).toBe(1)
      expect(filterSessionsByMode(all, 'sequences').length).toBe(1)
    })

    it('filterSessionsAdvanced filtra por Instrumento, Formato y Búsqueda', () => {
      const all = [sNotePiano, sNoteFlute, sInterval, sSequence]
      expect(
        filterSessionsAdvanced(all, { mode: 'single_note', instrumentId: 'flute' }).length
      ).toBe(1)
      expect(filterSessionsAdvanced(all, { mode: 'all', format: 'time_1' }).length).toBe(1)
      expect(filterSessionsAdvanced(all, { mode: 'all', searchQuery: 'Piano' }).length).toBe(3)
    })

    it('isIntervalSession, isSingleNoteSession e isSequenceSession clasifican con targetMode canónico', () => {
      expect(isSingleNoteSession({ ...sNotePiano, targetMode: 'single_note' })).toBe(true)
      expect(isIntervalSession({ ...sInterval, targetMode: 'intervals' })).toBe(true)
      expect(isSequenceSession({ ...sSequence, targetMode: 'sequences' })).toBe(true)
    })
  })

  describe('reconstructSessionConfig - Clonación de Sesiones', () => {
    it('reconstruye sesiones de nota individual', () => {
      const conf = reconstructSessionConfig(sNotePiano, mockAnswers)
      expect(conf.targetMode).toBe('single_note')
      expect(conf.recommendedNotes).toEqual([60, 62, 64])
      expect(conf.durationMinutes).toBe(1)
    })

    it('reconstruye sesiones de intervalos y secuencias', () => {
      const intConf = reconstructSessionConfig(sInterval, [
        { ...mockAnswers[0], sessionId: 's_int', reasonTelemetry: '4 st (ascending)' }
      ])
      expect(intConf.targetMode).toBe('intervals')
      expect(intConf.recommendedIntervals).toEqual([4])

      const seqConf = reconstructSessionConfig(sSequence, [
        { ...mockAnswers[0], sessionId: 's_seq', reasonTelemetry: 'Secuencia: [60, 64, 67]' }
      ])
      expect(seqConf.targetMode).toBe('sequences')
      expect(seqConf.sequenceLength).toBe(3)
      expect(seqConf.recommendedNotes).toEqual([60, 64, 67])
    })
  })

  describe('computeLongitudinalComparisons & computeAnalyticsMetrics', () => {
    it('computeLongitudinalComparisons calcula deltas correctamente', () => {
      const s1: DbSessionRecord = {
        ...sNotePiano,
        id: 'base',
        createdAt: '2026-08-10T10:00:00Z',
        accuracyPercentage: 60,
        avgResponseTimeMs: 1500
      }
      const s2: DbSessionRecord = {
        ...sNotePiano,
        id: 'retest',
        createdAt: '2026-08-20T10:00:00Z',
        accuracyPercentage: 90,
        avgResponseTimeMs: 1000
      }

      const details = [
        {
          session: s1,
          poolSize: 3,
          entropyBits: 1.58,
          chanceBaseline: 33,
          normalizedAccuracy: 40,
          responsesPerMinute: 10,
          fastPercent: 20,
          mediumPercent: 60,
          slowPercent: 20,
          sharpBiasCount: 0,
          flatBiasCount: 0,
          dominantBias: 'balanced' as const,
          formatType: 'time' as const,
          formatLabel: '⏱️ 1m 0s',
          inputMethod: 'hardware' as const,
          interSessionGapMs: null,
          interSessionGapLabel: 'Inicio',
          cpiScore: 400
        },
        {
          session: s2,
          poolSize: 3,
          entropyBits: 1.58,
          chanceBaseline: 33,
          normalizedAccuracy: 85,
          responsesPerMinute: 15,
          fastPercent: 80,
          mediumPercent: 20,
          slowPercent: 0,
          sharpBiasCount: 0,
          flatBiasCount: 0,
          dominantBias: 'balanced' as const,
          formatType: 'time' as const,
          formatLabel: '⏱️ 1m 0s',
          inputMethod: 'hardware' as const,
          interSessionGapMs: 864000000,
          interSessionGapLabel: '10 d',
          cpiScore: 900
        }
      ]

      const comps = computeLongitudinalComparisons(details)
      expect(comps.length).toBe(1)
      expect(comps[0].rawAccuracyDelta).toBe(30)
      expect(comps[0].responseTimeDeltaMs).toBe(-500)
      expect(comps[0].isImproved).toBe(true)
    })

    it('computeAnalyticsMetrics maneja conjunto vacío y calcula sesgos asimétricos', () => {
      const empty = computeAnalyticsMetrics([], [], 'all')
      expect(empty.totalAnswers).toBe(0)
      expect(empty.overallAccuracy).toBe(0)

      const metrics = computeAnalyticsMetrics([sNotePiano, sNoteFlute], mockAnswers, 'single_note')
      expect(metrics.totalAnswers).toBe(2)
      expect(metrics.filteredSessionsCount).toBe(2)
    })

    it('generateDiagnosticReport genera plan clínico', () => {
      const metrics = computeAnalyticsMetrics([sNotePiano], [mockAnswers[0]], 'single_note')
      const report = generateDiagnosticReport(metrics)
      expect(report.title).toBeDefined()
      expect(report.concreteActionPlan.length).toBeGreaterThan(0)
    })
  })
})
