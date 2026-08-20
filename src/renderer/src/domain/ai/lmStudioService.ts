import { AnalyticsMetrics } from '../analytics/historyAnalytics'
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder'
import { generateAlgorithmicFallback } from './fallbackGenerator'
import { validateAndParseAiResponse } from './schemaValidator'
import { AiAnalysisResponse } from './types'

const LM_STUDIO_DEFAULT_URL = 'http://127.0.0.1:1234'

export class LmStudioService {
  private baseUrl: string

  constructor(baseUrl = LM_STUDIO_DEFAULT_URL) {
    this.baseUrl = baseUrl
  }

  async getLoadedModelId(): Promise<string | null> {
    // 1. En Electron usamos el puente IPC nativo si existe
    if (typeof window !== 'undefined' && window.customAPI?.checkLmStudioModels) {
      return await window.customAPI.checkLmStudioModels()
    }

    // 2. En Node/Vitest usamos fetch a this.baseUrl con timeout
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 1000)

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
    const loadedModelId = await this.getLoadedModelId()

    if (!loadedModelId) {
      return generateAlgorithmicFallback(metrics)
    }

    const messages = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(metrics) }
    ]

    try {
      let rawContent = ''
      let returnedModel = loadedModelId

      if (typeof window !== 'undefined' && window.customAPI?.chatLmStudio) {
        const result = await window.customAPI.chatLmStudio({
          model: loadedModelId,
          messages
        })
        if (!result.success || !result.content) {
          return generateAlgorithmicFallback(metrics)
        }
        rawContent = result.content
        returnedModel = result.model || loadedModelId
      } else {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 4000)

        const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: loadedModelId,
            messages,
            temperature: 0.2
          }),
          signal: controller.signal
        })
        clearTimeout(timeout)

        if (!res.ok) return generateAlgorithmicFallback(metrics)
        const data = await res.json()
        const message = data.choices[0]?.message
        rawContent = message?.content || message?.reasoning_content || ''
        returnedModel = data.model || loadedModelId
      }

      // Validación estricta y sanitización determinista de octavas
      const validatedResponse = validateAndParseAiResponse(rawContent, returnedModel)

      if (validatedResponse) {
        return validatedResponse
      }

      console.warn(
        'El payload devuelto por LM Studio no cumplió el esquema estricto, usando fallback.'
      )
      return generateAlgorithmicFallback(metrics)
    } catch (err) {
      console.warn('Fallo o timeout al consultar LM Studio, usando motor local:', err)
      return generateAlgorithmicFallback(metrics)
    }
  }
}
