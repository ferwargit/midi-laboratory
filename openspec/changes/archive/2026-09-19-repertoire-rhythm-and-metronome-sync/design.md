## Context

El evaluador de repertorio (`src/renderer/src/domain/exercise/repertoireEvaluator.ts`) recibe la rebanada ya filtrada: `computeSliceEvents` (`useRepertoireTrainer.ts:165-171`) elimina silencios y eventos sin `midiNotes`, y `evaluateRepertoireAttempt` vuelve a filtrar (`repertoireEvaluator.ts:105`). Por eso **dentro del evaluador no existen los silencios** como eventos sumables — la fórmula actual de IOI (`repertoireEvaluator.ts:177`) no tiene acceso a ellos ni puede tenerlo sin cambiar el contrato de entrada.

Lo que sí está disponible en cada `ScorePlaybackEvent` es su posición métrica canónica: `measureNumber` (1-indexado) y `beatPosition` (1.0, 1.5, 1.75…), que es exactamente la clave que usa `fuseConcurrentEvents` (`useRepertoireTrainer.ts:117`) para fundir eventos simultáneos. Es la fuente de verdad temporal de la partitura.

En el scheduler, el problema es opuesto: la información existe pero no se propaga. `startContinuousMetronome` (`stimulusScheduler.ts:52-82`) ya tiene el guard correcto de idempotencia (`metronomeTimer && currentBeatDurationMs === beatDurationMs → return`), pero dos llamadores lo evitan cuando el tempo cambia:

- `useRepertoireTrainer.setStudyBpm` (`useRepertoireTrainer.ts:286-300`) solo reinicia si `isFreeMetronomeActiveRef.current` — el metrónomo de sesión con `continuousMetronome: true` no pasa por ese flag.
- `App.tsx` `onPlaySlice` (`App.tsx:328-341`) se guarda con `if (!stimulusScheduler.isContinuousMetronomeActive())`.

Ver `proposal.md - Why` para la motivación de ambos arreglos.

## Goals / Non-Goals

**Goals:**

- Que los tiempos esperados del evaluador rítmico reflejen la partitura real, silencios y fronteras de compás incluidos.
- Que ningún resultado de evaluación pueda contener `NaN` ni `Infinity`.
- Que el reloj maestro cambie de tempo de forma no interactiva y determinista, sin requerir intervención del usuario, para soportar `autoSpeedRamp`.
- Preservar la totalidad de los escenarios y pruebas existentes (cero regresiones numéricas en piezas sin silencios).

**Non-Goals:**

- No se modifica el significado de `strict_metronome`: sigue midiendo el offset absoluto **relativo a la primera nota tocada** (`actualTimeOffsetMs = played.timestampMs - firstPlayedTime`), no contra la fase del metrónomo. Anclarlo al downbeat del reloj requeriría inyectar conocimiento del scheduler en el evaluador, rompiendo su pureza y testeabilidad sin dependencia de React.
- No se altera `clusterPlayedMidiNotes`, la fusión polifónica, ni la regla +1 Res.
- No se añade UI nueva ni configuración persistida por usuario; el piso de IOI y `beatsPerMeasure` son constantes/campos de dominio.
- No se cambia la forma de `RepertoireExerciseResult` ni de `SingleEventEvaluation`: los consumidores (`RepertoireFeedbackPanel`, `RepertoireSummaryCard`) son transparentes.

## Decisions

### Decisión 1: Distancia métrica entre posiciones canónicas, no suma de duraciones

**Elección:** calcular el IOI esperado como `round(distanciaMétrica(prev, curr) * beatDurationMs)` donde `distanciaMétrica = (curr.measureNumber - prev.measureNumber) * beatsPerMeasure + (curr.beatPosition - prev.beatPosition)`.

**Rationale:** la posición métrica es la fuente de verdad temporal que ya usa el parser y el fusor; las duraciones son una _derivada_ que puede contradecirla (ligaduras que extienden una nota más allá del siguiente ataque, `fuseConcurrentEvents` que se queda con `Math.min(durationBeats)` al fundir manos, `durationBeats || 0.5` que miente sobre notas de adorno). Las dos alternativas son peores:

- **Alternativa A (sumar duraciones de todos los eventos intermedios, silencios incluidos):** exige pasar al evaluador la línea temporal _no filtrada_, rompiendo el contrato actual (`expectedEvents` = eventos jugables) y duplicando el cómputo de `computeSliceEvents`. Además, con `hand === 'both'` las duraciones fundidas ya no suman la distancia real.
- **Alternativa B (sumar `durationBeats` del evento previo + duraciones de silencios subsecuentes):** sigue siendo una suma de derivados y hereda todos los casos límite de las ligaduras.

**Consecuencia obligada:** el evaluador necesita saber los beats por compás. Ver Decisión 3.

### Decisión 2: Los valores numéricos no cambian para piezas sin silencios

**Elección:** demostrar por construcción que la nueva fórmula es **idéntica** a la vieja cuando no hay silencios ni eventos solapados.

**Rationale:** para una melodía estrictamente secuencial, la distancia entre onsets consecutivos es exactamente la duración del evento previo — es la invariante que la fórmula vieja asumía implícitamente. Ejemplo del escenario canónico existente (`repertoireEvaluator.test.ts:11-57`): `beatPosition` 1.0 → 1.5 → 1.75 con `durationBeats` 0.5, 0.25, 0.25 produce distancias 0.5 y 0.25 — los mismos IOI. Por eso el escenario `relative_proportional valida los ratios IOI` se conserva sin modificar, y la prueba existente debe seguir pasando sin reescribir sus aserciones.

La divergencia aparece _solo_ donde la fórmula vieja ya estaba equivocada: silencios (IOI esperado demasiado corto), notas sostenidas que se solapan con el siguiente ataque (IOI esperado demasiado largo) y eventos en la misma posición métrica (IOI cero).

### Decisión 3: `beatsPerMeasure` via `RepertoireEvaluationConfig`, no como parámetro posicional

**Elección:** añadir `beatsPerMeasure?: number` a `RepertoireEvaluationConfig` con default `2` y piso `Math.max(2, n)`, completado por `useRepertoireTrainer.handleUserNotePlayed` desde `currentScoreRef.current?.timeSignature.beats || 2`.

**Rationale:** `handleUserNotePlayed` ya construye el objeto `evalConfig` (`useRepertoireTrainer.ts:644-649`) — es el punto natural de inyección y no cambia la aridad de `evaluateRepertoireAttempt`. El piso 2 replica la convención que la spec canónica ya impone para el trainer ("Los beats por compás MUST leerse de `score.timeSignature.beats` (con piso 2)").

**Alternativa considerada:** inferir `beatsPerMeasure` dentro del evaluador a partir de los `measureNumber` de los eventos — rechazada porque una rebanada de un solo compás no permite distinguir 2/4 de 3/4, y porque el evaluador debe seguir siendo una función pura sin adivinanzas sobre el compás.

### Decisión 4: Guard de IOI `<= 0` como exención de penalización, no como clamp al piso

**Elección:** cuando la distancia métrica cruda sea `<= 0` (eventos en la misma posición métrica: notas de adorno/gracia, apoyaturas fusionadas), el evento se marca como **exento rítmico**: `isRhythmCorrect = true`, `timeDeviationMs = 0`, `timeDeviationPercent = 0`. Sigue contándose en el total y evaluándose en altura.

**Rationale:** un IOI esperado de 0 significa "estos ataques son simultáneos en la partitura"; clamearlo a 60 ms (Decisión 5) declararía incorrecto un acorde desplegado rápido, y la división directa produciría `Infinity`/`NaN`. La exención es la única opción que no miente ni penaliza la interpretación correcta. Es además el único punto donde el cambio elimina activamente un valor no finito: `timeDeviationPercent = round(abs(dev) / expectedIoi)` con `expectedIoi === 0` es `Infinity` (o `NaN` si `dev` también es 0).

**Nota sobre `durationBeats || 0.5`:** hoy esa máscara evita el cero literal en la fórmula vieja, pero es una máscara — reporta 0.5 negras para una nota de adorno. Con la nueva fórmula el riesgo se traslada a la distancia métrica, donde es real y debe guardarse explícitamente.

### Decisión 5: Piso de 60 ms como constante de dominio en el evaluador

**Elección:** exportar `MIN_EXPECTED_IOI_MS = 60` a nivel de módulo en `repertoireEvaluator.ts` y aplicarlo como `expectedIoi = Math.max(MIN_EXPECTED_IOI_MS, round(distancia * beatDurationMs))` — solo cuando la distancia ya superó el guard de la Decisión 4.

**Rationale:** por debajo de ~50–60 ms el jitter motor humano inter-dedos supera la ventana de tolerancia incluso con timing perfecto: a 0.1 tiempos y 120 BPM el IOI son 50 ms, y con tolerancia del 20% eso exige ±10 ms — inalcanzable. 60 ms es el umbral psicoacústico/motor operable. Vive en el módulo del evaluador (no en `DEFAULT_APP_CONFIG.midi`) porque es una constante de _evaluación pedagógica_, no de sincronización MIDI — sigue el patrón de `chordClusterWindowMs = 45`, que también es un default de módulo del evaluador y no pertenece a la tabla SSOT de `01-midi-audio-hardware`.

**Alternativa considerada:** escalar el piso con la tolerancia (ej. exigir `>= 60 / tolerancePercent`) — rechazada por acoplar dos magnitudes independientes y por ser más difícil de especificar deterministamente.

### Decisión 6: El scheduler se reinicia solo; los llamadores dejan de guardarse

**Elección:** `startContinuousMetronome` detecta el cambio de tempo internamente (metrónomo corriendo Y `beatDurationMs !== currentBeatDurationMs`) y ejecuta el reinicio limpio: `clearInterval` → `cancelSequenceTimers()` → actualizar tempo/compás → `clockStartTime = Date.now()` → fase de beat a downbeat. Los llamadores entonces **siempre** llaman con el tempo vigente:

- `App.tsx` `onPlaySlice` elimina el `if (!stimulusScheduler.isContinuousMetronomeActive())` y llama a `startContinuousMetronome` incondicionalmente antes de `schedulePhraseOnContinuousGrid`. La idempotencia del scheduler previene reinicios gratuitos cuando el tempo no cambió.
- `useRepertoireTrainer.setStudyBpm` deja de condicionar el reinicio a `isFreeMetronomeActiveRef` y lo aplica siempre que `stimulusScheduler.isContinuousMetronomeActive()` — cubriendo el metrónomo de sesión.

**Rationale:** la responsabilidad del reinicio queda en un solo lugar (el scheduler es el dueño del `setInterval` y de `clockStartTime`), y el guard de idempotencia ya escrito (`currentBeatDurationMs === beatDurationMs`) se reutiliza como rama de no-op. Cualquier otro llamador futuro hereda el comportamiento correcto por omisión.

**Alternativa considerada:** un método dedicado `updateContinuousMetronomeTempo(beatDurationMs)` — rechazada porque multiplica la superficie de API, obliga a los llamadores a saber cuándo el reloj está corriendo, y reintroduce exactamente la asimetría que causó H-04 (un llamador llama a `start`, otro a `update`).

### Decisión 7: Cancelación de frases pendientes en el cambio de tempo

**Elección:** el reinicio incluye `cancelSequenceTimers()`, de modo que toda frase programada sobre la cuadrícula vieja se anula.

**Rationale:** `schedulePhraseOnContinuousGrid` calcula sus `delayMs` contra `clockStartTime` y el tempo viejo; tras el reinicio esos retardos apuntan a tiempos absolutos sin sentido. Mantenerlos sonaría la frase desplazada respecto de los clics nuevos — precisamente el síntoma de H-04.

**Trade-off aceptado:** si el cambio de tempo pilla una frase a mitad de sonando, se silencian sus notas aún no articuladas. Es aceptable porque `autoSpeedRamp` solo sube el tempo en un **límite de frase** (tras alcanzar el streak, antes de expandir la rebanada), y la siguiente frase se reprograma en el avance siguiente. Los `Note Off` de las notas ya articuladas no dependen del scheduler: los gestiona `useMidi.sendNote` con sus propios temporizadores watchdog, así que no quedan notas colgadas.

### Decisión 8: Getter de inspección del tempo vigente

**Elección:** exponer `getCurrentBeatDurationMs(): number` en `StimulusScheduler`.

**Rationale:** la spec necesita una aserción normativa verificable del tempo vigente; contar clics con fake timers es frágil (depende de cuántos intervalos se avanzan y de la fase). El getter es una adición trivial y de solo lectura, y también es útil para telemetría/depuración.

## Risks / Trade-offs

- **[Regresión silenciosa en piezas con notas sostenidas que se solapan]** → la distancia métrica entre onsets es _menor_ que la duración de la nota previa cuando esta se mantiene mientras ataca la siguiente (legato, ligaduras). La fórmula vieja sobreestimaba el IOI esperado en estos casos; la nueva es correcta al IOI real. Mitigación: el escenario existente `relative_proportional valida los ratios IOI` se conserva idéntico y debe seguir pasando; cualquier cambio en su aserción sería la alarma de regresión.
- **[Stale closure en `setStudyBpm`]** → si el arreglo de dependencias del `useCallback` no se mantiene correcto, el reinicio usaría un `studyBpmRef` desactualizado. Mitigación: caso de prueba dedicado en `stimulusScheduler.test.ts` con fake timers, y revisión explícita del arreglo en `tasks.md`.
- **[El piso de 60 ms puede enmascarar errores rítmicos reales en pasajes muy rápidos]** → un estudiante que aporree fusas a destiempo dentro de una ventana de 60 ms no será penalizado. Trade-off aceptado: por debajo de ese umbral la penalización es indistinguible del jitter motor legítimo, y castigarlo generaría falsos negativos peores.
- **[Cancelación de frase audible en tempo change]** → ver Decisión 7. Mitigación: el cambio de tempo está acotado a límites de frase; si llegara a invocarse en otro punto, el peor caso es una frase truncada, no notas colgadas.
- **[Exención rítmica "jugable"]** → un evento exento podría parecer que regala un acierto rítmico. Mitigación: la exención aplica solo cuando la _partitura_ declara IOI 0 (ataques simultáneos genuinos); el evento sigue evaluándose en altura, y cualquier evento con IOI esperado positivo se evalúa con normalidad.
- **[`durationBeats` de eventos fundidos es `Math.min`]** → con `hand === 'both'`, la duración reportada puede no reflejar la nota más larga. La nueva fórmula es inmune: usa posición, no duración. La vieja empeoraba en ese caso.
- **[Rounding drift]** → `Math.round` en ambos lados de la comparación puede introducir ±1 ms. Ya pasaba con la fórmula vieja; no se introduce drift nuevo.

## Migration Plan

**Retrocompatible por construcción** (ver Decisión 2): sin cambios de API pública, sin migración de datos, sin cambios en la forma de los registros persistidos (`DbAnswerRecord.reasonTelemetry` sigue computándose de la misma fuente).

**Rollout:** un solo commit con evaluator + scheduler + cableado + pruebas; no hay flags ni rutas paralelas.

**Rollback:** revertir el commit restaura la fórmula vieja y el guard `isFreeMetronomeActiveRef`; los escenarios de spec canónica editados al archivar se restauran desde `git`.

## Open Questions

- **¿Debe `setStudyBpm` emitir telemetría cuando reinicia el metrónomo de sesión?** Hoy solo loguea el metrónomo libre (`⏱️ Metrónomo Libre iniciado a N BPM`). Un log de tempo change sería útil para auditar divergencias en sesiones reales, pero es cosmético y no cambia specs ni tareas — se puede decidir al implementar.
- **¿Conviene exponer el tempo actual del scheduler en la UI de repertorio (ej. "Metrónomo: 91 BPM")?** El getter de la Decisión 8 lo habilita barato, pero es alcance de UI y queda fuera de este cambio.
