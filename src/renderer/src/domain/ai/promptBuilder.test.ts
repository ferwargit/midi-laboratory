import { describe, it, expect } from 'vitest'
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildConsultationSystemPrompt,
  buildConsultationUserPrompt,
  buildConversationalMessages,
  buildMultiSessionComparisonSystemPrompt,
  buildMultiSessionComparisonPrompt
} from './promptBuilder'
import { AnalyticsMetrics } from '../analytics/historyAnalytics'

describe('promptBuilder - Generación de Prompts Especializados y Tutor Psicoacústico', () => {
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
        formatType: 'time',
        formatLabel: '⏱️ 1m 0s',
        inputMethod: 'hardware',
        interSessionGapMs: null,
        interSessionGapLabel: 'Inicio',
        cpiScore: 540
      }
    ],
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
        rawAccuracyDelta: 20,
        normalizedAccuracyDelta: 25,
        responseTimeDeltaMs: -450,
        rpmDelta: 3.5,
        isImproved: true
      }
    ]
  }

  describe('buildSystemPrompt & buildUserPrompt (Diagnóstico y Prescripción)', () => {
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

    it('empaqueta la telemetría clínica completa incluyendo RPM, entropía, fuente de entrada y sesgo', () => {
      const prompt = buildUserPrompt(mockMetrics)
      expect(prompt).toContain('Precisión Cruda Global: 80%')
      expect(prompt).toContain('Precisión Corregida por Azar (Oído Real Normalizado): 75%')
      expect(prompt).toContain('Entropía Media del Contexto (Incertidumbre del Pool): 1.58 bits')
      expect(prompt).toContain('TELEMETRÍA DETALLADA POR SESIÓN')
      expect(prompt).toContain('"cadenciaRPM": 10')
      expect(prompt).toContain('"poolNotas": 3')
      expect(prompt).toContain('"fuenteEntrada": "Roland FP-8 Físico"')
    })

    it('empaqueta las comparativas longitudinales (Test-Retest) con sus Deltas calculados', () => {
      const prompt = buildUserPrompt(mockMetrics)
      expect(prompt).toContain('COMPARATIVAS LONGITUDINALES (TEST-RETEST DETECTADOS)')
      expect(prompt).toContain('"contenido": "Nivel 1 (C, D, E)"')
      expect(prompt).toContain('"deltaPrecision": "+20%"')
      expect(prompt).toContain('"deltaLatenciaMs": "-450ms"')
    })
  })

  describe('buildConsultationSystemPrompt & buildConsultationUserPrompt (Tutor Psicoacústico)', () => {
    it('buildConsultationSystemPrompt configura el rol de tutor didáctico y motivador', () => {
      const sys = buildConsultationSystemPrompt('single_note')
      expect(sys).toContain('Profesor de Oído Musical y Neurociencia Auditiva')
      expect(sys).toContain('Modalidad activa de estudio: SINGLE_NOTE')
      expect(sys).toContain('DIRECTIVAS PEDAGÓGICAS PARA TUS RESPUESTAS')
    })

    it('buildConsultationUserPrompt inyecta la duda del alumno, el concepto pedagógico y la telemetría', () => {
      const userPrompt = buildConsultationUserPrompt(
        '¿Por qué me cuesta discriminar F4 y E4?',
        mockMetrics,
        'irt_normalized_accuracy'
      )

      expect(userPrompt).toContain('CONSULTA DEL ALUMNO:')
      expect(userPrompt).toContain('¿Por qué me cuesta discriminar F4 y E4?')
      expect(userPrompt).toContain('CONCEPTO PEDAGÓGICO DE REFERENCIA:')
      expect(userPrompt).toContain('Oído Real (IRT Normalizado)')
      expect(userPrompt).toContain('PERFIL Y TELEMETRÍA DEL ALUMNO')
      expect(userPrompt).toContain('Precisión Cruda: 80%')
    })
  })

  describe('buildConversationalMessages (Memoria Multi-Turn)', () => {
    it('debe construir una secuencia de mensajes alternando user y assistant con contexto de prescripciones', () => {
      const pastConsultations = [
        {
          id: 'c1',
          createdAt: new Date('2026-08-21T10:00:00Z').toISOString(),
          modelName: 'qwen3.5-9b',
          modeFilter: 'single_note',
          userQuery: '¿Por qué fallo en F4?',
          aiResponse: 'F4 tiene armónicos cercanos a E4...'
        }
      ]

      const pastReports = [
        {
          id: 'rep_1',
          createdAt: new Date('2026-08-21T09:00:00Z').toISOString(),
          modelName: 'qwen3.5-9b',
          modeFilter: 'single_note',
          analysisText: 'Reporte previo',
          prescription: {
            title: 'Refuerzo F4/E4',
            rationale: 'Foco en semitonos',
            targetMode: 'single_note' as const,
            instrumentId: 'acoustic_grand_piano' as const,
            recommendedNotes: [64, 65],
            limitType: 'mastery' as const,
            questionsCount: 10,
            durationMinutes: 5,
            advanceMode: 'smart' as const
          }
        }
      ]

      const messages = buildConversationalMessages(
        '¿Y cómo practico ese semitono?',
        mockMetrics,
        pastConsultations,
        pastReports,
        'irt_normalized_accuracy'
      )

      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toContain('Refuerzo F4/E4')
      expect(messages[1].role).toBe('user')
      expect(messages[1].content).toBe('¿Por qué fallo en F4?')
      expect(messages[2].role).toBe('assistant')
      expect(messages[2].content).toBe('F4 tiene armónicos cercanos a E4...')
      expect(messages[3].role).toBe('user')
      expect(messages[3].content).toContain('¿Y cómo practico ese semitono?')
    })
  })

  describe('buildMultiSessionComparisonPrompt (Comparador Multi-Sesión N-Sessions)', () => {
    it('debe empaquetar la telemetría cronológica cruzada de las sesiones seleccionadas', () => {
      const sys = buildMultiSessionComparisonSystemPrompt('single_note')
      expect(sys).toContain('ANÁLISIS COMPARATIVO CRUZADO EXHAUSTIVO')
      expect(sys).toContain('Modalidad de estudio: SINGLE_NOTE')

      const prompt = buildMultiSessionComparisonPrompt(
        mockMetrics.sessionPsychometricsList,
        mockMetrics
      )

      expect(prompt).toContain('SOLICITUD DE COMPARATIVA MULTI-SESIÓN')
      expect(prompt).toContain('TELEMETRÍA DETALLADA DE LAS 1 SESIONES SELECCIONADAS')
      expect(prompt).toContain('"precisionCruda": "80%"')
    })
  })
})
