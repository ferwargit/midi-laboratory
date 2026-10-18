# Design

## Context

`src/preload/index.ts` (33 líneas) importa `electronAPI` de `@electron-toolkit/preload` y lo expone en `window.electron` tanto por `contextBridge.exposeInMainWorld` (rama con `contextIsolation`) como por asignación directa (rama sin ella); `src/preload/index.d.ts` declara `electron: ElectronAPI` en la interfaz global `Window`. La inspección con grep confirma que `window.electron`/`electronAPI`/`ElectronAPI` solo aparecen en esos dos archivos: ningún módulo del Renderer los usa. El puente `customAPI` (2 métodos, mapeo 1:1 con los handlers `lm-studio:*`) es la única superficie que el Renderer consume. El proyecto ya tiene tests de proceso Main y de preload-adyacentes en Vitest sin Electron (`src/main/*.test.ts`), y un patrón de test de contrato de tipos/archivos (`index-csp.test.ts`, `lmStudioHostSync.test.ts`).

## Goals / Non-Goals

**Goals:**

- Superficie de exposición del preload reducida al mínimo necesario: solo `customAPI`.
- Tipos globales `Window` coherentes con la exposición real (solo `customAPI`).
- Regresión blindada por tests: ausencia de `window.electron` + contratos de `customAPI` intactos.
- Cero cambios en Main, renderer o handlers: el cambio queda contenido en `src/preload/` más su test.

**Non-Goals:**

- No se modifica el puente `customAPI` ni sus firmas (los contratos del requisito "Puente customAPI del Preload" se preservan).
- No se abordan otros hallazgos de la auditoría (F1, F4–F7 ya remediados o en otros cambios).
- No se elimina la dependencia del paquete `@electron-toolkit/preload` de `package.json` (solo se deja de usar su export `electronAPI`; la limpieza de la dependencia es una decisión separada).
- No se cambia la configuración `sandbox: false` / `contextIsolation: true` de `BrowserWindow` (documentada como decisión deliberada en `src/main/index.ts`).

## Decisions

1. **Eliminación completa de ambas ramas de exposición de `electronAPI`** (la de `contextBridge.exposeInMainWorld('electron', ...)` y la asignación de respaldo `window.electron = ...` en la rama sin `contextIsolation`). Alternativa descartada: exponer un `electronAPI` recortado — mantener cualquier forma de `window.electron` conserva superficie innecesaria y contradice el hallazgo F2; el Renderer no la usa.

2. **El preload queda con un único bloque de exposición**: `if (process.contextIsolated) { contextBridge.exposeInMainWorld('customAPI', customAPI) } else { window.customAPI = customAPI }`. Se conserva la estructura try/catch y la rama de respaldo existentes para no alterar el comportamiento en entornos sin `contextIsolation` (defensivo, ya presente). Alternativa descartada: asumir `contextIsolation` siempre activo y borrar la rama else — cambiaría el comportamiento defensivo existente más allá del alcance de F2/F3.

3. **Limpieza de imports en ambos archivos**: `import { electronAPI } from '@electron-toolkit/preload'` en `index.ts` y `import { ElectronAPI } from '@electron-toolkit/preload'` en `index.d.ts` se eliminan (quedan sin uso; el lint los marcaría). El import de `contextBridge, ipcRenderer` de `electron` en `index.ts` se conserva (lo usa `customAPI`). **Nota técnica (detectada en implementación):** al eliminar el import de `ElectronAPI`, `index.d.ts` deja de ser un módulo externo y el bloque `declare global` deja de aplicar la augmentación de `Window` (el Renderer pierde el tipo `Window.customAPI`, con errores TS2339 en `typecheck:web`). El archivo DEBE permanecer como módulo externo añadiendo `export {}` al final, para que la augmentación global siga funcionando sin errores TS2339.

4. **Test de regresión en `src/preload/preloadExposure.test.ts`** que verifica el contrato observable leyendo el fuente del preload (patrón `index-csp.test.ts`, que valida el fuente de `index.html`): (a) el fuente NO contiene `exposeInMainWorld('electron'` ni asignación `window.electron`; (b) el fuente de `index.d.ts` NO declara `electron:` ni importa `ElectronAPI`; (c) el fuente SÍ expone `customAPI` en ambas ramas. Alternativa considerada: mockear `electron`/`contextBridge` y ejecutar el preload en Vitest — acoplamiento frágil al entorno de Electron por un contrato que es estático (qué se expone), no dinámico; el patrón de lectura de fuente ya está establecido en el proyecto y es determinista.

5. **Verificación de no dependencia vía typecheck, no vía grep en tests**: la eliminación de `electron: ElectronAPI` de los tipos globales hace que cualquier uso residual de `window.electron` en el Renderer falle `typecheck:web`; eso es la verificación canónica (el compilador, no un grep). Los tests de la suite completa cubren el comportamiento en runtime.

6. **Los contratos de `customAPI` se blindan por los tests existentes**: `lmStudioService.test.ts` y `lmStudioService.mock.test.ts` ya verifican que el Renderer consume `window.customAPI` con esas firmas; cualquier alteración accidental del puente los rompería. No se duplican esas aserciones en el nuevo test (se verifica exposición, no semántica de red).

## Risks / Trade-offs

- [Uso oculto de `window.electron` no detectado por grep (acceso dinámico, ej. `window['electron']`)] → Mitigación: el typecheck tras eliminar la declaración de tipos detecta usos tipados; el acceso dinámico sin tipar es improbable en este códigobase (grep de `window.electron` y `window['electron']` en la fase de tareas) y el runtime degradaría visiblemente.
- [Algún flujo futuro necesite APIs de Electron en el Renderer] → Mitigación: la política del proyecto es exponer puentes mínimos y nombrados (como `customAPI`); cualquier necesidad futura debe añadirse como método explícito de un puente, no reexponiendo `electronAPI`.
- [Regresión en el arranque de la app si la rama sin `contextIsolation` cambia de semántica] → Mitigación: la estructura `if (process.contextIsolated) ... else ...` se conserva idéntica; solo se elimina la línea de `electron`.
- [El test de lectura de fuente puede quedar obsoleto si cambia el formato del preload] → Mitigación: las aserciones buscan patrones semánticos (`exposeInMainWorld('electron'`, `window.electron =`), no líneas exactas; un cambio legítimo de formato no las rompe, un reintento de exposición sí.

## Migration Plan

Sin migración de datos ni despliegue especial: cambio contenido en el preload. Rollback trivial (revert del commit). Orden: test de regresión primero (Rojo, porque la exposición aún existe) → eliminación en `index.ts` → limpieza en `index.d.ts` → Verde → typecheck node+web → suite completa.

## Open Questions

(ninguna)
