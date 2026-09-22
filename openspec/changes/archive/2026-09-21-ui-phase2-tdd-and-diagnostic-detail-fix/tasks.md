## 1. Limpiar AiDiagnosticTab (corregir malentendido inicial)

- [x] 1.1 Remover el selector 'Sesión a inspeccionar' y botón 'Detalle' que se agregaron incorrectamente a AiDiagnosticTab.tsx. **Verificación:** AiDiagnosticTab.tsx no contiene selector de sesión ni botón Detalle.
- [x] 1.2 Remover el estado local `sessionForDetail` y `selectedSessionForDetail` de AiDiagnosticTab.tsx. **Verificación:** No hay useState para session state en AiDiagnosticTab.
- [x] 1.3 Remover el montaje de SessionDetailModal de AiDiagnosticTab.tsx. **Verificación:** No hay <SessionDetailModal> en AiDiagnosticTab.tsx.
- [x] 1.4 Confirmar que AiDiagnosticTab.tsx regresa a su diseño limpio original (solo muestra diagnóstico y prescripción). **Verificación:** Componente coincide con versión original antes de los cambios.

## 2. Solucionar el bug REAL: cancelación de clics en Card + clipping del modal

- [x] 2.1 Añadir import de createPortal desde 'react-dom' en SessionDetailModal.tsx. **Verificación:** Import presente en el archivo.
- [x] 2.2 Modificar SessionDetailModal para usar ReactDOM.createPortal y renderizar en document.body. **Verificación:** Los retornos del modal usan createPortal(..., document.body).
- [x] 2.3 Renderizar con `fixed inset-0 z-[9999]` (en lugar de z-50) para garantizar superposición segura por encima de `ConfirmModal` (z-50), el dropdown de `StudioTopBar` (z-50) y cualquier capa de la vista. **Verificación:** Ambas ramas del modal usan `fixed inset-0 z-[9999]`.
- [x] 2.4 Asegurar que el fondo oscuro (backdrop-blur-lg) cubra toda la pantalla. **Verificación:** Clase backdrop-blur-lg presente en el contenedor externo.
- [x] 2.5 Verificar que si sessionAnswers está vacío, el modal renderice un estado informativo limpio sin fallar. **Verificación:** Rama de !analysis retorna modal informativo vía portal.
- [x] 2.6 Eliminar `active:scale-[0.99]` de Card.tsx (causa raíz de la cancelación de clics) y añadir test de regresión arquitectónica en Card.test.tsx que prohíbe `active:scale|rotate|translate|skew|transform` en el className del Card. **Verificación:** Card.tsx no contiene active:scale; Card.test.tsx incluye el guardián y pasa.

## 3. Verificar que SessionsTableTab funcione correctamente

- [x] 3.1 Confirmar que SessionsTableTab.tsx ya implementa correctamente el patrón: botón "Detalle" → setSessionForDetail(s) → SessionDetailModal montado. **Verificación:** Línea ~599 llama a setSessionForDetail(s) y líneas ~639-645 montan SessionDetailModal.
- [x] 3.2 Verificar que no se necesitan cambios en SessionsTableTab.tsx para que el botón Detalle funcione con el modal corregido. **Verificación:** SessionsTableTab.tsx sin modificaciones desde la versión original.

## 4. Tests TDD — components/ui/

- [x] 4.1 Crear `src/renderer/src/components/ui/Button.test.tsx`:
  - Renderizado de 5 variantes (`primary`, `secondary`, `success`, `danger`, `ghost`).
  - 3 tamaños (`sm`, `md`, `lg`).
  - `onClick` se dispara al click (mock `vi.fn()`).
  - Estado `disabled` deshabilita click y aplica estilos.
  - Clase `focus-visible:ring-2 focus-visible:ring-cyan-500`.
    **Verificación:** `npm run test -- Button.test.tsx` → 100% pass.
- [x] 4.2 Crear `src/renderer/src/components/ui/Card.test.tsx`:
  - Renderizado con 3 variantes glow (`cyan`, `purple`, `none` via prop `glow`).
  - Micro-transiciones base: clases `transition-all duration-150 ease-out` presentes.
  - Renderizado de children y paso de props adicionales (`id`, `data-testid`).
  - **Prohibición arquitectónica:** el className del Card nunca contiene `active:scale|rotate|translate|skew|transform` (regresión que cancelaba clics en los bordes del panel).
    **Verificación:** `npm run test -- Card.test.tsx` → 100% pass.
- [x] 4.3 Crear `src/renderer/src/components/ui/Badge.test.tsx`:
  - Renderizado de las 4 variantes canónicas (`success`, `danger`, `warning`, `info`).
  - Renderizado de children numéricos y de elementos anidados.
  - Clases base `inline-flex items-center px-2 py-0.5 rounded text-xs border`.
    **Verificación:** `npm run test -- Badge.test.tsx` → 100% pass.
- [x] 4.4 Crear `src/renderer/src/components/ui/StatCard.test.tsx`:
  - Renderizado de `title` y `value`.
  - `value` con `tabular-nums font-mono`.
  - `highlightColor` opcional (emerald para positivo / zinc-100 por defecto).
    **Verificación:** `npm run test -- StatCard.test.tsx` → 100% pass.

## 5. Test de Integración — Flujo "Detalle" en SessionsTableTab

- [x] 5.1 El test existente en `SessionsTableTab.test.tsx` ya verifica que al pulsar el botón Detalle se abre el SessionDetailModal. **Verificación:** Test pasa con la implementación corregida.
  - Render `SessionsTableTab` con sesiones de prueba
  - Simular click en botón "Detalle" de una fila
  - `expect(screen.getByText('Cerrar Inspector')).toBeDefined()`
  - `expect(screen.getByText(/Foco Inicial/i)).toBeDefined()`

## 6. Verificación Global y Limpieza

- [x] 6.1 Ejecutar suite completa: `npm run test` → 0 fallos, 0 tests omitidos.
- [x] 6.2 Ejecutar lint: `npm run lint` → 0 errores nuevos (1 error preexistente en SingleNoteView.tsx no relacionado con este cambio).
- [x] 6.3 Ejecutar typecheck: `npm run typecheck` → 0 errores.
- [x] 6.4 Ejecutar format: `npm run format` → 0 diffs (prettier ok).
- [x] 6.5 Validar cambio OpenSpec: `openspec validate ui-phase2-tdd-and-diagnostic-detail-fix --strict` → OK.

## 7. Documentación y Cierre

- [x] 7.1 Actualizar `CHANGELOG.md` (si existe) con entrada "fix: botón Detalle en SesionesTableTab ahora funciona correctamente con portal + limpiar AiDiagnosticTab incorrecto".
- [x] 7.2 Confirmar que `openspec status --change "ui-phase2-tdd-and-diagnostic-detail-fix" --json` muestra `isPlanningComplete: true` y todos los artifacts `done`/`skipped`.
