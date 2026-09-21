import { describe, it, expect } from 'vitest'
import { computePerNoteLatencyStats, computeNotePerformancesFromAnswers } from './latencyStats'
import { COGNITIVE_LATENCY_THRESHOLDS } from './thresholds'
import { DbAnswerRecord } from '../database/types'

function makeAnswer(partial: Partial<DbAnswerRecord> = {}): DbAnswerRecord {
  return {
    id: 'a_base',
    sessionId: 's_base',
    questionIndex: 0,
    expectedNote: 60,
    playedNote: 60,
    isCorrect: true,
    semitoneDistance: 0,
    responseTimeMs: 1000,
    velocity: 90,
    reasonTelemetry: '',
    createdAt: new Date('2026-09-01T10:01:00Z').toISOString(),
    inputSource: 'midi_hardware',
    ...partial
  }
}

describe('latencyStats - computePerNoteLatencyStats', () => {
  it('devuelve resúmenes nulos cuando ninguna respuesta es correcta', () => {
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'w1', expectedNote: 60, isCorrect: false, responseTimeMs: 1000 }),
      makeAnswer({ id: 'w2', expectedNote: 62, isCorrect: false, responseTimeMs: 2000 })
    ]

    const analysis = computePerNoteLatencyStats(answers)
    expect(analysis.fastestNote).toBeNull()
    expect(analysis.slowestNote).toBeNull()
    expect(analysis.fastestOctave).toBeNull()
    analysis.notes.forEach((n) => {
      expect(n.correctAttempts).toBe(0)
      expect(n.avgLatencyMs).toBe(0)
      expect(n.fastReflexPercent).toBe(0)
      expect(n.accuracyPercentage).toBe(0)
    })
  })

  it('devuelve un análisis vacío sin respuestas', () => {
    const analysis = computePerNoteLatencyStats([])
    expect(analysis.notes).toEqual([])
    expect(analysis.octaves).toEqual([])
    expect(analysis.fastestNote).toBeNull()
    expect(analysis.slowestNote).toBeNull()
    expect(analysis.fastestOctave).toBeNull()
  })

  it('ignora las respuestas con expectedNote < 0', () => {
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'n1', expectedNote: -1, isCorrect: true, responseTimeMs: 500 }),
      makeAnswer({ id: 'n2', expectedNote: 60, isCorrect: true, responseTimeMs: 1000 })
    ]

    const analysis = computePerNoteLatencyStats(answers)
    expect(analysis.notes.map((n) => n.noteNumber)).toEqual([60])
  })

  it('clasifica las octavas con etiquetas de grave, central y aguda', () => {
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'o1', expectedNote: 48, isCorrect: true, responseTimeMs: 2000 }),
      makeAnswer({ id: 'o2', expectedNote: 60, isCorrect: true, responseTimeMs: 1000 }),
      makeAnswer({ id: 'o3', expectedNote: 72, isCorrect: true, responseTimeMs: 3000 })
    ]

    const analysis = computePerNoteLatencyStats(answers)
    expect(analysis.octaves.map((o) => o.octave)).toEqual([3, 4, 5])
    expect(analysis.octaves.map((o) => o.octaveLabel)).toEqual([
      'Octava 3 (Grave: C3-B3)',
      'Octava 4 (Central: C4-B4)',
      'Octava 5 (Aguda)'
    ])
  })

  it('resuelve nombres de nota y octavas MIDI correctos', () => {
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'nm1', expectedNote: 48, isCorrect: true, responseTimeMs: 1000 }),
      makeAnswer({ id: 'nm2', expectedNote: 60, isCorrect: true, responseTimeMs: 1000 })
    ]

    const analysis = computePerNoteLatencyStats(answers)
    const byNote = new Map(analysis.notes.map((n) => [n.noteNumber, n]))
    expect(byNote.get(48)?.noteName).toBe('C3')
    expect(byNote.get(48)?.octave).toBe(3)
    expect(byNote.get(60)?.noteName).toBe('C4')
    expect(byNote.get(60)?.octave).toBe(4)
  })

  it('ordena las notas y octavas de forma ascendente', () => {
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 's1', expectedNote: 72, isCorrect: true, responseTimeMs: 1000 }),
      makeAnswer({ id: 's2', expectedNote: 48, isCorrect: true, responseTimeMs: 1000 }),
      makeAnswer({ id: 's3', expectedNote: 60, isCorrect: true, responseTimeMs: 1000 })
    ]

    const analysis = computePerNoteLatencyStats(answers)
    expect(analysis.notes.map((n) => n.noteNumber)).toEqual([48, 60, 72])
    expect(analysis.octaves.map((o) => o.octave)).toEqual([3, 4, 5])
  })

  it('identifica fastestNote, slowestNote y fastestOctave por latencia promedio', () => {
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'f1', expectedNote: 48, isCorrect: true, responseTimeMs: 2000 }),
      makeAnswer({ id: 'f2', expectedNote: 60, isCorrect: true, responseTimeMs: 1000 }),
      makeAnswer({ id: 'f3', expectedNote: 72, isCorrect: true, responseTimeMs: 3000 })
    ]

    const analysis = computePerNoteLatencyStats(answers)
    expect(analysis.fastestNote?.noteNumber).toBe(60)
    expect(analysis.slowestNote?.noteNumber).toBe(72)
    expect(analysis.fastestOctave?.octave).toBe(4)
  })

  it('promedia las latencias de las respuestas correctas de una nota', () => {
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'av1', expectedNote: 60, isCorrect: true, responseTimeMs: 1000 }),
      makeAnswer({ id: 'av2', expectedNote: 60, isCorrect: true, responseTimeMs: 3000 })
    ]

    const analysis = computePerNoteLatencyStats(answers)
    expect(analysis.notes[0].avgLatencyMs).toBe(2000)
  })

  it('cuenta respuestas rápidas según FAST_MAX_MS (frontera inclusiva)', () => {
    const boundary = COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'fr1', expectedNote: 60, isCorrect: true, responseTimeMs: 1000 }),
      makeAnswer({ id: 'fr2', expectedNote: 60, isCorrect: true, responseTimeMs: 2000 }),
      makeAnswer({ id: 'fr3', expectedNote: 62, isCorrect: true, responseTimeMs: boundary })
    ]

    const analysis = computePerNoteLatencyStats(answers)
    const byNote = new Map(analysis.notes.map((n) => [n.noteNumber, n]))
    expect(byNote.get(60)?.fastReflexPercent).toBe(50)
    expect(byNote.get(62)?.fastReflexPercent).toBe(0)
  })

  it('calcula accuracyPercentage con aciertos y errores mezclados', () => {
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'ac1', expectedNote: 60, isCorrect: true, responseTimeMs: 1000 }),
      makeAnswer({ id: 'ac2', expectedNote: 60, isCorrect: false, responseTimeMs: 1000 })
    ]

    const analysis = computePerNoteLatencyStats(answers)
    expect(analysis.notes[0].totalAttempts).toBe(2)
    expect(analysis.notes[0].correctAttempts).toBe(1)
    expect(analysis.notes[0].accuracyPercentage).toBe(50)
  })

  it('acumula totalNotes y totalAttempts por octava', () => {
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'tn1', expectedNote: 60, isCorrect: true, responseTimeMs: 1000 }),
      makeAnswer({ id: 'tn2', expectedNote: 62, isCorrect: true, responseTimeMs: 1000 }),
      makeAnswer({ id: 'tn3', expectedNote: 64, isCorrect: true, responseTimeMs: 1000 })
    ]

    const analysis = computePerNoteLatencyStats(answers)
    const octave4 = analysis.octaves.find((o) => o.octave === 4)
    expect(octave4?.totalNotes).toBe(3)
    expect(octave4?.totalAttempts).toBe(3)
  })
})

describe('latencyStats - computeNotePerformancesFromAnswers', () => {
  it('acumula intentos, aciertos y último resultado por nota', () => {
    const answers: DbAnswerRecord[] = [
      makeAnswer({ id: 'p1', expectedNote: 60, isCorrect: true, responseTimeMs: 1000 }),
      makeAnswer({ id: 'p2', expectedNote: 60, isCorrect: false, responseTimeMs: 2000 }),
      makeAnswer({ id: 'p3', expectedNote: 62, isCorrect: true, responseTimeMs: 900 })
    ]

    const map = computeNotePerformancesFromAnswers(answers)
    expect(map.size).toBe(2)
    const perf60 = map.get(60)
    expect(perf60?.attempts).toBe(2)
    expect(perf60?.correct).toBe(1)
    expect(perf60?.lastResultWasCorrect).toBe(false)
    expect(perf60?.accuracyPercentage).toBe(50)
    expect(perf60?.weight).toBe(1.0)
    const perf62 = map.get(62)
    expect(perf62?.lastResultWasCorrect).toBe(true)
    expect(perf62?.accuracyPercentage).toBe(100)
  })

  it('devuelve un mapa vacío sin respuestas', () => {
    expect(computeNotePerformancesFromAnswers([]).size).toBe(0)
  })
})
