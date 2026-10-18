# Tasks

## 1. Test de regresión de exposición (TDD)

- [x] 1.1 Escribir `src/preload/preloadExposure.test.ts` ANTES de la implementación (patrón de lectura de fuente de `index-csp.test.ts`): (a) el fuente de `src/preload/index.ts` NO contiene `exposeInMainWorld('electron'` ni asignación `window.electron =`; (b) el fuente de `src/preload/index.d.ts` NO contiene la declaración `electron:` en `Window` ni el import de `ElectronAPI`; (c) el fuente de `index.ts` SÍ expone `customAPI` en ambas ramas (`exposeInMainWorld('customAPI'` y `window.customAPI =`). Verificar: `npx vitest run src/preload/preloadExposure.test.ts` falla en Rojo (la exposición aún existe).
- [x] 1.2 Confirmar por inspección (grep) que no existe uso de `window.electron` ni `window['electron']` en `src/renderer` y registrar el resultado en la descripción del commit de la tarea 2.1. Verificar: grep sin coincidencias fuera de `src/preload/`.

## 2. Eliminación de la exposición y saneo de tipos

- [x] 2.1 En `src/preload/index.ts`: eliminar `contextBridge.exposeInMainWorld('electron', electronAPI)`, la asignación de respaldo `window.electron = electronAPI` y el import de `electronAPI` desde `@electron-toolkit/preload`; conservar la estructura `if (process.contextIsolated) ... else ...`, el try/catch y el import de `contextBridge, ipcRenderer`. Verificar: `npx vitest run src/preload/preloadExposure.test.ts` en Verde.
- [x] 2.2 En `src/preload/index.d.ts`: eliminar la declaración `electron: ElectronAPI` de la interfaz global `Window` y el import de `ElectronAPI`; mantener intacta la declaración de `customAPI` con sus firmas. Verificar: `npx vitest run src/preload/preloadExposure.test.ts` sigue en Verde.

## 3. Verificación de no regresión

- [x] 3.1 Ejecutar `npm run typecheck` (node + web) y confirmar que compilan sin errores: ningún componente o servicio del Renderer depende de `window.electron`. Verificar: ambos typechecks con 0 errores.
- [x] 3.2 Ejecutar la suite completa `npm test` y confirmar que los tests existentes del servicio LM Studio del frontend (`lmStudioService.test.ts`, `lmStudioService.mock.test.ts`) y el resto de la suite pasan sin modificaciones. Verificar: suite completa en verde.
- [x] 3.3 Ejecutar `npm run lint` con 0 errores y `npx prettier --write` sobre los archivos modificados según el formato del proyecto. Verificar: lint limpio y formato aplicado.
