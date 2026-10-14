import { CPI_CONFIG_BY_MODE } from './thresholds'

export function calculateSessionCPI(
  normalizedAccuracy: number,
  entropyBits: number,
  responsesPerMinute: number,
  avgResponseTimeMs: number,
  inputMethod: 'hardware' | 'virtual' | 'mixed',
  mode?: string
): number {
  if (normalizedAccuracy <= 0) return 0

  const entropyFactor = Math.max(0.5, entropyBits / 3.0)
  const latencySec = Math.max(0.6, avgResponseTimeMs / 1000)
  
  // Resolver configuración CPI por modalidad
  const resolvedMode = (mode || 'single_note').trim().toLowerCase() as keyof typeof CPI_CONFIG_BY_MODE
  const cpiConfig = CPI_CONFIG_BY_MODE[resolvedMode] ?? CPI_CONFIG_BY_MODE.single_note
  
  const speedFactor = Math.max(0.3, Math.min(2.5, (responsesPerMinute / cpiConfig.targetRpm) * (cpiConfig.targetLatencySec / latencySec)))
  const inputFactor = inputMethod === 'hardware' ? 1.0 : inputMethod === 'mixed' ? 0.92 : 0.85

  const rawScore = normalizedAccuracy * entropyFactor * speedFactor * inputFactor * 10
  return Math.round(Math.max(0, rawScore))
}
