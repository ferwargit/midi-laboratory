# Proposal

## Why

La auditoría de seguridad REA V7 señaló cuatro oportunidades de endurecimiento menor en el proceso Main: **F7** (`shell.openExternal` valida esquemas con `startsWith` en lugar de `new URL()`, susceptible a bypass por prefijos malformados), **F8** (ausencia de handler `will-navigate`, permitiendo navegaciones in-frame no autorizadas si el renderer se ve comprometido), **F9** (DevTools no está explícitamente deshabilitado según el entorno en `webPreferences`) y **F10** (el payload de `lm-studio:chat-completion` recibe `messages: unknown[]` sin validación básica de esquema, pudiendo propagar estructuras malformadas al backend de LM Studio).

## What Changes

- En `src/main/index.ts`:
  - `setWindowOpenHandler`: validar `details.url` con `new URL(details.url)` verificando que el protocolo sea estrictamente `https:` o `http:`; si falla el parseo o el protocolo no coincide, denegar la acción sin invocar `shell.openExternal` (F7).
  - Registrar `mainWindow.webContents.on('will-navigate', ...)`: cancelar con `event.preventDefault()` cualquier navegación cuyo origen no coincida con el origen local de la aplicación (dev server en desarrollo, `file://` en producción) (F8).
  - `webPreferences`: configurar explícitamente `devTools: is.dev` para deshabilitar las herramientas de desarrollo en producción (F9).
- En `src/main/lmStudioHandlers.ts` (vía un validador puro nuevo):
  - Validación de esquema defensiva del payload de `lm-studio:chat-completion`: `model` debe ser string no vacío y `messages` un arreglo no vacío de objetos con `role` (string) y `content` (string). Si falla, retornar `{ success: false, error: 'Payload de mensajes inválido' }` sin ejecutar `fetch` (F10).
- Tests unitarios para la validación de URLs/navegación del Main y para el validador de esquema del payload (casos válidos e inválidos/malformados).
- Suite completa, typecheck y lint sin regresiones.

## Capabilities

### New Capabilities

- `09-electron-window-hardening`: política de endurecimiento de la ventana del Main — validación estricta de esquemas en la apertura de URLs externas, prevención de navegaciones in-frame no autorizadas y DevTools deshabilitados en producción.

### Modified Capabilities

(ninguna — F10 añade una validación nueva sin alterar los contratos existentes del handler, por lo que se registra como requisito ADDED en `06-local-ai-integration`)

## Impact

- **Código afectado:** `src/main/index.ts` (windowOpenHandler, will-navigate, devTools), nuevo módulo puro de guardas de navegación/URL en `src/main/` (testeable sin Electron, patrón `sessionPermissions.ts`/`lmStudioHostValidator.ts`), `src/main/lmStudioHandlers.ts` (integración del validador de payload), nuevo validador puro de payload y sus tests.
- **Comportamiento observable:** URLs externas con esquemas no HTTP(S) o malformadas ya no llegan a `shell.openExternal`; navegaciones in-frame a orígenes ajenos se cancelan; DevTools quedan inaccesibles en producción; payloads malformados de chat-completion devuelven el error controlado sin tráfico de red.
- **Sin cambios en el camino feliz:** URLs https/http legítimas se abren igual; la navegación al propio origen de la app (dev server / file://) sigue permitida; payloads válidos fluyen idénticos.
- **Sin dependencias nuevas:** la validación usa `URL` (API estándar de Node/Electron).
- **Riesgo bajo:** el renderer actual no navega in-frame a orígenes externos ni abre ventanas con esquemas raros; los cambios son fail-closed sobre rutas hoy inexistentes.
