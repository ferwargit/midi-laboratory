import { describe, it, expect } from 'vitest'
import {
  clusterPlayedMidiNotes,
  evaluateRepertoireAttempt,
  RawPlayedMidiNote,
  DEFAULT_REPERTOIRE_CONFIG
} from './repertoireEvaluator'
import { ScorePlaybackEvent } from '../music/scoreTypes'

describe('repertoireEvaluator - Motor de Evaluación Bimodal de Repertorio', () => {
  describe('clusterPlayedMidiNotes (Agrupación de Acordes Polifónicos)', () => {
    it('debe agrupar notas tocadas casi al mismo tiempo (<45ms) en un único acorde', () => {
      // Usuario toca C3 (48) y E3 (52) con 12ms de diferencia humana
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
        { noteNumber: 55, velocity: 85, timestampMs: 1350 } // Corchea siguiente a 350ms
      ]

      const clusters = clusterPlayedMidiNotes(rawNotes, 45)

      expect(clusters.length).toBe(2)
      expect(clusters[0].notes).toEqual([48])
      expect(clusters[1].notes).toEqual([55])
    })
  })

  describe('evaluateRepertoireAttempt (Evaluación de Frases y Acordes)', () => {
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

    it('debe detectar notas incorrectas y reportar las notas esperadas vs tocadas', () => {
      const rawNotes: RawPlayedMidiNote[] = [
        { noteNumber: 67, velocity: 90, timestampMs: 1000 },
        { noteNumber: 65, velocity: 90, timestampMs: 1350 }, // Tocó F4 (65) en vez de G4 (67)
        { noteNumber: 69, velocity: 90, timestampMs: 1520 }
      ]

      const result = evaluateRepertoireAttempt(mockExpectedMelody, rawNotes)

      expect(result.isCompleteSuccess).toBe(false)
      expect(result.pitchAccuracyPercent).toBe(67) // 2 de 3 correctas
      expect(result.evaluatedEvents[1].isPitchCorrect).toBe(false)
      expect(result.evaluatedEvents[1].missingNotes).toEqual([67])
      expect(result.evaluatedEvents[1].extraNotes).toEqual([65])
    })

    it('en modo strict_metronome debe exigir que el ritmo caiga dentro de la tolerancia configurada', () => {
      const rawNotesExact: RawPlayedMidiNote[] = [
        { noteNumber: 67, velocity: 90, timestampMs: 1000 },
        { noteNumber: 67, velocity: 90, timestampMs: 1350 }, // +350ms (teórico 348ms -> ~0.5% desvío)
        { noteNumber: 69, velocity: 90, timestampMs: 1524 } // +174ms (teórico 174ms -> ~0% desvío)
      ]

      const resultExact = evaluateRepertoireAttempt(mockExpectedMelody, rawNotesExact, {
        ...DEFAULT_REPERTOIRE_CONFIG,
        rhythmMode: 'strict_metronome',
        rhythmTolerancePercent: 20
      })

      expect(resultExact.isCompleteSuccess).toBe(true)
      expect(resultExact.rhythmAccuracyPercent).toBe(100)

      // Intento fuera de tolerancia rítmica (>20%)
      const rawNotesRushed: RawPlayedMidiNote[] = [
        { noteNumber: 67, velocity: 90, timestampMs: 1000 },
        { noteNumber: 67, velocity: 90, timestampMs: 1150 }, // Tocó 200ms antes de tiempo
        { noteNumber: 69, velocity: 90, timestampMs: 1250 }
      ]

      const resultRushed = evaluateRepertoireAttempt(mockExpectedMelody, rawNotesRushed, {
        ...DEFAULT_REPERTOIRE_CONFIG,
        rhythmMode: 'strict_metronome',
        rhythmTolerancePercent: 20
      })

      expect(resultRushed.isCompleteSuccess).toBe(false)
      expect(resultRushed.rhythmAccuracyPercent).toBeLessThan(100)
      expect(resultRushed.feedbackMessage).toContain('ajustá el ritmo')
    })

    it('en modo relative_proportional (IOI) debe validar las proporciones de tiempo relativas', () => {
      // Evento 1 (348ms, negra/corchea) y Evento 2 (174ms, semicorchea = mitad de tiempo)
      const rawNotesProportional: RawPlayedMidiNote[] = [
        { noteNumber: 67, velocity: 90, timestampMs: 1000 },
        { noteNumber: 67, velocity: 90, timestampMs: 1350 }, // IOI = 350ms (~348ms teórico)
        { noteNumber: 69, velocity: 90, timestampMs: 1525 } // IOI = 175ms (~174ms teórico)
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
          midiNotes: [48, 52, 55], // Tríada C Mayor
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

      // Alumno toca C3 + E3 pero omite G3 (acorde incompleto)
      const rawNotesIncomplete: RawPlayedMidiNote[] = [
        { noteNumber: 48, velocity: 90, timestampMs: 1000 },
        { noteNumber: 52, velocity: 90, timestampMs: 1015 }
      ]

      const result = evaluateRepertoireAttempt(mockChordEvent, rawNotesIncomplete)

      expect(result.isCompleteSuccess).toBe(false)
      expect(result.evaluatedEvents[0].isPitchCorrect).toBe(false)
      expect(result.evaluatedEvents[0].missingNotes).toEqual([55]) // G3 faltante
    })
  })
})
