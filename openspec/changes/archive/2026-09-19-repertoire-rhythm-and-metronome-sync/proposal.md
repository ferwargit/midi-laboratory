## Why

La Auditoría V6 (OLA 2.2 de remediación) detectó dos defectos que invalidan modalidades enteras del entrenador de repertorio:

1. **H-06 — Evaluador rítmico incongruente con la partitura.** `evaluateRepertoireAttempt` deriva el IOI esperado exclusivamente de `targetEvents[i - 1].durationBeats` (`repertoireEvaluator.ts:177` y `:158-160`). Como la rebanada que recibe el evaluador ya viene filtrada de silencios por `computeSliceEvents` (`useRepertoireTrainer.ts:169`), la duración de los silencios intermedios se pierde: una secuencia nota‑silencio‑nota evalúa cualquier interpretación a tiempo como errónea en `relative_proportional` y `strict_metronome`. Además, eventos que comparten posición métrica (notas de adorno/gracia fusionadas o acordes con apoyatura) producen `expectedIoi = 0`, y la división en `timeDeviationPercent` genera `Infinity`/`NaN` que contaminan el feedback y el registro de sesión.
2. **H-04 — Reloj maestro divergente durante `autoSpeedRamp`.** Con `continuousMetronome: true` y `autoSpeedRamp: true`, el incremento de +5 BPM tras un streak (`useRepertoireTrainer.ts:719-725`) llega a `setStudyBpm`, pero esta solo reinicia el metrónomo si el **activo es el metrónomo libre** (`isFreeMetronomeActiveRef`, `useRepertoireTrainer.ts:291`); y `App.tsx:329` vuelve a guardarse con `if (!stimulusScheduler.isContinuousMetronomeActive())`. El metrónomo de sesión queda bloqueado al tempo viejo mientras la frase de piano se programa al nuevo, desplazándose de la cuadrícula de downbeat.

Ambos son fallos de corrección en conducta observable (no de rendimiento), por lo que requieren cambio de especificación.

## What Changes

- El cálculo de tiempos esperados en `repertoireEvaluator.ts` deja de usar `durationBeats` del evento previo y pasa a derivarse de la **distancia métrica real** entre eventos sonoros sucesivos en la línea temporal: `(measureNumber_i − measureNumber_{i−1}) × beatsPerMeasure + (beatPosition_i − beatPosition_{i−1})`, multiplicada por `beatDurationMs`. Aplica a `relative_proportional` (IOI) y `strict_metronome` (offset absoluto).
- `RepertoireEvaluationConfig` gana el campo opcional `beatsPerMeasure` (default `2`, piso 2), necesario para cruzar fronteras de compás; `useRepertoireTrainer.handleUserNotePlayed` lo completa desde `score.timeSignature.beats`.
- Se añade un **guard de duración no positiva**: eventos cuyo IOI esperado (o `durationBeats`) sea `<= 0` se tratan como eventos de altura pura —`isRhythmCorrect = true`, `timeDeviationMs = 0`, `timeDeviationPercent = 0`— sin penalización rítmica, evitando `Infinity`/`NaN`.
- Se establece un **piso mínimo de 60 ms** para el IOI esperado, de modo que notas hiper‑cortas (fusas/semifusas) no exijan tolerancias de jitter inalcanzables para la motricidad humana.
- `StimulusScheduler.startContinuousMetronome` **reinicia limpiamente el tempo** cuando recibe un `beatDurationMs` distinto del actual: cancela el `setInterval` viejo, cancela las frases pendientes programadas sobre la cuadrícula anterior (`cancelSequenceTimers`), reasigna `clockStartTime` y la fase de beat a downbeat, y reanuda inmediatamente con el nuevo tempo.
- `useRepertoireTrainer.setStudyBpm` propurga el cambio de tempo al scheduler **también con el metrónomo de sesión activo** (no solo el libre); `App.tsx` `onPlaySlice` reenvía el tempo actual en cada programación de frase, dejando que el scheduler decida el reinicio.
- Pruebas nuevas en `repertoireEvaluator.test.ts` (silencios incorporados al IOI; ausencia de `NaN`/`Infinity` con duración 0) y `stimulusScheduler.test.ts` (cambio de tempo en metrónomo continuo activo).
- Deltas formales en `03-practice-modalities` (requisito _Modos de Evaluación Rítmica y Tolerancia_) y `01-midi-audio-hardware` (requisito _Scheduler y Reloj Maestro Cuantizado_).

**Compatibilidad:** sin breaking changes de API. La nueva fórmula es **más correcta**, no más laxa: piezas sin silencios ni notas de adorno producen los mismos valores numéricos que hoy (ver `design.md`, Decisión 2). El guard de IOI `<= 0` y el piso de 60 ms son aditivos.

## Capabilities

### New Capabilities

<!-- Ninguna: se refina el comportamiento de capacidades existentes. -->

### Modified Capabilities

- `03-practice-modalities`: el requisito _Modos de Evaluación Rítmica y Tolerancia (Modalidad 04)_ cambia la forma de calcular los tiempos esperados en `relative_proportional` y `strict_metronome` — de la duración del evento previo a la distancia métrica entre eventos sonoros (incluyendo silencios intermedios y fronteras de compás) — y añade el guard de IOI no positivo con exención de penalización rítmica más el piso de 60 ms. Requiere delta formal.
- `01-midi-audio-hardware`: el requisito _Scheduler y Reloj Maestro Cuantizado (StimulusScheduler)_ exige que `startContinuousMetronome` se reinicie limpiamente ante un cambio de tempo mientras el metrónomo ya está corriendo, cancelando la cuadrícula pendiente. Requiere delta formal.

> **Nota:** el requisito _Control Maestro de Tempo y Metrónomo Libre (Modalidad 04)_ de `03-practice-modalities` también se ve afectado en su frase "`setStudyBpm(bpm)` MUST propagarse al scheduler"; la redacción ya es correcta y **no** requiere delta — el cambio está en la implementación que hoy no la cumple. Ver `design.md`, Decisión 5.

## Impact

- **Evaluador de repertorio**: `src/renderer/src/domain/exercise/repertoireEvaluator.ts` (fórmulas de `strict_metronome` y `relative_proportional`, interfaz `RepertoireEvaluationConfig`, nueva constante de piso).
- **Hook orquestador**: `src/renderer/src/hooks/useRepertoireTrainer.ts` (`handleUserNotePlayed` completa `beatsPerMeasure` en el `evalConfig`; `setStudyBpm` propurga el tempo al scheduler sin restringirse al metrónomo libre; arreglo de dependencias del `useCallback`).
- **Scheduler**: `src/renderer/src/services/audio/stimulusScheduler.ts` (`startContinuousMetronome` reinicia tempo limpiamente; posiblemente un método de inspección del tempo actual para los tests).
- **Cableado de audio**: `src/renderer/src/App.tsx` (`onPlaySlice` reenvía el tempo vigente en cada programación de frase continua en vez de guardarse con `isContinuousMetronomeActive()`).
- **Pruebas**: `src/renderer/src/domain/exercise/repertoireEvaluator.test.ts` y `src/renderer/src/services/audio/stimulusScheduler.test.ts` (nuevos escenarios; los existentes se preservan).
- **Especificaciones**: deltas en `openspec/changes/repertoire-rhythm-and-metronome-sync/specs/` más edición directa de `openspec/specs/03-practice-modalities/spec.md` y `openspec/specs/01-midi-audio-hardware/spec.md` al archivar.
- **Consumidores**: `RepertoireView.tsx` y componentes de feedback **sin cambios** — consumen `RepertoireExerciseResult`, cuya forma no varía.
- **Verificación**: `npm run typecheck`, `npm run lint`, `npm run test` (vitest) y `openspec validate repertoire-rhythm-and-metronome-sync --strict`.
