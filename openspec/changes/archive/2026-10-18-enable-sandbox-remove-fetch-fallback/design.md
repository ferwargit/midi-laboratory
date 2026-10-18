# Design

## Context

`lmStudioService.ts` implementa hoy una política de transporte híbrida: IPC primario (`window.customAPI`) con fallback a `fetch()` directo en `getLoadedModelId()` (líneas 44–58) y `sendChat()` (líneas 91–109). Ese fallback es la razón documentada (comentario en `src/main/index.ts:54-61`) para mantener `sandbox: false`, y a su vez la razón de la apertura `connect-src http://127.0.0.1:1234` en la CSP de `index.html` (comentario en líneas 7–10). Con F5 remediado (validación SSRF en el Main) y F2/F3 remediados (preload con exposición exclusiva de `customAPI`), el canal IPC es canónico y exclusivo de facto. Los tests afectados son `index-csp.test.ts` (2 tests sobre el HTML), `lmStudioService.mock.test.ts` (2 tests ejercitan el fallback a fetch: líneas 94–138 y 140–176; 4 tests ya usan IPC) y `lmStudioService.test.ts` (3 tests de integración que mockean `window.customAPI`, sin dependencia del fallback).

## Goals / Non-Goals

**Goals:**

- `sandbox: true` en el `BrowserWindow`, con el preload reducido a APIs compatibles con sandbox (`contextBridge`, `ipcRenderer`, `process.contextIsolated`).
- Política de transporte IPC exclusiva en `LmStudioService`: sin `fetch()` en el servicio, degradación controlada cuando el canal IPC no está disponible.
- CSP cerrada: `connect-src` sin el host de LM Studio (el Renderer no tiene salida de red directa hacia él).
- Tests actualizados para fijar la nueva postura y sin pruebas del fallback eliminado.

**Non-Goals:**

- No se modifica el circuit breaker, el fallback algorítmico (`generateAlgorithmicFallback`) ni el contrato de degradación: un fallo del canal IPC sigue contando como fallo y resolviéndose con `algorithmic_fallback`.
- No se eliminan los timeouts ni los handlers IPC del Main (F5 ya los endureció; sus contratos se preservan).
- No se elimina la dependencia `@electron-toolkit/preload` de `package.json` (ya sin uso tras F2/F3; limpieza separada).
- No se abordan otros hallazgos de la auditoría (F6+).

## Decisions

1. **Orden de desacoplamiento: fallback primero, sandbox después.** Se elimina el fallback a `fetch()` y se actualizan sus tests ANTES de activar `sandbox: true`, de modo que el cambio de sandbox nunca conviva con un servicio que depende de APIs incompatibles con él. Alternativa descartada: activar sandbox y eliminar el fallback en el mismo paso sin orden — dificultaría atribuir un fallo de arranque a la causa correcta.

2. **Degradación controlada sin fetch, reutilizando el circuit breaker.** En `sendChat`, si `window.customAPI` no está disponible, se lanza `Error('Canal IPC no disponible')` (mismo patrón que el error por respuesta vacía); el circuit breaker lo cuenta como fallo y resuelve con `fallbackOp`. En `getLoadedModelId`, si el canal no está disponible, se devuelve `null` (mismo contrato que "servidor caído"). Alternativa descartada: devolver valores silenciosos en `sendChat` — rompería el contrato del circuit breaker (los fallos deben ser visibles para abrir el circuito).

3. **CSP sin el host de LM Studio en `connect-src`.** El comentario de `index.html` documenta que la apertura existía únicamente para el fallback; con el fallback eliminado, mantenerla dejaría una vía para que el Renderer acceda a LM Studio por HTTP directo, evadiendo la validación SSRF del Main (F5). `connect-src` queda en `'self'`. Alternativa descartada: conservar la apertura "por si acaso" — superficie innecesaria que contradice la mitigación F5.

4. **`sandbox: true` con verificación de compatibilidad del preload.** El preload actual (`src/preload/index.ts`) solo usa `contextBridge`, `ipcRenderer` y `process.contextIsolated`: las tres APIs están disponibles en preload sandboxeado (Electron las expone explícitamente en ese modo). El comentario obsoleto de `index.ts:54-61` se elimina y se sustituye por uno breve que documente la nueva postura (sandbox activo, canal único IPC). Alternativa descartada: `sandbox: true` + `contextIsolation: false` — degradaría el aislamiento; `contextIsolation: true` se mantiene.

5. **Migración de los 2 tests de fetch a IPC, preservando su valor semántico.** `debe comunicarse exitosamente vía fetch HTTP y parsear la respuesta del modelo` → mismo escenario vía mock de `window.customAPI` (parseo del payload del LLM); `askCustomConsultation debe transmitir la secuencia Multi-Turn ... vía fetch` → mismo escenario vía IPC (transmisión del historial multi-turn). Se añade un test nuevo que fija la ausencia de `fetch()` en el fuente del servicio (patrón de lectura de fuente de `preloadExposure.test.ts`). Alternativa descartada: borrar los 2 tests sin migrarlos — perdería cobertura de parseo y multi-turn.

6. **`index-csp.test.ts` pasa a verificar la postura completa Main↔renderer.** Además de la CSP (ahora `connect-src 'self'` SIN el host), el test verifica que `src/main/index.ts` declara `sandbox: true` (lectura de fuente, mismo patrón). El nombre del archivo se conserva para no romper referencias; su docstring se actualiza. Alternativa descartada: renombrar el test — churn innecesario sin beneficio.

## Risks / Trade-offs

- [`sandbox: true` rompe alguna API del preload no detectada en la inspección] → Mitigación: el preload solo usa `contextBridge`/`ipcRenderer`/`process.contextIsolated` (compatibles con sandbox); la suite completa y el arranque (`npm run dev` manual) lo confirman; rollback trivial (revert).
- [Pérdida de resiliencia si el canal IPC falla en runtime (preload no cargado)] → Mitigación: el circuit breaker ya trata el fallo de IPC como fallo contable y degrada a `algorithmic_fallback`; la práctica musical nunca se bloquea (contrato "Desacoplamiento Absoluto" intacto). El escenario es además mucho menos probable con sandbox activo.
- [Regresión en tests que asumían el transporte híbrido] → Mitigación: los 2 tests de fetch se migran a IPC preservando sus aserciones semánticas; la suite completa debe quedar en verde sin tests eliminados netos.
- [CSP demasiado restrictiva si en el futuro se añade otra integración HTTP en el renderer] → Mitigación: la política del proyecto es canal IPC nombrado; cualquier futura integración debe añadir su apertura CSP explícita en un cambio revisado, no heredar esta.

## Migration Plan

Sin migración de datos ni despliegue especial. Orden: (1) eliminar fallback en `lmStudioService.ts` + migrar tests (Rojo→Verde), (2) actualizar `index-csp.test.ts` + CSP de `index.html`, (3) `sandbox: true` + limpieza del comentario en `index.ts`, (4) suite completa + typecheck + lint. Rollback trivial (revert del commit). Verificación manual recomendada post-implementación: arrancar `npm run dev` y confirmar que el diagnóstico IA funciona con LM Studio activo y degrada con LM Studio apagado.

## Open Questions

(ninguna)
