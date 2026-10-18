import { resolveLmStudioHost } from './lmStudioHostValidator'

/**
 * Lógica de los handlers IPC de LM Studio (capacidad 06-local-ai-integration,
 * hallazgo F5 de la auditoría V7). Viven en un módulo sin dependencia de
 * `electron` para que el cableado de `index.ts` sea una línea y la lógica sea
 * testeable en Vitest sin mockear Electron.
 *
 * Toda `baseUrl` proveniente del Renderer se resuelve con
 * `resolveLmStudioHost` ANTES de crear el AbortController o emitir `fetch()`:
 * un destino no local se deniega de forma controlada (fail-closed) y queda
 * registrado en la consola del proceso Main.
 */

export interface ChatCompletionPayload {
  model: string
  messages: unknown[]
  temperature?: number
  timeoutMs?: number
  baseUrl?: string
}

/** Registro auditable de cada baseUrl rechazada (patrón de [Permisos] Denegado). */
function logRejectedBaseUrl(handler: string, baseUrl: string | undefined, reason: string): void {
  console.warn(
    `[LM Studio] baseUrl rechazada: "${baseUrl ?? ''}" (handler: ${handler}) — ${reason}`
  )
}

/**
 * Handler `lm-studio:check-models(baseUrl?)`: GET /v1/models con timeout de
 * 2500 ms. Devuelve el primer modelo cargado o `null` (también ante una
 * `baseUrl` rechazada, sin emitir ninguna petición de red).
 */
export async function handleCheckModels(baseUrl?: string): Promise<string | null> {
  const resolution = resolveLmStudioHost(baseUrl)
  if (!resolution.ok) {
    logRejectedBaseUrl('lm-studio:check-models', baseUrl, resolution.reason)
    return null
  }
  const host = resolution.host

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)

  try {
    const res = await fetch(`${host}/v1/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    })
    clearTimeout(timer)

    if (!res.ok) return null
    const data = (await res.json()) as { data?: Array<{ id: string }> }
    if (data.data && data.data.length > 0) {
      return data.data[0].id as string
    }
    return null
  } catch {
    clearTimeout(timer)
    return null
  }
}

/**
 * Handler `lm-studio:chat-completion(payload)`: POST /v1/chat/completions con
 * timeout por defecto de 900000 ms (15 minutos para deep reasoning en GPU).
 * Devuelve `{ success: true, content, model }` o `{ success: false, error }`
 * sin lanzar excepciones; ante una `baseUrl` rechazada devuelve el error
 * controlado sin emitir ninguna petición de red.
 */
export async function handleChatCompletion(
  payload: ChatCompletionPayload
): Promise<{ success: boolean; content?: string; model?: string; error?: string }> {
  const resolution = resolveLmStudioHost(payload?.baseUrl)
  if (!resolution.ok) {
    logRejectedBaseUrl('lm-studio:chat-completion', payload?.baseUrl, resolution.reason)
    return { success: false, error: resolution.reason }
  }
  const host = resolution.host
  const timeoutMs = payload.timeoutMs || 900000 // 15 minutos por defecto para deep reasoning en GPU
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${host}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: payload.model,
        messages: payload.messages,
        temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.3
      }),
      signal: controller.signal
    })
    clearTimeout(timer)

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: errorText }
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>
      model?: string
    }
    const message = data.choices?.[0]?.message
    const content = message?.content || message?.reasoning_content || ''

    return { success: true, content, model: data.model || payload.model }
  } catch (err: unknown) {
    clearTimeout(timer)
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
