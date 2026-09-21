## Context

El cuerpo actual de `sendAllNotesOff` (src/renderer/src/hooks/useMidi.ts:98-130) es:

```ts
const sendAllNotesOff = useCallback(
  (channel = 1): void => {
    stimulusTimersRef.current.forEach((t) => clearTimeout(t))
    stimulusTimersRef.current.clear()
    hungNotesTimersRef.current.forEach((t) => clearTimeout(t))
    hungNotesTimersRef.current.clear()
    filterRef.current.clearHistory()
    setPressedNotes([])
    setActiveStimulusNotes([])

    if (!midiAccess || !selectedOutputId || isDeviceDisconnected) return
    const outputPort = midiAccess.outputs.get(selectedOutputId)
    if (!outputPort) return

    const chByte = (channel - 1) & 0x0f
    const ccStatus = 0xb0 | chByte

    try {
      outputPort.send([ccStatus, 120, 0])
      outputPort.send([ccStatus, 123, 0])
      outputPort.send([ccStatus, 64, 0])
      for (let note = 21; note <= 108; note++) {
        outputPort.send([0x80 | chByte, note, 0])
      }
    } catch (err) {
      console.warn('[useMidi] Error al emitir MIDI Panic:', err)
    }
  },
  [midiAccess, selectedOutputId, isDeviceDisconnected]
)
```

Dos hechos del sistema motivan el diseño:

1. **Dos canales vivos simultáneamente.** La spec canónica (`01-midi-audio-hardware/spec.md`, requisitos "Scheduler y Reloj Maestro Cuantizado" y "Aislamiento de Temporizadores por Clave Compuesta") fija `1 = Piano Acústico` y `10 = Metrónomo (GM)`; `sendNote` indexa temporizadores por clave `${channel}_${noteNumber}` precisamente porque la misma nota puede coexistir en ambos canales. El default `channel = 1` deja al Canal 10 fuera del pánico.
2. **El silenciamiento lógico no es silenciamiento físico.** `CC #123` (All Notes Off) es ignorado por muchos sintetizadores cuando el sostenido está activo, y `CC #120` (All Sound Off) no resetea controladores continuos. Por eso el barrido de 88 `Note Off` explícitos ya existe; falta el reset de controladores (`CC #121`) y el centrado de la rueda de pitch, que el Korg NS5R mantiene por canal.

## Goals / Non-Goals

**Goals:**

- H-01: que el pánico global (botón de UI, `clearAllPressedNotes`, cleanup de desmonte) alcance los canales activos `[1, 10]`.
- H-02: que la secuencia canónica incluya `CC #121` y `Pitch Bend` centrado, por canal.
- Preservar el silenciamiento selectivo por canal para `changeProgram`, que no debe barrer el Canal 10 al cambiar el programa de piano.
- Mantener la limpieza de estado interna atómica e incondicional (antes de cualquier envío y aunque no haya hardware).

**Non-Goals:**

- No se generaliza a los 16 canales: emisiones a canales no usados son tráfico inútil sobre un puerto MIDI físico de 31.25 kbaud y pueden resetear estados de otros timbres externos.
- No se introduce un mapa configurable de canales activos: el par `[1, 10]` es un invariant del subsistema declarado en spec; una constante nominal basta.
- No se toca `StimulusScheduler`, `sendNote` ni la máquina de watchdog: el pánico es un path de silenciamiento, no de planificación.
- No se persiste el estado de controladores ni se hace follow-up del `CC #1` (modulación) en la UI.

## Decisions

### Decisión 1: Default `undefined` = canales activos; número explícito = canal único

**Elección:** la firma sigue siendo `sendAllNotesOff(channel?: number)`. Si `channel === undefined`, se itera sobre `ACTIVE_MIDI_CHANNELS = [1, 10]`; si es un número, se silencia únicamente ese canal.

**Rationale:** esto es justo la semántica que ya asumen los llamadores: `clearAllPressedNotes()` (useMidi.ts:132-134), el cleanup de desmonte (useMidi.ts:208-212) y el Pánico de UI llaman sin argumento y esperan silencio total; `changeProgram` (useMidi.ts:289) pasa canal explícito y no debe arrastrar al Canal 10. Usar `undefined` como discriminante en vez de añadir un segundo parámetro booleano (`allChannels: boolean`) evita un flag ambiguo (`sendAllNotesOff(1, true)` es contradictorio). Los call-sites existentes no cambian.

**Alternativa considerada:** `sendAllNotesOff(channels: number[] = [1, 10])` — rechazada por romper la firma pública que consumen la spec canónica y los tests actuales (`sendAllNotesOff(1)`), y por permitir invocaciones no canónicas como `[3, 7]`.

### Decisión 2: Constante nominal `ACTIVE_MIDI_CHANNELS` en el propio hook

**Elección:** definir `const ACTIVE_MIDI_CHANNELS = [1, 10] as const` en el ámbito del módulo `useMidi.ts`, no en `DEFAULT_APP_CONFIG.midi`.

**Rationale:** `appConfig.ts` es la SSOT de **constantes temporales** (debounce, watchdog, retardos de auto-avance), no del mapa de canales GM — ese invariant ya vive en la spec `01-midi-audio-hardware` y en `StimulusScheduler`. Añadirlo a `MidiConfig` sugeriría que es calibrable por modalidad, lo cual es falso. Un `as const` literal en el hook mantiene el acoplamiento cero con el módulo de configuración. Si el Channel 10 dejara de usarse, el cambio sería de una línea más la edición de spec.

**Alternativa considerada:** importar `CHANNELS` desde `StimulusScheduler` — rechazada por crear una dependencia de hooks→scheduler en sentido inverso al establecido (el scheduler consume `playNoteFn`, no es consumido por el hook).

### Decisión 3: Secuencia canónica con `CC #121` y `Pitch Bend` centrado, en orden definido

**Elección:** por canal, emitir en este orden: `CC #120`, `CC #123`, `CC #64`, `CC #121`, `Pitch Bend [0xE0 | chByte, 0x00, 0x40]`, barrido `Note Off` 21→108.

**Rationale:**

- `CC #121` (Reset All Controllers) va **después** de los silenciadores y **antes** del barrido: debe encontrar los controladores ya apagados para dejar estados neutros, y el sintetizador lo aplica por canal. Cubre H-02 (modulación `CC #1`, breath, foot, etc.).
- `Pitch Bend` centrado `[0x00, 0x40]` (LSB 0, MSB 64) es el centro canónico MIDI; el Korg NS5R retiene el último pitch por canal. Ir después del reset porque algunos sintetadores tratan el pitch bend como controlador y el `CC #121` lo re-centra de todos modos; enviarlo explícito es idempotente y barato (3 bytes).
- El barrido de 88 `Note Off` se mantiene el último: es el único comando que algunos sintetizadores (incluido el NS5R en modo multi-timbral) obedecen de forma fiable, y deja el canal en silencio limpio tras el reset de controladores.

**Alternativa considerada:** enviar solo `CC #121` y omitir el barrido — rechazada: `CC #121` no apaga notas sonoras en muchos módulos GM, reintroduciría H-01 en silencio.

### Decisión 4: Orden canales `[1, 10]` y rendimiento del bus

**Elección:** iterar en el orden literal `[1, 10]`, canal de piano primero.

**Rationale:** el Canal 1 es el que más notas sueltas tiene (estímulos del ejercicio); silenciarlo primero corta el audio más molesto un milisegroso antes. El volumen total es `2 × (5 CC/PB + 88 Note Off) = 186 mensajes` por pánico — despreciable frente a un barrido de 88 actual, y solo ocurre en eventos discretos (pánico, desmonte), no en el bucle de práctica.

### Decisión 5: El try/catch envuelve todo el bucle de canales

**Elección:** mantener un único `try { ... } catch` alrededor del bucle completo de envíos, como hoy.

**Rationale:** si `outputPort.send` lanza (puerto desconectado a mitad de secuencia, buffer lleno), no se debe propagar al llamador — el Pánico puede dispararse desde un cleanup de React, donde una excepción aborta el desmonte. Que el catch envuelva todo el bucle significa que un fallo en el Canal 1 aborta el Canal 10; es aceptable porque el objetivo de H-01 es el caso común (puerto válido) y la contención ya está probada por el scenario "Error de envío contenido". Un try por canal añadiría ruido sin ganar observable nuevo.

## Risks / Trade-offs

- **[Reset de controladores en hardware no-GM]** → algunos controladores MIDI 1.0 legacy ignoran `CC #121`. Mitigación: el barrido de `Note Off` y `CC #120` siguen presentes, de modo que el silencio está garantizado; el reset es mejora, no dependencia.
- **[`Pitch Bend` centrado en sintetizadores con rango ampliado]** → módulos con pitch bend range ±12 pueden producir un click de re-afinación al centrar. Mitigación: es exactamente el estado neutro deseado para el siguiente ejercicio; el click es inaudible frente al barrido de 88 Note Off.
- **[Orden de llamadas en `changeProgram`]** → `sendAllNotesOff(channel)` ahora emite `CC #121`/`Pitch Bend` también en el path de cambio de programa. Es coherente (cambiar timbre con controladores heredados es el bug H-02 en miniatura) y no rompe el scenario "Program Change precedido de silenciamiento", que solo afirma que el pánico precede al `Program Change`.
- **[Duplicación de `Note Off` ya cubiertos por watchdog]** → los watchdog timers se cancelan antes de cualquier envío, de modo que no hay emisiones duplicadas tras el pánico.
- **[Deriva spec canónica vs delta]** → la delta solo reescribe el requisito "Procedimiento de Pánico MIDI"; los scenarios de requisitos adyacentes no se tocan. Mitigación: tarea explícita de sincronización a `openspec/specs/` y `openspec validate --strict`.

## Migration Plan

No requiere migración: la API pública no cambia y los call-sites existentes (`clearAllPressedNotes`, cleanup de desmonte, `changeProgram`) conservan su firma. Un rollback consiste en restaurar el cuerpo original de `sendAllNotesOff` y revertir la edición en `openspec/specs/01-midi-audio-hardware/spec.md`; los tests añadidos fallarían, señalando la regresión — que es precisamente su función.
