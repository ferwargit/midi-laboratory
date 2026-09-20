import { describe, it, expect } from 'vitest'
import {
  clusterPlayedMidiNotes,
  evaluateRepertoireAttempt,
  RawPlayedMidiNote,
  DEFAULT_REPERTOIRE_CONFIG
} from './repertoireEvaluator'
import { ScorePlaybackEvent } from '../music/scoreTypes'

describe('repertoireEvaluator - Motor de Evaluación Bimodal de Repertorio', () => {
  const mockExpectedMelody: ScorePlaybackEvent[] = [
    {
      id: '1',
      measureNumber: 1,
      beatPosition: 1.0,
      notes: [{ pitch: 67, step: 'G', alter: 0, octave: 4 }],
      midiNotes: [67],
      durationDivisions: 2,
      durationBeats: 0.5,
      durationMs: 348,
      isChord: false,
      isRest: false,
      hand: 'RH',
      staff: 1,
      voice: 1
    },
    {
      id: '2',
      measureNumber: 1,
      beatPosition: 1.5,
      notes: [{ pitch: 67, step: 'G', alter: 0, octave: 4 }],
      midiNotes: [67],
      durationDivisions: 1,
      durationBeats: 0.25,
      durationMs: 174,
      isChord: false,
      isRest: false,
      hand: 'RH',
      staff: 1,
      voice: 1
    },
    {
      id: '3',
      measureNumber: 1,
      beatPosition: 1.75,
      notes: [{ pitch: 69, step: 'A', alter: 0, octave: 4 }],
      midiNotes: [69],
      durationDivisions: 1,
      durationBeats: 0.25,
      durationMs: 174,
      isChord: false,
      isRest: false,
      hand: 'RH',
      staff: 1,
      voice: 1
    }
  ]

  describe('clusterPlayedMidiNotes (Agrupación de Acordes Polifónicos)', () => {
    it('debe agrupar notas tocadas casi al mismo tiempo (<45ms) en un único acorde', () => {
      const rawNotes: RawPlayedMidiNote[] = [
        { noteNumber: 48, velocity: 90, timestampMs: 1000 },
        { noteNumber: 52, velocity: 92, timestampMs: 1012 }
      ]

      const clusters = clusterPlayedMidiNotes(rawNotes, 45)

      expect(clusters.length).toBe(1)
      expect(clusters[0].notes).toEqual([48, 52])
      expect(clusters[0].timestampMs).toBe(1000)
    })

    it('debe separar notas consecutivas espaciadas en el tiempo (>45ms)', () => {
      const rawNotes: RawPlayedMidiNote[] = [
        { noteNumber: 48, velocity: 90, timestampMs: 1000 },
        { noteNumber: 55, velocity: 85, timestampMs: 1350 }
      ]

      const clusters = clusterPlayedMidiNotes(rawNotes, 45)

      expect(clusters.length).toBe(2)
      expect(clusters[0].notes).toEqual([48])
      expect(clusters[1].notes).toEqual([55])
    })
  })

  describe('evaluateRepertoireAttempt (Evaluación de Frases y Acordes)', () => {
    it('en modo free_rubato debe calificar 100% de éxito si las notas son correctas independientemente del tiempo', () => {
      const rawNotes: RawPlayedMidiNote[] = [
        { noteNumber: 67, velocity: 90, timestampMs: 1000 },
        { noteNumber: 67, velocity: 90, timestampMs: 2500 },
        { noteNumber: 69, velocity: 90, timestampMs: 4000 }
      ]

      const result = evaluateRepertoireAttempt(mockExpectedMelody, rawNotes, {
        ...DEFAULT_REPERTOIRE_CONFIG,
        rhythmMode: 'free_rubato'
      })

      expect(result.isCompleteSuccess).toBe(true)
      expect(result.pitchAccuracyPercent).toBe(100)
      expect(result.rhythmAccuracyPercent).toBe(100)
      expect(result.feedbackMessage).toContain('¡Afinación perfecta!')
    })

    it('debe evaluar eventos faltantes si el usuario no completó todas las notas', () => {
      const rawNotesPartial: RawPlayedMidiNote[] = [
        { noteNumber: 67, velocity: 90, timestampMs: 1000 }
      ]

      const result = evaluateRepertoireAttempt(mockExpectedMelody, rawNotesPartial)

      expect(result.isCompleteSuccess).toBe(false)
      expect(result.pitchAccuracyPercent).toBe(33) // 1 de 3
      expect(result.evaluatedEvents[1].missingNotes).toEqual([67])
      expect(result.evaluatedEvents[2].missingNotes).toEqual([69])
    })

    it('en modo relative_proportional (IOI) debe validar las proporciones de tiempo relativas', () => {
      const rawNotesProportional: RawPlayedMidiNote[] = [
        { noteNumber: 67, velocity: 90, timestampMs: 1000 },
        { noteNumber: 67, velocity: 90, timestampMs: 1350 },
        { noteNumber: 69, velocity: 90, timestampMs: 1525 }
      ]

      const result = evaluateRepertoireAttempt(mockExpectedMelody, rawNotesProportional, {
        ...DEFAULT_REPERTOIRE_CONFIG,
        rhythmMode: 'relative_proportional',
        rhythmTolerancePercent: 20
      })

      expect(result.isCompleteSuccess).toBe(true)
      expect(result.rhythmAccuracyPercent).toBe(100)
    })

    it('debe detectar acordes tríadas polifónicos incompletos o con notas erróneas', () => {
      const mockChordEvent: ScorePlaybackEvent[] = [
        {
          id: 'chord1',
          measureNumber: 1,
          beatPosition: 1.0,
          notes: [
            { pitch: 48, step: 'C', alter: 0, octave: 3 },
            { pitch: 52, step: 'E', alter: 0, octave: 3 },
            { pitch: 55, step: 'G', alter: 0, octave: 3 }
          ],
          midiNotes: [48, 52, 55],
          durationDivisions: 4,
          durationBeats: 1.0,
          durationMs: 500,
          isChord: true,
          isRest: false,
          hand: 'LH',
          staff: 2,
          voice: 5
        }
      ]

      const rawNotesIncomplete: RawPlayedMidiNote[] = [
        { noteNumber: 48, velocity: 90, timestampMs: 1000 },
        { noteNumber: 52, velocity: 90, timestampMs: 1015 }
      ]

      const result = evaluateRepertoireAttempt(mockChordEvent, rawNotesIncomplete)

      expect(result.isCompleteSuccess).toBe(false)
      expect(result.evaluatedEvents[0].isPitchCorrect).toBe(false)
      expect(result.evaluatedEvents[0].missingNotes).toEqual([55])
    })

    // ---- OLA 2.2 (Auditoría V6, H-06): silencios y límites aritméticos ----

    it('en relative_proportional debe incorporar los silencios intermedios al IOI esperado (H-06)', () => {
      // 2/4 a 86 BPM -> beatDurationMs = round(60000 / 86) = 698 ms
      // Eventos sonoros: C.1 beat 1.0 (negra), C.1 beat 1.5 (negra + silencio de negra),
      // C.2 beat 1.0 (nota de resolución +1 Res).
      // Distancia métrica entre el 2do y el 3er evento = 1 compás entero + 0.5 = 1.5 tiempos.
      const melodyWithRest: ScorePlaybackEvent[] = [
        {
          id: 'r1',
          measureNumber: 1,
          beatPosition: 1.0,
          notes: [{ pitch: 67, step: 'G', alter: 0, octave: 4 }],
          midiNotes: [67],
          durationDivisions: 4,
          durationBeats: 0.5,
          durationMs: 349,
          isChord: false,
          isRest: false,
          hand: 'RH',
          staff: 1,
          voice: 1
        },
        {
          id: 'r2',
          measureNumber: 1,
          beatPosition: 1.5,
          notes: [{ pitch: 69, step: 'A', alter: 0, octave: 4 }],
          midiNotes: [69],
          durationDivisions: 4,
          durationBeats: 0.5,
          durationMs: 349,
          isChord: false,
          isRest: false,
          hand: 'RH',
          staff: 1,
          voice: 1
        },
        {
          id: 'r3',
          measureNumber: 2,
          beatPosition: 1.0,
          notes: [{ pitch: 71, step: 'B', alter: 0, octave: 4 }],
          midiNotes: [71],
          durationDivisions: 4,
          durationBeats: 0.5,
          durationMs: 349,
          isChord: false,
          isRest: false,
          hand: 'RH',
          staff: 1,
          voice: 1
        }
      ]

      // Ejecutada a tiempo exacto: IOI reales = 349 ms (0.5 tiempos) y 1047 ms (1.5 tiempos)
      const playedOnTime: RawPlayedMidiNote[] = [
        { noteNumber: 67, velocity: 90, timestampMs: 1000 },
        { noteNumber: 69, velocity: 90, timestampMs: 1349 },
        { noteNumber: 71, velocity: 90, timestampMs: 2396 }
      ]

      const result = evaluateRepertoireAttempt(melodyWithRest, playedOnTime, {
        ...DEFAULT_REPERTOIRE_CONFIG,
        rhythmMode: 'relative_proportional',
        rhythmTolerancePercent: 20,
        beatsPerMeasure: 2
      })

      expect(result.rhythmAccuracyPercent).toBe(100)
      expect(result.isCompleteSuccess).toBe(true)
    })

    it('una nota de adorno con durationBeats 0 no debe generar NaN ni Infinity (H-06)', () => {
      // Dos eventos en la misma posición métrica (nota de adorno/gracia fusionada con su nota principal).
      // La fórmula vieja deriva expectedIoi = 0 y divide por cero en timeDeviationPercent.
      const melodyWithGraceNote: ScorePlaybackEvent[] = [
        {
          id: 'g1',
          measureNumber: 1,
          beatPosition: 1.0,
          notes: [{ pitch: 69, step: 'A', alter: 0, octave: 4 }],
          midiNotes: [69],
          durationDivisions: 0,
          durationBeats: 0,
          durationMs: 0,
          isChord: false,
          isRest: false,
          hand: 'RH',
          staff: 1,
          voice: 1
        },
        {
          id: 'g2',
          measureNumber: 1,
          beatPosition: 1.0,
          notes: [{ pitch: 67, step: 'G', alter: 0, octave: 4 }],
          midiNotes: [67],
          durationDivisions: 4,
          durationBeats: 1.0,
          durationMs: 698,
          isChord: false,
          isRest: false,
          hand: 'RH',
          staff: 1,
          voice: 1
        }
      ]

      // 60 ms de separación: por encima de la ventana de cluster (45 ms) -> dos eventos separados
      const played: RawPlayedMidiNote[] = [
        { noteNumber: 69, velocity: 90, timestampMs: 1000 },
        { noteNumber: 67, velocity: 90, timestampMs: 1060 }
      ]

      const result = evaluateRepertoireAttempt(melodyWithGraceNote, played, {
        ...DEFAULT_REPERTOIRE_CONFIG,
        rhythmMode: 'relative_proportional',
        rhythmTolerancePercent: 20
      })

      const deviations = result.evaluatedEvents.map((e) => e.timeDeviationPercent)
      expect(deviations.every((d) => Number.isFinite(d))).toBe(true)
      expect(result.evaluatedEvents[0].isRhythmCorrect).toBe(true)
      expect(result.evaluatedEvents[0].timeDeviationMs).toBe(0)
      // El evento de adorno sigue evaluándose en altura
      expect(result.evaluatedEvents[0].isPitchCorrect).toBe(true)
      expect(result.evaluatedEvents[1].isRhythmCorrect).toBe(true)
    })

    it('en strict_metronome debe cruzar la frontera de compás al calcular el offset absoluto (H-06)', () => {
      // 2/4 a 86 BPM -> 698 ms por tiempo. Evento 1 en C.1 beat 1.0 (corchea seguida de silencios
      // que rellenan el compás), evento 2 en C.2 beat 1.0 (nota de resolución +1 Res).
      // Offset absoluto esperado del 2do evento = 2 tiempos (un compás entero) = 1396 ms.
      // La fórmula vieja solo suma durationBeats del evento previo (0.5) -> 349 ms, sin ver el silencio.
      const melodyCrossingMeasure: ScorePlaybackEvent[] = [
        {
          id: 'm1',
          measureNumber: 1,
          beatPosition: 1.0,
          notes: [{ pitch: 67, step: 'G', alter: 0, octave: 4 }],
          midiNotes: [67],
          durationDivisions: 2,
          durationBeats: 0.5,
          durationMs: 349,
          isChord: false,
          isRest: false,
          hand: 'RH',
          staff: 1,
          voice: 1
        },
        {
          id: 'm2',
          measureNumber: 2,
          beatPosition: 1.0,
          notes: [{ pitch: 71, step: 'B', alter: 0, octave: 4 }],
          midiNotes: [71],
          durationDivisions: 4,
          durationBeats: 1.0,
          durationMs: 698,
          isChord: false,
          isRest: false,
          hand: 'RH',
          staff: 1,
          voice: 1
        }
      ]

      const playedOnTime: RawPlayedMidiNote[] = [
        { noteNumber: 67, velocity: 90, timestampMs: 1000 },
        { noteNumber: 71, velocity: 90, timestampMs: 2396 }
      ]

      const result = evaluateRepertoireAttempt(melodyCrossingMeasure, playedOnTime, {
        ...DEFAULT_REPERTOIRE_CONFIG,
        rhythmMode: 'strict_metronome',
        rhythmTolerancePercent: 20,
        beatsPerMeasure: 2
      })

      expect(result.rhythmAccuracyPercent).toBe(100)
      expect(result.isCompleteSuccess).toBe(true)
    })

    it('debe aplicar un piso de 60 ms al IOI esperado para notas hiper-cortas (H-06)', () => {
      // 120 BPM -> 500 ms por tiempo. Dos eventos a 0.1 tiempos de distancia -> IOI crudo = 50 ms.
      const melodyFast: ScorePlaybackEvent[] = [
        {
          id: 'f1',
          measureNumber: 1,
          beatPosition: 1.0,
          notes: [{ pitch: 67, step: 'G', alter: 0, octave: 4 }],
          midiNotes: [67],
          durationDivisions: 1,
          durationBeats: 0.1,
          durationMs: 50,
          isChord: false,
          isRest: false,
          hand: 'RH',
          staff: 1,
          voice: 1
        },
        {
          id: 'f2',
          measureNumber: 1,
          beatPosition: 1.1,
          notes: [{ pitch: 69, step: 'A', alter: 0, octave: 4 }],
          midiNotes: [69],
          durationDivisions: 1,
          durationBeats: 0.1,
          durationMs: 50,
          isChord: false,
          isRest: false,
          hand: 'RH',
          staff: 1,
          voice: 1
        }
      ]

      // Tocado a 60 ms de separación: con IOI esperado de 50 ms y tolerancia 20% (±10 ms) fallaría;
      // con el piso de 60 ms (±12 ms) también fallaría por 60 > 12... en cambio a 65 ms pasa.
      const played: RawPlayedMidiNote[] = [
        { noteNumber: 67, velocity: 90, timestampMs: 1000 },
        { noteNumber: 69, velocity: 90, timestampMs: 1065 }
      ]

      const result = evaluateRepertoireAttempt(melodyFast, played, {
        ...DEFAULT_REPERTOIRE_CONFIG,
        rhythmMode: 'relative_proportional',
        rhythmTolerancePercent: 20,
        baseBpm: 120
      })

      // IOI esperado efectivo = 60 ms (piso, pues el crudo es 50 ms); 65 - 60 = 5 ms
      // -> round(5 / 60 * 100) = 8% < 20% -> correcto. Las aserciones numéricas
      // blindan el piso: sin él, expectedIoi = 50 ms daría 30% y fallaría.
      expect(result.evaluatedEvents[1].timeDeviationMs).toBe(5)
      expect(result.evaluatedEvents[1].timeDeviationPercent).toBe(8)
      expect(result.evaluatedEvents[1].isRhythmCorrect).toBe(true)
    })
  })
})
