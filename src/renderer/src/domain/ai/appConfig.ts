export interface LmStudioConfig {
  baseUrl: string
  checkModelTimeoutMs: number
  chatTimeoutMs: number
  defaultTemperature: number
}

export interface MidiConfig {
  debounceWindowMs: number
  hungNoteWatchdogMs: number
  defaultVelocity: number
  autoAdvanceFastDelayMs: number
  autoAdvanceSlowDelayMs: number
}

export interface AppConfig {
  lmStudio: LmStudioConfig
  midi: MidiConfig
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  lmStudio: {
    baseUrl: 'http://127.0.0.1:1234',
    checkModelTimeoutMs: 2500,
    chatTimeoutMs: 900000, // 15 minutos para inferencia de razonamiento profundo en GPU
    defaultTemperature: 0.3
  },
  midi: {
    debounceWindowMs: 35,
    hungNoteWatchdogMs: 6000,
    defaultVelocity: 90,
    autoAdvanceFastDelayMs: 1500,
    autoAdvanceSlowDelayMs: 3500
  }
}
