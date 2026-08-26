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
}

export const DEFAULT_REPERTOIRE_CONFIG: RepertoireEvaluationConfig = {
  rhythmMode: 'free_rubato',
  rhythmTolerancePercent: 20,
  chordClusterWindowMs: 45,
  baseBpm: 86
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
 * Evalúa la correspondencia entre la secuencia de eventos esperados de la partitura
 * y los eventos reales tocados por el alumno en el Roland FP-8.
 */
export function evaluateRepertoireAttempt(
  expectedEvents: ScorePlaybackEvent[],
  playedRawNotes: RawPlayedMidiNote[],
  config: RepertoireEvaluationConfig = DEFAULT_REPERTOIRE_CONFIG
): RepertoireExerciseResult {
  // Filtrar silencios de la lista de eventos esperados
  const targetEvents = expectedEvents.filter((e) => !e.isRest && e.midiNotes.length > 0)
  const clusteredPlayed = clusterPlayedMidiNotes(playedRawNotes, config.chordClusterWindowMs)

  const evaluatedEvents: SingleEventEvaluation[] = []
  let pitchCorrectCount = 0
  let rhythmCorrectCount = 0

  const firstPlayedTime = clusteredPlayed[0]?.timestampMs ?? 0

  for (let i = 0; i < targetEvents.length; i++) {
    const expected = targetEvents[i]
    const played = clusteredPlayed[i]

    if (!played) {
      // Evento no tocado
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

    // 2. Evaluación Rítmica
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
      } else {
        // Calcular tiempo acumulado teórico desde la primera nota
        const expectedTimeOffsetMs = targetEvents
          .slice(0, i)
          .reduce((acc, evt) => acc + evt.durationMs, 0)
        const actualTimeOffsetMs = played.timestampMs - firstPlayedTime

        timeDeviationMs = actualTimeOffsetMs - expectedTimeOffsetMs
        const expectedDuration = expected.durationMs || 500
        timeDeviationPercent = Math.round((Math.abs(timeDeviationMs) / expectedDuration) * 100)

        isRhythmCorrect = timeDeviationPercent <= config.rhythmTolerancePercent
      }
    } else if (config.rhythmMode === 'relative_proportional') {
      if (i === 0) {
        isRhythmCorrect = true
      } else {
        const expectedIoi = targetEvents[i - 1].durationMs
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
