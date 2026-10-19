# Design

## Context

Ver `proposal.md` — Why. Estado actual verificado en el código:

- `useMidi.ts` (`sendNote`): articula la nota y, si `channel === MELODIC_CHANNEL`, ejecuta `setActiveStimulusNotes` (alta) y en el temporizador de liberación la retira. El gate actual de `visualCueMode` vive en `App.tsx:529` (filtro de prop, posterior al `setState`).
- `App.tsx:59-62` monta `useMidi({ onNoteOn, enableSoftwareThru: true })` sin información del modo visual; `visualCueMode` es estado local de `App` (`'blind'` default).
- `useRepertoireTrainer.ts:250-260`: efecto con deps `[]` que asigna `stimulusScheduler.onBeatTick` incondicionalmente; el callback hace `setActiveBeatIndex(beatIndex)` + `setTimeout(140)` de apagado. `visualBeatEnabled` (default `true`) es estado interno del hook, alternado desde `RepertoireView.tsx:232`.
- `StimulusScheduler` guarda la invocación con `if (this.onBeatTick)` (`stimulusScheduler.ts:81,90`): el desregistro es seguro y ya es el patrón del cleanup actual.
- El scheduler es un singleton de módulo; `onBeatTick` es una propiedad opcional pública.

## Goals / Non-Goals

**Goals:**

- Cero `setState` espurio en la raíz por notas melódicas cuando las pistas visuales están en modo `blind`.
- Cero actualizaciones de estado por pulso de metrónomo cuando el indicador visual de beat está desactivado.
- Preservar intactos el comportamiento acústico y la precisión visual cuando las pistas están activadas.

**Non-Goals:**

- Memoizar las vistas de entrenador (R7) — consolidación posterior.
- Cambiar la semántica de `VisualCueMode` ('blind' | 'assisted') ni la ubicación del estado en `App`.
- Alterar `StimulusScheduler`, contratos MIDI o la máquina de estados de los entrenadores.

## Decisions

### D1 — Flag `visualCuesEnabled` como opción de `useMidi` (no parámetro por invocación)

`UseMidiOptions` gana `visualCuesEnabled?: boolean` (default `true`); `App` pasa `visualCueMode === 'assisted'`. Alternativas descartadas: pasar el flag en cada llamada a `sendNote` (rompería la firma usada por todos los entrenadores y el scheduler) o que `useMidi` importe el modo desde un store global (acoplamiento innecesario para un único consumidor).

### D2 — Ref espejo sincronizada; el flag NO entra en las deps de `sendNote` ni del `useMemo` del retorno

El flag se copia a un `visualCuesEnabledRef` sincronizado en cada render (mismo patrón que las refs de callbacks `onNoteOnRef`/`onNoteOffRef`, efecto sin guard de montaje). `sendNote` lee la ref en el momento de la invocación. Razones:

- Preserva la identidad estable de `sendNote` y del retorno lograda por `stabilize-hook-return-identities`: alternar el modo visual (acción infrecuente de UI) no invalida la cascada de memoización.
- El flag es configuración de consumo, no un valor reactivo expuesto por el hook: no aparece en `UseMidiReturn` ni en sus deps.
- Riesgo de desfase de un frame en el instante exacto del toggle: despreciable (una nota como máximo) y auto-corregido por la liberación con cortocircuito (D3).

### D3 — Gate en el alta; liberación con cortocircuito (bail-out)

- Alta: `if (isMelodicStimulus && visualCuesEnabledRef.current) setActiveStimulusNotes(...)`.
- Liberación programada: `setActiveStimulusNotes((prev) => (prev.includes(noteNumber) ? prev.filter(...) : prev))` — al retornar `prev` sin cambios, React hace bail-out por `Object.is` y no re-renderiza.

Esto cubre el toggle a mitad de vuelo sin estados residuales: nota articulada con pistas activadas y desactivadas después → la liberación la retira (un re-render legítimo); nota nunca registrada → la liberación no provoca `setState` alguno.

### D4 — F12.5: desregistro del callback visual gobernado por `visualBeatEnabled` (opción del informe R3)

El efecto de `onBeatTick` pasa a depender de `[visualBeatEnabled]`:

- `visualBeatEnabled === true` → registra el callback vigente (alta + apagado temporizado a 140 ms, semántica actual).
- `visualBeatEnabled === false` → `stimulusScheduler.onBeatTick = undefined` (desregistro).
- El cleanup del efecto desregistra la propia referencia (simetría add/remove ya establecida).
- **Ajuste de implementación (verificado en apply):** la limpieza de `activeBeatIndex` al desactivar NO vive en el cuerpo del efecto sino en el manejador de evento `setVisualBeatEnabled` (única vía de desactivación), porque la regla `react-hooks/set-state-in-effect` prohíbe el `setState` síncrono en efectos. Semánticamente equivalente: el estado se limpia en el mismo evento de desactivación.

Alternativa descartada: gate dentro del callback con ref (`if (!ref.current) return`) — dejaría el callback registrado y al scheduler invocándolo en cada beat; el desregistro elimina la invocación misma y es la recomendación explícita de R3. El scheduler tolera `undefined` (guard verificado en `stimulusScheduler.ts:81,90`).

### D5 — Estrategia de pruebas

- `useMidi.test.ts`:
  - *Blind*: montar con `visualCuesEnabled: false`; contador de renders del consumidor + `sendNote` melódica → `activeStimulusNotes` vacío, mensajes MIDI emitidos, contador de renders sin incremento atribuible a la pista visual (y liberación programada sin re-render espurio, con fake timers).
  - *Assisted*: `visualCuesEnabled: true` (default) → alta al articular y retiro al liberar (comportamiento ya testado, se pinan de nuevo junto al gate).
  - *Toggle a mitad de vuelo*: nota articulada con pistas activadas, desactivar pistas, liberar → nota retirada; nota articulada con pistas desactivadas → liberación sin mutación.
  - **Ajuste de implementación (verificado en apply):** para la liberación programada, la aserción fiable de "sin actualización de estado" es la **estabilidad de identidad del retorno** (`toBe`) más el valor sin cambios, no el contador de renders del wrapper: React hace bail-out al actualizar un estado con el mismo valor, pero puede re-ejecutar el componente una vez más (comportamiento documentado). El contador de renders se usa solo donde no hay `setState` alguno (el alta con gate).
- `useRepertoireTrainer.test.ts`:
  - *Desactivado*: `setVisualBeatEnabled(false)` → `stimulusScheduler.onBeatTick === undefined`, `activeBeatIndex === null`; con fake timers, pulsos del metrónomo continuo emiten ticks acústicos (mock de `onPlayMetronomeTick`) sin mutar `activeBeatIndex`.
  - *Activado*: `visualBeatEnabled: true` → callback registrado; pulso → `activeBeatIndex` toma el índice y se apaga a ~140 ms (fake timers).
  - *Toggle en curso*: desactivar con el metrónomo corriendo → limpieza inmediata y ningún pulso posterior lo reactiva.
- Suite completa: `npm test`, `npm run typecheck`, `npm run lint` con 0 regresiones.

## Risks / Trade-offs

- **[Flag desincronizado en el instante del toggle]** → Mitigación: ref espejo sincronizada en cada render (D2); desfase máximo de un frame, auto-corregido por D3.
- **[Nota residual en `activeStimulusNotes` si el toggle ocurre entre alta y liberación]** → Mitigación: la liberación con cortocircuito la retira; el pánico (`sendAllNotesOff`) y el cambio de modo de `App` (`handleSelectMode` ya invoca `sendAllNotesOff`) cubren el caso extremo.
- **[Re-registro del callback visual en cada toggle]** → Coste despreciable (asignación de propiedad sobre el singleton); la simetría add/remove evita listeners zombi.
- **[Regresión en la precisión del LED al tocar el efecto]** → Mitigación: la rama activada replica la semántica actual (deps `[]` → `[visualBeatEnabled]` no altera el comportamiento registrado); pruebas con fake timers pinan encendido/apagado.

## Migration Plan

Un solo paso, sin migración de datos ni de API disruptiva: la opción nueva es opcional con default que preserva el comportamiento. Rollback trivial (revert del commit).

## Open Questions

(ninguna)
