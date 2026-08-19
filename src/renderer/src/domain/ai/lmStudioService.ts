import { AnalyticsMetrics } from '../analytics/historyAnalytics'
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder'
import { generateAlgorithmicFallback } from './fallbackGenerator'
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

    // 2. En Node/Vitest usamos fetch a this.baseUrl con timeout de 1s
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
        // Soporte tanto para content normal como para reasoning_content de Qwen
        rawContent = message?.content || message?.reasoning_content || ''
        returnedModel = data.model || loadedModelId
      }

      // Extraer el bloque JSON de la respuesta (ignorando tags <think> y markdown)
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
      const jsonString = jsonMatch ? jsonMatch[0] : rawContent

      const parsed = JSON.parse(jsonString)

      return {
        source: 'lm_studio_ai',
        modelName: returnedModel,
        analysisText: parsed.analysisText || 'Análisis completado exitosamente por tu IA Local.',
        prescription: parsed.prescription
      }
    } catch (err) {
      console.warn('Fallo o timeout al consultar LM Studio, usando motor local:', err)
      return generateAlgorithmicFallback(metrics)
    }
  }
}
