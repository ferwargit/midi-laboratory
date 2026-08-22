import { AnalyticsMetrics, AnalyticsModeFilter } from '../analytics/historyAnalytics'
import { getConcept } from '../analytics/pedagogicalDictionary'

export function buildSystemPrompt(mode: AnalyticsModeFilter = 'all'): string {
  let specializedInstructions = ''

  if (mode === 'single_note') {
    specializedInstructions = `
ENFOQUE CLÍNICO PARA NOTA INDIVIDUAL (PITCH DISCRIMINATION):
- Analiza el sesgo de semitono (+st hacia agudo vs -st hacia grave).
- Examina la velocidad de reflejo inmediato (<1.2s) vs sobrepensamiento (>2.8s).
- Identifica zonas de incertidumbre en teclas negras (alteraciones) vs teclas blancas (diatónicas).
- En la prescripción, targetMode DEBE ser 'single_note' y DEBES recomendar un pool de 2 a 8 notas MIDI exactas.`
  } else if (mode === 'intervals') {
    specializedInstructions = `
ENFOQUE CLÍNICO PARA INTERVALOS (RELATIVE PITCH & DISTANCE):
- Analiza errores de cualidad (ej: confundir 3M con 3m) y de inversión (4J vs 5J).
- Evalúa el desempeño según la dirección (ascendente vs descendente).
- En la prescripción, targetMode DEBE ser 'intervals' y DEBES incluir el array 'recommendedIntervals' con los semitonos a reforzar (1 a 12).`
  } else if (mode === 'sequences') {
    specializedInstructions = `
ENFOQUE CLÍNICO PARA SECUENCIAS (AUDITORY WORKING MEMORY & CONTOUR):
- Analiza la capacidad de retención del contorno melódico (subidas, bajadas) y distancia Levenshtein.
- Evalúa la fatiga cognitiva a medida que aumenta la longitud de la frase.
- En la prescripción, targetMode DEBE ser 'sequences', sequenceLength entre 3 y 6, y pool de notas en 'recommendedNotes'.`
  } else {
    specializedInstructions = `
ENFOQUE CLÍNICO GLOBAL INTEGRAL:
- Evalúa la correlación entre altura absoluta, memoria melódica y discriminación interválica.`
  }

  return `Eres un Profesor de Oído Musical y Psicoacústica de Élite (Item Response Theory & Auditory Perception Expert) especializado en piano y entrenamiento auditivo con hardware MIDI.
Tu objetivo es analizar las métricas clínicas acumuladas de un alumno y devolver un JSON estricto con:
1. 'analysisText': Diagnóstico psicopedagógico profundo, clínico, empático y detallado en español. Si detectas comparativas longitudinales (Test-Retest), debes felicitar o diagnosticar el Delta de evolución (Δ Precisión, Δ Latencia y Δ RPM).
2. 'prescription': Configuración de ejercicio personalizada para corregir sus errores específicos.

CATÁLOGO FORMAL DE PARÁMETROS DISPONIBLES EN EL SOFTWARE:
- targetMode: 'single_note' | 'intervals' | 'sequences'
- instrumentId (General MIDI en Korg NS5R): 'acoustic_grand_piano' | 'flute' | 'violin' | 'clarinet' | 'acoustic_bass'
- recommendedNotes: Array de números MIDI exactos:
    • Registro Grave: C3=48, D3=50, E3=52, F3=53, G3=55, A3=57, B3=59
    • Registro Central: C4=60, C#4=61, D4=62, D#4=63, E4=64, F4=65, F#4=66, G4=67, G#4=68, A4=69, A#4=70, B4=71
    • Registro Agudo: C5=72, D5=74, E5=76, F5=77, G5=79, A5=81, B5=83, C6=84
- recommendedIntervals (solo para intervals): Array de semitonos de 1 a 12 (1=2m, 2=2M, 3=3m, 4=3M, 5=4J, 6=TT, 7=5J, 8=6m, 9=6M, 10=7m, 11=7M, 12=8J).
- sequenceLength (solo para sequences): entero entre 3 y 6 notas.
- limitType: 'mastery' (hasta dominar en verde >=85%) | 'time' | 'questions' | 'infinite'
- questionsCount: 5, 10 o 20 preguntas.
- durationMinutes: 1, 3, 5 o 10 minutos.
- advanceMode: 'smart' (pausa al fallar) | 'manual' (espera espacio)
- noteDurationMs: Duración de la nota emitida (estándar: 500).
${specializedInstructions}

FORMATO DE RESPUESTA OBLIGATORIO (JSON puro sin bloques markdown alrededor):
{
  "analysisText": "Tu diagnóstico clínico exhaustivo en español...",
  "prescription": {
    "title": "Nombre del Ejercicio Diseñado",
    "rationale": "Explicación psicopedagógica de por qué este ejercicio resolverá su debilidad...",
    "targetMode": "single_note",
    "instrumentId": "acoustic_grand_piano",
    "recommendedNotes": [64, 65],
    "recommendedIntervals": [],
    "sequenceLength": 3,
    "limitType": "mastery",
    "questionsCount": 10,
    "durationMinutes": 5,
    "advanceMode": "smart",
    "noteDurationMs": 500
  }
}`
}

export function buildUserPrompt(
  metrics: AnalyticsMetrics,
  customQueryType: 'general' | 'fatigue' | 'weekly_plan' = 'general'
): string {
  let instruction =
    'Analiza exhaustivamente los patrones de error, sesgos de semitono (+st / -st), la evolución longitudinal en los re-testeos y las latencias cognitivas, y genera la prescripción de ejercicio óptima.'

  if (customQueryType === 'fatigue') {
    instruction =
      'Enfócate prioritariamente en la curva de degradación por fatiga temporal, velocidad de reflejo (RPM) y tiempo óptimo de estudio diario recomendado.'
  } else if (customQueryType === 'weekly_plan') {
    instruction =
      'Diseña un plan de estudio semanal estructurado de 7 días combinando Nota Aislada, Intervalos y Secuencias según los puntos ciegos detectados.'
  }

  // Telemetría clínica cronológica de sesiones
  const sessionsTelemetry = (metrics.sessionPsychometricsList || []).slice(0, 10).map((s) => ({
    id: s.session.id,
    fecha: s.session.createdAt,
    timbre: s.session.instrumentId,
    algoritmo: s.session.strategyId,
    formato: s.formatType,
    duracionSeg: s.session.durationSeconds,
    preguntas: `${s.session.correctAnswers}/${s.session.totalQuestions}`,
    precisionCruda: `${s.session.accuracyPercentage}%`,
    oidoRealIRT: `${s.normalizedAccuracy}%`,
    entropiaBits: s.entropyBits,
    poolNotas: s.poolSize,
    cadenciaRPM: s.responsesPerMinute,
    tiempoMedioMs: s.session.avgResponseTimeMs,
    reflejoInmediatoPct: `${s.fastPercent}%`,
    sesgoDominante:
      s.dominantBias === 'sharp'
        ? 'Hacia lo Agudo (+st)'
        : s.dominantBias === 'flat'
          ? 'Hacia lo Grave (-st)'
          : 'Equilibrado'
  }))

  // Comparativas longitudinales de Re-testeo
  const longitudinalTelemetry = (metrics.longitudinalComparisons || []).map((c) => ({
    contenido: c.contentName,
    intentosTotales: c.totalAttempts,
    baselineFecha: c.baselineSession.createdAt,
    baselinePrecision: `${c.baselineSession.accuracyPercentage}%`,
    baselineLatenciaMs: c.baselineSession.avgResponseTimeMs,
    retestFecha: c.latestSession.createdAt,
    retestPrecision: `${c.latestSession.accuracyPercentage}%`,
    retestLatenciaMs: c.latestSession.avgResponseTimeMs,
    deltaPrecision: `${c.rawAccuracyDelta > 0 ? `+${c.rawAccuracyDelta}` : c.rawAccuracyDelta}%`,
    deltaLatenciaMs: `${c.responseTimeDeltaMs > 0 ? `+${c.responseTimeDeltaMs}` : c.responseTimeDeltaMs}ms`,
    deltaRPM: `${c.rpmDelta > 0 ? `+${c.rpmDelta}` : c.rpmDelta} RPM`,
    estado: c.isImproved ? 'Progreso perceptual positivo' : 'Requiere consolidación'
  }))

  return `Métricas Psicométricas del Alumno (Filtro analizado: ${metrics.modeFilter}):
- Total Ejercicios Analizados: ${metrics.totalAnswers} en ${metrics.filteredSessionsCount} sesiones
- Precisión Cruda Global: ${metrics.overallAccuracy}%
- Precisión Corregida por Azar (Oído Real Normalizado): ${metrics.normalizedOverallAccuracy}%
- Entropía Media del Contexto (Incertidumbre del Pool): ${metrics.avgEntropyBits} bits
- Tiempo Medio de Reacción: ${(metrics.avgResponseTimeMs / 1000).toFixed(2)}s
- Respuestas Rápidas (<1.2s): ${metrics.fastResponsesCount} | Medias (1.2-2.8s): ${metrics.mediumResponsesCount} | Lentas (>2.8s): ${metrics.slowResponsesCount}
- Sesgo Hacia lo Agudo (+st): ${metrics.sharpBiasCount} | Sesgo Hacia lo Grave (-st): ${metrics.flatBiasCount}
- Top Pares de Confusión Recurrentes: ${JSON.stringify(metrics.topConfusions)}
- Notas con Mayor Dificultad (<80%): ${JSON.stringify(metrics.mostDifficultNotes)}
- Notas Consolidadas (>=80%): ${JSON.stringify(metrics.strongestNotes)}

COMPARATIVAS LONGITUDINALES (TEST-RETEST DETECTADOS):
${JSON.stringify(longitudinalTelemetry, null, 2)}

TELEMETRÍA DETALLADA POR SESIÓN (ÚLTIMAS 10 SESIONES):
${JSON.stringify(sessionsTelemetry, null, 2)}

${instruction}`
}

export function buildConsultationSystemPrompt(mode: AnalyticsModeFilter = 'all'): string {
  return `Eres un Profesor de Oído Musical y Neurociencia Auditiva de Élite (Item Response Theory & Psychoacoustics Tutor).
Tu objetivo es responder de forma didáctica, clara, profunda y personalizada a las dudas y preguntas del alumno sobre su oído, la psicoacústica o sus métricas.
Modalidad activa de estudio: ${mode.toUpperCase()}.

DIRECTIVAS PEDAGÓGICAS PARA TUS RESPUESTAS:
1. Responde en español con un tono cercano, pedagógico, motivador y riguroso.
2. Utiliza los datos psicométricos reales del alumno (sesiones, tiempos de reacción, confusiones de semitonos, fatiga) para ejemplificar la explicación.
3. Concluye siempre con un consejo de práctica aplicable al teclado MIDI físico.`
}

export function buildConsultationUserPrompt(
  userQuery: string,
  metrics: AnalyticsMetrics,
  conceptId?: string
): string {
  let conceptContext = ''
  if (conceptId) {
    const concept = getConcept(conceptId)
    if (concept) {
      conceptContext = `\nCONCEPTO PEDAGÓGICO DE REFERENCIA:
- Título: ${concept.title} (${concept.subtitle})
- Definición: ${concept.shortDefinition}
- Cálculo/Fórmula: ${concept.formulaOrCalculation}
- En la práctica: ${concept.practicalTakeaway}`
    }
  }

  return `CONSULTA DEL ALUMNO:
"${userQuery}"
${conceptContext}

PERFIL Y TELEMETRÍA DEL ALUMNO (Contexto clínico):
- Modalidad: ${metrics.modeFilter}
- Total Ejercicios: ${metrics.totalAnswers} en ${metrics.filteredSessionsCount} sesiones.
- Precisión Cruda: ${metrics.overallAccuracy}% | Oído Real IRT: ${metrics.normalizedOverallAccuracy}%
- Entropía Media: ${metrics.avgEntropyBits} bits.
- Latencia Media: ${(metrics.avgResponseTimeMs / 1000).toFixed(2)}s (Reflejo: ${metrics.fastResponsesCount} resp, Deducción: ${metrics.mediumResponsesCount} resp, Fatiga/Lentas: ${metrics.slowResponsesCount} resp).
- Sesgos: +st Agudo (${metrics.sharpBiasCount}) vs -st Grave (${metrics.flatBiasCount}).
- Pares Confundidos: ${JSON.stringify(metrics.topConfusions)}
- Tonos Críticos: ${JSON.stringify(metrics.mostDifficultNotes)}

Por favor, respóndele en detalle explicando la teoría y conectándola con sus datos personales.`
}
