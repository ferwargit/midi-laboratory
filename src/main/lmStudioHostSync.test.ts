import { describe, it, expect } from 'vitest'
import { LM_STUDIO_DEFAULT_HOST, resolveLmStudioHost } from './lmStudioHostValidator'
import { DEFAULT_APP_CONFIG } from '../renderer/src/domain/ai/appConfig'

/**
 * Test de regresión de sincronización canónica Main ↔ Renderer
 * (capacidad 06-local-ai-integration, hallazgo F5 de la auditoría V7).
 *
 * El host canónico de LM Studio vive en dos lados del proceso:
 * - Renderer (SSOT): DEFAULT_APP_CONFIG.lmStudio.baseUrl
 * - Main (allowlist): LM_STUDIO_DEFAULT_HOST en lmStudioHostValidator.ts
 *
 * Una desviación accidental entre ambos haría que el Main rechazara la baseUrl
 * que el propio frontend envía por defecto (fail-closed sobre el flujo legítimo).
 * Este test acopla contractualmente ambas constantes, al estilo de
 * index-csp.test.ts que acopla la CSP al baseUrl del renderer.
 */
describe('lmStudioHostSync - Sincronización canónica del host Main ↔ Renderer', () => {
  it('LM_STUDIO_DEFAULT_HOST (Main) es idéntico a DEFAULT_APP_CONFIG.lmStudio.baseUrl (Renderer)', () => {
    expect(LM_STUDIO_DEFAULT_HOST).toBe(DEFAULT_APP_CONFIG.lmStudio.baseUrl)
  })

  it('el host canónico del renderer es un destino aceptado por el allowlist del validador', () => {
    const result = resolveLmStudioHost(DEFAULT_APP_CONFIG.lmStudio.baseUrl)
    expect(result).toEqual({ ok: true, host: DEFAULT_APP_CONFIG.lmStudio.baseUrl })
  })
})
