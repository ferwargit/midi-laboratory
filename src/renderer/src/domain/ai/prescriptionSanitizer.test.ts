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
})
