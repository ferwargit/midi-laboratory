/**
 * Guardas de navegación y apertura externa del proceso Main
 * (capacidad 09-electron-window-hardening, hallazgos F7 y F8 de la auditoría
 * REA V7).
 *
 * Un renderer comprometido no debe poder pivotar hacia el sistema operativo
 * (shell.openExternal con esquemas peligrosos) ni hacia orígenes ajenos
 * (navegaciones in-frame). Ambas guardas son fail-closed: ante una URL que no
 * parsea o que no cumple la política, se deniega.
 */

/** Protocolos permitidos para la apertura de URLs externas (hallazgo F7). */
const ALLOWED_EXTERNAL_PROTOCOLS = new Set<string>(['http:', 'https:'])

/**
 * Determina si una URL solicitada por una ventana emergente puede delegarse a
 * `shell.openExternal`: solo si parsea correctamente y su protocolo es
 * estrictamente `http:` o `https:`. Nunca lanza excepciones.
 */
export function isOpenExternalUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Determina si una navegación in-frame del webContents está autorizada: solo
 * si parsea correctamente y su origen coincide exactamente con el origen local
 * de la aplicación. En producción el origen permitido es `file://`: las URLs
 * `file:` tienen origen opaco (`'null'` en el parser WHATWG), por lo que la
 * comparación se hace por protocolo `file:`. Nunca lanza excepciones.
 */
export function isAllowedNavigation(url: string, allowedOrigin: string): boolean {
  try {
    const parsed = new URL(url)
    if (allowedOrigin === 'file://') {
      return parsed.protocol === 'file:'
    }
    return parsed.origin === allowedOrigin
  } catch {
    return false
  }
}
