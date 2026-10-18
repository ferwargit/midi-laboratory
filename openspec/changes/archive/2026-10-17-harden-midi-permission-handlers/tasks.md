# Tasks

## 1. Política de permisos (módulo puro)

- [x] 1.1 Escribir el test unitario `src/main/sessionPermissions.test.ts` (TDD Red): afirmar que `isSessionPermissionAllowed('midi')` es `true` y que `midiSysex`, `media`, `geolocation`, `notifications`, `clipboard-read`, `camera`, `microphone` y una cadena desconocida devuelven `false`. Verificar con `npx vitest run src/main/sessionPermissions.test.ts` que el test falla porque el módulo no existe aún.
- [x] 1.2 Crear `src/main/sessionPermissions.ts` con `ALLOWED_SESSION_PERMISSIONS = new Set(['midi'])`, el predicado `isSessionPermissionAllowed(permission: string): boolean` y un comentario que documente la denegación explícita de `midiSysex` (TDD Green). Verificar con `npx vitest run src/main/sessionPermissions.test.ts` en verde.

## 2. Cableado en el proceso Main

- [x] 2.1 Escribir el test de cableado `src/main/permissionHandlers.test.ts` (TDD Red): mockear `electron` con `vi.mock` (superficie `app`, `session`, `BrowserWindow`, `ipcMain`, `shell`), capturar los callbacks registrados en `session.defaultSession.setPermissionRequestHandler` y `setPermissionCheckHandler`, y afirmar que ambos quedan registrados dentro de `app.whenReady()` y que el callback de solicitud aprueba `midi`, deniega `midiSysex` y deniega `media`. Verificar que el test falla antes de modificar `index.ts`.
- [x] 2.2 Cablear en `src/main/index.ts` dentro de `app.whenReady()` y antes de `createWindow()`: registrar `session.defaultSession.setPermissionRequestHandler` y `setPermissionCheckHandler` delegando en `isSessionPermissionAllowed`, con `console.warn` del permiso denegado (y `details.requestingUrl`/`details.isMainFrame` cuando estén disponibles) en cada denegación (TDD Green). Verificar con `npx vitest run src/main/permissionHandlers.test.ts` en verde.

## 3. Verificación de integración

- [x] 3.1 Ejecutar la suite completa `npm test` y confirmar que todos los tests existentes (incluidos los de `useMidi` y `index-csp`) siguen en verde junto con los dos archivos nuevos.
- [x] 3.2 Ejecutar `npm run typecheck` y `npm run lint` y confirmar cero errores en los archivos nuevos y modificados.
- [x] 3.3 Verificación manual opcional (design D5, alternativa E2E descartada): arrancar `npm run dev`, confirmar que el adaptador Roland/Korg se detecta (estado "Web MIDI conectado", puertos enumerados) y que la consola del proceso Main no registra denegaciones de `midi`. Completada por el usuario con hardware real (Roland FP-8 / interfaz MIDI en Windows): puertos enumerados en runtime, app en estado ONLINE, sin denegaciones de `midi` ni `midiSysex`.

## 4. Mejora opcional de cobertura

- [x] 4.1 Opcional: extender `coverage.include` en `vitest.config.ts` con `src/main/**` para que los archivos nuevos cuenten en el porcentaje de cobertura. Verificar que `npm run test:coverage` completa sin errores tras el cambio.

## 5. Corrección post-verificación 3.3 (SysEx requerido por hardware)

- [x] 5.1 Adaptar `src/main/sessionPermissions.test.ts` (TDD Red): 'midi' y 'midiSysex' devuelven `true`; los permisos no relacionados ('media', 'geolocation', 'notifications', 'clipboard-read', 'camera', 'microphone') y cadenas desconocidas siguen en `false`. Verificar que el test falla contra la política vigente.
- [x] 5.2 Actualizar `src/main/sessionPermissions.ts`: allowlist `['midi', 'midiSysex']` con comentario que documente la evidencia de runtime (Chromium aborta la enumeración de la interfaz sin SysEx) (TDD Green). Verificar con `npx vitest run src/main/sessionPermissions.test.ts` en verde.
- [x] 5.3 Adaptar `src/main/permissionHandlers.test.ts`: el handler de solicitudes aprueba 'midi' y 'midiSysex' y deniega 'media'; el handler de comprobaciones aplica la misma política; el test de registro de denegaciones usa un permiso no autorizado. Verificar con `npx vitest run src/main/permissionHandlers.test.ts` en verde.
- [x] 5.4 Actualizar artefactos de planificación (proposal, specs/08-electron-session-security, design) para reflejar la nueva política y la evidencia de runtime, manteniendo la coherencia entre artefactos.
- [x] 5.5 Ejecutar `npm test`, `npm run typecheck` y `npm run lint` en verde, y reportar el resultado para re-verificación manual con hardware encendido (3.3).

## 6. Remediación del informe de verificación

- [x] 6.1 Alinear artefactos (proposal.md Capabilities/Impact, design.md Context/D4/D5/Open Questions) con la política vigente y la evidencia de runtime de 3.3; documentar en D5 que los dos escenarios de hardware se cubren vía verificación manual.
- [x] 6.2 Incluir `isMainFrame` en el log de denegación de `src/main/index.ts` (TDD: adaptar primero la aserción de `permissionHandlers.test.ts`, confirmar Red, implementar, confirmar Green).
- [x] 6.3 Ejecutar `npm test`, `npm run typecheck` y `npm run lint` en verde y validar el cambio con `openspec validate`.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
