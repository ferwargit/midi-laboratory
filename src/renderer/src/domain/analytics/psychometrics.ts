export function calculateSessionCPI(
  normalizedAccuracy: number,
  entropyBits: number,
  responsesPerMinute: number,
  avgResponseTimeMs: number,
  inputMethod: 'hardware' | 'virtual' | 'mixed'
): number {
  if (normalizedAccuracy <= 0) return 0

  const entropyFactor = Math.max(0.5, entropyBits / 3.0)
  const latencySec = Math.max(0.6, avgResponseTimeMs / 1000)
  const speedFactor = Math.max(0.3, Math.min(2.5, (responsesPerMinute / 15.0) * (1.5 / latencySec)))
  const inputFactor = inputMethod === 'hardware' ? 1.0 : inputMethod === 'mixed' ? 0.92 : 0.85

  const rawScore = normalizedAccuracy * entropyFactor * speedFactor * inputFactor * 10
  return Math.round(Math.max(0, rawScore))
}
