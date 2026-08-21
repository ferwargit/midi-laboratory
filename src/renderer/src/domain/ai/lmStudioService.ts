import { AnalyticsMetrics } from '../analytics/historyAnalytics'
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder'
import { generateAlgorithmicFallback } from './fallbackGenerator'
import { validateAndParseAiResponse } from './schemaValidator'
import { CircuitBreaker } from './circuitBreaker'
import { AiAnalysisResponse } from './types'

const LM_STUDIO_DEFAULT_URL = 'http://127.0.0.1:1234'

export class LmStudioService {
  private baseUrl: string
  private circuitBreaker: CircuitBreaker

  constructor(baseUrl = LM_STUDIO_DEFAULT_URL, circuitBreaker = new CircuitBreaker()) {
    this.baseUrl = baseUrl
    this.circuitBreaker = circuitBreaker
  }

  async getLoadedModelId(): Promise<string | null> {
    if (!this.circuitBreaker.canExecute()) return null

    if (typeof window !== 'undefined' && window.customAPI?.checkLmStudioModels) {
      return await window.customAPI.checkLmStudioModels()
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)

      const res = await fetch(`${this.baseUrl}/v1/models`, {
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (!res.ok) return null
      const data = await res.json()
      return data.data?.[0]?.id || null
    } catch {
      return null
    }
  }

  async checkConnection(): Promise<boolean> {
    const modelId = await this.getLoadedModelId()
    return modelId !== null
  }

  async analyzeAndPrescribe(metrics: AnalyticsMetrics): Promise<AiAnalysisResponse> {
    const fallbackOp = (): AiAnalysisResponse => generateAlgorithmicFallback(metrics)

    return this.circuitBreaker.execute(async () => {
      const loadedModelId = await this.getLoadedModelId()
      if (!loadedModelId) {
        throw new Error('No hay modelo cargado en LM Studio')
      }

      // AQUÍ SE CONSTRUYEN LOS MENSAJES CON EL MODO ESPECÍFICO
      const messages = [
        { role: 'system', content: buildSystemPrompt(metrics.modeFilter) },
        { role: 'user', content: buildUserPrompt(metrics) }
      ]

      let rawContent = ''
      let returnedModel = loadedModelId

      if (typeof window !== 'undefined' && window.customAPI?.chatLmStudio) {
        const result = await window.customAPI.chatLmStudio({
          model: loadedModelId,
          messages
        })
        if (!result.success || !result.content) {
          throw new Error(result.error || 'Respuesta vacía de IPC')
        }
        rawContent = result.content
        returnedModel = result.model || loadedModelId
      } else {
        const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: loadedModelId,
            messages,
            temperature: 0.3
          })
        })

        if (!res.ok) throw new Error(`HTTP error ${res.status}`)
        const data = await res.json()
        const message = data.choices[0]?.message
        rawContent = message?.content || message?.reasoning_content || ''
        returnedModel = data.model || loadedModelId
      }

      const validatedResponse = validateAndParseAiResponse(rawContent, returnedModel)
      if (!validatedResponse) {
        throw new Error('Payload inválido devuelto por el LLM')
      }

      return validatedResponse
    }, fallbackOp)
  }
}
