# Proposal

## Why

La auditoría de seguridad identificó el hallazgo **F1**: `src/main/index.ts` construye el `BrowserWindow` con `sandbox: false` en `webPreferences`. El comentario en código documenta que se mantuvo así porque `sandbox: true` interfería con el fallback a `fetch()` directo de `lmStudioService.ts` (líneas 48 y 91), el cual además colisionaba con la CSP de `index.html`. Habiendo asegurado los handlers IPC contra SSRF (F5, cambio `harden-lm-studio-ipc-ssrf`) y limpiado el preload (F2/F3, cambio `remove-electron-api-exposure`), el canal canónico y exclusivo hacia LM Studio es `window.customAPI`: el fallback a `fetch()` ya no tiene justificación funcional ni de seguridad, y su existencia obliga a mantener el renderer sin sandbox y con una apertura CSP innecesaria.

## What Changes

- En `src/renderer/src/domain/ai/lmStudioService.ts`:
  - Eliminar el mecanismo de fallback directo a `fetch()` en `getLoadedModelId()` (líneas 44–58) y `sendChat()` (líneas 91–109).
  - `window.customAPI` pasa a ser la única vía canónica de comunicación para `checkModels` y `chatCompletion`.
  - Si `window.customAPI` no está disponible o falla, retornar un error controlado sin intentar `fetch()` directo: `getLoadedModelId()` devuelve `null`; `sendChat()` lanza `Error` (que el circuit breaker convierte en `algorithmic_fallback`, preservando el contrato de degradación existente).
- En `src/main/index.ts`:
  - Cambiar `sandbox: false` a `sandbox: true` en `webPreferences` de `createWindow()`.
  - Limpiar el comentario obsoleto que justificaba `sandbox: false`.
- En `src/renderer/index.html`:
  - Eliminar `http://127.0.0.1:1234` de la directiva `connect-src` (existía únicamente para el fallback a `fetch()`; mantenerlo permitiría al Renderer evadir la validación SSRF del Main accediendo a LM Studio por HTTP directo).
- En los tests:
  - Actualizar `src/renderer/src/index-csp.test.ts` para reflejar la nueva postura: `sandbox: true` en el Main y CSP sin dependencia del fallback a `fetch()`.
  - Adaptar los tests de `lmStudioService` (unitarios y mocks) para eliminar las pruebas del fallback a fetch directo, migrando su valor semántico (parseo de respuesta, transmisión multi-turn) al canal IPC.
- **BREAKING (interno, no observable para el usuario):** desaparece el transporte híbrido IPC+fetch; la política de transporte pasa a ser IPC exclusivo.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `06-local-ai-integration`: tres requisitos cambian a nivel de spec:
  - "Handlers IPC de Electron con AbortController y Timeouts": el `BrowserWindow` MUST construirse con `contextIsolation: true` y `sandbox: true` (antes `sandbox: false`).
  - "Método Centralizado sendChat (Patrón DRY)": la política de transporte pasa de híbrida (IPC con fallback a fetch) a IPC exclusivo; sin `window.customAPI` el servicio degrada con error controlado, nunca con `fetch()` directo.
  - "Content-Security-Policy Sincronizada con la Configuración": la CSP deja de permitir el host de LM Studio en `connect-src` (el Renderer no tiene salida de red directa hacia LM Studio); el test de regresión verifica la nueva postura.

## Impact

- **Código afectado:** `src/renderer/src/domain/ai/lmStudioService.ts` (eliminación del fallback), `src/main/index.ts` (`sandbox: true` + comentario), `src/renderer/index.html` (CSP), `src/renderer/src/index-csp.test.ts`, `src/renderer/src/domain/ai/lmStudioService.test.ts`, `src/renderer/src/domain/ai/lmStudioService.mock.test.ts`.
- **Comportamiento observable para el usuario:** idéntico en el camino feliz (IPC primario ya era el canal usado); en degradación, el `algorithmic_fallback` sigue operando igual (el circuit breaker ya trataba el fallo de IPC como fallo contable).
- **Seguridad:** el renderer queda aislado por el sandbox de Chromium (proceso de utilidad sin acceso directo a Node), se elimina la apertura CSP `connect-src` hacia LM Studio y se cierra la vía de evadir la validación SSRF del Main por HTTP directo.
- **Riesgo principal:** `sandbox: true` impone restricciones al preload (sin Node.js completo); el preload actual solo usa `contextBridge`, `ipcRenderer` y `process.contextIsolated`, todos compatibles con sandbox. Verificado por inspección; la suite y el arranque de la app lo confirmarán.
- **Sin dependencias nuevas:** se elimina código; no se añade ninguno.
