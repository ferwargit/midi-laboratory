import { ScorePlaybackEvent } from '../music/scoreTypes'

export type RhythmEvaluationMode = 'free_rubato' | 'relative_proportional' | 'strict_metronome'

export interface RawPlayedMidiNote {
  noteNumber: number
  velocity: number
  timestampMs: number
}

export interface ClusteredPlayedEvent {
  notes: number[]
  timestampMs: number
  durationMs?: number
}

export interface RepertoireEvaluationConfig {
  rhythmMode: RhythmEvaluationMode
  rhythmTolerancePercent: number // Ej: 20 para ±20%
  chordClusterWindowMs: number // Ventana de cluster (default 45ms)
  baseBpm: number
  beatsPerMeasure?: number // Tiempos por compás (default 2, piso 2) — para cruzar fronteras de compás
}

export const DEFAULT_REPERTOIRE_CONFIG: RepertoireEvaluationConfig = {
  rhythmMode: 'free_rubato',
  rhythmTolerancePercent: 35,
  chordClusterWindowMs: 45,
  baseBpm: 86
}

/**
 * Piso mínimo para el IOI esperado (H-06). Por debajo de ~60 ms el jitter motor
 * inter-dedos supera la ventana de tolerancia incluso con timing perfecto, de modo
 * que las notas hiper-cortas (fusas/semifusas) exigirían precisión inalcanzable.
 */
export const MIN_EXPECTED_IOI_MS = 60

/**
 * Distancia métrica real (en tiempos de compás) entre dos eventos sonoros de la
 * línea temporal, soportando el cruce de fronteras de compás. Es la fuente de
 * verdad para los tiempos esperados: los silencios intermedios quedan implícitamente
 * incluidos, pues la posición métrica refleja la partitura real.
 */
function metricDistanceBeats(
  prev: ScorePlaybackEvent,
  curr: ScorePlaybackEvent,
  beatsPerMeasure: number
): number {
  return (
    (curr.measureNumber - prev.measureNumber) * beatsPerMeasure +
    (curr.beatPosition - prev.beatPosition)
  )
}

export interface SingleEventEvaluation {
  expectedEvent: ScorePlaybackEvent
  playedNotes: number[]
  isPitchCorrect: boolean
  isRhythmCorrect: boolean
  isExactMatch: boolean
  missingNotes: number[]
  extraNotes: number[]
  timeDeviationMs: number
  timeDeviationPercent: number
}

export interface RepertoireExerciseResult {
  isCompleteSuccess: boolean
  pitchAccuracyPercent: number
  rhythmAccuracyPercent: number
  overallScorePercent: number
  evaluatedEvents: SingleEventEvaluation[]
  feedbackMessage: string
}

/**
 * Agrupa pulsaciones MIDI individuales que ocurren dentro de una ventana de cluster
 * (45ms) para tratarlas como un único acorde polifónico tocado por la mano.
 */
export function clusterPlayedMidiNotes(
  rawNotes: RawPlayedMidiNote[],
  clusterWindowMs = 45
): ClusteredPlayedEvent[] {
  if (!rawNotes || rawNotes.length === 0) return []

  const sorted = [...rawNotes].sort((a, b) => a.timestampMs - b.timestampMs)
  const clusters: ClusteredPlayedEvent[] = []

  let currentCluster: ClusteredPlayedEvent = {
    notes: [sorted[0].noteNumber],
    timestampMs: sorted[0].timestampMs
  }

  for (let i = 1; i < sorted.length; i++) {
    const note = sorted[i]
    const timeDelta = note.timestampMs - currentCluster.timestampMs

    // Un acorde polifónico solo contiene notas distintas (ej: C3 + E3).
    // Si es la MISMA tecla repetida (ej: G4 y luego G4), siempre es una nota melódica secuencial.
    const isSameNote = currentCluster.notes.includes(note.noteNumber)

    if (timeDelta <= clusterWindowMs && !isSameNote) {
      currentCluster.notes.push(note.noteNumber)
    } else {
      currentCluster.notes.sort((a, b) => a - b)
      clusters.push(currentCluster)
      currentCluster = {
        notes: [note.noteNumber],
        timestampMs: note.timestampMs
      }
    }
  }

  currentCluster.notes.sort((a, b) => a - b)
  clusters.push(currentCluster)

  return clusters
}

/**
 * Evalúa la correspondencia de notas y ritmo adaptando dinámicamente los
 * tiempos esperados al BPM de estudio activo.
 */
export function evaluateRepertoireAttempt(
  expectedEvents: ScorePlaybackEvent[],
  playedRawNotes: RawPlayedMidiNote[],
  config: RepertoireEvaluationConfig = DEFAULT_REPERTOIRE_CONFIG
): RepertoireExerciseResult {
  const targetEvents = expectedEvents.filter((e) => !e.isRest && e.midiNotes.length > 0)
  const clusteredPlayed = clusterPlayedMidiNotes(playedRawNotes, config.chordClusterWindowMs)

  const evaluatedEvents: SingleEventEvaluation[] = []
  let pitchCorrectCount = 0
  let rhythmCorrectCount = 0

  const activeBpm = config.baseBpm || 86
  const beatDurationMs = Math.round(60000 / activeBpm)
  const beatsPerMeasure = Math.max(2, config.beatsPerMeasure ?? 2)
  const firstPlayedTime = clusteredPlayed[0]?.timestampMs ?? 0

  // Pre-cómputo de los tiempos esperados derivados de la distancia métrica real
  // (silencios intermedios y fronteras de compás incluidos), con el piso de
  // MIN_EXPECTED_IOI_MS y la exención rítmica para eventos de altura pura.
  const expectedDurations: number[] = new Array(targetEvents.length).fill(0)
  const expectedTimeOffsets: number[] = new Array(targetEvents.length).fill(0)

  for (let i = 1; i < targetEvents.length; i++) {
    const rawDistanceBeats = metricDistanceBeats(
      targetEvents[i - 1],
      targetEvents[i],
      beatsPerMeasure
    )
    if (rawDistanceBeats <= 0) continue // evento de altura pura: exento de penalización

    const expectedIoi = Math.max(MIN_EXPECTED_IOI_MS, Math.round(rawDistanceBeats * beatDurationMs))
    expectedDurations[i] = expectedIoi
    expectedTimeOffsets[i] = expectedTimeOffsets[i - 1] + expectedIoi
  }

  for (let i = 0; i < targetEvents.length; i++) {
    const expected = targetEvents[i]
    const played = clusteredPlayed[i]

    if (!played) {
      evaluatedEvents.push({
        expectedEvent: expected,
        playedNotes: [],
        isPitchCorrect: false,
        isRhythmCorrect: false,
        isExactMatch: false,
        missingNotes: [...expected.midiNotes],
        extraNotes: [],
        timeDeviationMs: 0,
        timeDeviationPercent: 0
      })
      continue
    }

    // 1. Evaluación de Altura (Pitch / Acorde)
    const expectedSorted = [...expected.midiNotes].sort((a, b) => a - b)
    const playedSorted = [...played.notes].sort((a, b) => a - b)

    const missingNotes = expectedSorted.filter((n) => !playedSorted.includes(n))
    const extraNotes = playedSorted.filter((n) => !expectedSorted.includes(n))
    const isPitchCorrect = missingNotes.length === 0 && extraNotes.length === 0

    if (isPitchCorrect) pitchCorrectCount++

    // 2. Evaluación Rítmica Escalada al BPM de Estudio
    let isRhythmCorrect = true
    let timeDeviationMs = 0
    let timeDeviationPercent = 0

    if (config.rhythmMode === 'free_rubato') {
      isRhythmCorrect = true
      timeDeviationMs = 0
      timeDeviationPercent = 0
    } else if (config.rhythmMode === 'strict_metronome') {
      if (i === 0) {
        isRhythmCorrect = true
      } else if (expectedDurations[i] === 0) {
        // Evento de altura pura (nota de adorno/gracia fusionada en la misma
        // posición métrica): exento de penalización rítmica. Evita división por
        // cero que generaría Infinity/NaN en timeDeviationPercent.
        isRhythmCorrect = true
        timeDeviationMs = 0
        timeDeviationPercent = 0
      } else {
        // Offset absoluto esperado = suma acumulada de los IOI esperados de los
        // eventos precedentes, derivada de la distancia métrica real.
        const expectedTimeOffsetMs = expectedTimeOffsets[i]
        const actualTimeOffsetMs = played.timestampMs - firstPlayedTime

        timeDeviationMs = actualTimeOffsetMs - expectedTimeOffsetMs
        const currentExpectedDuration = expectedDurations[i]
        timeDeviationPercent = Math.round(
          (Math.abs(timeDeviationMs) / currentExpectedDuration) * 100
        )

        isRhythmCorrect = timeDeviationPercent <= config.rhythmTolerancePercent
      }
    } else if (config.rhythmMode === 'relative_proportional') {
      if (i === 0) {
        isRhythmCorrect = true
      } else if (expectedDurations[i] === 0) {
        // Evento de altura pura (nota de adorno/gracia fusionada en la misma
        // posición métrica): exento de penalización rítmica. Evita división por
        // cero que generaría Infinity/NaN en timeDeviationPercent.
        isRhythmCorrect = true
        timeDeviationMs = 0
        timeDeviationPercent = 0
      } else {
        // Cálculo del IOI esperado según el BPM de estudio activo y la distancia
        // métrica real entre este evento y el anterior (silencios incluidos).
        const expectedIoi = expectedDurations[i]
        const actualIoi = played.timestampMs - clusteredPlayed[i - 1].timestampMs

        timeDeviationMs = actualIoi - expectedIoi
        timeDeviationPercent = Math.round((Math.abs(timeDeviationMs) / expectedIoi) * 100)

        isRhythmCorrect = timeDeviationPercent <= config.rhythmTolerancePercent
      }
    }

    if (isRhythmCorrect) rhythmCorrectCount++

    const isExactMatch = isPitchCorrect && isRhythmCorrect

    evaluatedEvents.push({
      expectedEvent: expected,
      playedNotes: playedSorted,
      isPitchCorrect,
      isRhythmCorrect,
      isExactMatch,
      missingNotes,
      extraNotes,
      timeDeviationMs,
      timeDeviationPercent
    })
  }

  const total = Math.max(1, targetEvents.length)
  const pitchAccuracyPercent = Math.round((pitchCorrectCount / total) * 100)
  const rhythmAccuracyPercent = Math.round((rhythmCorrectCount / total) * 100)
  const overallScorePercent = Math.round(pitchAccuracyPercent * 0.7 + rhythmAccuracyPercent * 0.3)

  const isCompleteSuccess =
    pitchAccuracyPercent === 100 &&
    (config.rhythmMode === 'free_rubato' || rhythmAccuracyPercent === 100)

  let feedbackMessage = ''
  if (isCompleteSuccess) {
    if (config.rhythmMode === 'free_rubato') {
      feedbackMessage = '🎉 ¡Afinación perfecta! Notas dominadas (Rubato libre).'
    } else if (config.rhythmMode === 'relative_proportional') {
      feedbackMessage = '🎉 ¡Frase perfecta! Afinación y proporciones rítmicas (IOI) dominadas.'
    } else {
      feedbackMessage = '🎉 ¡Frase perfecta! Afinación y métrica de metrónomo dominadas.'
    }
  } else if (pitchAccuracyPercent === 100 && rhythmAccuracyPercent < 100) {
    feedbackMessage = `🎯 Afinación exacta (100%), pero ajustá el ritmo (${rhythmAccuracyPercent}% precisión rítmica).`
  } else if (pitchAccuracyPercent >= 70) {
    feedbackMessage = `👍 Buen progreso: ${pitchAccuracyPercent}% de acierto de notas. Repetí para consolidar.`
  } else {
    feedbackMessage =
      '❌ Hay notas que difieren de la frase. Escuchá el motivo con (R) y reintentá.'
  }

  return {
    isCompleteSuccess,
    pitchAccuracyPercent,
    rhythmAccuracyPercent,
    overallScorePercent,
    evaluatedEvents,
    feedbackMessage
  }
}
