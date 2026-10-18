# Design

## Context

Ver `proposal.md` — Why. Estado actual verificado en el código:

- `useMidi.ts:369-385` retorna un objeto literal fresco en cada render. Todos sus métodos ya son `useCallback` estables (`addLog` deps `[]`; `sendNote`/`sendAllNotesOff`/`changeProgram` deps `[midiAccess, selectedOutputId, isDeviceDisconnected]`; `clearAllPressedNotes` deps `[sendAllNotesOff]`; los setters de `useState` son estables por garantía de React).
- `useTrainerCore.ts:531-576` retorna un objeto literal fresco con **getters en vivo** sobre refs (`isSessionActive`, `sessionId`, `answersBuffer`, `questionToken`). Todos sus métodos ya son `useCallback`.
- `useSingleNoteTrainer.ts` declara callbacks con `core` en sus deps (`triggerNextQuestion:229`, `startSession:288`, `stopSession:311`, `handleUserNotePlayed:391`) y un `useMemo` final (`:429-512`) que incluye esos callbacks: al cambiar `core` de identidad en cada render, toda la cadena se invalida y el objeto `trainer` llega a las vistas (`App.tsx:554-592`) con identidad nueva siempre.
- El proyecto ya trata contratos de rendimiento de render como requisitos de spec (p. ej. «Desacople del Stream de Telemetría del Render Raíz» en `01-midi-audio-hardware`), por lo que este cambio se especifica como delta sobre las capacidades existentes.

## Goals / Non-Goals

**Goals:**

- Identidad referencial estable del retorno de `useMidi` y `useTrainerCore` entre re-renders sin cambios de estado reactivo.
- Preservar la semántica de lectura en vivo de los getters sobre refs del kernel.
- Pruebas que pinen el contrato de estabilidad (identidad preservada / invalidada) y el comportamiento funcional vigente.

**Non-Goals:**

- Memoizar las vistas de entrenador (`SingleNoteView`, etc.) — es R7 (P3), consolidación posterior una vez aplicado R1.
- Gate de `activeStimulusNotes`/`onBeatTick` en origen (R3), ciclo de vida de `statechange` (R4, ya remediado), store de telemetría (R2, ya remediado).
- Cambiar firmas, nombres de propiedades o comportamiento funcional de los hooks.

## Decisions

### D1 — `useMemo` con deps explícitas (opción a del informe R1) en lugar de "stable facade" (opción b)

El retorno se envuelve en `useMemo` cuya lista de deps enumera exactamente los valores reactivos expuestos. Alternativa descartada: un objeto creado una vez en `useRef` cuyas propiedades se mutan en cada render. Razones:

- `useMemo` es idiomático, auditable por `react-hooks/exhaustive-deps` y trivial de testear con `renderHook`/`rerender`.
- La fachada mutable oculta la noción de "render" (las props cambian sin re-render del consumidor), complica el razonamiento sobre stale reads y no es verificable por lint.
- Los getters en vivo del kernel son compatibles con `useMemo`: al recrear el objeto solo cuando cambian las deps, los getters siguen evaluándose en cada acceso y leen el valor vigente del ref.

### D2 — Deps del `useMemo` de `useMidi`

Deps = `[status, inputs, outputs, selectedInputId, selectedOutputId, isDeviceDisconnected, pressedNotes, activeStimulusNotes, addLog, sendNote, changeProgram, clearAllPressedNotes, sendAllNotesOff]`. Los setters `setSelectedInputId`/`setSelectedOutputId` (de `useState`) se incluyen en el objeto pero no en las deps: React garantiza su identidad estable.

### D3 — Deps del `useMemo` de `useTrainerCore`

Deps = todos los estados reactivos expuestos (`sessionLimitType`, `sessionQuestionsCount`, `sessionDurationMinutes`, `timeRemainingSeconds`, `sessionElapsedSeconds`, `advanceMode`, `isSessionFinished`, `isWaitingManualAdvance`, `isWaitingAnswer`, `currentQuestionIndex`, `lastResult`, `sessionHistory`, `saveError`) + todos los callbacks estables. Exclusiones deliberadas:

- `isSessionActive`, `sessionId`, `answersBuffer`, `questionToken` **no** son deps: son getters sobre refs. Toda transición que los muta va emparejada con al menos un `setState` (p. ej. `startCoreSession` activa la sesión y resetea `sessionHistory`/`lastResult`), de modo que el re-render ocurre y el getter entrega el valor vigente. Un consumidor que use `core.isSessionActive` en sus propias deps evalúa el getter durante el render y se invalida correctamente.
- `setIsSessionActiveState` es estado dummy (valor descartado): solo dispara el re-render; no aporta identidad.

### D4 — Plug-ins de entrenador sin cambios de lógica

`useSingleNoteTrainer` (y `useIntervalTrainer`/`useSequenceTrainer`/`useRepertoireTrainer`) no requieren edición: sus deps ya referencian `core`/`midi` completos, que pasarán a cortocircuitar. Se añade cobertura de prueba de cascada en `useSingleNoteTrainer.test.ts` (identidad de `startSession`/`stopSession`/`handleUserNotePlayed` estable entre re-renders sin cambios de estado) como verificación del efecto sistémico.

### D5 — Estrategia de pruebas

- `useMidi.test.ts`: bloque nuevo con `renderHook`; (1) `rerender()` sin cambios → `result.current` idéntico y métodos clave idénticos; (2) `act` que muta estado reactivo (Note On → `pressedNotes`) → identidad nueva + valor fresco; (3) `sendNote`/`sendAllNotesOff` operan sobre el puerto vigente tras cambio de `selectedOutputId` (comportamiento preservado).
- `useTrainerCore.test.ts`: bloque nuevo análogo; (1) identidad preservada sin cambios; (2) invalidación por cambio reactivo (`setSessionLimitType`, `setSessionHistory`); (3) getters en vivo: tras `startCoreSession`, `isSessionActive`/`sessionId`/`questionToken` leen el estado vigente aunque el contenedor no haya cambiado de identidad.
- Suite completa: `npm test`, `npm run typecheck`, `npm run lint` con 0 regresiones.

## Risks / Trade-offs

- **[Deps de `useMemo` incompleta → stale reads]** → Mitigación: enumeración explícita de cada valor reactivo expuesto (D2/D3), `react-hooks/exhaustive-deps` activo en lint, y pruebas que afirman valor fresco tras cada cambio reactivo.
- **[Getter leído en deps de consumidores puede enmascarar un cambio de ref si ningún `setState` lo acompaña]** → Mitigación: invariantes ya existentes del kernel (toda mutación de ref de sesión va emparejada con `setState`); cubierto por el escenario de getters en vivo.
- **[Coste de comparación de deps en cada render]** → Despreciable: ~13-20 comparaciones primitivas/referenciales por render frente a la reconstrucción en cascada actual de objetos y callbacks.
- **[Riesgo de regresión funcional al tocar el retorno]** → Mitigación: el cambio es puramente estructural (envolver el literal existente); las suites existentes de `useMidi` (767 líneas) y `useTrainerCore` pinan el comportamiento y deben pasar sin modificación.

## Migration Plan

Un solo paso, sin migración de datos ni de API: envolver ambos retornos en `useMemo`, ejecutar la suite completa y confirmar 0 regresiones. Rollback trivial (revert del commit).

## Open Questions

(ninguna)
