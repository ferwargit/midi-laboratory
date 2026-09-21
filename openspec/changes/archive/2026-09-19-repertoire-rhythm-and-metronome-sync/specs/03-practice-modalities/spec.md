## MODIFIED Requirements

### Requirement: Modos de Evaluación Rítmica y Tolerancia (Modalidad 04)

El evaluador MUST (DEBE) soportar `RhythmEvaluationMode = 'free_rubato' | 'relative_proportional' | 'strict_metronome'`, adaptando los tiempos esperados al BPM de estudio activo.

- **`free_rubato`**: evalúa solo altura; `isRhythmCorrect` siempre es `true`.
- **`relative_proportional`**: compara el IOI real contra el esperado; la desviación es correcta si `<= rhythmTolerancePercent`.
- **`strict_metronome`**: compara el offset absoluto contra la cuadrícula acumulada.
- En ambos modos rítmicos, el primer evento MUST considerarse rítmicamente correcto.
- `overallScorePercent = round(pitchAccuracyPercent * 0.7 + rhythmAccuracyPercent * 0.3)`.
- `isCompleteSuccess = (pitchAccuracyPercent === 100) && (rhythmMode === 'free_rubato' || rhythmAccuracyPercent === 100)`.

**Distancia métrica como fuente de los tiempos esperados:** en `relative_proportional` y `strict_metronome`, los tiempos esperados MUST (DEBEN) derivarse de la **distancia métrica real entre eventos sonoros sucesivos en la línea temporal de la partitura**, y NO de la duración del evento previo aislado:

- `RepertoireEvaluationConfig` MUST aceptar `beatsPerMeasure` (con piso `2` y default `2`), leído de `score.timeSignature.beats` por el hook orquestador.
- La distancia métrica en tiempos entre dos eventos sonorios consecutivos `a` (previo) y `b` (actual) MUST calcularse como `(b.measureNumber - a.measureNumber) * beatsPerMeasure + (b.beatPosition - a.beatPosition)`, soportando explícitamente el cruce de fronteras de compás (p. ej. la nota de resolución del compás siguiente).
- El IOI esperado en `relative_proportional` MUST ser `round(distanciaMétrica * beatDurationMs)`; el offset absoluto esperado en `strict_metronome` MUST ser la suma acumulada de los IOI esperados de los eventos precedentes.
- Como consecuencia, los silencios existentes entre dos notas MUST quedar implícitamente incluidos en el tiempo esperado, pues la distancia métrica refleja la posición real de cada evento en la partitura.

**Salvaguardas aritméticas y motor humano:**

- Un evento cuyo IOI esperado sea `<= 0` (eventos que comparten posición métrica, p. ej. notas de adorno/gracia fusionadas con su nota principal, o `durationBeats <= 0`) MUST (DEBE) tratarse como **evento de altura pura**: `isRhythmCorrect = true`, `timeDeviationMs = 0` y `timeDeviationPercent = 0`, sin penalización rítmica. En ningún caso el resultado MAY contener `NaN` ni `Infinity`.
- El IOI esperado efectivo MUST tener un **piso de 60 ms** (`MIN_EXPECTED_IOI_MS`): cuando la distancia métrica sea positiva pero produzca un valor menor, MUST usarse 60 ms, de modo que las notas hiper‑cortas no exijan tolerancias de jitter inalcanzables para la motricidad humana.
- Los eventos exentos (IOI `<= 0`) MUST seguir contabilizándose en el total de eventos y MUST evaluarse en altura; la exención es únicamente rítmica.

#### Scenario: free_rubato ignora el tiempo y premia la afinación

- **GIVEN** una melodía esperada de 3 eventos y las notas correctas tocadas con tiempos libres
- **WHEN** se evalúa en `free_rubato`
- **THEN** `isCompleteSuccess === true`, `pitchAccuracyPercent === 100` y `rhythmAccuracyPercent === 100`

#### Scenario: relative_proportional valida los ratios IOI

- **GIVEN** una melodía con duraciones 0.5, 0.25, 0.25 tiempos y notas tocadas a 1000, 1350 y 1525 ms
- **WHEN** se evalúa en `relative_proportional` con tolerancia 20%
- **THEN** `isCompleteSuccess === true` y `rhythmAccuracyPercent === 100`
- **AND** los IOI esperados coinciden con los que produce la distancia métrica entre eventos consecutivos del mismo compás

#### Scenario: Los silencios intermedios se incorporan al IOI esperado

- **GIVEN** una secuencia en 2/4 de tres eventos sonoros en `beatPosition` 1.0, 1.5 y 1.0 (del compás siguiente), separados por un silencio de negra entre el segundo y el tercero, a 86 BPM (`beatDurationMs ≈ 698 ms`)
- **AND** el evento del compás siguiente es la nota de resolución incluida por la regla +1 Res
- **WHEN** se evalúa en `relative_proportional` con los eventos tocados exactamente a tiempo
- **THEN** `rhythmAccuracyPercent === 100` e `isCompleteSuccess === true`
- **AND** el IOI esperado entre el segundo y el tercer evento refleja la distancia métrica completa (frontera de compás incluida), no la duración aislada del segundo evento

#### Scenario: Nota de adorno con duración 0 no genera NaN ni Infinity

- **GIVEN** una secuencia con dos eventos que comparten `measureNumber` y `beatPosition` (nota de adorno/gracia con `durationBeats === 0`)
- **WHEN** se evalúa en `relative_proportional`
- **THEN** ningún `timeDeviationPercent` del resultado es `NaN` ni `Infinity`
- **AND** el evento de adorno tiene `isRhythmCorrect === true` y `timeDeviationMs === 0`
- **AND** el evento sigue contabilizándose en el total de eventos y evaluándose en altura

#### Scenario: Piso de 60 ms para IOI esperados hiper‑cortos

- **GIVEN** una secuencia en la que dos eventos sonoros consecutivos distan 0.1 tiempos (semicorchea en división rápida) a un BPM alto
- **WHEN** se evalúa en `relative_proportional`
- **THEN** el IOI esperado usado en el cálculo de tolerancia es `>= 60 ms`, aunque la distancia métrica cruda produzca un valor menor
