# Proposal

## Why

La auditoría de seguridad identificó los hallazgos **F2** y **F3**: `src/preload/index.ts` expone `electronAPI` (el objeto completo de `@electron-toolkit/preload`) en `window.electron` vía `contextBridge`, lo que pone a disposición del Renderer métodos arbitrarios de `ipcRenderer` (`send`, `sendSync`, `invoke`, `on`) y filtra la totalidad de las variables de entorno del proceso Main a través de `process.env`. La inspección del código confirma que el Renderer NO usa `window.electron` en ninguna parte de la aplicación (solo `window.customAPI` para LM Studio), por lo que la exposición es superficie de ataque pura sin contrapartida funcional.

## What Changes

- En `src/preload/index.ts`:
  - Eliminar `contextBridge.exposeInMainWorld('electron', electronAPI)`.
  - Eliminar la asignación de respaldo `window.electron = electronAPI` en la rama sin `contextIsolation`.
  - Exponer única y exclusivamente `window.customAPI` (con sus contratos `checkLmStudioModels` y `chatLmStudio` intactos).
  - Limpiar el import innecesario de `electronAPI` desde `@electron-toolkit/preload`.
- En `src/preload/index.d.ts`:
  - Eliminar la declaración `electron: ElectronAPI` de la interfaz global `Window`.
  - Eliminar el import de `ElectronAPI` (queda sin uso).
  - Mantener intacta la declaración de `customAPI: CustomAPI`.
- Tests de regresión que verifiquen que `window.electron` ya no se expone y que `window.customAPI` permanece disponible con sus contratos intactos.
- Verificación de que ningún componente o servicio del Renderer depende de `window.electron` (typecheck node + web en verde) y suite completa sin regresiones.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `06-local-ai-integration`: se añaden requisitos de minimización de la superficie de exposición del preload — el preload SOLO expone `customAPI` (nunca `electronAPI`/`window.electron`), los tipos globales `Window` declaran únicamente `customAPI`, y el Renderer no depende de `window.electron`. El requisito existente "Puente customAPI del Preload" no cambia: sus firmas y el mapeo 1:1 con los handlers IPC se preservan (este cambio refuerza su cláusula "exactamente el objeto customAPI").

## Impact

- **Código afectado:** `src/preload/index.ts` (eliminación de exposición e import), `src/preload/index.d.ts` (eliminación de declaración e import), nuevo test de regresión en `src/preload/` o `src/main/`.
- **Sin cambios de comportamiento funcional:** el Renderer solo usa `window.customAPI`, cuyos contratos no se alteran; la app es observablemente idéntica para el usuario.
- **Superficie de ataque:** desaparecen del contexto del Renderer los métodos arbitrarios de `ipcRenderer` y el acceso a `process.env` del Main que `electronAPI` filtraba.
- **Riesgo de regresión bajo:** verificado por inspección que no existe uso de `window.electron` en `src/renderer`; el typecheck (node + web) lo confirmará tras eliminar la declaración de tipos.
- **Sin dependencias nuevas:** se elimina un import; no se añade ninguno.
