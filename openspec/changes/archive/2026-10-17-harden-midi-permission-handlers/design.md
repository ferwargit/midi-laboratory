# Design

## Context

Ver `proposal.md` — Why. Estado actual relevante para el enfoque:

- `src/main/index.ts` era un archivo único (141 líneas en el estado pre-implementación; hoy ~180 líneas) que importa `app, shell, BrowserWindow, ipcMain, session` de Electron y registra los handlers IPC dentro del módulo. La configuración de la app vive en `app.whenReady()` (hoy líneas 162-176), que ejecuta `setAppUserModelId`, el registro de la política de permisos, el hook `browser-window-created` y `createWindow()`.
- La ventana usa la sesión por defecto (no se especifica `partition` en `webPreferences`), por lo que `session.defaultSession` es la sesión efectiva de la ventana principal.
- El renderer solicita `navigator.requestMIDIAccess({ sysex: false })` en `src/renderer/src/hooks/useMidi.ts:201`; ese archivo NO se modifica.
- La suite de tests es Vitest con `include: ['src/**/*.{test,spec}.{ts,tsx}']` y entorno `jsdom` (`vitest.config.ts:7-8`): cualquier archivo `*.test.ts` bajo `src/main/` ya es recogido por la suite sin cambiar configuración.

## Goals / Non-Goals

**Goals:**

- Política de permisos **enforzada en el proceso Main** (no solo declarada en el renderer), aplicada antes de que exista cualquier ventana.
- Un único punto de definición de la política (allowlist) compartido por el handler de solicitudes y el de comprobaciones, sin riesgo de deriva entre ambos.
- Política testeable con la infraestructura Vitest existente, sin arrancar Electron.
- Denegaciones observables en consola del proceso Main para auditoría.

**Non-Goals:**

- No se modifica `webPreferences` (`sandbox: false`, `contextIsolation: true` quedan como están — hallazgos F1/F2 de la auditoría V7, fuera de alcance).
- No se eliminan los handlers IPC de LM Studio ni se valida `baseUrl` (hallazgo F5, cambio separado).
- No se añade UI de consentimiento de permisos: la política es allowlist estático.
- No se modifica el renderer ni `useMidi.ts`.

## Decisions

### D1 — Registrar ambos handlers en `session.defaultSession` dentro de `app.whenReady()`, antes de `createWindow()`

La ventana principal usa la sesión por defecto (sin `partition`), y `app.whenReady()` es el punto canónico de inicialización del proceso Main en este código base. Registrando los handlers **antes** de la primera llamada a `createWindow()` se elimina la carrera en la que una solicitud de permiso podría llegar antes de que exista la política.

*Alternativa considerada:* registrar por-`webContents` en el hook `browser-window-created` (patrón que ya usa el `optimizer`). Se descarta: es más complejo, deja un intervalo sin política entre la creación del `webContents` y el registro, y no cubre webContents que no sean ventanas.

### D2 — Política como predicado puro en módulo propio (`src/main/sessionPermissions.ts`)

Se extrae la política a un módulo sin dependencias de Electron:

```ts
// src/main/sessionPermissions.ts (borrador de diseño)
export const ALLOWED_SESSION_PERMISSIONS = new Set<string>(['midi', 'midiSysex'])

export function isSessionPermissionAllowed(permission: string): boolean {
  return ALLOWED_SESSION_PERMISSIONS.has(permission)
}
```

`index.ts` queda como cableado fino: ambos handlers delegan en el predicado y registran la denegación. El conjunto `ALLOWED_SESSION_PERMISSIONS` es la expresión **explícita** de la política: `midi` y `midiSysex` son los únicos permisos autorizados, y su inclusión es una decisión deliberada documentada — la verificación manual con hardware real (tarea 3.3, Roland FP-8 / interfaz MIDI en Windows) demostró que denegar `midiSysex` aborta la inicialización de la interfaz física en Chromium/Electron, dejando la lista de puertos vacía y la aplicación en estado OFFLINE. Todo permiso no listado se deniega (fail-closed).

*Alternativa considerada:* comparación literal inline (`permission === 'midi'`) en dos lambdas dentro de `index.ts`. Se descarta: duplica la política en dos sitios (deriva entre request/check) y no es testeable sin mockear Electron.

### D3 — Cobertura de ambos puntos de entrada de permisos

Electron expone la política por dos vías: solicitudes asíncronas (`setPermissionRequestHandler`) y comprobaciones síncronas (`setPermissionCheckHandler`). Ambas se registran con el mismo predicado (D2). Cubrir solo la primera dejaría la comprobación síncrona en el comportamiento por defecto (aprobar), reabriendo el hallazgo F4 por otra puerta.

### D4 — Registro de denegaciones con `console.warn` en el proceso Main

Cada denegación emite `console.warn` con el nombre del permiso y, cuando están disponibles, el origen del solicitante (`details.requestingUrl` en el handler de solicitudes, `requestingOrigin` en el de comprobaciones) y el indicador `details.isMainFrame` (p. ej. `[Permisos] Denegado: 'media' (origen: http://localhost:5173, marco principal: true)`). Se elige `console.warn` sobre un sistema de logging dedicado porque el proceso Main de este proyecto no tiene infraestructura de logging y la auditoría V7 solo exige observabilidad.

### D5 — Estrategia de pruebas: unidad pura + test de cableado con mock ligero

1. **Test unitario del predicado** (`src/main/sessionPermissions.test.ts`): aprueba `midi` y `midiSysex`; deniega `media`, `geolocation`, `notifications`, `clipboard-read`, `camera`, `microphone` y cadena desconocida. Corre en Vitest sin mocks (jsdom no interfiere: la función es pura).
2. **Test de cableado** (`src/main/permissionHandlers.test.ts`): mockea `electron` (`session.defaultSession`) con `vi.mock` para verificar que `app.whenReady()` registra ambos handlers y que el handler registrado aprueba `midi` y `midiSysex` y deniega `media` (invocando el callback capturado). El mock se limita a la superficie `app`, `session`, `BrowserWindow`, `ipcMain`, `shell` que `index.ts` importa al cargar.

*Alternativa considerada:* test E2E con la app real (`electron-vite preview` + Playwright). Se descarta para este cambio: el costo de orquestación no compensa para una política de dos handlers; queda como posible verificación manual post-implementación.

**Cobertura de los escenarios de runtime con hardware físico:** los dos escenarios de la spec que dependen de hardware real — "Enumeración de puertos con hardware conectado" y "Detección de hardware Roland/Korg sigue operativa" — quedan cubiertos mediante la verificación manual de la tarea 3.3, completada exitosamente por el usuario con el Roland FP-8 / interfaz MIDI conectada en Windows: puertos enumerados en runtime, aplicación en estado ONLINE y consola del Main sin denegaciones de `midi` ni `midiSysex`. No se duplican en tests automatizados (jsdom no puede ejercitar hardware USB).

### D6 — La política no consulta al usuario ni distingue por webContents

El allowlist es estático y global a la sesión. No se usa el parámetro `webContents` ni `details` para decidir (solo para el log). *Racional:* la app es de una sola ventana con contenido 100% local; una política dependiente del origen añade superficie de error sin beneficio. La autorización de `midiSysex` es deliberada y está motivada por evidencia de runtime (handshake de hardware Roland/Korg); retirarla en el futuro sería una modificación deliberada del allowlist con su propio requisito de spec.

## Risks / Trade-offs

- **[Riesgo] `midiSysex` autorizado permite al renderer enviar mensajes SysEx al hardware (manipulación profunda del dispositivo: patches, bancos, memory dumps).** → Mitigación: el contenido del renderer es 100% local con CSP estricta (`script-src 'self'`), la autorización es requisito funcional del handshake Roland/Korg (verificado en runtime, tarea 3.3) y cualquier uso futuro de SysEx queda sujeto a los requisitos de spec del subsistema MIDI. El fallo-closed se mantiene para todo permiso no listado.
- **[Riesgo] Denegación por defecto rompe una capacidad futura no prevista (p. ej. notificaciones del sistema).** → Mitigación: el fallo es explícito y registrado en consola (`console.warn`), y la remediación es una línea en `ALLOWED_SESSION_PERMISSIONS` más su requisito de spec. Fail-closed es la postura correcta para una app local.
- **[Riesgo] El mock de Electron en el test de cableado se desincroniza con la API real (Electron 43).** → Mitigación: el mock cubre solo los símbolos que `index.ts` importa en el módulo; si la importación cambia, el test falla por import faltante, no en silencio. El test unitario del predicado (D5.1) no depende de Electron en absoluto.
- **[Trade-off] La cobertura V8 no incluye `src/main/**` (`vitest.config.ts:15-20`).** → Los tests nuevos correrán y contarán para el pass/fail de la suite, pero no para el porcentaje de cobertura. Se deja así para minimizar el cambio; extender el `include` de cobertura es una mejora opcional documentada en tasks.
- **[Trade-off] `setPermissionCheckHandler` recibe firmas distintas según versión de Electron (con/sin `details`).** → Mitigación: el predicado solo consume `permission` (primer/según-posición argumento estable); el cableado usa la firma documentada de Electron 43 y el test de cableado fija el contrato.

## Migration Plan

1. Añadir `src/main/sessionPermissions.ts` (política pura) + su test unitario.
2. Cablear en `src/main/index.ts` dentro de `app.whenReady()` antes de `createWindow()`.
3. Añadir test de cableado con mock de Electron.
4. Ejecutar `npm test` (suite completa en verde, incluidos los tests existentes de `useMidi`), `npm run typecheck` y `npm run lint`.
5. Verificación manual opcional: arrancar `npm run dev`, confirmar que el teclado Roland/Korg sigue detectándose y que la consola del Main no muestra denegaciones de `midi`.

**Rollback:** revertir el commit — el cambio es aditivo (dos registros de handler + un módulo nuevo); ninguna migración de datos ni cambio de esquema.

## Open Questions

Ninguna. La política (allowlist = midi + midiSysex) quedó revisada y fijada tras la evidencia de runtime de la tarea 3.3.
