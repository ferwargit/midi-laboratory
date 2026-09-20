/**
 * Posicionamiento puro del tooltip pedagógico (F5-06).
 *
 * Módulo separado del componente para poder exportar constantes y funciones
 * sin romper `react-refresh/only-export-components`, y para testear la
 * aritmética de clamping sin depender del DOM (jsdom devuelve 0 para
 * clientWidth/offsetHeight).
 */

export const TOOLTIP_WIDTH = 320
export const ESTIMATED_TOOLTIP_HEIGHT = 260
export const VIEWPORT_MARGIN = 16
export const TRIGGER_GAP = 8

export interface TriggerRect {
  top: number
  bottom: number
  left: number
  width: number
}

export interface TooltipPlacement {
  top: number
  left: number
  placeBelow: boolean
}

/**
 * Decide la dirección vertical por espacio real disponible (no por un umbral
 * fijo) y clampea el borde superior dentro de
 * [VIEWPORT_MARGIN, innerHeight - altura - VIEWPORT_MARGIN], de forma que el
 * tooltip nunca es recortado por ningún borde de la ventana.
 */
export function computeTooltipPlacement(
  rect: TriggerRect,
  viewport: { innerWidth: number; innerHeight: number },
  tooltipHeight: number
): TooltipPlacement {
  const spaceBelow = viewport.innerHeight - rect.bottom
  const spaceAbove = rect.top
  const placeBelow = spaceBelow >= spaceAbove

  const naturalTop = placeBelow ? rect.bottom + TRIGGER_GAP : rect.top - TRIGGER_GAP - tooltipHeight
  const maxTop = viewport.innerHeight - tooltipHeight - VIEWPORT_MARGIN
  const top = Math.max(VIEWPORT_MARGIN, Math.min(maxTop, naturalTop))

  const naturalLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(viewport.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN, naturalLeft)
  )

  return { top, left, placeBelow }
}
