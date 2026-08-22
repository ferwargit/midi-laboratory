import { describe, it, expect } from 'vitest'
import { PEDAGOGICAL_DICTIONARY } from './pedagogicalDictionary'

describe('knowledgeGuide - Validación de los 5 Modelos Psicoacústicos Ilustrados', () => {
  it('todos los temas de la guía deben tener modelos correspondientes en el catálogo', () => {
    const requiredTopics = [
      'irt_normalized_accuracy',
      'cognitive_latency',
      'shannon_entropy',
      'leitner_system',
      'directional_bias'
    ]

    requiredTopics.forEach((topicKey) => {
      expect(PEDAGOGICAL_DICTIONARY[topicKey]).toBeDefined()
      expect(PEDAGOGICAL_DICTIONARY[topicKey].formulaOrCalculation.length).toBeGreaterThan(0)
    })
  })
})
