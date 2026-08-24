import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { DEFAULT_APP_CONFIG } from './domain/ai/appConfig'

/**
 * Regresión (Auditoría V4, Fase 1): con sandbox: true en BrowserWindow,
 * window.customAPI dejaba de exponerse y lmStudioService caía a fetch()
 * directo, que el Content-Security-Policy de index.html bloqueaba en
 * silencio (sin connect-src explícito, default-src 'self' lo prohíbe).
 *
 * Este test no reproduce el bug de sandbox (eso es un comportamiento de
 * Electron en runtime, no testeable en jsdom), pero sí fija en tests
 * automatizados que el CSP declarado en index.html siempre habilite el
 * host de LM Studio configurado en appConfig.ts, para que un futuro
 * cambio en cualquiera de los dos archivos no vuelva a desincronizarlos
 * en silencio.
 */
describe('index.html - Content Security Policy', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf-8')

  it('debe declarar un meta tag de Content-Security-Policy', () => {
    expect(html).toContain('Content-Security-Policy')
  })

  it('el connect-src del CSP debe incluir el host de LM Studio configurado en appConfig', () => {
    const metaMatch = html.match(
      /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/
    )
    expect(metaMatch).not.toBeNull()

    const cspContent = metaMatch![1]
    expect(cspContent).toContain('connect-src')
    expect(cspContent).toContain(DEFAULT_APP_CONFIG.lmStudio.baseUrl)
  })
})
