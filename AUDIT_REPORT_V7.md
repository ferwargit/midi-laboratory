# Informe de Auditoría de Seguridad e Integridad IT — V7
**Fecha:** Octubre 2024
**Herramientas:** REA (*Reverse Engineer Anything*) + OpenCode (GLM-5.3-Flash)
**Alcance:** `src/main`, `src/preload`, superficie IPC, permisos de sesión Web MIDI / SysEx, CSP y empaquetado.
**Método:** Análisis estático sintáctico REA (`analyze_javascript_application`) + Inspección directa de fuentes.

---

## 1. Métricas del Grafo REA
- **Evidence ID:** `ev_1e0fe497ec8e665852aa89cfc78ee119d283040e728011ada45630529ed6d7dd`
- **Árbol extraído SHA-256:** `579444df...`
- **Métricas:**
  - Browser Windows: `1`
  - Explicit Web Preferences: `3`
  - Preload Entrypoints: `1`
  - Context Bridge APIs: `2`
  - IPC Operations: `4`
  - IPC Literal Channels: `2`
  - IPC Main Handlers: `2`
  - IPC Renderer Listeners: `0`
  - Sender Validation Observations: `0`

---

## 2. Resumen Ejecutivo de Hallazgos

| ID | Hallazgo | Riesgo |
|---|---|---|
| **F1** | `sandbox: false` en la ventana principal | Medio |
| **F2** | `window.electron` expone `ipcRenderer` crudo (canales arbitrarios) | Medio |
| **F3** | `electronAPI.process.env` filtra todas las variables de entorno al renderer | Medio |
| **F4** | Sin `setPermissionRequestHandler` / `setPermissionCheckHandler` para Web MIDI/SysEx | Medio |
| **F5** | Handlers IPC aceptan `baseUrl` arbitraria del renderer → SSRF desde el proceso main | Medio |
| **F6** | CSP con `style-src 'unsafe-inline'` | Bajo |
| **F7** | `shell.openExternal` con URL sin validación profunda | Bajo |
| **F8** | Sin handler `will-navigate` | Bajo |
| **F9** | `devTools` no deshabilitado explícitamente en producción | Bajo |
| **F10**| Payload IPC messages `unknown[]` sin validación de esquema | Bajo |

**Aspectos positivos verificados:** `contextIsolation: true`, `nodeIntegration: false` (default), `webSecurity` habilitado, contenido 100% local, scripts y recargas bloqueados en producción por `@electron-toolkit/utils`, y solicitud de Web MIDI en frontend con `{ sysex: false }`.

---

## 3. Hallazgos Detallados y Evidencia Técnica

### F1 — `sandbox: false` en la ventana principal (Riesgo: Medio)
- **Ubicación:** `src/main/index.ts:15-25`
- **Evidencia:**
  ```typescript
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,
    contextIsolation: true
  }
  ```
- **Análisis:** Decisión documentada en código para evitar colisión de `window.customAPI` con el fallback a `fetch()`. No obstante, `sandbox: false` permite que el script de preload mantenga acceso total a APIs de Node.
- **Remediación:** Eliminar el fallback a `fetch()` en `lmStudioService.ts` para que todo viaje por IPC canónico, permitiendo encender `sandbox: true`.

---

### F2 — `window.electron` expone `ipcRenderer` crudo (Riesgo: Medio)
- **Ubicación:** `src/preload/index.ts:21-27`
- **Evidencia:** Exposición de `electronAPI` (`@electron-toolkit/preload`).
- **Análisis:** Anti-patrón de Electron. Otorga al Renderer capacidades arbitrarias de `send`, `invoke` y `on` en cualquier canal sin control de sender.
- **Remediación:** Exponer únicamente `customAPI` y eliminar `exposeInMainWorld('electron', electronAPI)`.

---

### F3 — Fuga de `process.env` completa al Renderer (Riesgo: Medio)
- **Ubicación:** `@electron-toolkit/preload/dist/index.cjs:72-82`
- **Evidencia:** `get env() { return { ...process.env }; }`
- **Análisis:** Permite al Renderer leer todas las variables de entorno de Windows/Node del host.
- **Remediación:** Se resuelve automáticamente al remover `electronAPI` (F2).

---

### F4 — Sin gestión explícita de permisos de sesión para Web MIDI/SysEx (Riesgo: Medio)
- **Ubicación:** `src/main/index.ts` (Ausencia verificada).
- **Evidencia en Frontend:** `src/renderer/src/hooks/useMidi.ts:196-211` (`requestMIDIAccess({ sysex: false })`).
- **Análisis:** Electron aprueba por omisión cualquier permiso solicitado. Si una librería externa solicita `sysex: true` o permisos de cámara/red, se otorgan en silencio.
- **Remediación:** Configurar en `app.whenReady()`:
  ```typescript
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'midi')
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'midi')
  ```

---

### F5 — Handlers IPC aceptan `baseUrl` arbitraria (SSRF desde Main) (Riesgo: Medio)
- **Ubicación:** `src/main/index.ts:47-57` y `index.ts:84-99`
- **Evidencia:** `const host = baseUrl || LM_STUDIO_DEFAULT_HOST`
- **Análisis:** El Renderer puede enviar cualquier URL remota o interna, y el proceso Main ejecuta el `fetch`, evadiendo la Content Security Policy (CSP).
- **Remediación:** Validar que la URL apunte exclusivamente a `http://127.0.0.1:1234` o suprimir el parámetro `baseUrl` fijándolo en el Main.

---

### F6 a F10 — Endurecimientos Menores (Riesgo: Bajo)
- **F6 (CSP):** `style-src 'unsafe-inline'` requerido por Tailwind v4. Riesgo bajo aceptable.
- **F7 (URLs externas):** `shell.openExternal` valida con `startsWith('http')`. Se sugiere robustecer usando `new URL(details.url).protocol`.
- **F8 (Navegación):** Ausencia de handler `will-navigate` para anular redirecciones in-frame.
- **F9 (DevTools):** No explícito en config, aunque mitigado en producción por `@electron-toolkit/utils`.
- **F10 (Tipado IPC):** `messages: unknown[]` sin validación de esquema en la recepción de IPC.

---

## 4. Prioridades de Remediación

1. **Fase 1 (Inmediata / Alto valor):** `F4` (Permisos MIDI) y `F5` (Validación de endpoint LM Studio).
2. **Fase 2 (Superficie Preload):** `F2` + `F3` (Eliminar `electronAPI`) y `F1` (`sandbox: true`).
3. **Fase 3 (Higiene general):** `F7`, `F8`, `F10`.
