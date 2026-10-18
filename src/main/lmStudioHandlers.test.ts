import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleCheckModels, handleChatCompletion } from './lmStudioHandlers'

/**
 * Tests de cableado de los handlers IPC de LM Studio (hallazgo F5).
 * Verifican el contrato observable: una baseUrl rechazada deniega la petición
 * de forma controlada SIN invocar fetch, y una baseUrl válida (o ausente)
 * emite la petición contra el host resuelto.
 */
describe('lmStudioHandlers - Validación de baseUrl antes de la red (hallazgo F5)', () => {
  const fetchMock = vi.fn()
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    warnSpy.mockClear()
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('lm-studio:check-models', () => {
    it('devuelve null y NUNCA invoca fetch ante una baseUrl rechazada', async () => {
      const result = await handleCheckModels('http://8.8.8.8:1234')

      expect(result).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('registra el rechazo en la consola del proceso Main', async () => {
      await handleCheckModels('http://evil.example.com')

      expect(warnSpy).toHaveBeenCalledTimes(1)
      const logged = warnSpy.mock.calls[0][0] as string
      expect(logged).toContain('[LM Studio] baseUrl rechazada')
      expect(logged).toContain('http://evil.example.com')
      expect(logged).toContain('lm-studio:check-models')
    })

    it('con baseUrl ausente invoca fetch contra el host canónico', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'modelo-cargado' }] })
      })

      const result = await handleCheckModels(undefined)

      expect(result).toBe('modelo-cargado')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('http://127.0.0.1:1234/v1/models')
      expect(init.method).toBe('GET')
    })

    it('con baseUrl local válida invoca fetch contra ese host', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })

      const result = await handleCheckModels('http://localhost:8080')

      expect(result).toBeNull()
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/v1/models', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: expect.any(AbortSignal)
      })
    })

    it('devuelve null sin lanzar excepción cuando fetch falla', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'))

      const result = await handleCheckModels('http://127.0.0.1:1234')

      expect(result).toBeNull()
    })
  })

  describe('lm-studio:chat-completion', () => {
    const basePayload = {
      model: 'modelo-local',
      messages: [{ role: 'user', content: 'hola' }]
    }

    it('devuelve error controlado y NUNCA invoca fetch ante una baseUrl rechazada', async () => {
      const result = await handleChatCompletion({ ...basePayload, baseUrl: 'http://10.0.0.5:1234' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Host no permitido')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('registra el rechazo en la consola del proceso Main', async () => {
      await handleChatCompletion({ ...basePayload, baseUrl: 'file:///etc/passwd' })

      expect(warnSpy).toHaveBeenCalledTimes(1)
      const logged = warnSpy.mock.calls[0][0] as string
      expect(logged).toContain('[LM Studio] baseUrl rechazada')
      expect(logged).toContain('file:///etc/passwd')
      expect(logged).toContain('lm-studio:chat-completion')
    })

    it('con baseUrl ausente invoca fetch contra el host canónico y extrae content', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'respuesta del modelo' } }],
          model: 'modelo-local'
        })
      })

      const result = await handleChatCompletion({ ...basePayload })

      expect(result).toEqual({
        success: true,
        content: 'respuesta del modelo',
        model: 'modelo-local'
      })
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('http://127.0.0.1:1234/v1/chat/completions')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toEqual({
        model: 'modelo-local',
        messages: basePayload.messages,
        temperature: 0.3
      })
    })

    it('con baseUrl local válida invoca fetch contra ese host', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] })
      })

      await handleChatCompletion({ ...basePayload, baseUrl: 'https://localhost:1234' })

      expect(fetchMock.mock.calls[0][0]).toBe('https://localhost:1234/v1/chat/completions')
    })

    it('devuelve error de servidor sin lanzar excepción cuando la respuesta no es ok', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, text: async () => 'server error' })

      const result = await handleChatCompletion({ ...basePayload })

      expect(result).toEqual({ success: false, error: 'server error' })
    })

    it('devuelve error controlado sin lanzar excepción cuando fetch falla', async () => {
      fetchMock.mockRejectedValueOnce(new Error('timeout de red'))

      const result = await handleChatCompletion({ ...basePayload })

      expect(result).toEqual({ success: false, error: 'timeout de red' })
    })
  })
})
