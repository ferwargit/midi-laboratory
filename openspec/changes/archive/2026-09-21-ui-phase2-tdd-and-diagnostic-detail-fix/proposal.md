## Why

La solapa "Diagnóstico IA" (`AiDiagnosticTab`) carece del botón **"Detalle"** que permite inspeccionar la telemetría micro-cronológica de las sesiones analizadas, rompiendo la paridad funcional con la pestaña "Sesiones" (`SessionsTableTab`) donde dicho botón sí existe y abre correctamente el `SessionDetailModal`. Además, la Fase 2 de Frontend (componentes `components/ui/`) no dispone de suite de pruebas unitarias TDD con `@testing-library/react`, dejando sin cobertura de regresión los elementos de interfaz críticos (Button, Card, Badge, StatCard) y la propia interacción del botón "Detalle".

### Diagnóstico Raíz (verificado en producción)

El bug reportado en vivo ("el modal Detalle no se abre") tenía **dos causas independientes y acumulativas**, ambas originadas por el refactor del Design System de Fase 2 (commit `c7ead6a`):

1. **Causa raíz real (cancelación de clics):** la clase `active:scale-[0.99]` añadida a `Card.tsx` provocaba que, al hacer `mousedown` sobre la tarjeta (un contenedor de ~1400 px de ancho), toda su superficie se deformara al 99 % con `transform-origin: center`. Esto desplazaba cada elemento interactivo hacia el centro hasta un 1 % de su distancia al centro (7–15 px en las columnas de los bordes). Como el navegador nativo solo dispara el evento `click` cuando `mousedown` y `mouseup` caen sobre el **mismo elemento**, ese desplazamiento animado (`transition-all duration-150`) sacaba el target de debajo del cursor antes del `mouseup` y **cancelaba el evento click**: el checkbox de selección (extremo izquierdo) no se marcaba y los botones `Detalle`/`Re-testar` (extremo derecho) jamás invocaban `setSessionForDetail(s)`, por lo que el modal no abría. El usuario percibía únicamente "la tabla se mueve", que no era otra cosa que el propio efecto de escala.

2. **Causa secundaria (clipping del posicionamiento fijo):** antes de este cambio, `SessionDetailModal` se renderizaba _inline_ dentro de un ancestro con `backdrop-filter` (`Card`), lo cual establece un _containing block_ para los descendientes `position: fixed`, rompiendo la cobertura `fixed inset-0` a viewport completo.

Ambas se corrigen en este cambio: se elimina la transformación interactiva del `Card` y el modal se renderiza mediante `createPortal` en `document.body`.

## What Changes

- **Agregar botón "Detalle" en `AiDiagnosticTab`**: Conectar el handler y el `SessionDetailModal` (ya montado en `AnalyticsView` o localmente) para que al hacer clic se abra la inspección clínica de la sesión correspondiente, con accesibilidad completa (focus-visible, ARIA, Escape).
- **Suite TDD completa para `components/ui/` (Fase 2)**:
  - `Button.test.tsx`: renderizado de variantes (`primary`, `secondary`, `success`, `danger`, `ghost`), tamaños, `onClick`, estado `disabled`.
  - `Card.test.tsx`: renderizado con variantes de glow (`cyan`, `purple`, `none`) y micro-interacciones (hover/focus).
  - `Badge.test.tsx` y `StatCard.test.tsx`: renderizado de variantes, clases `tabular-nums font-mono` y formato numérico.
  - `AiDiagnosticTab.test.tsx` (o `AnalyticsView.test.tsx`): prueba en **Rojo** que simula clic en "Detalle" y verifica apertura del modal/vista de detalle; luego **Verde** con la solución implementada.
- **Corrección de estado desconectado**: El modal de detalle debe recibir la sesión correcta desde `metrics.sessionPsychometricsList` (las sesiones que alimentaron el diagnóstico IA) y no quedar huérfano por falta de callback o prop.

## Capabilities

### New Capabilities

- `ui-testing/tdd-phase2-components`: Suite de pruebas unitarias TDD para la Fase 2 de componentes UI (`Button`, `Card`, `Badge`, `StatCard`, `AiDiagnosticTab`) con `@testing-library/react`, cubriendo renderizado, interacción, accesibilidad y regresión visual de variantes.

### Modified Capabilities

- `05-analytics-psychometrics`: Se añade requisito de paridad UI en la solapa de Diagnóstico IA: **el botón "Detalle" DEBE estar presente y funcional**, abriendo el `SessionDetailModal` con la sesión seleccionada del conjunto analizado (`metrics.sessionPsychometricsList`), replicando el comportamiento existente en `SessionsTableTab`.

## Impact

**Archivos afectados:**

- `src/renderer/src/components/views/analytics/AiDiagnosticTab.tsx` — agregar botón "Detalle", estado `sessionForDetail`, montar `SessionDetailModal`.
- `src/renderer/src/components/views/AnalyticsView.tsx` — pasar `answers` y `onLoadPrescription` a `AiDiagnosticTab` (ya disponibles) y opcionalmente montar el modal a nivel de vista si se prefiere elevación.
- `src/renderer/src/components/ui/Card.tsx` — **eliminación de la clase `active:scale-[0.99]`** (causa raíz de la cancelación de clics). Los contenedores de panel que alojan elementos interactivos en sus bordes (tablas con checkbox a la izquierda y botones de Acciones a la derecha) no deben aplicar deformaciones dimensionales en `:active`.
- `src/renderer/src/components/views/analytics/SessionDetailModal.tsx` — renderizado del modal y de la rama sin-respuestas mediante `ReactDOM.createPortal(..., document.body)`, con `fixed inset-0 z-[9999]` para superposición segura por encima de `ConfirmModal` (`z-50`) y `PedagogicalTooltip` (`z-99999` colisionante).
- **Nuevos tests**: `src/renderer/src/components/ui/Button.test.tsx`, `Card.test.tsx` (incluye guardián de regresión arquitectónica que prohíbe `active:scale|rotate|translate|skew|transform` en el `Card`), `Badge.test.tsx`, `StatCard.test.tsx`, `AiDiagnosticTab.test.tsx` (o `AnalyticsView.test.tsx`).

**Dependencias:** `@testing-library/react`, `@testing-library/user-event`, `vitest`, `jsdom` (ya en proyecto).

**Sistemas:** Ningún cambio en API, almacenamiento, IPC o motor de dominio. Solo capa de presentación y pruebas.
