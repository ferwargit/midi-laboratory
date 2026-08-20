import { describe, it, expect, vi } from 'vitest'
import { CircuitBreaker } from './circuitBreaker'

describe('s2-ai-timeout-breaker - Circuit Breaker y Timeout para IA Local', () => {
  it('timeout fallback: debe ejecutar fallback de inmediato si la operación excede el timeout', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      cooldownPeriodMs: 1000,
      requestTimeoutMs: 50
    })

    const slowOperation = (): Promise<string> =>
      new Promise((resolve) => setTimeout(() => resolve('respuesta lenta'), 200))

    const fallback = vi.fn().mockReturnValue('fallback_activado')

    const result = await breaker.execute(slowOperation, fallback)

    expect(result).toBe('fallback_activado')
    expect(fallback).toHaveBeenCalledTimes(1)
  })

  it('session never blocked: la práctica musical nunca se bloquea ante excepciones de red', async () => {
    const breaker = new CircuitBreaker()
    const brokenOperation = (): Promise<never> => Promise.reject(new Error('Network error'))
    const fallback = (): string => 'datos_locales_seguros'

    const result = await breaker.execute(brokenOperation, fallback)
    expect(result).toBe('datos_locales_seguros')
  })

  it('repeated AI calls suppressed after failures: tras fallos consecutivos, el circuito se abre y suprime llamadas al servidor', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      cooldownPeriodMs: 5000,
      requestTimeoutMs: 100
    })

    const brokenOp = vi.fn().mockRejectedValue(new Error('LM Studio caído'))
    const fallback = (): string => 'fallback'

    // Fallo 1
    await breaker.execute(brokenOp, fallback)
    expect(breaker.getState()).toBe('CLOSED')

    // Fallo 2
    await breaker.execute(brokenOp, fallback)
    expect(breaker.getState()).toBe('OPEN')

    // Llamada 3 con circuito ABIERTO -> suprime brokenOp
    brokenOp.mockClear()
    const result = await breaker.execute(brokenOp, fallback)

    expect(result).toBe('fallback')
    expect(brokenOp).not.toHaveBeenCalled()
  })
})
