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
  isSequenceSession,
  BIAS_DOMINANCE_RATIO,
  ISI_THRESHOLDS,
  DetailedSessionAnalysis
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

  describe('filterSessionsAdvanced - Umbral de maestría 60', () => {
    const sCritical = { ...sNotePiano, id: 's_59', accuracyPercentage: 59 }
    const sLearningLow = { ...sNotePiano, id: 's_60', accuracyPercentage: 60 }
    const sLearningHigh = { ...sNotePiano, id: 's_84', accuracyPercentage: 84 }
    const sMastered = { ...sNotePiano, id: 's_85', accuracyPercentage: 85 }
    const boundarySessions = [sCritical, sLearningLow, sLearningHigh, sMastered]

    it('critical incluye solo precisión estrictamente menor a 60', () => {
      const critical = filterSessionsAdvanced(boundarySessions, {
        mode: 'all',
        mastery: 'critical'
      })
      expect(critical.map((s) => s.id)).toEqual(['s_59'])
    })

    it('learning abarca exactamente el rango 60..84', () => {
      const learning = filterSessionsAdvanced(boundarySessions, {
        mode: 'all',
        mastery: 'learning'
      })
      expect(learning.map((s) => s.id)).toEqual(['s_60', 's_84'])
    })

    it('mastered incluye solo precisión mayor o igual a 85', () => {
      const mastered = filterSessionsAdvanced(boundarySessions, {
        mode: 'all',
        mastery: 'mastered'
      })
      expect(mastered.map((s) => s.id)).toEqual(['s_85'])
    })
  })

  describe('Filtros Avanzados de Sesión en el Dominio Puro (F-01 / F-02 / F-04)', () => {
    const makeAnswer = (
      id: string,
      sessionId: string,
      semitoneDistance: number,
      inputSource: 'midi_hardware' | 'virtual_ui' = 'midi_hardware'
    ): DbAnswerRecord => ({
      id,
      sessionId,
      questionIndex: 1,
      expectedNote: 60,
      playedNote: 60 + semitoneDistance,
      isCorrect: semitoneDistance === 0,
      semitoneDistance,
      responseTimeMs: 1000,
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString(),
      inputSource
    })

    it('1.1 filterSessionsAdvanced filtra por inputSource (hardware / virtual / mixed / all)', () => {
      const sHw = { ...sNotePiano, id: 's_hw' }
      const sVirt = { ...sNotePiano, id: 's_virt' }
      const sMixed = { ...sNotePiano, id: 's_mixed' }
      const answers: DbAnswerRecord[] = [
        makeAnswer('h1', 's_hw', 0, 'midi_hardware'),
        makeAnswer('v1', 's_virt', 0, 'virtual_ui'),
        makeAnswer('m1', 's_mixed', 0, 'midi_hardware'),
        makeAnswer('m2', 's_mixed', 0, 'virtual_ui')
      ]
      const all = [sHw, sVirt, sMixed]

      expect(
        filterSessionsAdvanced(all, { mode: 'all', inputSource: 'virtual' }, answers).map(
          (s) => s.id
        )
      ).toEqual(['s_virt'])
      expect(
        filterSessionsAdvanced(all, { mode: 'all', inputSource: 'hardware' }, answers).map(
          (s) => s.id
        )
      ).toEqual(['s_hw'])
      expect(
        filterSessionsAdvanced(all, { mode: 'all', inputSource: 'all' }, answers).map((s) => s.id)
      ).toEqual(['s_hw', 's_virt', 's_mixed'])
    })

    it('1.2 filterSessionsAdvanced filtra por biasFilter contra el sesgo dominante', () => {
      const sSharp = { ...sNotePiano, id: 's_sharp' }
      const sBalanced = { ...sNotePiano, id: 's_balanced' }
      const answers: DbAnswerRecord[] = [
        // 3 errores agudos vs 2 graves -> sharp bajo 1.4 (3 > 2 * 1.4)
        makeAnswer('sh1', 's_sharp', 2),
        makeAnswer('sh2', 's_sharp', 2),
        makeAnswer('sh3', 's_sharp', 1),
        makeAnswer('fl1', 's_sharp', -2),
        makeAnswer('fl2', 's_sharp', -1),
        // 2 agudos vs 2 graves -> balanced
        makeAnswer('b1', 's_balanced', 2),
        makeAnswer('b2', 's_balanced', 1),
        makeAnswer('b3', 's_balanced', -2),
        makeAnswer('b4', 's_balanced', -1)
      ]
      const all = [sSharp, sBalanced]

      expect(
        filterSessionsAdvanced(all, { mode: 'all', biasFilter: 'sharp' }, answers).map((s) => s.id)
      ).toEqual(['s_sharp'])
      expect(
        filterSessionsAdvanced(all, { mode: 'all', biasFilter: 'balanced' }, answers).map(
          (s) => s.id
        )
      ).toEqual(['s_balanced'])
    })

    it('1.3 filterSessionsAdvanced clasifica las bandas ISI (massed / optimal / spaced)', () => {
      const t0 = new Date('2026-09-01T10:00:00Z').getTime()
      const sFirst = { ...sNotePiano, id: 's_first', createdAt: new Date(t0).toISOString() }
      const sMassed = {
        ...sNotePiano,
        id: 's_massed',
        createdAt: new Date(t0 + 600000).toISOString()
      }
      const sOptimal = {
        ...sNotePiano,
        id: 's_optimal',
        createdAt: new Date(t0 + 600000 + 50000000).toISOString()
      }
      const sSpaced = {
        ...sNotePiano,
        id: 's_spaced',
        createdAt: new Date(t0 + 600000 + 50000000 + 200000000).toISOString()
      }
      const all = [sFirst, sMassed, sOptimal, sSpaced]

      expect(
        filterSessionsAdvanced(all, { mode: 'all', isiFilter: 'massed' }).map((s) => s.id)
      ).toEqual(['s_massed'])
      expect(
        filterSessionsAdvanced(all, { mode: 'all', isiFilter: 'optimal' }).map((s) => s.id)
      ).toEqual(['s_optimal'])
      expect(
        filterSessionsAdvanced(all, { mode: 'all', isiFilter: 'spaced' }).map((s) => s.id)
      ).toEqual(['s_spaced'])
    })

    it('1.4 (F-02) la primera sesion (gap === null) no pertenece a ninguna banda ISI', () => {
      const single = [{ ...sNotePiano, id: 's_only' }]

      expect(
        filterSessionsAdvanced(single, { mode: 'all', isiFilter: 'spaced' }).map((s) => s.id)
      ).toEqual([])
      expect(
        filterSessionsAdvanced(single, { mode: 'all', isiFilter: 'massed' }).map((s) => s.id)
      ).toEqual([])
      expect(
        filterSessionsAdvanced(single, { mode: 'all', isiFilter: 'optimal' }).map((s) => s.id)
      ).toEqual([])
      expect(
        filterSessionsAdvanced(single, { mode: 'all', isiFilter: 'all' }).map((s) => s.id)
      ).toEqual(['s_only'])
    })

    it('1.5 BIAS_DOMINANCE_RATIO e ISI_THRESHOLDS exponen los umbrales canónicos de la SSOT', () => {
      expect(BIAS_DOMINANCE_RATIO).toBe(1.4)
      expect(ISI_THRESHOLDS.MASSED_MAX_MS).toBe(900000)
      expect(ISI_THRESHOLDS.OPTIMAL_MIN_MS).toBe(43200000)
      expect(ISI_THRESHOLDS.OPTIMAL_MAX_MS).toBe(172800000)

      const answers: DbAnswerRecord[] = [
        makeAnswer('x1', 's_note_piano', 2),
        makeAnswer('x2', 's_note_piano', 2),
        makeAnswer('x3', 's_note_piano', 1),
        makeAnswer('y1', 's_note_piano', -2),
        makeAnswer('y2', 's_note_piano', -1)
      ]
      const metrics = computeAnalyticsMetrics([sNotePiano], answers, 'all')
      expect(metrics.sharpBiasCount).toBe(3)
      expect(metrics.flatBiasCount).toBe(2)
      expect(metrics.sessionPsychometricsList[0].dominantBias).toBe('sharp')
    })

    it('1.6 (F-04) generateDiagnosticReport coincide con el motor en el sesgo direccional', () => {
      // 3 agudos vs 2 graves: sharp bajo 1.4 (3 > 2.8) pero balanced bajo 1.5 (3 <= 3)
      const session = { ...sNotePiano, id: 's_bias_report' }
      const answers: DbAnswerRecord[] = [
        makeAnswer('r1', 's_bias_report', 2),
        makeAnswer('r2', 's_bias_report', 2),
        makeAnswer('r3', 's_bias_report', 1),
        makeAnswer('r4', 's_bias_report', -2),
        makeAnswer('r5', 's_bias_report', -1)
      ]
      const metrics = computeAnalyticsMetrics([session], answers, 'all')
      expect(metrics.sharpBiasCount).toBe(3)
      expect(metrics.flatBiasCount).toBe(2)
      expect(metrics.sessionPsychometricsList[0].dominantBias).toBe('sharp')

      const report = generateDiagnosticReport(metrics)
      expect(report.directionalBiasAnalysis).toContain('AGUDO')
    })

    it('1.6b (spec) informe y motor coinciden con 7 agudos / 2 graves', () => {
      const session = { ...sNotePiano, id: 's_bias_72' }
      const answers: DbAnswerRecord[] = [
        ...Array.from({ length: 7 }, (_, i) => makeAnswer(`p${i}`, 's_bias_72', 2)),
        ...Array.from({ length: 2 }, (_, i) => makeAnswer(`q${i}`, 's_bias_72', -2))
      ]
      const metrics = computeAnalyticsMetrics([session], answers, 'all')
      expect(metrics.sharpBiasCount).toBe(7)
      expect(metrics.flatBiasCount).toBe(2)
      expect(generateDiagnosticReport(metrics).directionalBiasAnalysis).toContain('AGUDO')
    })

    it('1.7 los tres filtros nuevos se combinan conjuntamente con los existentes', () => {
      const sMatch = { ...sNotePiano, id: 's_match' }
      const sWrongInput = { ...sNotePiano, id: 's_wrong_input' }
      const sWrongBias = { ...sNotePiano, id: 's_wrong_bias' }
      const sWrongMode = { ...sInterval, id: 's_wrong_mode' }

      const answers: DbAnswerRecord[] = [
        // sMatch: single_note + hardware + sharp (3 agudos vs 2 graves)
        makeAnswer('a1', 's_match', 2, 'midi_hardware'),
        makeAnswer('a2', 's_match', 2, 'midi_hardware'),
        makeAnswer('a3', 's_match', 1, 'midi_hardware'),
        makeAnswer('a4', 's_match', -2, 'midi_hardware'),
        makeAnswer('a5', 's_match', -1, 'midi_hardware'),
        // sWrongInput: single_note + virtual + sharp
        makeAnswer('b1', 's_wrong_input', 2, 'virtual_ui'),
        makeAnswer('b2', 's_wrong_input', 2, 'virtual_ui'),
        makeAnswer('b3', 's_wrong_input', 1, 'virtual_ui'),
        makeAnswer('b4', 's_wrong_input', -2, 'virtual_ui'),
        makeAnswer('b5', 's_wrong_input', -1, 'virtual_ui'),
        // sWrongBias: single_note + hardware + balanced (2 agudos vs 2 graves)
        makeAnswer('c1', 's_wrong_bias', 2, 'midi_hardware'),
        makeAnswer('c2', 's_wrong_bias', 1, 'midi_hardware'),
        makeAnswer('c3', 's_wrong_bias', -2, 'midi_hardware'),
        makeAnswer('c4', 's_wrong_bias', -1, 'midi_hardware'),
        // sWrongMode: intervals + hardware + sharp
        makeAnswer('d1', 's_wrong_mode', 2, 'midi_hardware'),
        makeAnswer('d2', 's_wrong_mode', 2, 'midi_hardware'),
        makeAnswer('d3', 's_wrong_mode', 1, 'midi_hardware'),
        makeAnswer('d4', 's_wrong_mode', -2, 'midi_hardware'),
        makeAnswer('d5', 's_wrong_mode', -1, 'midi_hardware')
      ]
      const all = [sMatch, sWrongInput, sWrongBias, sWrongMode]

      expect(
        filterSessionsAdvanced(
          all,
          { mode: 'single_note', inputSource: 'hardware', biasFilter: 'sharp' },
          answers
        ).map((s) => s.id)
      ).toEqual(['s_match'])
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

  describe('Casos Borde de la Auditoría Frente 3 (F-06/F-09/F-13)', () => {
    it('F-13: analyzeSessionTimeline con sesión vacía no reporta 100% de confianza ni reparación', () => {
      const timeline = analyzeSessionTimeline(sNotePiano, [])
      expect(timeline.totalQuestions).toBe(0)
      expect(timeline.overallAccuracy).toBe(0)
      expect(timeline.avgLatencyMs).toBe(0)
      expect(timeline.firstHalfAccuracy).toBe(0)
      expect(timeline.secondHalfAccuracy).toBe(0)
      expect(timeline.firstListenConfidencePercent).toBe(0)
      expect(timeline.errorRepairRatePercent).toBe(0)
    })

    it('F-06/F-14: resolveNominalPoolSize respeta niveles de dos dígitos y aplica piso >= 2', () => {
      const answerFor = (sessionId: string): DbAnswerRecord => ({
        id: `ans_${sessionId}`,
        sessionId,
        questionIndex: 1,
        expectedNote: 60,
        playedNote: 60,
        isCorrect: true,
        semitoneDistance: 0,
        responseTimeMs: 1000,
        velocity: 90,
        reasonTelemetry: '',
        createdAt: new Date().toISOString()
      })

      // "Nivel 10" contiene la subcadena "nivel 1": el bug F-14 devolvía poolSize 3.
      const sLevel10: DbSessionRecord = {
        ...sNotePiano,
        id: 's_level10',
        presetName: 'Nivel 10 (Custom) • Notas personalizadas (11)'
      }
      const metrics10 = computeAnalyticsMetrics([sLevel10], [answerFor('s_level10')], 'all')
      expect(metrics10.sessionPsychometricsList[0].poolSize).toBe(11)

      // Pool personalizado de 1 nota debe pisarse a 2 (F-06).
      const sPool1: DbSessionRecord = {
        ...sNotePiano,
        id: 's_pool1',
        presetName: 'Notas Personalizadas (1)'
      }
      const metricsPool1 = computeAnalyticsMetrics([sPool1], [answerFor('s_pool1')], 'all')
      expect(metricsPool1.sessionPsychometricsList[0].poolSize).toBe(2)
    })

    it('F-09: computeLongitudinalComparisons acumula el total de preguntas evaluadas en totalAttempts', () => {
      const s1: DbSessionRecord = {
        ...sNotePiano,
        id: 'long_base',
        createdAt: '2026-08-10T10:00:00Z'
      }
      const s2: DbSessionRecord = {
        ...sNotePiano,
        id: 'long_retest',
        createdAt: '2026-08-20T10:00:00Z'
      }

      const buildDetail = (session: DbSessionRecord): DetailedSessionAnalysis => ({
        session,
        poolSize: 3,
        entropyBits: 1.58,
        chanceBaseline: 33,
        normalizedAccuracy: 70,
        responsesPerMinute: 12,
        fastPercent: 50,
        mediumPercent: 40,
        slowPercent: 10,
        sharpBiasCount: 0,
        flatBiasCount: 0,
        dominantBias: 'balanced' as const,
        formatType: 'questions' as const,
        formatLabel: '🔢 Serie 10',
        inputMethod: 'hardware' as const,
        interSessionGapMs: null,
        interSessionGapLabel: 'Inicio',
        cpiScore: 500
      })

      const comps = computeLongitudinalComparisons([buildDetail(s1), buildDetail(s2)])
      expect(comps.length).toBe(1)
      // El bug F-09 asignaba sorted.length (2) en lugar del total de preguntas (10 + 10).
      expect(comps[0].totalAttempts).toBe(20)
    })
  })
})
