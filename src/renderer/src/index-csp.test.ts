import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Regresión (Auditoría V7, hallazgo F1): con el fallback a fetch() directo
 * eliminado de lmStudioService, el canal único hacia LM Studio es IPC
 * (window.customAPI, no pasa por la CSP). La apertura connect-src hacia el
 * host de LM Studio existía únicamente para ese fallback y se elimina: dejarla
 * permitiría al renderer evadir la validación SSRF del proceso Main (F5)
 * accediendo a LM Studio por HTTP directo.
 *
 * Este test fija la postura completa Main↔renderer leyendo los fuentes
 * (patrón preloadExposure.test.ts): el Main declara sandbox: true y la CSP
 * del renderer no permite ninguna salida de red directa hacia LM Studio.
 */
describe('index.html - Content Security Policy y postura de sandbox (hallazgo F1)', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf-8')
  const mainSource = readFileSync(resolve(__dirname, '../../main/index.ts'), 'utf-8')

  it('debe declarar un meta tag de Content-Security-Policy', () => {
    expect(html).toContain('Content-Security-Policy')
  })

  it('el connect-src de la CSP NO abre salida directa hacia el host de LM Studio', () => {
    const metaMatch = html.match(
      /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/
    )
    expect(metaMatch).not.toBeNull()

    const cspContent = metaMatch![1]
    expect(cspContent).toContain('connect-src')
    expect(cspContent).toContain("'self'")
    expect(cspContent).not.toContain('http://127.0.0.1:1234')
  })

  it('el proceso Main declara sandbox: true con contextIsolation: true', () => {
    expect(mainSource).toContain('sandbox: true')
    expect(mainSource).toContain('contextIsolation: true')
    expect(mainSource).not.toContain('sandbox: false')
  })
})
