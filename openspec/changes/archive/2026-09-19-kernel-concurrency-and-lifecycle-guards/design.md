## Context

El micro-kernel `useTrainerCore<TResult>` centraliza la máquina de estados de las cuatro modalidades. Hoy su contrato público `recordAnswer(result, answerRecord, isCorrectForSmartAdvance, onAdvanceTrigger)` se apoya en un único guard de sesión (`isSessionActiveRef`) más la mera existencia de `questionTokenRef.current`. La auditoría V6 (OLA 1.3, hallazgos F01/F02/F03/F07) demuestra que ese guard es insuficiente en tres escenarios reales: doble pulsación MIDI dentro de la misma pregunta, reprogramación de auto-avance sin limpieza previa, y `isWaitingManualAdvance` trabado en `true` tras el primer error en modo `smart`.

Paralelamente, `useSequenceTrainer` ejecuta la evaluación y la persistencia dentro del updater de `setCapturedNotes`, y `useSingleNoteTrainer` puede disparar un estímulo desde un pre-roll huérfano. Véase `proposal.md` para la motivación completa y `specs/02-trainer-core-engine/spec.md` para los requisitos normativos endurecidos.

Estado actual relevante constatado en el código:

| Hallazgo | Ubicación | Estado |
| --- | --- | --- |
| F01 | `useTrainerCore.ts` `recordAnswer` (guard incompleto, sin `clearTimeout` previo, timer sin check de token) | **No remediado** |
| F07 | `useTrainerCore.ts` rama `else` de `recordAnswer` y `advanceToNextQuestion` (sin reset de `isWaitingManualAdvance`) | **No remediado** |
| F02 | `useSequenceTrainer.ts:277-313` (evaluación + `recordAnswer` dentro del updater) | **No remediado** |
| F03 | `useSingleNoteTrainer.ts` (cancelación de `preRollTimerRef`) | **Parcialmente remediado**: `startSession`, `stopSession` y `resetToConfig` ya cancelan el pre-roll; falta el guard defensivo en `triggerNextQuestion` |

## Goals / Non-Goals

**Goals:**

- Hacer que `recordAnswer` sea idempotente por pregunta: ninguna pulsación duplicada puede producir dos `DbAnswerRecord` con el mismo `questionIndex`.
- Garantizar que exista como máximo un temporizador de auto-avance vivo por sesión, y que su callback valide token y sesión.
- Que `isWaitingManualAdvance` sea reflejo exacto del estado de espera manual en todo instante.
- Eliminar todo side-effect de los updaters de estado de React 19 en la modalidad de secuencias.
- Cerrar el ciclo de vida del pre-roll de contexto tonal por defensa en profundidad.

**Non-Goals:**

- No se rediseña la máquina de estados ni el contrato `TrainerCoreOptions`; solo se endurecen guards y se reordena código.
- No se aborda el crecimiento O(n²) del historial en sesiones `infinite` (F-05) ni la detención de trainers al cambiar de pestaña (F-06); ambos quedan para olas posteriores.
- No se toca la capa MIDI/audio, el scheduler de estímulos ni la persistencia IndexedDB.
- No se introduce ninguna dependencia nueva.

## Decisions

### D1. El token de pregunta pasa a ser argumento explícito y obligatorio de `recordAnswer`

**Decisión:** la firma pasa a ser
`recordAnswer(result, answerRecord, isCorrectForSmartAdvance, onAdvanceTrigger, questionToken: string)`, y el cuerpo valida `questionToken === questionTokenRef.current` además de los guards existentes.

**Rationale:** el remedio canónico de la auditoría exige "exigir `questionToken` vigente en `recordAnswer`". Pasar el token como argumento (en vez de leer solo la ref) permite a la modalidad testimoniar **qué pregunta** creía estar resolviendo y al kernel detectar respuestas desfasadas de preguntas anteriores — escenario imposible de distinguir si solo se consulta la ref, porque la ref ya apunta al token nuevo.

**Alternativa considerada:** añadir un quinto parámetro opcional `questionToken?: string` para no romper las 8 llamadas de `useTrainerCore.test.ts`. Descartada: un parámetro opcional deja el contrato permeable y permite que una modalidad omita el check, que es justo la causa raíz de F01. Se asume el coste de actualizar las llamadas existentes.

**Alternativa considerada:** un idempotency token distinto por respuesta. Descartada por sobreingeniería: el `questionToken` ya rota por pregunta y cumple el mismo papel.

### D2. El guard anti-duplicado es `isWaitingAnswerRef`, no un contador de respuestas

**Decisión:** `recordAnswer` se rechaza si `isWaitingAnswerRef.current === false`. Como `recordAnswer` mismo invoca `setIsWaitingAnswer(false)` (que escribe la ref de forma síncrona), toda segunda llamada dentro de la misma pregunta se descarta.

**Rationale:** la ref `isWaitingAnswerRef` ya existe y ya se mantiene sincronizada por el callback `setIsWaitingAnswer`; reutilizarla evita introducir un nuevo campo de estado y otra fuente de verdad. Además, este mismo guard aporta **defensa en profundidad** frente a F02: aunque una modalidad siguiera invocando `recordAnswer` dentro de un updater impuro, la segunda invocación (la del doble-render de `<StrictMode>`) se rechazaría en el kernel.

**Alternativa considerada:** un `Set<string>` de tokens ya consumidos. Descartada: exige limpieza por pregunta y duplica información que ya vive en `questionTokenRef`.

### D3. `clearTimeout` preventivo + captura del token programado dentro del callback

**Decisión:** antes de `setTimeout`, siempre `if (autoAdvanceTimerRef.current) clearTimeout(...)`. Dentro del callback, además del check de sesión existente, se valida que `questionTokenRef.current === tokenProgramado`.

**Rationale:** el check de `sessionId` existente solo aísla sesiones distintas; no evita que un temporizador de la pregunta N dispare el avance mientras la pregunta N+1 ya está en curso. El token es la identidad de pregunta, que es exactamente la granularidad del fallo. `advanceToNextQuestion` ya hace este `clearTimeout`; se unifica el patrón.

### D4. Reset explícito de `isWaitingManualAdvance` en los dos puntos de avance

**Decisión:** `recordAnswer` invoca `setIsWaitingManualAdvanceState(false)` en su rama `else` (auto-avance / smart con acierto) y `advanceToNextQuestion` lo invoca al incrementar `currentQuestionIndex`.

**Rationale:** la bandera es de **espera manual por error pedagógico**; semánticamente solo puede estar activa entre una respuesta incorrecta y el avance manual. Si el avance ocurre por otra vía, debe quedar apagada. Ponerlo en los dos puntos (y no solo en uno) es defensa en profundidad: cubre el avance automático puro (que no pasa por `advanceToNextQuestion` hasta que venza el timer) y el avance explícito. El estado final (finalización) ya lo resetea; se mantiene.

### D5. Buffer `useRef` en secuencias, patrón canónico de Repertorio

**Decisión:** `playedNotesBufferRef = useRef<number[]>([])`. `handleUserNotePlayed` empuja a la ref, hace un `setCapturedNotes([...buffer])` **puro** (solo UI) y, si el buffer alcanza la longitud esperada, evalúa y registra **fuera** del updater, vaciando la ref.

**Rationale:** es el patrón ya probado en `useRepertoireTrainer.ts:242,631-642` (ref como fuente de verdad síncrona, estado de React solo para render). React 19 ejecuta los updaters de `useState` dos veces bajo `<StrictMode>` para detectar impureza; al sacar la evaluación y la persistencia del updater, la doble invocación se vuelve inofensiva. Ver `specs/02-trainer-core-engine/spec.md` — los requisitos del kernel ahora exigen una sola persistencia por pregunta.

**Alternativa considerada:** mantener la evaluación dentro del updater y fiarse del guard D2. Descartada: dejaría el doble cómputo de `evaluateSequenceAnswer` y el doble log de telemetría, y violaría el principio de pureza de los updaters aunque el kernel frene la persistencia.

### D6. Guard de sesión en `triggerNextQuestion` (F03) por defensa en profundidad

**Decisión:** `triggerNextQuestion` arranca con `if (!core.isSessionActive) return`. Se conserva y pinnea con tests la cancelación existente de `preRollTimerRef` en `startSession`, `stopSession` y `resetToConfig`.

**Rationale:** el pre-roll (hasta 2840 ms en modo `cadence`) es un temporizador de modalidad que el `cleanupTimers` del kernel no conoce. La cancelación en los puntos de parada es la barrera principal; el guard en `triggerNextQuestion` es la barrera final para el caso en que la sesión expire por tiempo **durante** el pre-roll, donde el kernel finaliza sin que la modalidad pase por `stopSession`.

**Alternativa considerada:** exponer un slot `onCleanupTimers` en `TrainerCoreOptions` para que el kernel cancele el pre-roll. Descartada: acopla el kernel a un concepto musical (contexto tonal) del que está diseñado para ser agnóstico, rompiendo el principio de tabla del spec.

### D7. `isSessionActive` como getter reactivo-síncrono

**Decisión:** el campo `isSessionActive` del objeto de retorno del kernel se expone como un getter sobre `isSessionActiveRef.current`:

```ts
get isSessionActive() {
  return isSessionActiveRef.current
}
```

El `useState` subyacente se conserva únicamente como disparador de re-renderizados de la UI (`const [, setIsSessionActiveState] = useState<boolean>(false)`); ya no se lee su valor directamente.

**Rationale:** el guard de D6 (`if (!core.isSessionActive) return` en `triggerNextQuestion`) lee el flag a través de un closure. En llamadas síncronas imperativas — típicamente `onTriggerFirstStimulus` invocada dentro de `startCoreSession`, antes de que se vacíe el lote de actualizaciones de React — el closure ve el snapshot de estado del render anterior (`false`) y rechaza la primera pregunta, rompiendo el arranque de toda sesión. La ref, en cambio, se escribe de forma síncrona en `startCoreSession` antes de invocar el callback. Exponer el getter elimina la trampa de closures obsoletos para todo consumidor que necesite el valor en el instante de la llamada, no en el del último render.

Esta conversión destapó un **bug latente de divergencia ref/state**: `stopCoreSession` (rama sin respuestas) y `resetCoreToConfig` actualizaban solo `setIsSessionActiveState(false)` sin escribir `isSessionActiveRef.current = false`. Mientras el campo se leyó del estado, la divergencia era invisible; al convertirse la ref en fuente de verdad, ambos puntos debieron escribir la ref primero. Ambos están corregidos.

**Alternativa considerada:** añadir un segundo campo público (p. ej. `isSessionActiveSync`) para no alterar la semántica del existente. Descartada: duplica la fuente de verdad, obliga a decidir cuál usar en cada punto y deja el campo original con el defecto que motivó el cambio. El getter es coherente con el patrón ya existente en el propio retorno del kernel (`sessionId`, `answersBuffer` y `questionToken` son getters sobre refs por el mismo motivo).

**Compatibilidad:** los consumidores que leen `isSessionActive` durante el render siguen obteniendo el valor correcto, porque toda escritura de la ref va acompañada del `setState` que dispara el re-render. Solo cambia lo que ven las llamadas síncronas post-actualización, que es precisamente lo que se quiere corregir.

## Risks / Trade-offs

- **[Riesgo] `recordAnswer` rompe compatibilidad con 5 call sites en 4 plug-ins y 8 en tests** → Mitigación: la actualización es mecánica (pasar `core.questionToken`); se incluye como tarea explícita con verificación por `npm run typecheck`. El alcance se contiene en el renderer; no es API de paquete.
- **[Riesgo] Falsos positivos del guard `isWaitingAnswer`** si una modalidad llama a `recordAnswer` sin haber hecho `setIsWaitingAnswer(true)` → Mitigación: las cuatro modalidades ya llaman a `core.setIsWaitingAnswer(true)` dentro de su `triggerNext*` antes de aceptar input; el flujo productivo queda intacto. Los tests directos del kernel deben actualizar su setup (pasar de "session + token" a "session + token + waiting"), lo que además los acerca más al flujo real.
- **[Riesgo] El token opcional/obligatorio puede recibir `undefined` en tiempo de ejecución** → Mitigación: el guard trata `undefined`, `null` y `''` como token inválido y descarta silenciosamente, igual que hace hoy con la ausencia de sesión.
- **[Trade-off] `playedNotesBufferRef` duplica la fuente de verdad de las notas capturadas** (ref + estado) → Aceptado: es el costo canónico del patrón y ya se asume en Repertorio; la ref es la verdad operativa y el estado es una proyección de render.
- **[Riesgo] Regresión visual del botón de avance manual** si algún flujo dependía del flag trabado en `true` → Mitigación: el flag solo se apaga cuando realmente hay avance, que es cuando el botón debe ocultarse; los paneles (`FeedbackPanel` y sus 3 hermanos) ya renderizan condicionalmente con `isWaitingManualAdvance && onAdvanceNext`. La suite `s4-ux-feedback.test.tsx` no se toca.

## Migration Plan

1. Endurecer `useTrainerCore.ts` (guards, clearTimeout, reset de flag, check de token en el callback).
2. Actualizar las 5 llamadas de `recordAnswer` en los 4 plug-ins para pasar `core.questionToken`.
3. Refactorizar `useSequenceTrainer.handleUserNotePlayed` al patrón de buffer.
4. Añadir el guard en `useSingleNoteTrainer.triggerNextQuestion`.
5. Escribir los tests TDD (idealmente antes de cada bloque de implementación, según el protocolo de `AGENTS.md`).
6. Verificación no interactiva obligatoria: `npm run typecheck`, `npm run lint`, `npm run test` (vitest run). No se ejecuta `npm run dev` (guardrail de Electron).

**Rollback:** todos los cambios se revierten eliminando el quinto argumento de `recordAnswer` y devolviendo la evaluación de secuencias al updater; al ser cambios locales de hooks sin migración de datos, no hay rollback de persistencia que gestionar.

## Open Questions

Ninguna. Las decisiones D1–D7 son autocontenidas y no modifican el contrato público del paquete ni los requisitos del spec más allá del delta propuesto. D7 se incorporó durante la implementación al constatarse que D6 no era viable leyendo el estado desde un closure; queda documentada aquí y en `tasks.md` (7.3/7.4).
