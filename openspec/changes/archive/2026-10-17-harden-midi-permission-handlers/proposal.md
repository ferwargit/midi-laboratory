# Proposal

## Why

La auditoría de seguridad V7 (hallazgo F4) verificó que `src/main/index.ts` no configura ningún handler de permisos de sesión: ni `session.setPermissionRequestHandler` ni `session.setPermissionCheckHandler`. El comportamiento por defecto de Electron es **aprobar automáticamente todas las solicitudes de permisos** cuando no hay handler configurado. Hoy el renderer pide Web MIDI con `sysex: false` (`useMidi.ts:201`), pero esa política vive solo en el código del renderer: cualquier código futuro que solicite permisos sensibles no relacionados (cámara, micrófono, geolocalización, notificaciones, clipboard) sería concedido silenciosamente, sin consentimiento del usuario ni punto único de auditoría en el proceso Main.

Además, la verificación manual con hardware real (tarea 3.3, Roland FP-8 / interfaz MIDI en Windows) demostró que denegar `midiSysex` aborta la inicialización de la interfaz física en Chromium/Electron, dejando la lista de puertos vacía y la aplicación en estado OFFLINE: el handshake de drivers Roland/Korg requiere tanto `midi` como `midiSysex`.

## What Changes

- Configurar `session.defaultSession.setPermissionRequestHandler` dentro de `app.whenReady()` en `src/main/index.ts`, con una lista de permitidos que autorice **únicamente** los permisos `midi` y `midiSysex` (este último requerido por el handshake de hardware Roland/Korg, evidencia de runtime de la verificación 3.3) y deniegue todo lo demás.
- Configurar `session.defaultSession.setPermissionCheckHandler` con la misma política, para cubrir también las comprobaciones síncronas de permisos (no solo las solicitudes).
- No se modifica el renderer: `useMidi.ts` ya solicita `navigator.requestMIDIAccess({ sysex: false })` y esa llamada debe seguir funcionando sin cambios (detección de hardware Roland/Korg intacta).
- No se añaden dependencias nuevas ni se altera la configuración de `webPreferences` existente (`sandbox: false`, `contextIsolation: true` quedan fuera del alcance de este cambio).

## Capabilities

### New Capabilities

- `08-electron-session-security`: Política de permisos de sesión de Electron aplicada en el proceso Main. Cubre el allowlist de permisos de Web APIs (Web MIDI y SysEx permitidos (SysEx requerido por el handshake de hardware Roland/Korg); todo lo demás denegado por defecto), la cobertura tanto de solicitudes asíncronas como de comprobaciones síncronas, y la garantía de que la política no degrada la detección de hardware MIDI existente.

### Modified Capabilities

<!-- Ninguna: 01-midi-audio-hardware describe el subsistema MIDI del renderer
     (useMidi, parser, filtro, scheduler), cuyo comportamiento no cambia. La
     política de permisos es un comportamiento nuevo del proceso Main. -->

## Impact

- **Código afectado:** `src/main/index.ts` (único archivo de producción modificado; se añade la configuración de handlers dentro de `app.whenReady()`).
- **Tests:** nuevo archivo de pruebas para los handlers de permisos (mockeando `session.defaultSession`); la suite existente (`npm test`) debe seguir en verde.
- **Renderer:** sin cambios; `useMidi.ts` y la detección de dispositivos Roland (UM-ONE) / Korg no se ven afectados.
- **Dependencias:** ninguna nueva.
- **Riesgo de regresión:** bajo — la política permite exactamente los permisos que la app usa (midi y midiSysex, este último requerido por el handshake de hardware) y el flujo de `requestMIDIAccess` no cambia.
