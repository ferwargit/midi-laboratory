# Capability: Electron Session Security Policy

## Purpose

Define la política de permisos de sesión de Electron aplicada en el proceso Main de `midi-laboratory`: el allowlist canónico de permisos de Web APIs que gobierna tanto las solicitudes asíncronas como las comprobaciones síncronas de `session.defaultSession`, con Web MIDI y SysEx permitidos (requeridos por el handshake de hardware Roland/Korg) y todo lo demás denegado por defecto.

## Requirements

### Requirement: Allowlist de permisos en solicitudes de sesión

El proceso Main MUST (DEBE) registrar, dentro de `app.whenReady()` y sobre `session.defaultSession`, un handler de solicitudes de permisos (`setPermissionRequestHandler`) que autorice **únicamente** los permisos `midi` y `midiSysex` y deniegue cualquier otro permiso solicitado.

#### Scenario: Solicitud de Web MIDI sin SysEx es autorizada

- **WHEN** el renderer invoca `navigator.requestMIDIAccess({ sysex: false })` y Electron emite la solicitud de permiso `midi` hacia el proceso Main
- **THEN** el handler responde con callback de aprobación (`true`) y el acceso MIDI se concede

#### Scenario: Solicitud de Web MIDI con SysEx es autorizada

- **WHEN** cualquier código del renderer invoca `navigator.requestMIDIAccess({ sysex: true })` y Electron emite la solicitud de permiso `midiSysex`
- **THEN** el handler responde con callback de aprobación (`true`) y el acceso con exclusividad de sistema se concede

#### Scenario: Solicitud de permiso no relacionado es denegada

- **WHEN** cualquier webContents solicita un permiso distinto de `midi` y `midiSysex` (p. ej. `media`, `geolocation`, `notifications`, `clipboard-read`, `camera`, `microphone`)
- **THEN** el handler responde con callback de denegación (`false`) y el permiso no se concede

### Requirement: Autorización de SysEx para el handshake de hardware MIDI

La política de permisos MUST (DEBE) incluir `midiSysex` en el allowlist porque el handshake y la enumeración inicial de interfaces MIDI físicas (Roland FP-8 / UM-ONE, teclados Korg) en Chromium/Electron lo requieren: al denegarlo, Chromium aborta la inicialización de la interfaz y la lista de puertos queda vacía. Esta autorización es una decisión deliberada documentada, no un permiso por omisión.

#### Scenario: Enumeración de puertos con hardware conectado

- **WHEN** la aplicación arranca con un adaptador MIDI USB conectado y Chromium completa el handshake de la interfaz física
- **THEN** las solicitudes y comprobaciones de `midiSysex` son autorizadas y los puertos de entrada/salida quedan enumerados

### Requirement: Cobertura de comprobaciones síncronas de permisos

El proceso Main MUST (DEBE) registrar sobre `session.defaultSession` un handler de comprobación de permisos (`setPermissionCheckHandler`) que aplique la misma política del allowlist: aprobar únicamente `midi` y `midiSysex` y denegar cualquier otra comprobación.

#### Scenario: Comprobación síncrona de Web MIDI es aprobada

- **WHEN** Chromium realiza una comprobación síncrona de permiso `midi` contra la sesión por defecto
- **THEN** el handler responde con aprobación (`true`)

#### Scenario: Comprobación síncrona de SysEx es aprobada

- **WHEN** Chromium realiza una comprobación síncrona de permiso `midiSysex` contra la sesión por defecto
- **THEN** el handler responde con aprobación (`true`)

#### Scenario: Comprobación síncrona de permiso ajeno es denegada

- **WHEN** Chromium realiza una comprobación síncrona de cualquier permiso distinto de `midi` y `midiSysex` contra la sesión por defecto
- **THEN** el handler responde con denegación (`false`)

### Requirement: No degradación del acceso MIDI existente

La política de permisos MUST (DEBE) preservar el flujo actual de detección de hardware: la solicitud `navigator.requestMIDIAccess({ sysex: false })` del hook de MIDI del renderer MUST seguir resolviendo con éxito y la enumeración de puertos de entrada/salida (adaptadores Roland/Korg) MUST continuar funcionando sin cambios en el renderer.

#### Scenario: Detección de hardware Roland/Korg sigue operativa

- **WHEN** la aplicación arranca con un adaptador MIDI USB conectado (p. ej. Roland UM-ONE) y el hook del renderer solicita acceso MIDI sin SysEx
- **THEN** el acceso se concede, los puertos se enumeran y el estado del hook reporta conexión exitosa

### Requirement: Registro auditable de denegaciones

El proceso Main MUST (DEBE) emitir una salida de diagnóstico (registro en consola del proceso Main) cada vez que deniega una solicitud de permiso, incluyendo el nombre del permiso denegado, para que las denegaciones sean observables durante auditorías y depuración.

#### Scenario: Denegación queda registrada

- **WHEN** el handler deniega una solicitud de permiso distinto de `midi` y `midiSysex`
- **THEN** el proceso Main emite un mensaje de diagnóstico que identifica el permiso denegado
