/**
 * Validador de host de destino para los handlers IPC de LM Studio
 * (capacidad 06-local-ai-integration, hallazgo F5 de la auditoría V7).
 *
 * El Renderer envía `baseUrl` por IPC; sin validación, un Renderer comprometido
 * podría hacer que el proceso Main emita peticiones HTTP hacia la red local o
 * internet (SSRF), evadiendo la CSP del renderer. Este módulo aplica un
 * allowlist fail-closed: solo se aceptan destinos estrictamente locales
 * (`127.0.0.1` o `localhost`) con protocolo http/https; cualquier otro destino
 * se rechaza sin ejecutar la petición.
 */

/** Host canónico de LM Studio (SSOT en DEFAULT_APP_CONFIG.lmStudio.baseUrl). */
export const LM_STUDIO_DEFAULT_HOST = 'http://127.0.0.1:1234'

/** Hosts estrictamente permitidos como destino de las peticiones del Main. */
const ALLOWED_HOSTS = new Set<string>(['127.0.0.1', 'localhost'])

/** Protocolos permitidos para el destino de las peticiones del Main. */
const ALLOWED_PROTOCOLS = new Set<string>(['http:', 'https:'])

export type LmStudioHostResolution = { ok: true; host: string } | { ok: false; reason: string }

/**
 * Resuelve el host de destino de un `baseUrl` opcional proveniente del Renderer.
 *
 * - Sin `baseUrl` (o vacía): resuelve al host canónico `LM_STUDIO_DEFAULT_HOST`.
 * - Con `baseUrl`: solo acepta http/https con host estrictamente `127.0.0.1` o
 *   `localhost` (cualquier puerto numérico válido 1-65535).
 * - Cualquier otro destino (IP privada/pública, dominio remoto, protocolo no
 *   HTTP, URL malformada, puerto inválido) se rechaza con un motivo descriptivo.
 *
 * Nunca lanza excepciones: devuelve un resultado discriminado para que cada
 * handler IPC reporte el rechazo según su propio contrato de retorno.
 */
export function resolveLmStudioHost(baseUrl?: string): LmStudioHostResolution {
  const trimmed = baseUrl?.trim()
  if (!trimmed) {
    return { ok: true, host: LM_STUDIO_DEFAULT_HOST }
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, reason: `URL inválida: "${trimmed}"` }
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return {
      ok: false,
      reason: `Protocolo no permitido "${url.protocol}" (solo http/https)`
    }
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return {
      ok: false,
      reason: `Host no permitido "${url.hostname}" (solo 127.0.0.1 o localhost)`
    }
  }

  if (url.port) {
    const port = Number(url.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { ok: false, reason: `Puerto inválido "${url.port}"` }
    }
  }

  return { ok: true, host: url.origin }
}
