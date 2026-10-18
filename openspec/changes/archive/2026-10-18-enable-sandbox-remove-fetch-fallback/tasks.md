# Tasks

## 1. Desacoplamiento del fallback a fetch en lmStudioService (TDD)

- [x] 1.1 Adaptar primero los tests: en `src/renderer/src/domain/ai/lmStudioService.mock.test.ts` migrar los 2 tests que ejercitan el fallback a fetch (`debe comunicarse exitosamente vía fetch HTTP y parsear la respuesta del modelo`, líneas 94–138; `askCustomConsultation debe transmitir la secuencia Multi-Turn ... vía fetch`, líneas 140–176) al canal IPC con mock de `window.customAPI`, preservando sus aserciones semánticas (parseo del payload del LLM, transmisión del historial multi-turn); añadir un test de lectura de fuente que verifique que `lmStudioService.ts` NO contiene llamadas `fetch()` y que `window.customAPI` es la única vía referenciada (patrón `preloadExposure.test.ts`). Verificar: `npx vitest run src/renderer/src/domain/ai/lmStudioService.mock.test.ts` falla en Rojo (el fallback aún existe).
- [x] 1.2 En `src/renderer/src/domain/ai/lmStudioService.ts`: eliminar el bloque de fallback a `fetch()` de `getLoadedModelId()` (devolver `null` controlado si el canal IPC no está disponible) y de `sendChat()` (lanzar `Error('Canal IPC no disponible')` si `window.customAPI` no está disponible); actualizar el docstring de `sendChat` (política IPC exclusivo). Verificar: `npx vitest run src/renderer/src/domain/ai/lmStudioService.mock.test.ts src/renderer/src/domain/ai/lmStudioService.test.ts` en Verde.

## 2. CSP y sandbox

- [x] 2.1 Actualizar `src/renderer/src/index-csp.test.ts`: verificar que el `connect-src` de la CSP NO contiene `http://127.0.0.1:1234` (limitado a `'self'`), que `src/main/index.ts` declara `sandbox: true`, y actualizar el docstring a la nueva postura (canal IPC exclusivo, sin fallback a fetch). Verificar: `npx vitest run src/renderer/src/index-csp.test.ts` falla en Rojo (la CSP y el sandbox aún no están actualizados).
- [x] 2.2 En `src/renderer/index.html`: eliminar `http://127.0.0.1:1234` de `connect-src` (quedar `connect-src 'self'`) y actualizar el comentario HTML obsoleto que justificaba la apertura para el fallback. Verificar: `npx vitest run src/renderer/src/index-csp.test.ts` en Verde (parcial: CSP).
- [x] 2.3 En `src/main/index.ts`: cambiar `sandbox: false` a `sandbox: true` en `webPreferences` de `createWindow()` y sustituir el comentario obsoleto (líneas 54–61) por uno breve que documente la postura (sandbox activo, canal único IPC vía `window.customAPI`). Verificar: `npx vitest run src/renderer/src/index-csp.test.ts` en Verde (completo).

## 3. Verificación de no regresión

- [x] 3.1 Ejecutar `npm run typecheck` (node + web) confirmando 0 errores. Verificar: ambos typechecks limpios.
- [x] 3.2 Ejecutar la suite completa `npm test` y confirmar 0 regresiones: los tests de `aiDecoupling`, `circuitBreaker`, `useAiStore` y el resto de la suite pasan sin modificaciones; ningún test neto eliminado (los 2 de fetch migrados, no borrados). Verificar: suite completa en verde.
- [x] 3.3 Ejecutar `npm run lint` con 0 errores y `npx prettier --write` sobre los archivos modificados según el formato del proyecto. Verificar: lint limpio y formato aplicado.

## Workflow follow-up

- Verificación manual recomendada tras el apply: arrancar `npm run dev` y confirmar que el diagnóstico IA funciona con LM Studio activo y degrada a `algorithmic_fallback` con LM Studio apagado (sandbox activo en runtime).
