export type VisualCueMode = 'blind' | 'assisted'

export interface VisualCueOption {
  id: VisualCueMode
  name: string
  description: string
}

export const VISUAL_CUE_OPTIONS: VisualCueOption[] = [
  {
    id: 'blind',
    name: '👂 Oído Puro / A Ciegas (Sin Pistas)',
    description: 'El piano no se ilumina al sonar el estímulo para entrenar la escucha real.'
  },
  {
    id: 'assisted',
    name: '👁️ Asistido (Iluminar al Sonar)',
    description: 'La tecla se ilumina sincronizada con el sonido para aprendizaje inicial.'
  }
]

export interface StimulusSyncEvent {
  noteNumber: number
  durationMs: number
  startedAt: number
  expiresAt: number
}

/**
 * Calcula el estado de iluminación del estímulo respetando el modo pedagógico y la duración.
 */
export function calculateActiveStimulusNotes(
  events: StimulusSyncEvent[],
  mode: VisualCueMode,
  now = Date.now()
): number[] {
  if (mode === 'blind') {
    return [] // En modo a ciegas, nunca se revela la nota mientras suena
  }

  // En modo asistido, solo retorna las notas cuyo tiempo de emisión no haya expirado
  return events.filter((e) => now >= e.startedAt && now < e.expiresAt).map((e) => e.noteNumber)
}
