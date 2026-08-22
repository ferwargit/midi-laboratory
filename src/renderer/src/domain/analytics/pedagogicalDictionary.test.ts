import { describe, it, expect } from 'vitest'
import { PEDAGOGICAL_DICTIONARY, getConcept } from './pedagogicalDictionary'

describe('pedagogicalDictionary - Diccionario y Modelos Psicoacústicos Centralizados', () => {
  it('todos los conceptos deben tener campos completos y no vacíos', () => {
    Object.values(PEDAGOGICAL_DICTIONARY).forEach((concept) => {
      expect(concept.id).toBeDefined()
      expect(concept.title.length).toBeGreaterThan(0)
      expect(concept.subtitle.length).toBeGreaterThan(0)
      expect(concept.shortDefinition.length).toBeGreaterThan(15)
      expect(concept.formulaOrCalculation.length).toBeGreaterThan(5)
      expect(concept.practicalTakeaway.length).toBeGreaterThan(20)
      expect(['psychometrics', 'cognition', 'algorithm', 'melody']).toContain(concept.category)
    })
  })

  it('getConcept debe devolver el concepto correcto por su ID con umbrales calibrados', () => {
    const irt = getConcept('irt_normalized_accuracy')
    expect(irt).not.toBeNull()
    expect(irt?.title).toContain('Oído Real')
    expect(irt?.formulaOrCalculation).toContain('Acierto - c')

    const latency = getConcept('cognitive_latency')
    // Umbral calibrado psicoacústicamente a < 1.4s
    expect(latency?.practicalTakeaway).toContain('< 1.4s')
  })

  it('debe devolver null si el concepto no existe', () => {
    expect(getConcept('concepto_inexistente')).toBeNull()
  })
})
