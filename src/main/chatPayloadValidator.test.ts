import { describe, it, expect } from 'vitest'
import { isValidChatCompletionPayload } from './chatPayloadValidator'

const validPayload = {
  model: 'qwen3.5-9b',
  messages: [
    { role: 'system', content: 'Eres un profesor de oído musical.' },
    { role: 'user', content: 'Analiza mis métricas.' }
  ]
}

describe('chatPayloadValidator - Validación de esquema del payload de chat-completion (F10)', () => {
  it('acepta un payload válido', () => {
    expect(isValidChatCompletionPayload(validPayload)).toBe(true)
  })

  it('permite campos adicionales al esquema mínimo', () => {
    expect(
      isValidChatCompletionPayload({ ...validPayload, temperature: 0.3, timeoutMs: 900000 })
    ).toBe(true)
  })

  it('rechaza payload ausente, nulo o no objeto', () => {
    expect(isValidChatCompletionPayload(undefined)).toBe(false)
    expect(isValidChatCompletionPayload(null)).toBe(false)
    expect(isValidChatCompletionPayload('hola')).toBe(false)
    expect(isValidChatCompletionPayload(42)).toBe(false)
  })

  it('rechaza model vacío o no string', () => {
    expect(isValidChatCompletionPayload({ ...validPayload, model: '' })).toBe(false)
    expect(isValidChatCompletionPayload({ ...validPayload, model: '   ' })).toBe(false)
    expect(isValidChatCompletionPayload({ ...validPayload, model: 42 })).toBe(false)
    expect(isValidChatCompletionPayload({ ...validPayload, model: undefined })).toBe(false)
  })

  it('rechaza messages vacío, no arreglo o ausente', () => {
    expect(isValidChatCompletionPayload({ ...validPayload, messages: [] })).toBe(false)
    expect(isValidChatCompletionPayload({ ...validPayload, messages: 'hola' })).toBe(false)
    expect(isValidChatCompletionPayload({ ...validPayload, messages: undefined })).toBe(false)
  })

  it('rechaza elementos de messages malformados', () => {
    expect(isValidChatCompletionPayload({ ...validPayload, messages: [{}] })).toBe(false)
    expect(isValidChatCompletionPayload({ ...validPayload, messages: [{ role: 'user' }] })).toBe(
      false
    )
    expect(isValidChatCompletionPayload({ ...validPayload, messages: [{ content: 'hola' }] })).toBe(
      false
    )
    expect(
      isValidChatCompletionPayload({ ...validPayload, messages: [{ role: 1, content: 'x' }] })
    ).toBe(false)
    expect(
      isValidChatCompletionPayload({ ...validPayload, messages: [{ role: 'user', content: 3 }] })
    ).toBe(false)
    expect(isValidChatCompletionPayload({ ...validPayload, messages: ['hola'] })).toBe(false)
  })

  it('rechaza role o content vacíos', () => {
    expect(
      isValidChatCompletionPayload({ ...validPayload, messages: [{ role: '', content: 'x' }] })
    ).toBe(false)
    expect(
      isValidChatCompletionPayload({ ...validPayload, messages: [{ role: 'user', content: '' }] })
    ).toBe(false)
  })
})
