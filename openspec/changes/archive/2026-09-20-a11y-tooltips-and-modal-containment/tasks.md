## 1. Pruebas primero (TDD — deben fallar en Rojo antes de la implementación)

- [x] 1.1 Crear `src/renderer/src/components/ui/PedagogicalTooltip.test.tsx` y verificar Rojo: el trigger aún no expone `role="button"`/`tabIndex={0}`/`aria-expanded`, `Enter`/`Space` no abren, `Escape` no cierra, y `computeTooltipPlacement` no existe (import falla).
- [x] 1.2 Crear `src/renderer/src/components/ui/ConfirmModal.test.tsx` y verificar Rojo: no hay `role="dialog"`/`aria-modal="true"`, y `Escape` no invoca `onCancel`.
- [x] 1.3 Crear `src/renderer/src/components/views/analytics/SessionDetailModal.test.tsx` y verificar Rojo: sin `role="dialog"`/`aria-modal="true"` en ambas ramas, `Escape` no invoca `onClose`, y `clampChartTooltipLeftEdge` no existe.
- [x] 1.4 Crear `src/renderer/src/components/views/guide/KnowledgeGuideModal.test.tsx` y verificar Rojo: sin `role="dialog"`/`aria-modal="true"` y `Escape` no invoca `onClose` (mockear los 5 diagramas con `vi.mock` solo si el SVG es pesado en jsdom).

## 2. PedagogicalTooltip — trigger accesible, Escape y clamp vertical (F5-05, F5-06)

- [x] 2.1 Extraer `computeTooltipPlacement` (pura, exportada) con `TriggerRect`/`TooltipPlacement`, `TOOLTIP_WIDTH=320`, `ESTIMATED_TOOLTIP_HEIGHT=260`, `VIEWPORT_MARGIN=16`: `placeBelow = (innerHeight - rect.bottom) >= rect.top`, `top` como borde superior en ambas ramas, y clampeo en `[16, innerHeight - height - 16]`; verificar que la prueba de tabla pura (1.1) pasa.
- [x] 2.2 Hacer el trigger focable y semántico en `PedagogicalTooltip.tsx`: `role="button"`, `tabIndex={0}`, `aria-expanded={isVisible}`, `aria-controls` al id del portal, anillo de foco `focus-visible:ring-2 ring-sky-400`, y `onKeyDown` que conmute en `Enter`/`Space` con `preventDefault()` en `Space`; verificar que las pruebas de teclado de 1.1 pasan.
- [x] 2.3 Agregar el listener de `Escape` dentro del `useEffect` existente (`isVisible`-gated) con teardown simétrico; verificar que la prueba de Escape de 1.1 pasa.
- [x] 2.4 Reescribir `updatePosition` para usar `computeTooltipPlacement` con altura medida del portal (`tooltipRef.current?.offsetHeight ?? ESTIMATED_TOOLTIP_HEIGHT`), unificar el render a `top: ${coords.top}px` (eliminando la rama `bottom:`), y agregar un `useLayoutEffect` que re-calcule la posición al montar el portal; verificar que la prueba de clamp vertical de 1.1 pasa.

## 3. Modales — semántica de diálogo y Escape (F5-07)

- [x] 3.1 En `ConfirmModal.tsx`: agregar `role="dialog"`, `aria-modal="true"`, `aria-label={title}` al panel y un `useEffect` (antes del `if (!isOpen) return null`) que llame a `onCancel` en `Escape`; verificar que 1.2 pasa (Escape → `onCancel` una vez, `onConfirm` nunca).
- [x] 3.2 En `SessionDetailModal.tsx`: agregar `role="dialog"`, `aria-modal="true"`, `aria-label={session.presetName}` a las dos ramas (vacía en `:68` y poblada en `:104`) y el `useEffect` de `Escape` → `onClose` antes del early return; verificar que 1.3 pasa.
- [x] 3.3 En `KnowledgeGuideModal.tsx`: agregar `role="dialog"`, `aria-modal="true"`, `aria-label` fijo al panel y el `useEffect` de `Escape` → `onClose`; verificar que 1.4 pasa.

## 4. SessionDetailModal — clamp horizontal del tooltip SVG (F5-09)

- [x] 4.1 Extraer `clampChartTooltipLeftEdge` (pura, exportada) con `CHART_TOOLTIP_WIDTH=260` y `CHART_MARGIN=8`: clamping del borde izquierdo con `maxLeft = Math.max(margin, containerWidth - tooltipWidth - margin)`; verificar que la tabla de pruebas de 1.3 pasa (borde izquierdo ≥ 8, nunca negativo, contenedor estrecho degrada a `margin`).
- [x] 4.2 Reconectar el tooltip de `SessionDetailModal.tsx:464-472`: ancho fijo `w-[260px]`, medir el contenedor con `ref`/`clientWidth`, `left` en píxeles desde `clampChartTooltipLeftEdge`, y `transform: 'translateY(-100%)` (eliminar `translate(-50%)`); verificar que la prueba de integración de 1.3 pasa.

## 5. Verificación final (no interactiva, per guardrail de Electron)

- [x] 5.1 Ejecutar `npm run typecheck` y verificar que no hay errores nuevos.
- [x] 5.2 Ejecutar `npm run lint` y verificar que no hay errores nuevos.
- [x] 5.3 Ejecutar `npm run test` (vitest run) y verificar que toda la suite está en Verde, incluyendo las 4 pruebas nuevas de los grupos 1.
- [x] 5.4 Ejecutar `openspec validate a11y-tooltips-and-modal-containment --strict` y verificar validación limpia.
