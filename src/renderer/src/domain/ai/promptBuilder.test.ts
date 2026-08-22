import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder'
import { AnalyticsMetrics } from '../analytics/historyAnalytics'

describe('promptBuilder - Generación de Prompts Especializados y Telemetría Clínica', () => {
  const mockMetrics: AnalyticsMetrics = {
    modeFilter: 'single_note',
    filteredSessionsCount: 2,
    totalAnswers: 20,
    totalCorrect: 16,
    overallAccuracy: 80,
    normalizedOverallAccuracy: 75,
    avgEntropyBits: 1.58,
    avgResponseTimeMs: 1350,
    fastResponsesCount: 14,
    mediumResponsesCount: 4,
    slowResponsesCount: 2,
    sharpBiasCount: 3,
    flatBiasCount: 1,
    topConfusions: [{ expected: 'C#4', played: 'D4', count: 2 }],
    mostDifficultNotes: [{ noteName: 'C#4', accuracy: 50, attempts: 4 }],
    strongestNotes: [{ noteName: 'C4', accuracy: 100, attempts: 6 }],
    sessionPsychometricsList: [
      {
        session: {
          id: 'session_test_1',
          createdAt: new Date('2026-08-21T10:00:00Z').toISOString(),
          strategyId: 'adaptive_v1',
          instrumentId: 'acoustic_grand_piano',
          presetName: 'Nivel 1 (C, D, E)',
          totalQuestions: 10,
          correctAnswers: 8,
          accuracyPercentage: 80,
          avgResponseTimeMs: 1350,
          durationSeconds: 60
        },
        poolSize: 3,
        entropyBits: 1.58,
        chanceBaseline: 33,
        normalizedAccuracy: 70,
        responsesPerMinute: 10,
        fastPercent: 70,
        mediumPercent: 20,
        slowPercent: 10,
        sharpBiasCount: 2,
        flatBiasCount: 0,
        dominantBias: 'sharp',
        formatType: 'time'
      }
    ],
    // Comparativa longitudinal de prueba (Baseline vs Retest)
    longitudinalComparisons: [
      {
        contentName: 'Nivel 1 (C, D, E)',
        baselineSession: {
          id: 'session_base_1',
          createdAt: new Date('2026-08-10T10:00:00Z').toISOString(),
          strategyId: 'adaptive_v1',
          instrumentId: 'acoustic_grand_piano',
          presetName: 'Nivel 1 (C, D, E)',
          totalQuestions: 10,
          correctAnswers: 6,
          accuracyPercentage: 60,
          avgResponseTimeMs: 1800,
          durationSeconds: 60
        },
        latestSession: {
          id: 'session_test_1',
          createdAt: new Date('2026-08-21T10:00:00Z').toISOString(),
          strategyId: 'adaptive_v1',
          instrumentId: 'acoustic_grand_piano',
          presetName: 'Nivel 1 (C, D, E)',
          totalQuestions: 10,
          correctAnswers: 8,
          accuracyPercentage: 80,
          avgResponseTimeMs: 1350,
          durationSeconds: 60
        },
        totalAttempts: 2,
        rawAccuracyDelta: 20, // +20%
        normalizedAccuracyDelta: 25,
        responseTimeDeltaMs: -450, // 450ms más rápido
        rpmDelta: 3.5, // +3.5 RPM
        isImproved: true
      }
    ]
  }

  describe('buildSystemPrompt', () => {
    it('genera directivas especializadas para single_note con catálogo formal', () => {
      const prompt = buildSystemPrompt('single_note')
      expect(prompt).toContain('Profesor de Oído Musical')
      expect(prompt).toContain('ENFOQUE CLÍNICO PARA NOTA INDIVIDUAL')
      expect(prompt).toContain('sesgo de semitono')
      expect(prompt).toContain("targetMode DEBE ser 'single_note'")
      expect(prompt).toContain('recommendedNotes')
    })

    it('genera directivas especializadas para intervals', () => {
      const prompt = buildSystemPrompt('intervals')
      expect(prompt).toContain('ENFOQUE CLÍNICO PARA INTERVALOS')
      expect(prompt).toContain('recommendedIntervals')
    })

    it('genera directivas especializadas para sequences', () => {
      const prompt = buildSystemPrompt('sequences')
      expect(prompt).toContain('ENFOQUE CLÍNICO PARA SECUENCIAS')
      expect(prompt).toContain('retención del contorno melódico')
      expect(prompt).toContain('sequenceLength')
    })

    it('genera directivas globales integrales por defecto', () => {
      const prompt = buildSystemPrompt('all')
      expect(prompt).toContain('ENFOQUE CLÍNICO GLOBAL INTEGRAL')
    })
  })

  describe('buildUserPrompt', () => {
    it('empaqueta la telemetría clínica completa incluyendo RPM, entropía y sesgo dominante', () => {
      const prompt = buildUserPrompt(mockMetrics)

      expect(prompt).toContain('Precisión Cruda Global: 80%')
      expect(prompt).toContain('Precisión Corregida por Azar (Oído Real Normalizado): 75%')
      expect(prompt).toContain('Entropía Media del Contexto (Incertidumbre del Pool): 1.58 bits')
      expect(prompt).toContain('TELEMETRÍA DETALLADA POR SESIÓN')
      expect(prompt).toContain('"cadenciaRPM": 10')
      expect(prompt).toContain('"poolNotas": 3')
      expect(prompt).toContain('"sesgoDominante": "Hacia lo Agudo (+st)"')
    })

    it('empaqueta las comparativas longitudinales (Test-Retest) con sus Deltas calculados', () => {
      const prompt = buildUserPrompt(mockMetrics)

      expect(prompt).toContain('COMPARATIVAS LONGITUDINALES (TEST-RETEST DETECTADOS)')
      expect(prompt).toContain('"contenido": "Nivel 1 (C, D, E)"')
      expect(prompt).toContain('"deltaPrecision": "+20%"')
      expect(prompt).toContain('"deltaLatenciaMs": "-450ms"')
      expect(prompt).toContain('"deltaRPM": "+3.5 RPM"')
    })

    it('adapta las instrucciones clínicas según el customQueryType', () => {
      const fatigue = buildUserPrompt(mockMetrics, 'fatigue')
      expect(fatigue).toContain('fatiga temporal')

      const weekly = buildUserPrompt(mockMetrics, 'weekly_plan')
      expect(weekly).toContain('plan de estudio semanal')
    })
  })
})
