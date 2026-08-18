import { AnalyticsMetrics } from '../analytics/historyAnalytics'
import { generateDiagnosticReport } from '../analytics/diagnosticReportGenerator'
import { AiAnalysisResponse, AiExercisePrescription } from './types'

export function generateAlgorithmicFallback(metrics: AnalyticsMetrics): AiAnalysisResponse {
  const report = generateDiagnosticReport(metrics)

  let targetMode: 'single_note' | 'intervals' | 'sequences' = 'single_note'
  const recommendedNotes = [60, 62, 64, 65, 67]
  const recommendedIntervals: number[] = [2, 4, 5, 7]

  if (metrics.mostDifficultNotes.length >= 2) {
    // Aislar las notas débiles
    targetMode = 'single_note'
  } else if (metrics.overallAccuracy >= 80) {
    targetMode = 'intervals'
  }

  const prescription: AiExercisePrescription = {
    title: 'Sesión Adaptativa de Refuerzo de Precisión',
    rationale:
      'Diseñada algorítmicamente para aislar las notas con mayor latencia y error registradas en la base de datos.',
    targetMode,
    instrumentId: 'acoustic_grand_piano',
    recommendedNotes,
    recommendedIntervals,
    sequenceLength: 3,
    limitType: 'questions',
    questionsCount: 10,
    durationMinutes: 5,
    advanceMode: 'smart'
  }

  const fullText = `### ${report.executiveSummary}\n\n**Diagnóstico:** ${report.perceptualDiagnosis}\n\n**Latencia:** ${report.cognitiveLatencyAnalysis}\n\n**Sesgo:** ${report.directionalBiasAnalysis}`

  return {
    source: 'algorithmic_fallback',
    modelName: 'Motor Heurístico Local',
    analysisText: fullText,
    prescription
  }
}
