/**
 * Contención horizontal del tooltip de telemetría del gráfico SVG (F5-09).
 *
 * Módulo separado del componente para poder exportar constantes y funciones
 * sin romper `react-refresh/only-export-components`, y para testear la
 * aritmética de clamping sin depender del DOM (jsdom devuelve 0 para
 * clientWidth).
 */

export const CHART_TOOLTIP_WIDTH = 260
export const CHART_MARGIN = 8
export const CHART_VIEWBOX_WIDTH = 900

/**
 * Clampa el borde izquierdo del tooltip para que nunca sea negativo ni
 * desborde el contenedor, eliminando la scrollbar horizontal espuria del
 * modal. Un contenedor más estrecho que el tooltip degrada al margen en
 * lugar de producir un offset negativo.
 */
export function clampChartTooltipLeftEdge(
  centerX: number,
  containerWidth: number,
  tooltipWidth: number,
  margin: number = CHART_MARGIN
): number {
  const naturalLeft = centerX - tooltipWidth / 2
  const maxLeft = Math.max(margin, containerWidth - tooltipWidth - margin)
  return Math.max(margin, Math.min(maxLeft, naturalLeft))
}
