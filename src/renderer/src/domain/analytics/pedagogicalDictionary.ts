import { COGNITIVE_LATENCY_THRESHOLDS } from './historyAnalytics'

export interface PedagogicalConcept {
  id: string
  title: string
  subtitle: string
  category: 'psychometrics' | 'cognition' | 'algorithm' | 'melody'
  shortDefinition: string
  formulaOrCalculation: string
  practicalTakeaway: string
}

export const PEDAGOGICAL_DICTIONARY: Record<string, PedagogicalConcept> = {
  irt_normalized_accuracy: {
    id: 'irt_normalized_accuracy',
    title: 'Oído Real (IRT Normalizado)',
    subtitle: 'Teoría de Respuesta al Ítem (Corrección por Azar)',
    category: 'psychometrics',
    shortDefinition:
      'Mide tu verdadera precisión auditiva descontando la probabilidad estadística de acertar por pura suerte o descarte.',
    formulaOrCalculation: 'Oído Real = (Acierto - c) / (1 - c)   donde c = 1 / Tamaño del Pool',
    practicalTakeaway:
      'En 3 notas, un 80% crudo equivale a 70% real (hay 33% de azar). En una escala cromática de 13 notas, el azar es solo del 7%, por lo que tu precisión cruda y real casi coinciden.'
  },
  shannon_entropy: {
    id: 'shannon_entropy',
    title: 'Entropía Contextual (Shannon)',
    subtitle: 'Carga de Incertidumbre en Bits',
    category: 'psychometrics',
    shortDefinition:
      'Cuantifica cuánta información e incertidumbre debe procesar tu memoria de trabajo en cada ejercicio.',
    formulaOrCalculation: 'H = log₂(N)   donde N es el número de notas activas en el pool',
    practicalTakeaway:
      '3 notas = 1.58 bits (baja carga). 8 notas = 3.0 bits (carga media). 13 notas = 3.7 bits (alta carga). Evalúa si tu oído mantiene la afinación cuando la variedad aumenta.'
  },
  cognitive_latency: {
    id: 'cognitive_latency',
    title: 'Latencia Cognitiva',
    subtitle: 'Tiempo de Decisión y Acceso Mental',
    category: 'cognition',
    shortDefinition:
      'Tiempo transcurrido desde que suena el tono hasta que presionas la tecla en tu teclado MIDI.',
    formulaOrCalculation: 'Tiempo de Reacción = Timestamp(Pulsación) - Timestamp(Estímulo)',
    practicalTakeaway: `${COGNITIVE_LATENCY_THRESHOLDS.FAST_LABEL}: Reflejo directo (tono consolidado). ${COGNITIVE_LATENCY_THRESHOLDS.MEDIUM_LABEL}: Deducción interválica consciente. ${COGNITIVE_LATENCY_THRESHOLDS.SLOW_LABEL}: Vacilación, búsqueda al azar o fatiga auditiva.`
  },
  responses_per_minute: {
    id: 'responses_per_minute',
    title: 'Cadencia (RPM)',
    subtitle: 'Respuestas por Minuto / Velocidad de Flujo',
    category: 'cognition',
    shortDefinition: 'Velocidad de procesamiento sostenida a lo largo de toda la sesión.',
    formulaOrCalculation: 'RPM = (Total de Preguntas / Duración en Segundos) × 60',
    practicalTakeaway:
      'Una cadencia alta (>18 RPM) con buena precisión indica que el reconocimiento es fluido y no requiere sobrepensamiento.'
  },
  directional_bias: {
    id: 'directional_bias',
    title: 'Sesgo Direccional (+st / -st)',
    subtitle: 'Asimetría del Error de Semitono',
    category: 'psychometrics',
    shortDefinition:
      'Indica si tus fallos tienden a percibir las notas más agudas (+semitonos) o más graves (-semitonos) de lo que realmente suenan.',
    formulaOrCalculation: 'Sesgo = Nota Tocada - Nota Esperada   (+st = Agudo, -st = Grave)',
    practicalTakeaway:
      'Si tienes sesgo hacia lo agudo, tu oído anticipa tensión tonal hacia arriba. La IA usa esto para prescribir notas ancla graves de estabilización.'
  },
  test_retest_delta: {
    id: 'test_retest_delta',
    title: 'Evolución Test-Retest (Δ)',
    subtitle: 'Medición Longitudinal de Plasticidad Neuronal',
    category: 'psychometrics',
    shortDefinition:
      'Compara matemáticamente una sesión idéntica repetida en el tiempo para medir si hubo consolidación real de la memoria auditiva.',
    formulaOrCalculation: 'Δ Precisión = Retest - Baseline   |   Δ Latencia = Retest - Baseline',
    practicalTakeaway:
      'Si tu precisión se mantiene pero la latencia sube +350ms, tu oído está experimentando fatiga auditiva. Si la latencia baja y la precisión sube, hay consolidación neuronal.'
  },
  leitner_system: {
    id: 'leitner_system',
    title: 'Repetición Espaciada (Leitner / SM-2)',
    subtitle: 'Algoritmo de 3 Cajas de Memoria',
    category: 'algorithm',
    shortDefinition:
      'Distribuye los tonos en cajas según tu acierto: los fallos se reintentan inmediatamente y los aciertos se espacian en el tiempo.',
    formulaOrCalculation:
      'Caja 1 (Fallo: turno 1) ➔ Caja 2 (1 acierto: turno 3) ➔ Caja 3 (3 aciertos: turno 8)',
    practicalTakeaway:
      'Garantiza que no pierdas tiempo en notas que ya dominas y refuerza inmediatamente las notas con interferencia perceptual.'
  },
  inter_session_gap: {
    id: 'inter_session_gap',
    title: 'Descanso Inter-Sesión (ISI)',
    subtitle: 'Spacing Effect y Consolidación Sináptica',
    category: 'cognition',
    shortDefinition:
      'Tiempo transcurrido desde que finalizaste la sesión anterior hasta el inicio de la sesión actual.',
    formulaOrCalculation: 'ISI = Timestamp(Inicio Sesión Actual) - Timestamp(Fin Sesión Previa)',
    practicalTakeaway:
      '< 15 min: Práctica masiva (propensa a saturación y fatiga). 12h - 48h: Espaciamiento óptimo con consolidación durante el sueño. > 48h: Retención a largo plazo.'
  }
}

export function getConcept(id: string): PedagogicalConcept | null {
  return PEDAGOGICAL_DICTIONARY[id] || null
}
