# Informe de Auditoría de Rendimiento, Gestión de Recursos y React 19 — V8

**Fecha:** 18 de octubre de 2026
**Proyecto:** midi-laboratory
**Alcance:** `src/renderer/` — `hooks/useMidi.ts`, hooks de entrenador (`useTrainerCore`, `useSingleNoteTrainer`, `useRepertoireTrainer`), stores Zustand (`useDatabaseStore`, `useAnalyticsStore`, `useAiStore`), motor de audio/scheduling (`services/audio/stimulusScheduler.ts`, `services/midi/*`) y punto de consumo `App.tsx`.
**Exclusiones:** componentes visuales estáticos, SVG/iconos, estilos Tailwind y archivos de tests (los tests se consultaron únicamente como evidencia de contratos de memoización existentes).

**Metodología:** análisis estático profundo de las fuentes TypeScript del renderer. Las herramientas REA (`analyze_javascript_application`) operan sobre artefactos empaquetados (ASAR/bundles); al estar disponible el código fuente directamente, la auditoría se realizó sobre las fuentes con la misma granularidad estática y mayor fidelidad que la recuperación desde un bundle. Cada hallazgo cita archivo y líneas exactas verificadas por lectura directa.

---

## 1. Resumen Ejecutivo

| Área auditada | Veredicto | Hallazgos clave |
|---|---|---|
| Ciclo de vida `MIDIAccess` | ✅ Mayormente correcto, con 2 fragilidades | `onmidimessage` se limpia correctamente; `onstatechange` nunca se desregistra (listener zombi); efecto de pánico MIDI dispara "panic storms" en transiciones de dispositivo (F11) |
| Re-renders por ráfagas MIDI | ⚠️ Riesgo alto | Cada evento Note On/Off re-renderiza el árbol completo de `App`; la memoización existente está mayormente neutralizada por inestabilidad de identidades (F12) |
| `AudioContext` | ✅ No aplicable / sin fugas posibles | No existe ningún `AudioContext` en el renderer; el audio se emite íntegramente por MIDI a sintetizador GM externo. El scheduling es por `setTimeout`/`setInterval` con jitter de timer (F13) |
| Stores Zustand | ✅ Bien diseñados, 1 punto de degradación | El hot-path MIDI vive en estado local del hook, no en el store (decisión correcta); `reloadAllData` relee todas las tablas tras cada escritura, O(n) creciente (F14) |

**Diagnóstico principal:** el hallazgo de mayor impacto no es una fuga de recursos sino un problema de **granularidad de re-render**. La arquitectura actual concentra todo el estado MIDI de alta frecuencia (`pressedNotes`, `logs`, `activeStimulusNotes`) en el componente raíz `App`, y las cadenas de `useCallback`/`useMemo` dependen de objetos retornados como literales frescos en cada render (`useMidi`, `useTrainerCore`), lo que invalida la memoización en cascada y hace que cada pulsación de tecla reconcilie todo el árbol de componentes.

---

## 2. Hallazgos Detallados

### F11 — Ciclo de vida y fugas de MIDIAccess

#### F11.1 — `onmidimessage`: limpieza correcta ✅

`src/renderer/src/hooks/useMidi.ts:283-286`:

```ts
inputPort.onmidimessage = handleMessage
return (): void => {
  inputPort.onmidimessage = null
}
```

El listener de `midimessage` se anula en el cleanup del efecto, que se re-ejecuta al cambiar `selectedInputId` (cambio de ejercicio o de dispositivo). **Sin fuga.**

#### F11.2 — `onstatechange`: nunca se desregistra — listener zombi (impacto: bajo)

`useMidi.ts:208-210` asigna el handler como propiedad:

```ts
access.onstatechange = (): void => {
  if (isMounted) refreshPorts(access)
}
```

El cleanup (`useMidi.ts:216-218`) solo hace `isMounted = false`; el handler permanece adjunto al objeto `MIDIAccess`, que vive durante toda la página. Hoy es inocuo porque `useMidi` se monta una sola vez en la raíz (`App.tsx:53`) y el guard `isMounted` neutraliza el callback. Sin embargo, el patrón es frágil: si el hook se montara en una vista desmontable, cada remontaje dejaría un handler zombi por acceso. **Recomendación:** usar `access.addEventListener('statechange', ...)` + `removeEventListener` en el cleanup.

#### F11.3 — Efecto de pánico MIDI con dependencias: "panic storms" en transiciones de dispositivo (impacto: medio)

`useMidi.ts:221-225`:

```ts
useEffect(() => {
  return (): void => {
    sendAllNotesOff()
  }
}, [sendAllNotesOff])
```

`sendAllNotesOff` (`useMidi.ts:105-143`) cambia de identidad cada vez que cambian `midiAccess`, `selectedOutputId` o `isDeviceDisconnected`. Consecuencia: el cleanup se ejecuta en **cada transición de dispositivo**, no solo al desmontar, emitiendo un pánico completo (5 mensajes CC + 88 NoteOff × canal activo, `useMidi.ts:124-136`) hacia el puerto antiguo. Es un efecto colateral no intencional: una tormenta de ~180 mensajes MIDI por reconexión o cambio de salida.

#### F11.4 — Timers y estado residual: correcto ✅

Los watchdogs de notas colgadas (`hungNotesTimersRef`, `useMidi.ts:75, 251-261`) y los timers de estímulo (`stimulusTimersRef`, `useMidi.ts:76, 320-348`) se purgan vía `sendAllNotesOff` en el desmontaje (`useMidi.ts:107-111`). El log está acotado a 35 entradas (`useMidi.ts:102`), evitando crecimiento ilimitado. `filterRef` (`useMidi.ts:72-74`) no se limpia explícitamente pero se recolecta con el hook.

---

### F12 — Frecuencia de actualización y re-renders (React 19)

#### F12.1 — Cada evento Note On/Off re-renderiza el árbol completo de `App` (impacto: alto en CPU de render)

El flujo por tecla pulsada es: `handleMessage` → `setPressedNotes` (`useMidi.ts:263-265`) + `addLog` (`useMidi.ts:266-271`) → dos `setState` en el componente raíz. React 18/19 auto-agrupa ambos en **un solo render**, pero ese render reconcilia todo `App`: TopBar, alertas, la vista activa, el dock y el modal (`App.tsx:525-603`). Con ráfagas de acordes (p. ej. 10 notas/s) son 10 reconciliaciones completas/s. `pressedNotes` solo lo consume `PianoKeyboard`, y `logs` solo `StudioBottomDock` — ninguno justifica re-render global.

#### F12.2 — `React.memo(StudioBottomDock)` neutralizado (impacto: medio)

`StudioBottomDock.tsx:210` memoiza el componente, pero recibe:

- `logs`: array nuevo en cada evento (`useMidi.ts:102`).
- `onOpenResetModal`: arrow function inline en `App.tsx:592` (`onOpenResetModal={(): void => setIsResetModalOpen(true)}`) → identidad nueva en cada render.

El memo nunca cortocircuita.

#### F12.3 — Cascada de memoización muerta por objetos retornados como literales frescos (impacto: alto, sistémico)

- `useTrainerCore` retorna un objeto literal nuevo en cada render (`useTrainerCore.ts:531-576`).
- En `useSingleNoteTrainer`, todo `useCallback` que depende de `core` se recrea en cada render: `triggerNextQuestion` (`useSingleNoteTrainer.ts:229`, deps `[core, strategy, onPlayStimulus]`), `startSession` (`:288-296`), `stopSession` (`:311-319`), `handleUserNotePlayed` (`:344-392`), etc.
- El `useMemo` gigante final (`useSingleNoteTrainer.ts:429-512`) incluye esos callbacks en sus deps → **se recalcula en cada render**, y el objeto `trainer` pasado a las vistas (`App.tsx:549-585`) tiene identidad nueva siempre.
- Lo mismo ocurre con `midi` (literal fresco, `useMidi.ts:353-370`): `playTonalContextMidi` (`App.tsx:87`, deps `[midi]`) y `handleVirtualKeyPress` (`App.tsx:441`, deps `[midi, appMode, ...trainers]`) se recrean en cada render.
- Resultado: las vistas `SingleNoteView`/`IntervalsView`/`SequencesView`/`RepertoireView` **no están memoizadas** (solo `DatabaseCard.tsx:163` y `AiConsultationTab.tsx:228` usan `memo` en views) y aunque lo estuvieran, sus props (`trainer`) cambiarían de identidad en cada render. La inversión en memoización de `PianoKeyboard` (OLA 3.1/F5-01, verificada por `s3-render-performance.test.tsx:115-177`) queda aislada: protege el teclado pero no el resto del árbol.

#### F12.4 — `activeStimulusNotes` se actualiza aunque las pistas visuales estén desactivadas (impacto: medio)

`useMidi.ts:331-333`: cada nota melódica programada (`sendNote`, canal 1) hace `setActiveStimulusNotes`. El gate de `visualCueMode === 'blind'` ocurre después, en `App.tsx:522-523`:

```ts
const liveStimulusNotes =
  visualCueMode === 'assisted' ? midi.activeStimulusNotes : EMPTY_STIMULUS_NOTES
```

que solo filtra la **prop**, no el `setState`. En modo blind (el default, `App.tsx:40`), cada nota del repertorio/metrónomo provoca un re-render de `App` cuyo único efecto visible es ninguno.

#### F12.5 — Metrónomo continuo: re-render por beat (impacto: medio)

`useRepertoireTrainer.ts:251-258`: `stimulusScheduler.onBeatTick` hace `setActiveBeatIndex(beatIndex)` en cada beat más un segundo `setState` para apagar el LED. A 86-120 BPM son 2-4 re-renders de `App`/s sostenidos durante toda la sesión de repertorio, sumándose a F12.4.

**Nota positiva:** el canal 10 (metrónomo) no actualiza estado (`useMidi.ts:318, 331`: `isMelodicStimulus = channel === MELODIC_CHANNEL`), y `PianoKeyboard` usa Sets O(1) + `PianoKey` memoizado por tecla (`PianoKeyboard.tsx:288-294, 335-370`) — un cambio de una tecla no re-renderiza las otras 36 (contrato testado en `s3-render-performance.test.tsx:145-177`).

---

### F13 — Audio y Scheduling

#### F13.1 — Síntesis externa GM sin `AudioContext` (verificado: 0 coincidencias en todo `src/renderer/src`)

El "motor de síntesis" es el sintetizador GM externo: todo el audio sale por `outputPort.send([...])` (`useMidi.ts:330, 338, 128-135`). Consecuencias:

- **No hay fugas de contexto, nodos huérfanos ni estados suspendidos posibles.** No se requiere `resume()` por gesto de usuario.
- El desbloqueo por interacción y la liberación de nodos son **no aplicables** en el estado actual.

#### F13.2 — Scheduling por timers de JS, sin reloj de audio (impacto: medio en precisión temporal)

`stimulusScheduler.ts:30` (`setTimeout` por nota), `:84` (`setInterval` para el metrónomo) y `:106-123` (alineación de frases contra `Date.now()`). Los timers de JS tienen jitter típico de 4-15 ms (mayor bajo carga o con la pestaña en background, donde se estrangulan a ≥1 s). Para un entrenador auditivo que mide `responseTimeMs` esto es aceptable, pero la alineación de frases al downbeat (`schedulePhraseOnContinuousGrid`) puede derivar un tick de timer, y el metrónomo no compensa deriva acumulada del `setInterval`.

#### F13.3 — Consideraciones para Web Audio futuro

Si se añade síntesis por software (la configuración de instrumentos y el nombre `stimulusScheduler` sugieren esa dirección), el patrón actual de timers se trasladaría mal a Web Audio. Ver recomendación R6.

---

### F14 — Stores Zustand

#### F14.1 — Desacoplamiento correcto del hot-path ✅

Los datos de alta frecuencia (`pressedNotes`, `activeStimulusNotes`, `logs`) viven en estado local de `useMidi`, **no** en Zustand. Los stores (`useDatabaseStore`, `useAnalyticsStore`, `useAiStore`) contienen datos de baja frecuencia (sesiones, métricas, respuestas IA). Esta es la decisión arquitectónica correcta: no hay re-renders de suscriptores de store por ráfagas MIDI.

#### F14.2 — Relectura O(n) en `reloadAllData` tras cada escritura (impacto: medio, degradación progresiva)

`useDatabaseStore.ts:62-73`: cada `saveSession`/`deleteSession`/`saveAiReport` (`:75-108`) ejecuta `reloadAllData()`, que hace 5 lecturas completas (`getSummary`, `getAllSessions`, `getAllAnswers`, `getAllAiReports`, `getAllAiConsultations`) y reemplaza los 4 arrays de estado. Con historial creciente, la finalización de cada sesión se vuelve O(n) sobre toda la base y dispara re-render de todos los suscriptores (incluido `StudioBottomDock` vía `summary`, `StudioBottomDock.tsx:27`). Solo ocurre al cerrar sesión, no en el hot-path.

#### F14.3 — Cómputo síncrono completo en analítica, pero acotado ✅

`useAnalyticsStore.ts:45-58`: `computeAnalyticsMetrics` es O(sesiones×respuestas) y síncrono, pero solo se invoca en interacción con la vista de analítica. Aceptable; si el historial crece mucho, considerar memoización por firma de datos (el test `s3-render-performance.test.tsx:44-55` ya pincha este contrato).

---

## 3. Hoja de Ruta y Recomendaciones Priorizadas

| ID | Prioridad | Recomendación | Hallazgos que remedia |
|---|---|---|---|
| R1 | **P0** | Estabilizar identidades de los objetos retornados por hooks | F12.3 |
| R2 | **P0** | Sacar `logs` del camino de render de `App` | F12.1, F12.2 |
| R3 | **P1** | Gate de `activeStimulusNotes` y `onBeatTick` en origen | F12.4, F12.5 |
| R4 | **P1** | Corregir ciclo de vida de `statechange` y el efecto de pánico | F11.2, F11.3 |
| R5 | **P2** | Actualización incremental en `useDatabaseStore` | F14.2 |
| R6 | **P2** | Patrón preventivo para síntesis Web Audio futura | F13.2, F13.3 |
| R7 | **P3** | Memoizar las vistas de entrenador | F12.3 (consolidación) |

### R1 (P0) — Estabilizar identidades de los objetos retornados por hooks

Es la palanca de mayor impacto: habilita toda la memoización existente. Opciones:

- (a) Envolver el objeto de retorno de `useMidi` y `useTrainerCore` en `useMemo` con deps de los valores que realmente cambian.
- (b) Patrón "stable facade": un objeto creado una vez en `useRef` cuyas propiedades se actualizan en cada render.

Con esto, `trainer`/`midi` dejan de invalidar `useCallback`/`useMemo` en cascada (F12.3) y las vistas podrán memoizarse efectivamente.

### R2 (P0) — Sacar `logs` del camino de render de `App`

Mantener el buffer en un `ref`/store mínimo y que `MidiMonitor` se suscriba directamente (vía `useSyncExternalStore` o un store dedicado). Como mínimo: memoizar `onOpenResetModal` con `useCallback` en `App.tsx:592` y dividir el contador `Telemetría (N)` en un componente suscriptor propio. Elimina la principal causa de re-render global por evento MIDI (F12.1/F12.2).

### R3 (P1) — Gate de `activeStimulusNotes` en origen

Pasar `visualCueMode` (o un flag ref) a `useMidi`/`sendNote` para no ejecutar `setActiveStimulusNotes` cuando las pistas están en modo blind (F12.4). Ídem para `onBeatTick`: desregistrar el callback cuando `visualBeatEnabled` esté en falso (F12.5).

### R4 (P1) — Corregir el ciclo de vida de `statechange` y el efecto de pánico

- (a) `addEventListener`/`removeEventListener` para `statechange` (F11.2).
- (b) Separar el pánico de desmontaje del pánico por transición: efecto con deps vacías que invoque la última `sendAllNotesOff` vía ref (F11.3).

### R5 (P2) — Actualización incremental en `useDatabaseStore`

Tras `saveSession`, hacer `set` con el registro nuevo (o revalidar solo `summary`) en lugar de `reloadAllData` completo; reservar la recarga total para import/restore (F14.2).

### R6 (P2, preventiva) — Si se introduce síntesis Web Audio

Un único `AudioContext` singleton (módulo-level o en un store no-React), `resume()` en el primer gesto del usuario, y reemplazar el scheduling por timers con el patrón lookahead (scheduler contra `audioCtx.currentTime` con horizonte de ~100 ms), reutilizando `StimulusScheduler` como capa de decisión y delegando el disparo al reloj de audio. Esto eliminaría el jitter de F13.2 y haría la medición de `responseTimeMs` independiente de la latencia del driver MIDI.

### R7 (P3) — Memoizar las vistas de entrenador

`SingleNoteView`, `IntervalsView`, `SequencesView`, `RepertoireView` con props primitivas o estables, **una vez aplicada R1**. Hoy sería inefectivo y solo añadiría comparación de props costosa (el objeto `trainer` es grande).

---

## 4. Estrategia de Verificación

Extender `src/renderer/src/components/trainer/s3-render-performance.test.tsx` tras aplicar R1-R3:

1. **Test de ráfaga MIDI:** disparar N eventos `midimessage` sintéticos y afirmar que el contador de renders de `App` es O(1) por ráfaga (no O(N)).
2. **Test de dock:** afirmar que `StudioBottomDock` no re-renderiza con el drawer cerrado durante una ráfaga de notas.
3. **Test de modo blind:** afirmar que en `visualCueMode === 'blind'` no se producen re-renders atribuibles a `activeStimulusNotes` durante la reproducción.
4. **Regresión de pánico:** afirmar que `sendAllNotesOff` solo se emite al desmontar, no en cada cambio de `selectedOutputId`/`isDeviceDisconnected`.

Los contratos existentes de `PianoKeyboard` (OLA 3.1 / F5-01, F5-02) en `s3-render-performance.test.tsx:97-177` deben seguir pasando sin modificación.

---

*Fin del informe — AUDIT_REPORT_V8*
