import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Regresión (Auditoría V7, hallazgos F2 y F3): el preload exponía
 * `electronAPI` (el objeto completo de @electron-toolkit/preload) en
 * `window.electron` vía contextBridge, poniendo a disposición del Renderer
 * métodos arbitrarios de ipcRenderer (send, sendSync, invoke, on) y filtrando
 * las variables de entorno del proceso Main a través de process.env.
 *
 * Este test no ejecuta el preload en runtime (eso acoplaría el test al
 * entorno de Electron); fija el contrato estático de exposición leyendo el
 * fuente, al estilo de index-csp.test.ts: el preload SOLO expone customAPI,
 * nunca window.electron, y los tipos globales declaran únicamente customAPI.
 */
describe('preload - Exposición exclusiva de customAPI (hallazgos F2/F3)', () => {
  const preloadSource = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8')
  const preloadTypes = readFileSync(resolve(__dirname, 'index.d.ts'), 'utf-8')

  it('el preload NO expone window.electron bajo contextIsolation', () => {
    expect(preloadSource).not.toContain("exposeInMainWorld('electron'")
    expect(preloadSource).not.toContain('exposeInMainWorld("electron"')
  })

  it('el preload NO asigna window.electron en la rama sin contextIsolation', () => {
    expect(preloadSource).not.toContain('window.electron =')
  })

  it('el preload NO importa electronAPI de @electron-toolkit/preload', () => {
    expect(preloadSource).not.toContain('electronAPI')
  })

  it('el preload SÍ expone customAPI en ambas ramas', () => {
    expect(preloadSource).toContain("exposeInMainWorld('customAPI'")
    expect(preloadSource).toContain('window.customAPI =')
  })

  it('los tipos globales NO declaran electron en Window', () => {
    expect(preloadTypes).not.toContain('electron:')
    expect(preloadTypes).not.toContain('ElectronAPI')
  })

  it('los tipos globales declaran customAPI con sus contratos intactos', () => {
    expect(preloadTypes).toContain('customAPI')
    expect(preloadTypes).toContain('checkLmStudioModels')
    expect(preloadTypes).toContain('chatLmStudio')
  })
})
