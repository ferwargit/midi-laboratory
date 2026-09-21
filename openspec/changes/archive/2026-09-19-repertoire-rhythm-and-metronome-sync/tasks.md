## 1. Pruebas del evaluador rítmico (TDD — Red primero)

- [x] 1.1 En `src/renderer/src/domain/exercise/repertoireEvaluator.test.ts`, añadir un escenario con silencios: secuencia en 2/4 de tres eventos sonoros en `beatPosition` 1.0 (C.1), 1.5 (C.1) y 1.0 (C.2, nota de resolución +1 Res), donde el silencio de negra entre el 2.º y el 3.º evento hace que la distancia métrica sea 1.5 tiempos; tocar las notas a tiempo exacto y afirmar `rhythmAccuracyPercent === 100` e `isCompleteSuccess === true` en `relative_proportional`. Verificar que la prueba **falla** contra la implementación actual (la fórmula vieja usa solo `durationBeats` del evento previo y no ve el silencio).
- [x] 1.2 En el mismo archivo, añadir un escenario con dos eventos que comparten `measureNumber` y `beatPosition` (nota de adorno con `durationBeats === 0`) y afirmar que ningún `timeDeviationPercent` del resultado es `NaN` ni `Infinity`, que el evento de adorno tiene `isRhythmCorrect === true` y `timeDeviationMs === 0`, y que sigue evaluándose en altura. Verificar que la prueba **falla** o produce `Infinity` contra la implementación actual.
- [x] 1.3 En el mismo archivo, añadir un escenario de cruce de frontera de compás en `strict_metronome` (eventos en C.1 beat 1.0 y C.2 beat 1.0) con ejecución a tiempo, afirmando `rhythmAccuracyPercent === 100`. Verificar que la prueba **falla** contra la implementación actual.
- [x] 1.4 En el mismo archivo, añadir un escenario de piso de IOI: dos eventos consecutivos a 0.1 tiempos de distancia a 120 BPM (IOI crudo = 50 ms) y afirmar que el IOI efectivo usado es `>= 60 ms`. Verificar que la prueba **falla** contra la implementación actual.
- [x] 1.5 Confirmar que el escenario existente `relative_proportional valida los ratios IOI` sigue presente y sin modificar — debe seguir pasando antes y después del cambio (invariante de la Decisión 2 de `design.md`).

## 2. Pruebas del scheduler (TDD — Red primero)

- [x] 2.1 En `src/renderer/src/services/audio/stimulusScheduler.test.ts`, añadir un escenario que arranque el metrónomo continuo a 750 ms/beat, invoque `startContinuousMetronome(500, 2, fn)` estando activo, y afirme: `isContinuousMetronomeActive() === true`, tempo vigente 500 ms, y que los clics siguientes se emiten cada 500 ms (avanzando fake timers) con la fase reiniciada en downbeat (GM 76, velocity 115). Verificar que la prueba **falla** contra la implementación actual (early-return en `stimulusScheduler.ts:57`).
- [x] 2.2 En el mismo archivo, añadir un escenario de cancelación: programar una frase con `schedulePhraseOnContinuousGrid`, cambiar el tempo con `startContinuousMetronome`, y afirmar `hasPending() === false`. Verificar que la prueba **falla** contra la implementación actual.
- [x] 2.3 En el mismo archivo, añadir un escenario de idempotencia: invocar `startContinuousMetronome(750, 2, fn)` dos veces con el mismo tempo y afirmar que el reloj no se reinicia (la fase de beat y `clockStartTime` se conservan; los clics siguen a 750 ms). Verificar que la prueba **pasa** desde el principio (comportamiento ya correcto que se debe preservar).

## 3. Implementación del evaluador (`repertoireEvaluator.ts`)

- [x] 3.1 Exportar la constante `MIN_EXPECTED_IOI_MS = 60` a nivel de módulo.
- [x] 3.2 Añadir `beatsPerMeasure?: number` a la interfaz `RepertoireEvaluationConfig` con default `2` y aplicar el piso `Math.max(2, n)` al consumirlo. Verificar con `npm run typecheck`.
- [x] 3.3 Implementar el helper de distancia métrica entre dos `ScorePlaybackEvent`: `(b.measureNumber - a.measureNumber) * beatsPerMeasure + (b.beatPosition - a.beatPosition)`.
- [x] 3.4 Reescribir la rama `relative_proportional`: `expectedIoi = Math.max(MIN_EXPECTED_IOI_MS, round(distanciaMetrica(prev, curr) * beatDurationMs))`; si la distancia cruda es `<= 0`, marcar el evento como exento rítmico (`isRhythmCorrect = true`, `timeDeviationMs = 0`, `timeDeviationPercent = 0`) sin tocar `expectedIoi`.
- [x] 3.5 Reescribir la rama `strict_metronome`: el offset absoluto esperado pasa a ser la suma acumulada de los IOI esperados de los eventos precedentes (misma helper y mismo piso), manteniendo el offset real calculado contra `firstPlayedTime` y el primer evento exento de penalización. Eliminar el fallback `|| 500` de `currentExpectedDuration` ahora que la fuente es la distancia métrica.
- [x] 3.6 Verificar que las pruebas 1.1–1.5 pasan (`npm run test`) y que ninguna aserción de los escenarios existentes cambió.

## 4. Implementación del scheduler (`stimulusScheduler.ts`)

- [x] 4.1 Añadir el getter público `getCurrentBeatDurationMs(): number` que devuelva `this.currentBeatDurationMs`.
- [x] 4.2 En `startContinuousMetronome`, sustituir el early-return por detección de cambio de tempo: si el metrónomo está corriendo y `beatDurationMs !== currentBeatDurationMs`, ejecutar el reinicio limpio en orden — `clearInterval`, `cancelSequenceTimers()`, actualizar `currentBeatDurationMs`/`currentBeatsPerMeasure`, `clockStartTime = Date.now()`, fase de beat a downbeat — y luego arrancar el `setInterval` nuevo; si el tempo es idéntico, mantener el no-op actual.
- [x] 4.3 Confirmar que `stopContinuousMetronome`, `cancelAll`, `schedulePhraseOnContinuousGrid` y `scheduleSequence` quedan sin cambios de contrato.
- [x] 4.4 Verificar que las pruebas 2.1–2.3 pasan (`npm run test`).

## 5. Cableado del tempo en el hook y en `App.tsx`

- [x] 5.1 En `src/renderer/src/hooks/useRepertoireTrainer.ts` `handleUserNotePlayed`, completar `beatsPerMeasure` en el `evalConfig` desde `currentScoreRef.current?.timeSignature.beats || 2`.
- [x] 5.2 En `setStudyBpm`, eliminar la condición `isFreeMetronomeActiveRef.current` de forma que el reinicio se aplique siempre que `stimulusScheduler.isContinuousMetronomeActive()` (cubre el metrónomo de sesión con `continuousMetronome: true`); revisar y completar el arreglo de dependencias del `useCallback` para evitar stale closures.
- [x] 5.3 En `src/renderer/src/App.tsx` `onPlaySlice`, eliminar el guard `if (!stimulusScheduler.isContinuousMetronomeActive())` y llamar a `startContinuousMetronome` con el `beatDurationMs` vigente antes de `schedulePhraseOnContinuousGrid`, confiando en la idempotencia del scheduler; conservar el log de telemetría de arranque del metrónomo.
- [x] 5.4 Verificar con `npm run typecheck` y `npm run lint` que no hay errores nuevos.

## 6. Especificaciones y verificación final

- [x] 6.1 Ejecutar `openspec validate repertoire-rhythm-and-metronome-sync --strict` y confirmar que el cambio es válido (deltas con `## MODIFIED Requirements` completas, escenarios con exactamente 4 hashtags, requirement names coincidentes con la spec canónica).
- [x] 6.2 Ejecutar `npm run typecheck` y confirmar salida sin errores.
- [x] 6.3 Ejecutar `npm run lint` y confirmar salida sin errores.
- [x] 6.4 Ejecutar `npm run test` (vitest run) y confirmar que todos los casos — incluidos los nuevos de `repertoireEvaluator.test.ts` y `stimulusScheduler.test.ts` y los preexistentes — pasan.
- [x] 6.5 Al archivar el cambio, editar directamente `openspec/specs/03-practice-modalities/spec.md` (requisito _Modos de Evaluación Rítmica y Tolerancia (Modalidad 04)_) y `openspec/specs/01-midi-audio-hardware/spec.md` (requisito _Scheduler y Reloj Maestro Cuantizado (StimulusScheduler)_) con el contenido de las deltas, y releer que no quede ninguna referencia a la fórmula antigua basada en `durationBeats` del evento previo.
