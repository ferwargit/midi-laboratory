# Design

## Context

Verificado en HEAD: el cableado visual ya es completo (`App.tsx` línea 522-523 computa `liveStimulusNotes` según `visualCueMode`; línea 583 lo pasa a `RepertoireView`, que lo reenvía a `PianoKeyboard` como `stimulusNotes`). La fuente de esa pista es `midi.activeStimulusNotes`, que `useMidi.sendNote` (líneas 305-341) popula con **cada** nota enviada, sin distinguir canal. El metrónomo —continuo, de pre-roll y libre— emite sus ticks (GM 76/77) por el mismo `sendNote` en Canal 10 (`App.tsx` líneas 212-227, 234-242; `stimulusScheduler.ts` línea 80, 89), por lo que contamina la pista visual. El spec `01-midi-audio-hardware` ya define la semántica de canales (1 = Piano, 10 = Metrónomo) y cubre `activeStimulusNotes` en el requisito "Aislamiento de Temporizadores por Clave Compuesta".

## Goals / Non-Goals

**Goals:**

- Excluir el Canal 10 del registro en `activeStimulusNotes`, de modo que el modo `'assisted'` ilumine únicamente notas melódicas reales en las 4 modalidades.
- Preservar íntegro el aislamiento de temporizadores por clave compuesta `${channel}_${noteNumber}` (los ticks siguen sonando y silenciándose igual).
- Mantener verdes todos los tests existentes de `useMidi.test.ts` y del resto de la suite.

**Non-Goals:**

- No se migra la iluminación a un cálculo por rebanada (`calculateActiveStimulusNotes` sobre `activeEventsSlice`): el mecanismo actual basado en los timers reales de `sendNote` es temporalmente exacto y ya está cableado; migrarlo exigiría exponer el timing de reproducción desde `useRepertoireTrainer` (cambio invasivo descartado con el usuario).
- No se toca `App.tsx`, las vistas, `PianoKeyboard`, `visualAudioSync.ts`, el scheduler ni los evaluadores.
- No se filtra el pre-roll tonal (`playTonalContextMidi`, Canal 1): sus notas son referencia acústica melódica y su iluminación en modo `'assisted'` se considera aceptable; queda registrado como comportamiento conocido, no como defecto de este cambio.

## Decisions

1. **Filtrar en `useMidi.sendNote` por canal, no en la capa de consumo.**
   - `activeStimulusNotes` no transporta información de canal, así que un filtro en `App.tsx` o en las vistas sería imposible o requeriría ampliar el contrato del hook. `sendNote` es el único punto donde el canal es conocido y es la fuente única de verdad del estado.
   - Implementación: guardar la nota en `activeStimulusNotes` solo cuando `channel === 1` (canal melódico canónico según el spec); el `Note Off` programado solo la retira si fue registrada. Alternativa descartada: excluir solo las notas 76/77 — frágil, porque el Canal 10 podría emitir otros ticks y las notas 76/77 son legítimas como estímulo melódico en el Canal 1.
2. **Constante con nombre para el canal melódico.**
   - Extraer `MELODIC_CHANNEL = 1` (junto al existente `ACTIVE_MIDI_CHANNELS`) para que la condición no sea un literal mágico y quede alineada con la semántica del spec (1 = Piano Acústico, 10 = Metrónomo).
3. **TDD estricto (protocolo AGENTS.md).**
   - Primero los escenarios nuevos en `useMidi.test.ts` (tick del Canal 10 nunca aparece en `activeStimulusNotes`; nota del Canal 1 sí), confirmar Rojo, luego la implementación, luego Verde. Los escenarios del spec delta son la fuente de los casos de prueba.
4. **Sin cambios de contrato público.**
   - La firma de `sendNote` y la forma de `activeStimulusNotes: number[]` no varían; el cambio es semántico (qué notas se registran), no estructural.

## Risks / Trade-offs

- [Un test existente asuma que Canal 10 registra en `activeStimulusNotes`] → Revisión previa de `useMidi.test.ts`: los escenarios actuales ("Nota homónima en canal distinto") verifican independencia de temporizadores, no registro visual; si alguno contradice el nuevo contrato, se actualiza junto con el delta (el spec es la autoridad).
- [Regresión silenciosa futura: alguien reintroduce el registro sin filtro] → El escenario del spec delta ("El tick del metrónomo no contamina la pista visual de estímulo") queda plasmado como test de regresión permanente.
- [Pérdida de feedback visual del metrónomo en el teclado] → Aceptado: el pulso ya tiene su propio indicador dedicado (LEDs de beat en `RepertoireView`, `visualBeatEnabled`), por lo que el teclado no es la superficie prevista para el pulso.

## Migration Plan

Cambio contenido en un único hook y su test: no hay migración de datos ni de configuración. Rollback = revertir el commit; ningún artefacto persistido depende del nuevo comportamiento.

## Open Questions

(ninguna)
