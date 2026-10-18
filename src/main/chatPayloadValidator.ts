/**
 * Validador de esquema del payload de `lm-studio:chat-completion`
 * (capacidad 06-local-ai-integration, hallazgo F10 de la auditoría REA V7).
 *
 * El Renderer envía el payload por IPC; sin validación, estructuras malformadas
 * se propagarían al backend de LM Studio. Este módulo aplica una validación
 * defensiva fail-closed: `model` string no vacío y `messages` arreglo no vacío
 * de objetos con `role` y `content` strings no vacíos. Los campos adicionales
 * están permitidos (el esquema es mínimo, no excluyente).
 */

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Determina si el payload recibido del Renderer cumple el esquema mínimo del
 * handler `lm-studio:chat-completion`. Nunca lanza excepciones.
 */
export function isValidChatCompletionPayload(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) {
    return false
  }

  const candidate = payload as { model?: unknown; messages?: unknown }
  if (!isNonEmptyString(candidate.model)) {
    return false
  }

  if (!Array.isArray(candidate.messages) || candidate.messages.length === 0) {
    return false
  }

  return candidate.messages.every(
    (message) =>
      typeof message === 'object' &&
      message !== null &&
      isNonEmptyString((message as { role?: unknown }).role) &&
      isNonEmptyString((message as { content?: unknown }).content)
  )
}
