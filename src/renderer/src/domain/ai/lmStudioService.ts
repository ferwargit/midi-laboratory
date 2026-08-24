import { AnalyticsMetrics, DetailedSessionAnalysis } from '../analytics/historyAnalytics'
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildConversationalMessages,
  buildMultiSessionComparisonSystemPrompt,
  buildMultiSessionComparisonPrompt,
  ChatMessage
} from './promptBuilder'
import { generateAlgorithmicFallback } from './fallbackGenerator'
import { validateAndParseAiResponse } from './schemaValidator'
import { CircuitBreaker } from './circuitBreaker'
import { AiAnalysisResponse } from './types'
import { DbAiConsultationRecord, DbAiReportRecord } from '../database/types'
import { DEFAULT_APP_CONFIG, LmStudioConfig } from './appConfig'

export class LmStudioService {
  private config: LmStudioConfig
  private circuitBreaker: CircuitBreaker

  constructor(
    configOrBaseUrl: string | Partial<LmStudioConfig> = DEFAULT_APP_CONFIG.lmStudio,
    circuitBreaker = new CircuitBreaker()
  ) {
    if (typeof configOrBaseUrl === 'string') {
      this.config = { ...DEFAULT_APP_CONFIG.lmStudio, baseUrl: configOrBaseUrl }
    } else {
      this.config = { ...DEFAULT_APP_CONFIG.lmStudio, ...configOrBaseUrl }
    }
    this.circuitBreaker = circuitBreaker
  }

  getBaseUrl(): string {
    return this.config.baseUrl
  }

  async getLoadedModelId(): Promise<string | null> {
    if (!this.circuitBreaker.canExecute()) return null

    if (typeof window !== 'undefined' && window.customAPI?.checkLmStudioModels) {
      return await window.customAPI.checkLmStudioModels(this.config.baseUrl)
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.checkModelTimeoutMs)

      const res = await fetch(`${this.config.baseUrl}/v1/models`, {
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

  /**
   * Método centralizado (DRY): ejecuta la llamada a LM Studio vía IPC o fallback a fetch
   */
  private async sendChat(
    messages: ChatMessage[],
    temperature: number,
    model: string
  ): Promise<{ content: string; modelName: string }> {
    if (typeof window !== 'undefined' && window.customAPI?.chatLmStudio) {
      const result = await window.customAPI.chatLmStudio({
        model,
        messages,
        temperature,
        timeoutMs: this.config.chatTimeoutMs,
        baseUrl: this.config.baseUrl
      })
      if (!result.success || !result.content) {
        throw new Error(result.error || 'Respuesta vacía de IPC')
      }
      return {
        content: result.content,
        modelName: result.model || model
      }
    }

    const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature
      })
    })

    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    const message = data.choices?.[0]?.message
    const content = message?.content || message?.reasoning_content || ''

    return {
      content,
      modelName: data.model || model
    }
  }

  async analyzeAndPrescribe(metrics: AnalyticsMetrics): Promise<AiAnalysisResponse> {
    const fallbackOp = (): AiAnalysisResponse => generateAlgorithmicFallback(metrics)

    return this.circuitBreaker.execute(async () => {
      const loadedModelId = await this.getLoadedModelId()
      if (!loadedModelId) {
        throw new Error('No hay modelo cargado en LM Studio')
      }

      const messages: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(metrics.modeFilter) },
        { role: 'user', content: buildUserPrompt(metrics) }
      ]

      const { content, modelName } = await this.sendChat(
        messages,
        this.config.defaultTemperature,
        loadedModelId
      )

      const validatedResponse = validateAndParseAiResponse(content, modelName)
      if (!validatedResponse) {
        throw new Error('Payload inválido devuelto por el LLM')
      }

      return validatedResponse
    }, fallbackOp)
  }

  async askCustomConsultation(
    userQuery: string,
    metrics: AnalyticsMetrics,
    conceptId?: string,
    pastConsultations: DbAiConsultationRecord[] = [],
    recentReports: DbAiReportRecord[] = []
  ): Promise<{ content: string; modelName: string }> {
    const fallbackOp = (): { content: string; modelName: string } => ({
      content: `### Tutor Local (Respuesta Heurística)\n\nSobre tu consulta: "${userQuery}".\n\nEn base a tus ${metrics.totalAnswers} ejercicios analizados con una precisión real del ${metrics.normalizedOverallAccuracy}%, te recomendamos mantener sesiones cortas de 3 minutos para afianzar el reflejo sin fatiga auditiva.`,
      modelName: 'Motor Heurístico Local'
    })

    return this.circuitBreaker.execute(async () => {
      const loadedModelId = await this.getLoadedModelId()
      if (!loadedModelId) {
        throw new Error('No hay modelo cargado en LM Studio')
      }

      const messages: ChatMessage[] = buildConversationalMessages(
        userQuery,
        metrics,
        pastConsultations,
        recentReports,
        conceptId
      )

      const { content, modelName } = await this.sendChat(messages, 0.5, loadedModelId)

      return {
        content: content.trim(),
        modelName
      }
    }, fallbackOp)
  }

  async askMultiSessionComparison(
    selectedSessions: DetailedSessionAnalysis[],
    metrics: AnalyticsMetrics
  ): Promise<{ content: string; modelName: string }> {
    const fallbackOp = (): { content: string; modelName: string } => ({
      content: `### Comparativa Cruzada Heurística (${selectedSessions.length} Sesiones)\n\nSe analizaron ${selectedSessions.length} sesiones seleccionadas. Se observa una variación entre el primer intento (${selectedSessions[0].session.accuracyPercentage}%) y el último (${selectedSessions[selectedSessions.length - 1].session.accuracyPercentage}%). Recomendamos consolidar el anclaje tonal manteniendo sesiones de 3 minutos.`,
      modelName: 'Motor Heurístico Local'
    })

    return this.circuitBreaker.execute(async () => {
      const loadedModelId = await this.getLoadedModelId()
      if (!loadedModelId) {
        throw new Error('No hay modelo cargado en LM Studio')
      }

      const messages: ChatMessage[] = [
        { role: 'system', content: buildMultiSessionComparisonSystemPrompt(metrics.modeFilter) },
        { role: 'user', content: buildMultiSessionComparisonPrompt(selectedSessions, metrics) }
      ]

      const { content, modelName } = await this.sendChat(messages, 0.4, loadedModelId)

      return {
        content: content.trim(),
        modelName
      }
    }, fallbackOp)
  }
}
