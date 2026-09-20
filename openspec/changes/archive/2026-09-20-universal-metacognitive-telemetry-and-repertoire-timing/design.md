## Context

La Auditoría V6 (OLA 4.2) halló que la telemetría metacognitiva del kernel (`02-trainer-core-engine` R7: `preAnswerListens` / `postErrorListens` / `postErrorDwellTimeMs` estampadas en cada `DbAnswerRecord`) solo se alimenta desde `useSingleNoteTrainer`. Los tres _plug-ins_ restantes exponen `repeatCurrent*()` (exigido por `03-practice-modalities` R1) pero no lo conectan con `core.recordPreAnswerRepeat()` / `core.recordPostErrorRepeat()`. Adicionalmente, `useRepertoireTrainer` estampa un `responseTimeMs` literal (`1000`) en lugar de medirlo. Ver proposal.md para el motivo y el alcance.

Estado actual relevante (confirmado por inspección):

- Pauta de referencia: `useSingleNoteTrainer.ts:331-342` — `repeatCurrentNote` decide entre `recordPreAnswerRepeat` / `recordPostErrorRepeat` según `core.isWaitingAnswer` / `core.isWaitingManualAdvance` antes de re-emitir el estímulo.
- Handlers a modificar: `useIntervalTrainer.ts:311-316`, `useSequenceTrainer.ts:270-275`, `useRepertoireTrainer.ts:605-607`.
- El kernel expone ambos registradores en su API pública (`useTrainerCore.ts:567-568`) y los conteos se consolidan sobre el `DbAnswerRecord` en `recordAnswer` (`useTrainerCore.ts:451-452`).
- Buffer de notas tocadas en Repertorio: `playedNotesBufferRef: RawPlayedMidiNote[]` con `timestampMs` estrictamente creciente (garantizado por `useRepertoireTrainer.ts:627-638` y la regla de reloj de `03-practice-modalities` R20).
- `sanitizeResponseTime` (`evalPolicy.ts:22-33`) aplica clamping `[50, 30000]` y ya es usado por los evaluadores de Nota/Intervalo/Secuencia.

## Goals / Non-Goals

**Goals:**

- Que las cuatro modalidades alimenten los KPIs de escucha con idéntica semántica (pre-respuesta vs. post-error).
- Que el `DbAnswerRecord` de Repertorio lleve un `responseTimeMs` medido y sanitizado, reemplazando el literal `1000`.
- Que `npm run test` corra con 0 stderr para el módulo `useMidi`.

**Non-Goals:**

- Rediseñar la política de clamping ni los evaluadores (`evalPolicy.ts`, `*Evaluator.ts` no se modifican).
- Cambiar schema de `DbAnswerRecord`/`DbSessionRecord` ni de IndexedDB (los campos ya existen; `preAnswerListens` es opcional en `domain/database/types.ts:33`).
- Medir latencia de playback o latencia de síntesis de audio: el tiempo medido es el de ejecución motora del usuario, no el de salida de sonido.
- Extender la telemetría a `postErrorDwellTimeMs` (ya cubierta por el kernel en `advanceToNextQuestion`/`finalizeAndSaveSession`).

## Decisions

### D1 — Pauta única de registro de repetición (F12)

Replicar literalmente la estructura de `useSingleNoteTrainer` en los tres handlers, antes de re-emitir el estímulo:

```ts
if (core.isWaitingAnswer) {
  core.recordPreAnswerRepeat()
} else if (core.isWaitingManualAdvance) {
  core.recordPostErrorRepeat()
}
```

**Rationale**: `recordPreAnswerRepeat`/`recordPostErrorRepeat` son los únicos puntos de incremento de los _refs_ del kernel (`useTrainerCore.ts:187-193`); la semántica pre/post ya está fijada por el estado del kernel, por lo que el _plug-in_ solo aporta la señal de "el usuario pidió re-escuchar". **Alternativa descartada**: mover el registro al kernel (p. ej. interceptar las llamadas a `repeatCurrent*`): acoplaría el kernel a la UI y violaría `02-trainer-core-engine` R1 (kernel sin conocimiento de modalidad).

### D1.b — Excepción obligatoria en Repertorio: la re-escucha NO rota el token de pregunta

Hallado durante la implementación: `generateQuestionToken` (`useTrainerCore.ts:212-219`) **reinicia** `preAnswerListensRef = 1`, `postErrorListensRef = 0` y `errorPauseStartTimeRef = 0` cada vez que se invoca — es el punto de "comienza una pregunta nueva" del kernel. Y `triggerPlayCurrentSlice` (`useRepertoireTrainer.ts`) llamaba a `core.generateQuestionToken('token_rep')` en **cada** emisión de rebanada, incluidas las re-escuchas. Resultado: cada `repeatCurrentSlice()` borraba la telemetría que acababa de registrar (los KPIs quedaban en sus valores base), y la consolidación post-error en `finalizeAndSaveSession` estampaba `postErrorListens = 0`. Por eso Intervalos/Secuencias/Nota (cuyos `repeatCurrent*` solo re-emiten el estímulo sin rotar token) sí funcionaban y Repertorio no.

**Decisión**: `triggerPlayCurrentSlice` recibe `regenerateToken = true` como parámetro; `startSession` y `advanceToNextStep` (preguntas nuevas) lo mantienen en `true`, mientras que `repeatCurrentSlice` lo pasa en `false`. La re-escucha sigue reseteando el buffer de notas y `isWaitingAnswer`, pero conservando el token vigente y sus contadores.

**Rationale**: el token existe para impedir respuestas dobles sobre la misma pregunta (`02-trainer-core-engine` R5); `handleUserNotePlayed` siempre usa `core.questionToken` (el vigente), por lo que nunca llega con un token desfasado, y el guard `!isWaitingAnswerRef.current` de `recordAnswer` ya bloquea la doble evaluación. Rotar el token en una re-escucha no aportaba ninguna protección adicional y destruía la telemetría exigida por R7. **Alternativa descartada**: registrar el incremento después de `triggerPlayCurrentSlice`: como cada regeneración reinicia el contador a 1, N re-escuchas dejarían el KPI siempre en 2, sin importar cuántas hubo.

### D2 — `responseTimeMs` en Repertorio = tiempo entre primera y última nota tocada (F15)

Calcular, al cierre de la rebanada en `handleUserNotePlayed` (`useRepertoireTrainer.ts:643-671`):

```ts
const firstNote = playedNotesToEvaluate[0]
const lastNote = playedNotesToEvaluate[playedNotesToEvaluate.length - 1]
const rawResponseTimeMs = lastNote.timestampMs - firstNote.timestampMs
const responseTimeMs = sanitizeResponseTime(rawResponseTimeMs)
```

usando el buffer ya clonado (`playedNotesToEvaluate`), y pasando el resultado a `sanitizeResponseTime` de `evalPolicy.ts`.

**Rationale**: los `timestampMs` del buffer son la única fuente de tiempo real disponible en el hook, y ya son estrictamente crecientes (R20), por lo que la resta es no-negativa y determinista. `sanitizeResponseTime` ya es el contrato de clamping del dominio (`02-trainer-core-engine` R8), por lo que los casos degenerados — `NaN`, `Infinity` y cualquier valor fuera del rango `[50, 30000]` — quedan cubiertos sin añadir lógica nueva.

**Alternativas consideradas y descartadas**:

- _(b) Timestamp de inicio de reproducción de la rebanada_ (`triggerPlayCurrentSlice` capturaría `Date.now()` antes de `onPlaySlice`): incluye latencia de síntesis/audio y el retardo del _pre-roll_ rítmico, que el hook no puede medir con precisión (la señal sale por un callback a la capa de audio, `RepertoireTrainerProps.onPlaySlice`). Imposible de hacer determinista en tests.
- _(c) Tiempo desde la última re-escucha_: penalizaría artificialmente a quien re-escucha (un KPI que justamente queremos fomentar), y acoplaría dos telemétricas.

Para rebanadas de un solo evento (`activeSliceLength === 1`, caso frecuente al inicio del encadenamiento), primera y última nota coinciden y el resultado es `0` → `sanitizeResponseTime` lo clampa a `minMs` (50 ms). Es aceptable: representa una ejecución instantánea y el promedio de sesión deja de estar falseado por el literal `1000`.

### D3 — Restablecer el mock en `useMidi.test.ts` antes del unmount

En la prueba `sendAllNotesOff contiene las excepciones del puerto de salida` (`useMidi.test.ts:224-256`), tras las aserciones y antes de salir:

```ts
mockOutput.send = vi.fn()
```

**Rationale**: React Testing Library desmonta el hook al finalizar el test; el cleanup de `useMidi.ts:216-220` invoca `sendAllNotesOff()`. Si el _spy_ conservara la implementación que lanza, el `console.warn` (cuyo _spy_ fue restaurado en la línea 252) se emitiría a stderr real. Reasignar el mock es la forma canónica de devolverlo a un estado neutro. **Alternativa descartada**: hacer `unmount()` explícito dentro de un `console.spyOn` activo: sigue dejando el mock lanzador para el cleanup posterior del _harness_.

### D4 — Estrategia de pruebas (observable por contrato, no por internals)

Los KPIs se assertan sobre el `DbAnswerRecord` persistido, espiando `useDatabaseStore.getState().saveSession` — la pauta ya usada en `useIntervalTrainer.test.ts:304-337` y `useRepertoireTrainer.test.ts:339-372`:

- Caso pre-respuesta: iniciar sesión → invocar `repeatCurrent*()` N veces → responder → parar sesión → assert `savedAnswers[last].preAnswerListens === N + 1` (el kernel inicializa en 1).
- Caso post-error: configurar `advanceMode: 'manual'` → responder mal → assert `isWaitingManualAdvance === true` → invocar `repeatCurrent*()` → assert `postErrorListens === 1`.
- Caso Repertorio timing: responder con notas separadas por un delta temporal conocido (p. ej. dos `handleUserNotePlayed` con `vi.setSystemTime` bajo _fake timers_) → assert `savedAnswers[0].responseTimeMs !== 1000` y que está dentro del rango clampleado `[50, 30000]`. **Detalle descubierto al implementar**: bajo _fake timers_ el auto-avance programado (modo `smart`) no dispara, por lo que el caso de Repertorio usa `advanceMode: 'manual'` y avanza explícitamente con `advanceToNextStep()` entre rebanadas — de lo contrario el token de la segunda rebanada nunca se genera y `handleUserNotePlayed` es rechazado.

## Risks / Trade-offs

- **[Riesgo] Conteos dobles si el usuario re-escucha varias veces seguidas** → Es el comportamiento deseado (`preAnswerListens` es un conteo acumulado, no un booleano); el kernel lo resetea a 1 en cada nueva pregunta (`generateQuestionToken`, `useTrainerCore.ts:215`), y el estampado del valor sobre el `DbAnswerRecord` ocurre en `recordAnswer` (`useTrainerCore.ts:451`). Sin mitigación necesaria.
- **[Riesgo] `responseTimeMs` en rebanadas de 1 evento siempre vale 50 ms (clamping de 0)** → Trade-off aceptado (D2); sesgado a la baja en el primer eslabón del encadenamiento, pero ya no es un valor inventado. Mitigación parcial: documentarlo en el `reasonTelemetry` no es necesario (el campo es numérico y su semántica es "tiempo de ejecución motora").
- **[Riesgo] Tests con tiempo real (flaky)** → Preferir _fake timers_ de Vitest (`vi.useFakeTimers()`) o deltas grandes (> 100 ms) en los tests nuevos; la pauta de tests del módulo ya usa ambas.
- **[Riesgo] Regression en tests existentes de Repertorio** → Los tests actuales no assertan sobre `responseTimeMs` (solo sobre `targetMode`, `currentStreak`, `saveSpy`), por lo que el cambio de valor no los rompe; el test de auto-finalización (`useRepertoireTrainer.test.ts:297-337`) sí persiste sesión y debe seguir verde.

## Migration Plan

- Cambio puramente de código y tests en el renderer; sin migración de datos, sin cambios de schema y sin nouvelles dependencias.
- Verificación no interactiva obligatoria (Electron): `npm run typecheck`, `npm run lint`, `npm run test` (vitest run). La inspección visual en Electron queda opt-in y manual.
- Rollback: revertir el commit restaura el literal `1000` y los handlers sin telemetría; los registros persistidos con valores reales siguen siendo válidos para el validador (`recordValidator.ts:99-103` solo exige enteros ≥ 0).

## Open Questions

(ninguna pendiente — las decisiones D1–D4 cierran toda la ambigüedad técnica del alcance; la elección de `skip_specs` se justifica en proposal.md → Capabilities).
