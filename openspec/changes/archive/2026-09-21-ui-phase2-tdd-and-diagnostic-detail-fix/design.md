## Context

See `proposal.md` for motivation.

**Estado actual:**

- `SessionsTableTab.tsx` ya implementa el patrón completo: botón "Detalle" (línea 593-601) → `setSessionForDetail(s)` → `SessionDetailModal` montado inline (líneas 639-645) con `isOpen={sessionForDetail !== null}` y `onClose={() => setSessionForDetail(null)}`.
- `AiDiagnosticTab.tsx` recibe `metrics` (incluye `sessionPsychometricsList`) pero **no renderiza ningún botón "Detalle"** ni monta `SessionDetailModal`.
- `AnalyticsView.tsx` pasa `onLoadPrescription` a `AiDiagnosticTab` y tiene acceso a `answers` (línea 34) y `displayedAnalysisList` (línea 141).
- `SessionDetailModal.tsx` espera `session: DbSessionRecord`, `answers: DbAnswerRecord[]`, `isOpen`, `onClose`, `onReTest`.

**Restricciones:**

- Mantener paridad exacta con `SessionsTableTab` (accesibilidad, focus-visible, Escape, ARIA).
- No duplicar `SessionDetailModal` en `AnalyticsView` si ya existe en `SessionsTableTab` — pero `AiDiagnosticTab` es un hijo distinto; la opción más limpia es montar el modal **dentro de `AiDiagnosticTab`** (misma estrategia que `SessionsTableTab`).
- Tests TDD: usar `@testing-library/react` + `@testing-library/user-event` + `vitest`; seguir convenciones existentes en `SessionsTableTab.test.tsx`.

## Goals / Non-Goals

**Goals:**

1. Añadir botón "Detalle" en `AiDiagnosticTab` junto a "Generar Nuevo Diagnóstico" (header) y/o en la sección de prescripción, que abra `SessionDetailModal` con la sesión correspondiente.
2. El modal debe recibir la sesión seleccionada de `metrics.sessionPsychometricsList` (las sesiones que alimentaron el diagnóstico IA) y `answers` globales.
3. Suite TDD completa para `components/ui/` (Button, Card, Badge, StatCard) y prueba de integración para el flujo "Detalle" en `AiDiagnosticTab`.

**Non-Goals:**

- Cambiar `AnalyticsView` más allá de pasar `answers` a `AiDiagnosticTab` (ya disponible en el padre).
- Refactorizar `SessionsTableTab` ni su test existente.

## Decisions

### 1. Dónde montar `SessionDetailModal` en `AiDiagnosticTab`

**Decisión:** Montar `SessionDetailModal` **dentro de `AiDiagnosticTab`** (igual que `SessionsTableTab`), con estado local `sessionForDetail`.

**Rationale:**

- Encapsula la lógica de detalle en la propia pestaña; `AnalyticsView` no necesita conocer este estado.
- Evita elevar estado a `AnalyticsView` y pasarlo por props a dos hijos distintos (`SessionsTableTab` y `AiDiagnosticTab`).
- Coherente con el patrón ya validado en `SessionsTableTab`.

**Alternativa considerada:** Montar un único `SessionDetailModal` en `AnalyticsView` y pasarle `sessionForDetail` + `setSessionForDetail` a ambas pestañas. **Rechazada** por acoplar pestañas independientes y requerir `useImperativeHandle` o context innecesario.

### 2. Qué sesión mostrar al hacer clic en "Detalle" desde `AiDiagnosticTab`

**Decisión:** Mostrar un **selector de sesión** (dropdown o lista colapsable) en el header de `AiDiagnosticTab` cuando `metrics.sessionPsychometricsList.length > 0`, permitiendo elegir qué sesión inspeccionar. El botón "Detalle" abre el modal con la sesión seleccionada.

**Rationale:**

- El diagnóstico IA se genera sobre **todas las sesiones filtradas** (`displayedMetrics`), no sobre una sola.
- `metrics.sessionPsychometricsList` contiene exactamente esas sesiones con su telemetría.
- UX: un dropdown "Sesión a inspeccionar:" + botón "Detalle" es más claro que un botón por sesión en el header.

**Alternativa considerada:** Un botón "Detalle" por sesión en una tabla dentro de `AiDiagnosticTab`. **Rechazada** por duplicar la tabla de `SessionsTableTab` y salir del alcance del cambio (solo paridad de botón).

### 3. Estructura de tests TDD (Fase 2)

**Decisión:** Crear tests en `src/renderer/src/components/ui/` y `src/renderer/src/components/views/analytics/` siguiendo el patrón AAA (Arrange-Act-Assert) y `describe`/`it` de `vitest`.

- `Button.test.tsx`: 5 variantes × 3 tamaños × estados (enabled/disabled/loading) + `onClick` + `focus-visible`.
- `Card.test.tsx`: 3 variantes glow + `hover`/`focus` micro-interacciones (snapshot o className assertion).
- `Badge.test.tsx`: variantes (`cyan`, `amber`, `emerald`, `rose`, `purple`, `sky`, `zinc`) + `tabular-nums`.
- `StatCard.test.tsx`: renderizado de label/value, `tabular-nums font-mono`, trend opcional.
- `AiDiagnosticTab.test.tsx`: **Red test first** — render con `currentAiResponse` + `metrics.sessionPsychometricsList`, click en "Detalle", `expect(screen.getByRole('dialog')).toBeInTheDocument()`.

**Rationale:** Cobertura de regresión visual y funcional; `SessionsTableTab.test.tsx` ya sirve de referencia.

### 4. Accesibilidad del botón "Detalle" y modal

**Decisión:** Replicar exactamente los atributos de `SessionsTableTab`:

- Botón: `title="Ver telemetría micro-cronológica pregunta a pregunta"`, `className` con `focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none`.
- Modal: `role="dialog"`, `aria-modal="true"`, `aria-label={session.presetName}`, `onKeyDown` para Escape.

### 5. Prohibición de transformaciones interactivas en contenedores (`Card`)

**Decisión:** Eliminar `active:scale-[0.99]` de `Card.tsx` y blindar la regla con un test de regresión arquitectónica en `Card.test.tsx` que assertiona que el `className` del `Card` nunca contiene `active:scale`, `active:rotate`, `active:translate`, `active:skew` ni `active:transform`.

**Rationale:**

- Un `Card` es un contenedor de panel de gran tamaño (~1400 px de ancho) que aloja elementos interactivos en toda su superficie, **incluidos los bordes**: checkbox de selección en el extremo izquierdo y botones de la columna "Acciones" (`Detalle`, `Re-testar`, eliminar) en el extremo derecho de las tablas.
- Cualquier `transform: scale()` en `:active` con `transform-origin: center` desplaza cada hijo hacia el centro hasta un 1 % de su distancia al centro (7–15 px en los bordes de un panel ancho). El navegador solo dispara `click` si `mousedown` y `mouseup` caen en el mismo elemento; con `transition-all duration-150`, el desplazamiento animado saca el target de debajo del cursor durante la transición y **cancela el evento click**. Este fue el mecanismo exacto del bug "el modal Detalle no se abre".
- La escala interactiva sigue siendo válida en **elementos pequeños** (`Button.tsx` usa `active:scale-[0.98]`: desplazamiento absoluto ~1 px, inofensivo), pero es catastrófica en contenedores, donde el desplazamiento absoluto escala con las dimensiones del elemento.
- El bug era **indetectable por jsdom/vitest**, que no aplica layout ni transformaciones CSS: el test de integración de `SessionsTableTab` (sin mock, modal real) pasaba en verde mientras la app estaba rota en el navegador. Por ello la defensa eficaz es un guardián arquitectónico sobre el `className`, no un test de comportamiento.

### 6. Renderizado del modal fuera del árbol de la vista (`createPortal` + `z-[9999]`)

**Decisión:** `SessionDetailModal` renderiza tanto su rama poblada como la rama sin-respuestas mediante `ReactDOM.createPortal(contenido, document.body)`, manteniendo `fixed inset-0` y elevando el z-index a `z-[9999]`.

**Rationale:**

- Antes de este cambio el modal se renderizaba _inline_ dentro de un ancestro con `backdrop-filter` (`Card`). Según la especificación CSS, `backdrop-filter` (como `filter`, `transform` o `perspective`) establece un _containing block_ para los descendientes con `position: fixed`, de modo que `fixed inset-0` pasaba a referenciarse al padding box del `Card` en lugar del viewport: el overlay cubría solo la tarjeta y el diálogo se centraba dentro de un contenedor mucho más alto que la ventana, quedando fuera de la pantalla.
- Portalizar a `document.body` elimina por construcción cualquier _containing block_ intermedio y cualquier contexto de apilamiento de la vista.
- `z-[9999]` garantiza superposición por encima de `ConfirmModal` (`z-50`) y del dropdown de `StudioTopBar` (`z-50`), y es seguro frente a `PedagogicalTooltip` (z-index inline `99999`, pero `pointer-events-none` y solo visible bajo interacción explícita).

## Risks / Trade-offs

| Riesgo                                                                                                        | Mitigación                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metrics.sessionPsychometricsList` puede estar vacío (sin sesiones filtradas)                                 | Renderizar botón "Detalle" **deshabilitado** con `title="No hay sesiones en el filtro actual"` y tooltip explicativo.                                   |
| `answers` no pasado a `AiDiagnosticTab` desde `AnalyticsView`                                                 | `AnalyticsView` ya tiene `answers` (línea 34); añadir prop `answers` a `AiDiagnosticTabProps` y pasarlo en el render (línea 404-413).                   |
| Tests fallan por `SessionDetailModal` usando `window.addEventListener` (Escape)                               | Mockear `window.addEventListener` en `setupTests.ts` o usar `act()` + `fireEvent.keyDown`. Ya resuelto en `SessionsTableTab.test.tsx`.                  |
| `SessionDetailModal` espera `DbSessionRecord` pero `sessionPsychometricsList` tiene `DetailedSessionAnalysis` | Usar `item.session` (línea 160 de `AnalyticsView`) que es `DbSessionRecord`; pasar `answers` completas y el modal filtra internamente por `session.id`. |

## Migration Plan

1. **Commit 1**: Añadir prop `answers` a `AiDiagnosticTabProps` y pasarla desde `AnalyticsView`.
2. **Commit 2**: Implementar estado `sessionForDetail`, dropdown de selección de sesión, botón "Detalle" y `SessionDetailModal` en `AiDiagnosticTab`.
3. **Commit 3**: Crear tests TDD para `Button`, `Card`, `Badge`, `StatCard` en `components/ui/`.
4. **Commit 4**: Crear test de integración `AiDiagnosticTab.test.tsx` (Red → Green).
5. **Commit 5**: `npm run test`, `npm run lint`, `npm run typecheck` — todo verde.

**Rollback:** Revertir commits individuales; no hay migración de datos ni esquema.

## Open Questions

- ¿El dropdown de selección de sesión debe persistir la selección al cambiar de pestaña? **Respuesta por defecto:** No, resetear a `null` al cerrar modal o cambiar pestaña (comportamiento actual de `SessionsTableTab`).
- ¿Añadir test de snapshot visual para `Card` glow variants? **Respuesta por defecto:** Solo className assertions; snapshots visuales quedan para Storybook/Chromatic (fuera de alcance).
