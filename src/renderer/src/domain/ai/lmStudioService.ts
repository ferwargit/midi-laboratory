import { AnalyticsMetrics } from '../analytics/historyAnalytics'
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder'
import { generateAlgorithmicFallback } from './fallbackGenerator'
import { AiAnalysisResponse } from './types'

const LM_STUDIO_URL = 'http://localhost:1234/v1/chat/completions'

export class LmStudioService {
  private baseUrl: string

  constructor(baseUrl = LM_STUDIO_URL) {
    this.baseUrl = baseUrl
  }

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch('http://localhost:1234/v1/models', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      return res.ok
    } catch {
      return false
    }
  }

  async analyzeAndPrescribe(metrics: AnalyticsMetrics): Promise<AiAnalysisResponse> {
    const isConnected = await this.checkConnection()

    if (!isConnected) {
      return generateAlgorithmicFallback(metrics)
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(metrics) }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        return generateAlgorithmicFallback(metrics)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content
      const parsed = JSON.parse(content)

      return {
        source: 'lm_studio_ai',
        modelName: data.model || 'LM Studio Local LLM',
        analysisText: parsed.analysisText || 'Análisis completado.',
        prescription: parsed.prescription
      }
    } catch (err) {
      console.warn('Fallo al consultar LM Studio, utilizando motor de respaldo:', err)
      return generateAlgorithmicFallback(metrics)
    }
  }
}
