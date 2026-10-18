# Proposal

## Why

La auditoría de rendimiento V8 (`AUDIT_REPORT_V8.md`, hallazgo F11) identificó dos fragilidades en el ciclo de vida de Web MIDI dentro de `src/renderer/src/hooks/useMidi.ts`:

- **F11.2 — Listener zombi de `statechange`:** el handler se asigna por propiedad directa (`access.onstatechange = ...`, líneas 208-210) y el cleanup del efecto (líneas 216-218) solo marca `isMounted = false`; el listener permanece adjunto al objeto `MIDIAccess`, que vive durante toda la página. Hoy es inocuo porque el hook se monta una sola vez en la raíz, pero el patrón es frágil: cualquier remontaje futuro en una vista desmontable dejaría un handler zombi por acceso.
- **F11.3 — "Panic storms" en transiciones de dispositivo:** el efecto de pánico de desmontaje (líneas 221-225) declara `[sendAllNotesOff]` como dependencia. Como `sendAllNotesOff` muta de identidad al cambiar `midiAccess`, `selectedOutputId` o `isDeviceDisconnected`, el cleanup se ejecuta en **cada transición de dispositivo** — no solo al desmontar — emitiendo una tormenta de ~180 mensajes MIDI (5 CC + 88 NoteOff × canal activo) hacia el puerto antiguo. Es un efecto colateral no intencional que satura el bus MIDI en cada reconexión o cambio de salida.

## What Changes

- **Registro simétrico del listener `statechange` (F11.2):** migrar la suscripción en `useMidi.ts` de asignación por propiedad (`access.onstatechange = ...`) a `access.addEventListener('statechange', handleStateChange)`, con desregistro simétrico `access.removeEventListener('statechange', handleStateChange)` en el cleanup del efecto.
- **Desacoplamiento del pánico de desmontaje (F11.3):** mantener una referencia mutable `sendAllNotesOffRef` sincronizada con la última versión de `sendAllNotesOff`, y configurar el efecto de limpieza global con dependencias vacías `[]` invocando `sendAllNotesOffRef.current()`, de modo que el pánico de seguridad se emita únicamente al desmontar el hook y NO ante cambios de puerto, reconexiones o cambios de estado de conexión.
- **Cobertura de regresión:** nuevas pruebas unitarias en `useMidi.test.ts` que verifiquen (a) que `removeEventListener('statechange', ...)` se invoca al desmontar, (b) que cambiar de dispositivo o reconectar la interfaz NO dispara la ráfaga de `sendAllNotesOff`, y (c) que el pánico de seguridad sigue disparándose correctamente en el desmontaje final.
- **Sin cambios observables en el contrato existente:** la secuencia canónica del Pánico MIDI (CC 120/123/64/121, Pitch Bend centrado y 88 NoteOff por canal activo), los canales activos `[1, 10]` y la API pública del hook permanecen intactos.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `01-midi-audio-hardware`: el requisito de **Resiliencia de Hardware (Hotplugging)** incorpora garantías de ciclo de vida del listener `statechange` (registro vía `addEventListener` y desregistro simétrico en el cleanup); el requisito de **Procedimiento de Pánico MIDI** se enmienda para que el pánico de desmontaje se dispare únicamente en el desmonte final del hook, nunca en transiciones de dispositivo (cambio de puerto, reconexión o fluctuación de estado de conexión).

## Impact

- **Código afectado:**
  - `src/renderer/src/hooks/useMidi.ts` — efecto de solicitud de acceso MIDI (líneas 196-219: registro/cleanup de `statechange`) y efecto de pánico de desmontaje (líneas 221-225: dependencias y vía de invocación).
- **Tests afectados:**
  - `src/renderer/src/hooks/useMidi.test.ts` — el mock de `MIDIAccess` necesita exponer `addEventListener`/`removeEventListener`; se añaden pruebas de ciclo de vida y de no-ráfaga en transiciones.
- **Sin impacto en:** dependencias, API pública del hook, secuencia canónica del pánico, otros hooks o servicios. Sin cambios breaking.
