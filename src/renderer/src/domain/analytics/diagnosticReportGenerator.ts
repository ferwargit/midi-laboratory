import { AnalyticsMetrics } from './historyAnalytics'

export interface DiagnosticReport {
  title: string
  date: string
  executiveSummary: string
  perceptualDiagnosis: string
  cognitiveLatencyAnalysis: string
  directionalBiasAnalysis: string
  concreteActionPlan: string[]
}

export function generateDiagnosticReport(metrics: AnalyticsMetrics): DiagnosticReport {
  const date = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  if (metrics.totalAnswers === 0) {
    return {
      title: '📋 Informe de Diagnóstico Auditivo',
      date,
      executiveSummary: 'No se registran sesiones de entrenamiento para emitir un diagnóstico.',
      perceptualDiagnosis:
        'Inicia al menos una sesión de práctica para generar datos psicométricos.',
      cognitiveLatencyAnalysis: 'Sin datos.',
      directionalBiasAnalysis: 'Sin datos.',
      concreteActionPlan: ['Realizar una sesión inicial de 10 ejercicios en Modalidad 1.']
    }
  }

  // 1. Resumen Ejecutivo
  let executiveSummary = ''
  if (metrics.overallAccuracy >= 85) {
    executiveSummary = `Tu oído presenta un nivel de discriminación auditiva AVANZADO con un ${metrics.overallAccuracy}% de precisión global sobre ${metrics.totalAnswers} ejercicios analizados.`
  } else if (metrics.overallAccuracy >= 65) {
    executiveSummary = `Tu oído se encuentra en nivel INTERMEDIO CONSOLIDADO (${metrics.overallAccuracy}% de precisión). Se observa buena base en notas diatónicas con margen de ajuste en alteraciones y semitonos.`
  } else {
    executiveSummary = `Tu oído está en etapa de ENTRENAMIENTO FORMATIVO (${metrics.overallAccuracy}% de precisión). El sistema recomienda focalizar en contrastes y notas ancla antes de ampliar rangos cromáticos.`
  }

  // 2. Diagnóstico Perceptual
  let perceptualDiagnosis = ''
  if (metrics.mostDifficultNotes.length > 0) {
    const diffList = metrics.mostDifficultNotes
      .map((n) => `${n.noteName} (${n.accuracy}%)`)
      .join(', ')
    perceptualDiagnosis = `Se detectan zonas de incertidumbre en las notas: ${diffList}. `
  } else {
    perceptualDiagnosis = 'No se observan notas débiles recurrentes. '
  }

  if (metrics.topConfusions.length > 0) {
    const confList = metrics.topConfusions
      .map((c) => `[${c.expected} confundida con ${c.played} (${c.count} veces)]`)
      .join(' ')
    perceptualDiagnosis += `Principales pares de confusión: ${confList}.`
  }

  // 3. Análisis de Latencia Cognitiva
  const fastPercent = Math.round((metrics.fastResponsesCount / metrics.totalAnswers) * 100)
  const slowPercent = Math.round((metrics.slowResponsesCount / metrics.totalAnswers) * 100)
  let cognitiveLatencyAnalysis = `Tiempo de respuesta promedio: ${(metrics.avgResponseTimeMs / 1000).toFixed(2)}s. `

  if (fastPercent >= 60) {
    cognitiveLatencyAnalysis += `El ${fastPercent}% de tus respuestas son de REFLEJO INMEDIATO (< 1.2s), indicando una sólida representación mental interna del tono.`
  } else if (slowPercent >= 35) {
    cognitiveLatencyAnalysis += `El ${slowPercent}% de tus respuestas requieren más de 2.8s de procesamiento, lo que sugiere que tu cerebro realiza deducción interválica o conteo mental antes de pulsar.`
  } else {
    cognitiveLatencyAnalysis += 'Equilibrio adecuado entre velocidad de decisión y precisión.'
  }

  // 4. Sesgo Direccional
  let directionalBiasAnalysis = ''
  const totalErrors = metrics.sharpBiasCount + metrics.flatBiasCount
  if (totalErrors > 0) {
    if (metrics.sharpBiasCount > metrics.flatBiasCount * 1.5) {
      directionalBiasAnalysis = `Se detecta un SESGO HACIA LO AGUDO (+semitonos): en el ${Math.round((metrics.sharpBiasCount / totalErrors) * 100)}% de tus errores tiendes a percibir la nota más alta de lo que realmente suena.`
    } else if (metrics.flatBiasCount > metrics.sharpBiasCount * 1.5) {
      directionalBiasAnalysis = `Se detecta un SESGO HACIA LO GRAVE (-semitonos): en el ${Math.round((metrics.flatBiasCount / totalErrors) * 100)}% de tus errores tiendes a percibir la nota por debajo de su tono real.`
    } else {
      directionalBiasAnalysis =
        'Tus errores se distribuyen simétricamente alrededor del tono objetivo (sin sesgo direccional marcado).'
    }
  } else {
    directionalBiasAnalysis = 'Sin errores registrados para calcular sesgo direccional.'
  }

  // 5. Plan de Acción Concreto
  const concreteActionPlan: string[] = []
  if (metrics.mostDifficultNotes.length > 0) {
    concreteActionPlan.push(
      `Entrenar una sesión libre focalizada exclusivamente en las notas: ${metrics.mostDifficultNotes.map((n) => n.noteName).join(', ')}.`
    )
  }
  if (metrics.topConfusions.length > 0) {
    const top = metrics.topConfusions[0]
    concreteActionPlan.push(
      `Trabajar la discriminación directa del par conflictivo ${top.expected} vs ${top.played} en Modalidad 1.`
    )
  }
  concreteActionPlan.push(
    'Realizar una sesión de 5 minutos cronometrada para reforzar la velocidad de reflejo auditivo sin sobrepensar.'
  )
  if (metrics.overallAccuracy >= 80) {
    concreteActionPlan.push(
      'Avanzar a Modalidad 2 (Intervalos) con dirección mixta o a Modalidad 3 (Secuencias de 4 notas).'
    )
  }

  return {
    title: '📋 Informe Psicopedagógico de Diagnóstico Auditivo',
    date,
    executiveSummary,
    perceptualDiagnosis,
    cognitiveLatencyAnalysis,
    directionalBiasAnalysis,
    concreteActionPlan
  }
}
