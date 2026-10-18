# Tasks

## 1. Validadores puros (TDD)

- [x] 1.1 Escribir `src/main/windowNavigationGuard.test.ts` ANTES de la implementación: `isOpenExternalUrlAllowed` acepta `https://`/`http://` legítimas y rechaza `file:`, `javascript:`, `data:`, `not-a-url`, `https:`; `isAllowedNavigation` acepta el origen propio (dev `http://localhost:5173` y prod `file://`) y rechaza orígenes ajenos (`https://evil.example.com`, `http://192.168.1.10/`), sufijos de suplantación (`https://localhost:5173.evil.com`) y URLs malformadas. Verificar: `npx vitest run src/main/windowNavigationGuard.test.ts` falla en Rojo.
- [x] 1.2 Implementar `src/main/windowNavigationGuard.ts` con `isOpenExternalUrlAllowed(url: string): boolean` y `isAllowedNavigation(url: string, allowedOrigin: string): boolean` usando `new URL()` y comparación estricta de `protocol`/`origin`. Verificar: `npx vitest run src/main/windowNavigationGuard.test.ts` en Verde.
- [x] 1.3 Escribir `src/main/chatPayloadValidator.test.ts` ANTES de la implementación: `isValidChatCompletionPayload` acepta un payload válido y rechaza payload ausente/nulo, `model` vacío o no string, `messages` vacío, no arreglo o con elementos sin `role`/`content` strings (ej. `[{}]`, `'hola'`, `[{ role: 1, content: 'x' }]`); campos extra permitidos. Verificar: `npx vitest run src/main/chatPayloadValidator.test.ts` falla en Rojo.
- [x] 1.4 Implementar `src/main/chatPayloadValidator.ts` con `isValidChatCompletionPayload(payload: unknown): boolean` (objeto no nulo, `model` string no vacío tras trim, `messages` arreglo no vacío de objetos con `role`/`content` strings no vacíos). Verificar: `npx vitest run src/main/chatPayloadValidator.test.ts` en Verde.

## 2. Integración en el Main

- [x] 2.1 En `src/main/lmStudioHandlers.ts`: invocar `isValidChatCompletionPayload(payload)` al inicio de `handleChatCompletion` (antes de la resolución de baseUrl); en fallo retornar `{ success: false, error: 'Payload de mensajes inválido' }` sin fetch ni excepciones. Añadir en `src/main/lmStudioHandlers.test.ts` los casos de payload malformado y ausente verificando el error controlado y que `fetch` NUNCA es invocado; confirmar que los tests existentes (payloads válidos) pasan sin modificaciones. Verificar: `npx vitest run src/main/lmStudioHandlers.test.ts` en Verde.
- [x] 2.2 En `src/main/index.ts`: (a) `setWindowOpenHandler` delega a `shell.openExternal` solo si `isOpenExternalUrlAllowed(details.url)`; (b) registrar `mainWindow.webContents.on('will-navigate', ...)` que cancela con `event.preventDefault()` y registra `console.warn('[Navegación] Cancelada: ...')` toda navegación cuyo origen no coincida con el origen local (dev: origen de `ELECTRON_RENDERER_URL`; prod: `file://`); (c) añadir `devTools: is.dev` en `webPreferences`. Verificar: `npm run typecheck:node` sin errores.
- [x] 2.3 Escribir test de lectura de fuente en `src/main/windowNavigationGuard.test.ts` (o archivo adyacente) verificando el cableado de `index.ts`: contiene `will-navigate`, `devTools: is.dev`, `isOpenExternalUrlAllowed(` y `shell.openExternal` solo tras la guarda (patrón `index-csp.test.ts`). Verificar: `npx vitest run src/main/windowNavigationGuard.test.ts` en Verde.

## 3. Verificación de no regresión

- [x] 3.1 Ejecutar `npm run typecheck` (node + web) confirmando 0 errores. Verificar: ambos typechecks limpios.
- [x] 3.2 Ejecutar la suite completa `npm test` y confirmar 0 regresiones: los tests existentes de `lmStudioHandlers`, `lmStudioHostValidator`, `sessionPermissions`, `preloadExposure`, `index-csp` y el resto de la suite pasan sin modificaciones. Verificar: suite completa en verde.
- [x] 3.3 Ejecutar `npm run lint` con 0 errores y `npx prettier --write` sobre los archivos modificados según el formato del proyecto. Verificar: lint limpio y formato aplicado.

## Workflow follow-up

- Verificación manual recomendada tras el apply: `npm run dev` y confirmar que la app arranca, navega a su origen sin cancelaciones espurias y que un `window.open('javascript:alert(1)')` desde la consola del renderer no abre nada.
