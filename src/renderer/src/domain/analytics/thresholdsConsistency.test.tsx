import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  COGNITIVE_LATENCY_THRESHOLDS,
  COGNITIVE_LATENCY_THRESHOLDS_BY_MODE,
  getLatencyThresholds,
  MASTERY_THRESHOLDS,
  computeAnalyticsMetrics
} from './historyAnalytics'
import { ConfusionMatrixTab } from '../../components/views/analytics/ConfusionMatrixTab'
import { AnalyticsKpiCards } from '../../components/views/analytics/AnalyticsKpiCards'
import { AnalyticsMetrics } from './historyAnalytics'
import { LatencySpectrumDiagram } from '../../components/views/guide/LatencySpectrumDiagram'
import { generateDiagnosticReport } from './diagnosticReportGenerator'
import { getConcept } from './pedagogicalDictionary'
import { fireEvent } from '@testing-library/react'
import { buildUserPrompt } from '../ai/promptBuilder'
import { DbAnswerRecord, DbSessionRecord } from '../database/types'

describe('thresholdsConsistency - Certificación de Constantes y Umbrales Psicométricos', () => {
  const mockSession: DbSessionRecord = {
    id: 's_thresh_1',
    createdAt: new Date().toISOString(),
    strategyId: 'adaptive_v1',
    instrumentId: 'piano',
    presetName: 'Test',
    totalQuestions: 3,
    correctAnswers: 3,
    accuracyPercentage: 100,
    avgResponseTimeMs: 1500,
    durationSeconds: 30
  }

  const mockAnswers: DbAnswerRecord[] = [
    {
      id: 'a1',
      sessionId: 's_thresh_1',
      questionIndex: 1,
      expectedNote: 60,
      playedNote: 60,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 1350, // < 1400ms (Debe ser FAST)
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'a2',
      sessionId: 's_thresh_1',
      questionIndex: 2,
      expectedNote: 62,
      playedNote: 62,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 2100, // 1400ms - 2800ms (Debe ser MEDIUM)
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'a3',
      sessionId: 's_thresh_1',
      questionIndex: 3,
      expectedNote: 64,
      playedNote: 64,
      isCorrect: true,
      semitoneDistance: 0,
      responseTimeMs: 3200, // > 2800ms (Debe ser SLOW)
      velocity: 90,
      reasonTelemetry: '',
      createdAt: new Date().toISOString()
    }
  ]

  it('las constantes canónicas deben estar fijadas en 1400ms y 2800ms', () => {
    expect(COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS).toBe(1400)
    expect(COGNITIVE_LATENCY_THRESHOLDS.MEDIUM_MAX_MS).toBe(2800)
    expect(COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL).toBe('< 1.4s')
    expect(COGNITIVE_LATENCY_THRESHOLDS.MEDIUM_LABEL).toBe('1.4s - 2.8s')
    expect(MASTERY_THRESHOLDS.MASTERED_MIN).toBe(85)
    expect(MASTERY_THRESHOLDS.LEARNING_MIN).toBe(60)
    expect(MASTERY_THRESHOLDS.CRITICAL_MAX).toBe(60)
  })

  it('computeAnalyticsMetrics debe clasificar exactamente en base al umbral de 1400ms', () => {
    const metrics = computeAnalyticsMetrics([mockSession], mockAnswers, 'all')

    expect(metrics.fastResponsesCount).toBe(1) // 1350ms < 1400ms
    expect(metrics.mediumResponsesCount).toBe(1) // 2100ms
    expect(metrics.slowResponsesCount).toBe(1) // 3200ms
  })

  it('ConfusionMatrixTab debe renderizar estrictamente las etiquetas de la SSOT', () => {
    const metrics = computeAnalyticsMetrics([mockSession], mockAnswers, 'all')
    render(<ConfusionMatrixTab modeFilter="single_note" metrics={metrics} />)

    expect(
      screen.getByText(
        new RegExp(`Reflejo Inmediato \\(${COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL}\\)`, 'i')
      )
    ).toBeDefined()
    expect(
      screen.getByText(
        new RegExp(`Deducción Activa \\(${COGNITIVE_LATENCY_THRESHOLDS.MEDIUM_LABEL}\\)`, 'i')
      )
    ).toBeDefined()
    expect(screen.queryByText(/< 1.2s/i)).toBeNull()
  })

  it('ConfusionMatrixTab con modeFilter="intervals" debe renderizar etiquetas de umbrales calibrados para intervalos', () => {
    const intervalsSession: DbSessionRecord = {
      ...mockSession,
      id: 's_intervals_test',
      targetMode: 'intervals',
      presetName: 'Intervalos Test'
    }
    const intervalsAnswers: DbAnswerRecord[] = mockAnswers.map((a, i) => ({
      ...a,
      id: `a_int_${i}`,
      sessionId: 's_intervals_test'
    }))
    const metrics = computeAnalyticsMetrics([intervalsSession], intervalsAnswers, 'intervals')

    render(<ConfusionMatrixTab modeFilter="intervals" metrics={metrics} />)

    expect(
      screen.getByText(
        new RegExp(
          `Reflejo Inmediato \\(${COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.intervals.FAST_LABEL}\\)`,
          'i'
        )
      )
    ).toBeDefined()
    expect(
      screen.getByText(
        new RegExp(
          `Deducción Activa \\(${COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.intervals.MEDIUM_LABEL}\\)`,
          'i'
        )
      )
    ).toBeDefined()
  })

  it('LatencySpectrumDiagram debe renderizar las etiquetas calibradas desde la SSOT', () => {
    render(<LatencySpectrumDiagram />)

    expect(
      screen.getByText(new RegExp(`Zona 1 \\(${COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL}\\)`, 'i'))
    ).toBeDefined()
    expect(screen.queryByText(/1.2s/i)).toBeNull()
  })

  it('AnalyticsKpiCards debe colorear el KPI de Oído Real según la SSOT (60% en ámbar)', () => {
    const metrics: AnalyticsMetrics = {
      modeFilter: 'all',
      filteredSessionsCount: 1,
      totalAnswers: 10,
      totalCorrect: 6,
      overallAccuracy: 60,
      normalizedOverallAccuracy: 60,
      avgEntropyBits: 1.58,
      avgResponseTimeMs: 1200,
      fastResponsesCount: 4,
      mediumResponsesCount: 4,
      slowResponsesCount: 2,
      sharpBiasCount: 0,
      flatBiasCount: 0,
      topConfusions: [],
      mostDifficultNotes: [],
      strongestNotes: [],
      sessionPsychometricsList: [],
      longitudinalComparisons: []
    }

    render(<AnalyticsKpiCards metrics={metrics} totalFilteredSessions={1} />)

    const kpiValue = screen.getByText('60%')
    expect(kpiValue.className).toContain('text-amber-400')
  })

  it('diagnosticReportGenerator y promptBuilder deben derivar de la constante canónica', () => {
    const metrics = computeAnalyticsMetrics([mockSession], [mockAnswers[0]], 'all')
    const report = generateDiagnosticReport(metrics)
    expect(report.cognitiveLatencyAnalysis).toContain(COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL)

    const prompt = buildUserPrompt(metrics)
    // Validación usando la constante central
    expect(prompt).toContain(`Respuestas Rápidas (${COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL})`)
  })
})

describe('thresholdsByModality - Umbrales de Latencia Calibrados por Modalidad', () => {
  it('COGNITIVE_LATENCY_THRESHOLDS_BY_MODE debe contener las cuatro modalidades con valores calibrados', () => {
    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note.FAST_MAX_MS).toBe(1400)
    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note.MEDIUM_MAX_MS).toBe(2800)
    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note.FAST_LABEL).toBe('< 1.4s')

    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.intervals.FAST_MAX_MS).toBe(2400)
    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.intervals.MEDIUM_MAX_MS).toBe(3800)
    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.intervals.FAST_LABEL).toBe('< 2.4s')

    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.sequences.FAST_MAX_MS).toBe(3500)
    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.sequences.MEDIUM_MAX_MS).toBe(5000)
    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.sequences.FAST_LABEL).toBe('< 3.5s')

    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.repertoire.FAST_MAX_MS).toBe(2500)
    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.repertoire.MEDIUM_MAX_MS).toBe(4000)
    expect(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.repertoire.FAST_LABEL).toBe('< 2.5s')
  })

  it('getLatencyThresholds debe resolver la configuración correcta para cada modalidad conocida', () => {
    expect(getLatencyThresholds('single_note').FAST_MAX_MS).toBe(1400)
    expect(getLatencyThresholds('intervals').FAST_MAX_MS).toBe(2400)
    expect(getLatencyThresholds('sequences').FAST_MAX_MS).toBe(3500)
    expect(getLatencyThresholds('repertoire').FAST_MAX_MS).toBe(2500)
  })

  it('getLatencyThresholds debe hacer fallback a single_note para modo desconocido', () => {
    expect(getLatencyThresholds('unknown_mode').FAST_MAX_MS).toBe(1400)
    expect(getLatencyThresholds('invalid').FAST_LABEL).toBe('< 1.4s')
    expect(getLatencyThresholds('').FAST_MAX_MS).toBe(1400)
    expect(getLatencyThresholds(undefined).FAST_MAX_MS).toBe(1400)
  })

  it('getLatencyThresholds debe ser case-insensitive', () => {
    expect(getLatencyThresholds('INTERVALS').FAST_MAX_MS).toBe(2400)
    expect(getLatencyThresholds('SeQuEnCeS').FAST_MAX_MS).toBe(3500)
  })

  it('getLatencyThresholds debe manejar espacios en blanco alrededor del modo', () => {
    expect(getLatencyThresholds(' intervals ').FAST_MAX_MS).toBe(2400)
    expect(getLatencyThresholds(' intervals ').FAST_LABEL).toBe('< 2.4s')
    expect(getLatencyThresholds(' Sequences ').FAST_MAX_MS).toBe(3500)
    expect(getLatencyThresholds(' Sequences ').FAST_LABEL).toBe('< 3.5s')
    expect(getLatencyThresholds('\trepertoire\n').FAST_MAX_MS).toBe(2500)
    expect(getLatencyThresholds('\trepertoire\n').FAST_LABEL).toBe('< 2.5s')
  })
})

describe('AnalyticsView - Pipeline de Dominio Puro (F-01, spec 05)', () => {
  // Regresión arquitectónica estática (patrón de index-csp.test.ts): la spec 05
  // prohíbe que la vista reimplemente con .filter() propios los filtros que ya
  // declara AnalyticsFilterOptions. Una regresión silenciosa en este punto
  // reintroduciría la lógica fugada F-01 sin que los tests funcionales lo
  // detectaran, por lo que se fija el contrato sobre el propio código fuente.
  const viewSource = readFileSync(
    resolve(__dirname, '../../components/views/AnalyticsView.tsx'),
    'utf-8'
  )

  it('no reimplementa el filtrado de inputSource, bias ni ISI con .filter() manuales', () => {
    // La forma histórica del bug (OLA 2.3, F-01) era `if (x !== 'all') { list = list.filter(...) }`,
    // por lo que la regex admite la llave de apertura opcional y el salto de línea.
    expect(viewSource).not.toMatch(
      /selectedInputSource\s*!==\s*'all'\s*\)\s*\{?\s*list\s*=\s*list\.filter/
    )
    expect(viewSource).not.toMatch(
      /selectedBias\s*!==\s*'all'\s*\)\s*\{?\s*list\s*=\s*list\.filter/
    )
    expect(viewSource).not.toMatch(/selectedIsi\s*!==\s*'all'\s*\)\s*\{?\s*list\s*=\s*list\.filter/)
  })

  it('delega los tres filtros al dominio mediante filterSessionsAdvanced', () => {
    expect(viewSource).toMatch(/inputSource:\s*selectedInputSource/)
    expect(viewSource).toMatch(/biasFilter:\s*selectedBias/)
    expect(viewSource).toMatch(/isiFilter:\s*selectedIsi/)
  })
})

describe('SSOT Propagation - Diccionario Pedagógico e Informes sincronizados por modalidad', () => {
  const MODALITIES = ['single_note', 'intervals', 'sequences', 'repertoire'] as const

  const buildIntervalsMetrics = (): AnalyticsMetrics => ({
    modeFilter: 'intervals',
    filteredSessionsCount: 1,
    totalAnswers: 10,
    totalCorrect: 9,
    overallAccuracy: 90,
    normalizedOverallAccuracy: 90,
    avgEntropyBits: 1.58,
    avgResponseTimeMs: 2000,
    fastResponsesCount: 8,
    mediumResponsesCount: 1,
    slowResponsesCount: 1,
    sharpBiasCount: 0,
    flatBiasCount: 0,
    topConfusions: [],
    mostDifficultNotes: [],
    strongestNotes: [],
    sessionPsychometricsList: [],
    longitudinalComparisons: []
  })

  afterEach(() => {
    vi.doUnmock('./thresholds')
    vi.resetModules()
  })

  it('getConcept("cognitive_latency").formulaOrCalculation contiene las etiquetas FAST y MEDIUM de las 4 modalidades', () => {
    const concept = getConcept('cognitive_latency')
    expect(concept).not.toBeNull()
    for (const mode of MODALITIES) {
      expect(concept!.formulaOrCalculation).toContain(
        COGNITIVE_LATENCY_THRESHOLDS_BY_MODE[mode].FAST_LABEL
      )
      expect(concept!.formulaOrCalculation).toContain(
        COGNITIVE_LATENCY_THRESHOLDS_BY_MODE[mode].MEDIUM_LABEL
      )
    }
  })

  it('el concepto de latencia cita el fundamento psicométrico Donders/Sternberg', () => {
    const concept = getConcept('cognitive_latency')
    expect(concept).not.toBeNull()
    const explanation = `${concept!.formulaOrCalculation} ${concept!.practicalTakeaway}`
    expect(explanation).toMatch(/Donders/i)
    expect(explanation).toMatch(/Sternberg/i)
    expect(explanation).toMatch(/emisión acústica/i)
    expect(explanation).toMatch(/ejecución motora secuencial/i)
  })

  it('generateDiagnosticReport con modeFilter="intervals" interpola la etiqueta FAST de intervals', () => {
    const report = generateDiagnosticReport(buildIntervalsMetrics())
    expect(report.cognitiveLatencyAnalysis).toContain(getLatencyThresholds('intervals').FAST_LABEL)
    expect(report.cognitiveLatencyAnalysis).not.toContain(
      COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note.FAST_LABEL
    )
  })

  it('generateDiagnosticReport sin datos no se rompe y degrada con plan accionable', () => {
    const emptyMetrics: AnalyticsMetrics = {
      ...buildIntervalsMetrics(),
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
      topConfusions: [],
      mostDifficultNotes: [],
      strongestNotes: [],
      sessionPsychometricsList: [],
      longitudinalComparisons: []
    }

    expect(() => generateDiagnosticReport(emptyMetrics)).not.toThrow()
    const report = generateDiagnosticReport(emptyMetrics)
    expect(report.executiveSummary).toContain('No se registran sesiones')
    expect(report.cognitiveLatencyAnalysis).toContain('Sin datos')
    expect(report.concreteActionPlan.length).toBeGreaterThan(0)
  })

  it('un cambio en la SSOT se propaga automáticamente al diccionario y al informe', async () => {
    vi.resetModules()
    vi.doMock('./thresholds', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./thresholds')>()
      const mockedByMode = {
        ...actual.COGNITIVE_LATENCY_THRESHOLDS_BY_MODE,
        intervals: {
          ...actual.COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.intervals,
          FAST_LABEL: '< 9.9s'
        }
      }
      return {
        ...actual,
        COGNITIVE_LATENCY_THRESHOLDS_BY_MODE: mockedByMode,
        // Simula una edición real de la SSOT: el resolver lee el objeto alterado
        getLatencyThresholds: (mode?: string) => {
          if (!mode) return mockedByMode.single_note
          const normalized = mode.trim().toLowerCase() as keyof typeof mockedByMode
          return mockedByMode[normalized] ?? mockedByMode.single_note
        }
      }
    })

    try {
      const { getConcept: getConceptMocked } = await import('./pedagogicalDictionary')
      const { generateDiagnosticReport: generateReportMocked } =
        await import('./diagnosticReportGenerator')

      const concept = getConceptMocked('cognitive_latency')
      expect(concept?.formulaOrCalculation).toContain('< 9.9s')

      const report = generateReportMocked(buildIntervalsMetrics())
      expect(report.cognitiveLatencyAnalysis).toContain('< 9.9s')
    } finally {
      vi.doUnmock('./thresholds')
      vi.resetModules()
    }
  })

  it('LatencySpectrumDiagram muestra la escala de la modalidad seleccionada', () => {
    render(<LatencySpectrumDiagram />)

    // Estado inicial: single_note
    expect(
      screen.getByText(
        new RegExp(`Zona 1 \\(${getLatencyThresholds('single_note').FAST_LABEL}\\)`, 'i')
      )
    ).toBeDefined()

    // Al seleccionar Intervalos, la escala deriva de la SSOT de esa modalidad
    fireEvent.click(screen.getByRole('button', { name: /Intervalos/i }))
    expect(
      screen.getByText(
        new RegExp(`Zona 1 \\(${COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.intervals.FAST_LABEL}\\)`, 'i')
      )
    ).toBeDefined()
    expect(
      screen.getByText(
        new RegExp(`${COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.intervals.SLOW_LABEL}\\+`, 'i')
      )
    ).toBeDefined()
    expect(
      screen.queryByText(
        new RegExp(
          `Zona 1 \\(${COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note.FAST_LABEL}\\)`,
          'i'
        )
      )
    ).toBeNull()
  })
})
