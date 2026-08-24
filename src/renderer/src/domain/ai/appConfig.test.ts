import { describe, it, expect } from 'vitest'
import { DEFAULT_APP_CONFIG } from './appConfig'
import { LmStudioService } from './lmStudioService'

describe('appConfig - Configuración Centralizada y Parametrización del Sistema', () => {
  it('debe contener los valores por defecto canónicos para LM Studio y MIDI', () => {
    expect(DEFAULT_APP_CONFIG.lmStudio.baseUrl).toBe('http://127.0.0.1:1234')
    expect(DEFAULT_APP_CONFIG.lmStudio.checkModelTimeoutMs).toBe(2500)
    expect(DEFAULT_APP_CONFIG.lmStudio.chatTimeoutMs).toBe(900000)
    expect(DEFAULT_APP_CONFIG.lmStudio.defaultTemperature).toBe(0.3)

    expect(DEFAULT_APP_CONFIG.midi.debounceWindowMs).toBe(35)
    expect(DEFAULT_APP_CONFIG.midi.hungNoteWatchdogMs).toBe(6000)
    expect(DEFAULT_APP_CONFIG.midi.defaultVelocity).toBe(90)
  })

  it('LmStudioService debe instanciarse con la configuración por defecto y aceptar overrides', () => {
    const defaultService = new LmStudioService()
    expect(defaultService.getBaseUrl()).toBe('http://127.0.0.1:1234')

    const customService = new LmStudioService('http://192.168.1.100:8080')
    expect(customService.getBaseUrl()).toBe('http://192.168.1.100:8080')

    const objectConfigService = new LmStudioService({
      baseUrl: 'http://localhost:5000',
      defaultTemperature: 0.7
    })
    expect(objectConfigService.getBaseUrl()).toBe('http://localhost:5000')
  })
})
