# Tasks

## 1. Validador de host (TDD)

- [x] 1.1 Escribir tests unitarios en `src/main/lmStudioHostValidator.test.ts` para `resolveLmStudioHost(baseUrl?)` ANTES de la implementación: baseUrl ausente/vacía → host canónico `http://127.0.0.1:1234`; hosts válidos `127.0.0.1`/`localhost` con puertos válidos (1234, 8080, 1, 65535) y con/sin esquema http/https; rechazo de IPs privadas/públicas (`192.168.1.10`, `10.0.0.5`, `172.16.0.1`, `8.8.8.8`), dominios remotos (`evil.example.com`), protocolos no HTTP (`file:`, `ftp:`), URLs malformadas (`not-a-url`, `127.0.0.1:1234` sin esquema) y puertos inválidos. Verificar: `npx vitest run src/main/lmStudioHostValidator.test.ts` falla en Rojo.
- [x] 1.2 Implementar `src/main/lmStudioHostValidator.ts` con `resolveLmStudioHost(baseUrl?: string): { ok: true; host: string } | { ok: false; reason: string }` usando `new URL()` y comparación exacta de `hostname` contra el allowlist fijo (`127.0.0.1`, `localhost`), protocolo `http:`/`https:` y constante `LM_STUDIO_DEFAULT_HOST = 'http://127.0.0.1:1234'`. Verificar: `npx vitest run src/main/lmStudioHostValidator.test.ts` en Verde.

## 2. Integración en los handlers IPC

- [x] 2.1 Integrar la validación en `lm-studio:check-models`: implementar el handler `handleCheckModels(baseUrl?)` en `src/main/lmStudioHandlers.ts` (módulo sin dependencia de `electron`, decisión 7 de design.md) resolviendo el host con `resolveLmStudioHost(baseUrl)` antes de crear `AbortController`/timer; en fallo, registrar `console.warn('[LM Studio] baseUrl rechazada: ...')` y devolver `null` sin ejecutar `fetch()`; en éxito, usar el host resuelto por el validador. Registrar el handler en `src/main/index.ts` como punto de cableado limpio (`ipcMain.handle` delegando en el módulo). Verificar: `npm run typecheck:node` sin errores.
- [x] 2.2 Integrar la validación en `lm-studio:chat-completion`: implementar el handler `handleChatCompletion(payload)` en `src/main/lmStudioHandlers.ts` con el mismo patrón; en fallo, registrar el rechazo y devolver `{ success: false, error: <reason> }` sin ejecutar `fetch()`; en éxito, usar el host resuelto. Registrar el handler en `src/main/index.ts` como punto de cableado limpio. Verificar: `npm run typecheck:node` sin errores.
- [x] 2.3 Escribir tests de cableado en `src/main/lmStudioHandlers.test.ts`: con `global.fetch` mockeado, verificar que una `baseUrl` rechazada produce `null` (check-models) / `{ success: false, error }` (chat-completion) y que `fetch` NUNCA es invocado; y que una `baseUrl` válida (o ausente) invoca `fetch` contra el host correcto. Si `index.ts` no es importable por su dependencia de `electron`, extraer las funciones de handler a un módulo sin dependencia de `electron` (decisión 7 de design.md). Verificar: `npx vitest run src/main/lmStudioHandlers.test.ts` en Verde.

## 3. Verificación de no regresión

- [x] 3.1 Ejecutar la suite completa `npm test` y confirmar que los tests existentes de LM Studio en el frontend (`lmStudioService.test.ts`, `lmStudioService.mock.test.ts`, `appConfig.test.ts`, `index-csp.test.ts`) y los de proceso Main (`sessionPermissions.test.ts`, `permissionHandlers.test.ts`) pasan sin modificaciones.
- [x] 3.2 Ejecutar `npm run typecheck` (node + web) y `npm run lint` confirmando cero errores; ejecutar `npx prettier --write` sobre los archivos modificados según el formato del proyecto.
