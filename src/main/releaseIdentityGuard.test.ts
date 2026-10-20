import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Guarda de regresión del cambio OpenSpec `sanitize-release-engineering-f18-f20`
 * (capacidad 10-build-packaging, requisito "Identidad canónica de la aplicación").
 *
 * La identidad de la aplicación en Windows (AppUserModelId) debe coincidir
 * estrictamente con el `appId` declarado en electron-builder.yml. Si divergen,
 * las notificaciones toast y los accesos directos del menú Inicio quedan
 * desasociados de la aplicación instalada.
 */
describe('Identidad de release - Guarda appId ≡ appUserModelId (sanitize-release-engineering-f18-f20)', () => {
  const CANONICAL_APP_ID = 'com.ferwarno.midilaboratory'

  const builderYml = readFileSync(resolve(__dirname, '../../electron-builder.yml'), 'utf-8')
  const mainIndexTs = readFileSync(resolve(__dirname, './index.ts'), 'utf-8')

  const appIdMatch = builderYml.match(/^appId:\s*(\S+)\s*$/m)
  const appUserModelIdMatch = mainIndexTs.match(/setAppUserModelId\(\s*['"]([^'"]+)['"]\s*\)/)

  it('electron-builder.yml declara el appId canónico del proyecto', () => {
    expect(appIdMatch).not.toBeNull()
    expect(appIdMatch?.[1]).toBe(CANONICAL_APP_ID)
  })

  it('el proceso Main registra el AppUserModelId canónico', () => {
    expect(appUserModelIdMatch).not.toBeNull()
    expect(appUserModelIdMatch?.[1]).toBe(CANONICAL_APP_ID)
  })

  it('appId del empaquetado y appUserModelId del runtime coinciden estrictamente', () => {
    expect(appIdMatch).not.toBeNull()
    expect(appUserModelIdMatch).not.toBeNull()
    expect(appUserModelIdMatch?.[1]).toBe(appIdMatch?.[1])
  })
})
