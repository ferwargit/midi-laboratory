import { describe, it, expect } from 'vitest'
import { sanitizePrescription } from './prescriptionSanitizer'
import { AiExercisePrescription } from './types'

describe('prescriptionSanitizer - Corrección Determinista de Prescripciones de IA', () => {
  it('debe corregir B5 (83) a B4 (71) cuando el texto menciona explícitamente B4', () => {
    const rawWithOctaveBug: AiExercisePrescription = {
      title: 'Consolidación de Anclajes Tonales (D4-F4 y B4)',
      rationale: 'Aísla las notas problemáticas (E4/F4/B4) en modo discriminación simple.',
      targetMode: 'single_note',
      instrumentId: 'acoustic_grand_piano',
      recommendedNotes: [64, 65, 83], // E4 (64), F4 (65), y el erróneo B5 (83)
      recommendedIntervals: [1], // Campo residual que no debería estar en single_note
      limitType: 'mastery',
      questionsCount: 10,
      durationMinutes: 5,
      advanceMode: 'smart'
    }

    const sanitized = sanitizePrescription(rawWithOctaveBug)

    // B5 (83) debe haber sido corregido a B4 (71)
    expect(sanitized.recommendedNotes).toEqual([64, 65, 71])
    // recommendedIntervals debe haber sido eliminado en single_note
    expect(sanitized.recommendedIntervals).toBeUndefined()
  })

  it('debe eliminar sequenceLength en modalidad de intervalos', () => {
    const rawInterval: AiExercisePrescription = {
      title: 'Intervalos de 3ra',
      rationale: 'Práctica de terceras',
      targetMode: 'intervals',
      instrumentId: 'acoustic_grand_piano',
      recommendedNotes: [60],
      recommendedIntervals: [3, 4],
      sequenceLength: 4, // Huérfano
      limitType: 'questions',
      questionsCount: 10,
      durationMinutes: 5,
      advanceMode: 'smart'
    }

    const sanitized = sanitizePrescription(rawInterval)
    expect(sanitized.sequenceLength).toBeUndefined()
    expect(sanitized.recommendedIntervals).toEqual([3, 4])
  })

  it('debe asignar intervalos por defecto si faltan o están vacíos en modo intervals', () => {
    const rawMissing: AiExercisePrescription = {
      title: 'Intervals',
      rationale: 'intervals',
      targetMode: 'intervals',
      instrumentId: 'acoustic_grand_piano',
      recommendedNotes: [60, 64],
      limitType: 'questions',
      questionsCount: 10,
      durationMinutes: 5,
      advanceMode: 'smart'
    }
    const sanitized1 = sanitizePrescription(rawMissing)
    expect(sanitized1.recommendedIntervals).toEqual([2, 4, 5, 7])

    const rawEmpty: AiExercisePrescription = {
      ...rawMissing,
      recommendedIntervals: []
    }
    const sanitized2 = sanitizePrescription(rawEmpty)
    expect(sanitized2.recommendedIntervals).toEqual([2, 4, 5, 7])
  })

  it('debe validar y corregir sequenceLength y eliminar recommendedIntervals en modo sequences', () => {
    const rawSeq: AiExercisePrescription = {
      title: 'Sequences',
      rationale: 'sequences',
      targetMode: 'sequences',
      instrumentId: 'acoustic_grand_piano',
      recommendedNotes: [60, 62, 64],
      recommendedIntervals: [3, 4],
      sequenceLength: 1, // < 3
      limitType: 'questions',
      questionsCount: 10,
      durationMinutes: 5,
      advanceMode: 'smart'
    }
    const sanitized1 = sanitizePrescription(rawSeq)
    expect(sanitized1.sequenceLength).toBe(3)
    expect(sanitized1.recommendedIntervals).toBeUndefined()

    const rawSeqHigh: AiExercisePrescription = {
      ...rawSeq,
      sequenceLength: 7 // > 6
    }
    const sanitized2 = sanitizePrescription(rawSeqHigh)
    expect(sanitized2.sequenceLength).toBe(3)

    const rawSeqMissing: AiExercisePrescription = {
      ...rawSeq,
      sequenceLength: undefined as unknown as number
    }
    const sanitized3 = sanitizePrescription(rawSeqMissing)
    expect(sanitized3.sequenceLength).toBe(3)
  })

  it('debe asegurar al menos 2 notas por defecto si recommendedNotes es inválido o menor a 2', () => {
    const rawInvalid: AiExercisePrescription = {
      title: 'Single Note',
      rationale: 'single',
      targetMode: 'single_note',
      instrumentId: 'acoustic_grand_piano',
      recommendedNotes: [60] as unknown as number[],
      limitType: 'questions',
      questionsCount: 10,
      durationMinutes: 5,
      advanceMode: 'smart'
    }
    const sanitized1 = sanitizePrescription(rawInvalid)
    expect(sanitized1.recommendedNotes).toEqual([60, 62, 64])

    const rawNonArray: AiExercisePrescription = {
      ...rawInvalid,
      recommendedNotes: 'not-an-array' as unknown as number[]
    }
    const sanitized2 = sanitizePrescription(rawNonArray)
    expect(sanitized2.recommendedNotes).toEqual([60, 62, 64])
  })

  it('debe manejar contextText y notas con sostenidos/bemoles sin alterar notas sin corrección de octava', () => {
    const rawContext: AiExercisePrescription = {
      title: 'Secuencia C#3 y DB4',
      rationale: 'Práctica general',
      targetMode: 'single_note',
      instrumentId: 'acoustic_grand_piano',
      recommendedNotes: [37, 73, 90], // 37 (C#2 aprox), 73 (C#5), 90 (no 12 diff)
      limitType: 'questions',
      questionsCount: 10,
      durationMinutes: 5,
      advanceMode: 'smart'
    }
    const sanitized = sanitizePrescription(rawContext, 'Contexto con C#3 (49) y DB4 (61)')
    expect(sanitized.recommendedNotes).toContain(49)
    expect(sanitized.recommendedNotes).toContain(61)
    expect(sanitized.recommendedNotes).toContain(90)
  })
})
