export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  failureThreshold: number
  cooldownPeriodMs: number
  requestTimeoutMs: number
}

// Timeout generoso de 15 minutos (900.000 ms) para dar libertad absoluta a modelos de razonamiento profundo
export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  cooldownPeriodMs: 30000,
  requestTimeoutMs: 900000
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0
  private config: CircuitBreakerConfig

  constructor(config = DEFAULT_CIRCUIT_CONFIG) {
    this.config = config
  }

  getState(): CircuitState {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed >= this.config.cooldownPeriodMs) {
        this.state = 'HALF_OPEN'
      }
    }
    return this.state
  }

  canExecute(): boolean {
    const currentState = this.getState()
    return currentState === 'CLOSED' || currentState === 'HALF_OPEN'
  }

  recordSuccess(): void {
    this.failureCount = 0
    this.state = 'CLOSED'
  }

  recordFailure(): void {
    this.failureCount += 1
    this.lastFailureTime = Date.now()
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  async execute<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    fallbackOperation: () => T | Promise<T>
  ): Promise<T> {
    if (!this.canExecute()) {
      return fallbackOperation()
    }

    const controller = new AbortController()
    let timer: NodeJS.Timeout | null = null

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('Operation timed out'))
      }, this.config.requestTimeoutMs)
    })

    try {
      const result = await Promise.race([operation(controller.signal), timeoutPromise])
      if (timer) clearTimeout(timer)
      this.recordSuccess()
      return result
    } catch {
      if (timer) clearTimeout(timer)
      this.recordFailure()
      return fallbackOperation()
    }
  }

  reset(): void {
    this.failureCount = 0
    this.state = 'CLOSED'
    this.lastFailureTime = 0
  }
}
