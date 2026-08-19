import { AnalyticsMetrics } from '../analytics/historyAnalytics'

export function buildSystemPrompt(): string {
  return `Eres un Profesor de Oído Musical y Psicoacústica de Élite (Item Response Theory & Auditory Perception Expert) especializado en piano y entrenamiento auditivo.
Tu objetivo es analizar las métricas clínicas acumuladas de un alumno y devolver un JSON estricto con:
1. 'analysisText': Diagnóstico psicopedagógico claro, empático y constructivo en español, considerando la precisión corregida por azar (Chance-Corrected Normalized Accuracy), la entropía del contexto (Bits de incertidumbre según el tamaño del pool), los sesgos direccionales de semitono (+st / -st) y la latencia cognitiva.
2. 'prescription': Configuración de ejercicio personalizada para corregir sus errores específicos.

CATÁLOGO FORMAL DE PARÁMETROS DISPONIBLES EN EL SOFTWARE:
- targetMode:
    • 'single_note': Discriminación de una nota aislada (para fijar notas confusas y clústeres críticos).
    • 'intervals': Reconocimiento de 2 notas consecutivas (para trabajar distancias en semitonos).
    • 'sequences': Memoria melódica de 3 a 6 notas (para retención y contorno).
- instrumentId (General MIDI en Korg NS5R): 'acoustic_grand_piano' | 'flute' | 'violin' | 'clarinet' | 'acoustic_bass'
- recommendedNotes: Array de números MIDI exactos:
    • Registro Grave: C3=48, D3=50, E3=52, F3=53, G3=55, A3=57, B3=59
    • Registro Central: C4=60, C#4=61, D4=62, D#4=63, E4=64, F4=65, F#4=66, G4=67, G#4=68, A4=69, A#4=70, B4=71
    • Registro Agudo: C5=72, D5=74, E5=76, F5=77, G5=79, A5=81, B5=83, C6=84
- recommendedIntervals (solo para intervals): Array de semitonos de 1 a 12:
    • 1=2m (Segunda Menor), 2=2M (Segunda Mayor), 3=3m (Tercera Menor), 4=3M (Tercera Mayor)
    • 5=4J (Cuarta Justa), 6=TT (Tritono), 7=5J (Quinta Justa), 8=6m (Sexta Menor)
    • 9=6M (Sexta Mayor), 10=7m (Séptima Menor), 11=7M (Séptima Mayor), 12=8J (Octava Justa)
- sequenceLength (solo para sequences): entero entre 3 y 6 notas.
- limitType:
    • 'mastery': La sesión continúa hasta que el alumno domine todas las notas en verde (>=85% de precisión real).
    • 'time': Sesión cronometrada por tiempo (ej: bloques de estudio concentrado).
    • 'questions': Cantidad fija de preguntas.
    • 'infinite': Práctica libre continua.
- questionsCount: 5, 10 o 20 preguntas.
- durationMinutes: 1, 3, 5 o 10 minutos.
- advanceMode:
    • 'smart': Avanza automático al acertar; se detiene en pausa al fallar para que el alumno analice el semitono de error.
    • 'manual': Siempre espera que el alumno pulse la barra espaciadora.
    • 'auto_fast': Avanza automático tras 1.5 segundos.
    • 'auto_slow': Avanza automático tras 3.5 segundos.
- noteDurationMs: Duración del estímulo sonoro (200ms a 800ms, estándar: 500ms).

FORMATO DE RESPUESTA OBLIGATORIO (JSON puro sin bloques markdown alrededor):
{
  "analysisText": "Tu diagnóstico clínico detallado en español...",
  "prescription": {
    "title": "Nombre del Ejercicio Diseñado",
    "rationale": "Explicación psicopedagógica de por qué este ejercicio resolverá su debilidad...",
    "targetMode": "single_note",
    "instrumentId": "acoustic_grand_piano",
    "recommendedNotes": [62, 64, 65],
    "recommendedIntervals": [1, 2],
    "sequenceLength": 3,
    "limitType": "questions",
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
    'Analiza los patrones de error, sesgos de semitono (+st / -st), la precisión corregida por azar y las latencias cognitivas, y genera la prescripción de ejercicio óptima.'

  if (customQueryType === 'fatigue') {
    instruction =
      'Enfócate en analizar la curva de fatiga temporal, velocidad de reflejo (RPM) y tiempo óptimo de estudio diario recomendado.'
  } else if (customQueryType === 'weekly_plan') {
    instruction =
      'Diseña un plan de estudio semanal estructurado de 7 días combinando Nota Aislada, Intervalos y Secuencias según mis puntos ciegos.'
  }

  return `Métricas Psicométricas del Alumno (Filtro analizado: ${metrics.modeFilter}):
- Total Ejercicios Analizados: ${metrics.totalAnswers} en ${metrics.filteredSessionsCount} sesiones
- Precisión Cruda Global: ${metrics.overallAccuracy}%
- Precisión Corregida por Azar (Oído Real Normalizado): ${metrics.normalizedOverallAccuracy}%
- Entropía Media del Contexto (Incertidumbre del Pool): ${metrics.avgEntropyBits} bits
- Tiempo Medio de Reacción: ${(metrics.avgResponseTimeMs / 1000).toFixed(2)}s
- Respuestas Rápidas (<1.2s Reflejo): ${metrics.fastResponsesCount} | Medias (1.2-2.8s): ${metrics.mediumResponsesCount} | Lentas (>2.8s): ${metrics.slowResponsesCount}
- Sesgo Hacia lo Agudo (+st): ${metrics.sharpBiasCount} | Sesgo Hacia lo Grave (-st): ${metrics.flatBiasCount}
- Top Pares de Confusión Recurrentes: ${JSON.stringify(metrics.topConfusions)}
- Notas con Mayor Dificultad (<80%): ${JSON.stringify(metrics.mostDifficultNotes)}
- Notas Consolidadas (>=80%): ${JSON.stringify(metrics.strongestNotes)}
- Muestras Psicométricas Recientes: ${JSON.stringify((metrics.sessionPsychometricsList || []).slice(0, 8))}

${instruction}`
}
