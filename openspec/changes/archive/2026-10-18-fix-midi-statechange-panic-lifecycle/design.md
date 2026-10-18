# Design

## Context

`useMidi.ts` gestiona el ciclo de vida de `MIDIAccess` con dos efectos que la auditoría V8 (F11.2, F11.3) marca como frágiles:

1. **Suscripción `statechange` por propiedad** (`access.onstatechange = ...`, líneas 208-210): el cleanup del efecto (líneas 216-218) solo marca `isMounted = false`; el handler queda adjunto al objeto `MIDIAccess`, que sobrevive al hook. Inocuo hoy (montaje único en `App.tsx:53`), pero frágil ante cualquier remontaje futuro.
2. **Efecto de pánico con dependencia `[sendAllNotesOff]`** (líneas 221-225): `sendAllNotesOff` es un `useCallback` con deps `[midiAccess, selectedOutputId, isDeviceDisconnected]`, por lo que muta de identidad en cada transición de dispositivo. El cleanup de React se ejecuta en cada cambio de identidad → tormenta de ~180 mensajes MIDI (5 CC + 88 NoteOff × canal activo) hacia el puerto antiguo en cada reconexión o cambio de salida.

Restricciones que condicionan el diseño:

- La secuencia canónica del pánico y los canales `[1, 10]` están especificados en `openspec/specs/01-midi-audio-hardware/spec.md` y NO cambian.
- El hook ya usa el patrón ref-para-callbacks (`onNoteOnRef`, `onNoteOffRef`, `onDisconnectedRef`, `onReconnectedRef`, líneas 80-90) para desacoplar efectos de identidades inestables; el fix debe seguir el mismo patrón establecido.
- El mock de `MIDIAccess` en `useMidi.test.ts` solo expone `onstatechange` como propiedad; debe ampliarse para soportar `addEventListener`/`removeEventListener`.

## Goals / Non-Goals

**Goals:**

- Registro/desregistro simétrico del listener `statechange` vía `addEventListener`/`removeEventListener` sobre la misma referencia de handler.
- Pánico de desmontaje disparado únicamente en el desmonte final del hook, invocando siempre la versión vigente de `sendAllNotesOff` a través de una ref.
- Cero ráfagas de pánico en transiciones de dispositivo (cambio de puerto, reconexión, fluctuación de conexión).
- Cobertura de regresión en `useMidi.test.ts` para los tres comportamientos nuevos.
- Suite completa (`npm test`), `typecheck` y `lint` en verde.

**Non-Goals:**

- No se modifica la secuencia canónica del pánico ni los canales activos.
- No se cambia la API pública del hook (`UseMidiReturn`).
- No se abordan otros hallazgos de la auditoría V8 (F12, re-render granularity, etc.).
- No se refactoriza `sendAllNotesOff` en sí (su lógica interna permanece intacta).

## Decisions

### D1 — `addEventListener`/`removeEventListener` con handler nombrado estable

En el efecto de solicitud de acceso, el handler anónimo asignado por propiedad se sustituye por una función nombrada `handleStateChange` registrada con `access.addEventListener('statechange', handleStateChange)`. El cleanup invoca `access.removeEventListener('statechange', handleStateChange)` con la **misma referencia**.

- **Por qué:** `removeEventListener` solo desregistra si la referencia coincide exactamente (mismo handler, misma fase/captura). Un handler definido inline dentro del `.then()` y otro definido en el cleanup no coincidirían; definir `handleStateChange` una vez dentro del efecto y capturarlo en el closure del cleanup garantiza la simetría.
- **Alternativa descartada:** mantener `onstatechange` y anularlo en cleanup (`access.onstatechange = null`). Funcionalmente equivalente hoy, pero la auditoría recomienda explícitamente el patrón de eventos estándar y es el que escala si en el futuro se registran múltiples listeners.
- **Nota:** el guard `isMounted` del handler se conserva; con el desregistro simétrico es redundante en la práctica, pero es defensa en profundidad barata ante eventos en vuelo.

### D2 — Ref mutable `sendAllNotesOffRef` + efecto de desmontaje con deps `[]`

Se añade `const sendAllNotesOffRef = useRef(sendAllNotesOff)` sincronizado en cada render (o en un efecto sin guard de montaje, siguiendo el patrón existente de las refs de callbacks), y el efecto de pánico pasa a:

```ts
useEffect(() => {
  return (): void => {
    sendAllNotesOffRef.current()
  }
}, [])
```

- **Por qué:** el pánico de desmontaje es un comportamiento de ciclo de vida del hook completo, no de una configuración concreta de puertos. La ref desacopla la identidad del callback de la identidad del efecto: el cleanup siempre invoca la última versión (con el `midiAccess`/`selectedOutputId` vigentes al momento del desmonte), y el efecto no se re-ejecuta nunca durante la vida del hook.
- **Alternativa descartada:** `useEffect(() => () => sendAllNotesOff(), [sendAllNotesOff])` con un flag `isUnmountingRef` para distinguir desmonte real de re-ejecución. Rechazada por añadir estado extra y una condición sutil propensa a errores; la ref logra el mismo resultado con el patrón ya establecido en el archivo.
- **Detalle de sincronización:** la ref se actualiza en un `useEffect` dedicado sin array de dependencias, declarado inmediatamente después de la definición de `sendAllNotesOff` — y no en el efecto de sincronización de refs de las líneas 85-90 —, manteniendo un único punto de actualización por render siguiendo el patrón de las refs de callbacks del hook. Motivo: `eslint-plugin-react-hooks` v7 (lints del React Compiler) prohíbe acceder a una variable antes de su declaración dentro de un efecto (`react-hooks/immutability`) y, al hacerlo, omite la preservación de la memoización manual del componente (`react-hooks/preserve-manual-memoization`); alojar la sincronización tras la declaración del `useCallback` cumple ambas reglas limpiamente.

### D3 — Estrategia de pruebas sobre el mock existente

El mock de `MIDIAccess` en `createMockMidiAccess()` se amplía con `addEventListener`/`removeEventListener` como `vi.fn()` que registran el handler en una propiedad interna, de modo que el test de desconexión existente (que dispara `access.onstatechange?.()`) siga funcionando y se puedan afirmar:

- `removeEventListener` invocado con `'statechange'` y la misma referencia registrada por `addEventListener` (desregistro simétrico).
- Que tras desmontar (`unmount()`), ninguna invocación posterior del handler dispara `refreshPorts`.
- Que una transición de dispositivo simulada (vaciar puertos + disparar `statechange` + reconectar) NO produce mensajes de pánico en el puerto (`mockOutput.send` sin CC 120/123/64/121, sin Pitch Bend, sin NoteOff masivo), mientras que el `unmount()` final sí produce la secuencia canónica completa sobre `[1, 10]`.

## Risks / Trade-offs

- **[Riesgo] El pánico ya no se emite al cambiar de puerto de salida.** Comportamiento intencional (era el defecto), pero un usuario que cambie de interfaz de salida con notas sostenidas podría arrastrar notas colgadas al hardware nuevo. → _Mitigación:_ el watchdog de notas colgadas (6000 ms) y el botón de Pánico manual cubren ese caso; el cambio se limita a eliminar la emisión automática no intencional.
- **[Riesgo] El mock de tests deja de exponer `onstatechange` como propiedad asignable.** Los tests existentes que disparan `access.onstatechange?.()` dejarían de ver el handler. → _Mitigación:_ el mock ampliado mantiene un puente de compatibilidad (el `addEventListener` del mock registra el handler y el test lo invoca a través de la referencia registrada), y la suite completa debe pasar en verde antes de cerrar.
- **[Trade-off] La ref `sendAllNotesOffRef` añade una indirección.** Coste mínimo (una asignación por render) frente al beneficio de eliminar ~180 mensajes espurios por transición; sigue el patrón idiomático ya presente en el hook.
- **[Trade-off] `removeEventListener` no existe en mocks parciales.** Si algún otro test o entorno construye un `MIDIAccess` falso sin `addEventListener`, el efecto fallaría. → _Mitigación:_ verificación con `typecheck` + suite completa; el único mock del repo es el de `useMidi.test.ts`.

## Migration Plan

Cambio interno de un solo archivo de implementación + su test. Sin migración de datos, sin cambios de configuración, sin despliegue especial. Rollback trivial (revert del commit).

## Open Questions

(ninguna)
