# Proposal

## Why

En modo visual `'assisted'` (👁️ Asistido), la iluminación del teclado se alimenta de `midi.activeStimulusNotes`, pero `useMidi.sendNote` registra en ese estado **toda** nota emitida sin filtrar por canal. Los ticks del metrónomo (GM 76/77, Canal 10) y el metrónomo libre pasan por el mismo `sendNote`, de modo que en modo Asistido las teclas E5/F5 se iluminan falsamente como si fueran notas del estímulo musical. Esto contamina la pista visual en las cuatro modalidades (Nota Individual, Intervalos, Secuencias y Repertorio) y es especialmente grave en Repertorio, donde el metrónomo continuo suena durante toda la sesión: el alumno ve iluminaciones que no corresponden a la partitura, degradando la fiabilidad del único modo pensado para el aprendizaje inicial.

Nota de alcance: la auditoría original ("Incoherencia 4") describía la falta de cableado `stimulusNotes` hacia `RepertoireView`; la inspección del HEAD verificó que ese cableado ya existe (`App.tsx` → `RepertoireView` → `PianoKeyboard`), por lo que el defecto real se reencuadró, de acuerdo con el usuario, a la contaminación del metrónomo en `activeStimulusNotes`.

## What Changes

- **`useMidi.sendNote`**: las notas emitidas en el Canal 10 (Metrónomo GM) MUST dejar de registrarse en `activeStimulusNotes` (ni al articular ni al liberar), de forma que los ticks del metrónomo —continuo, de pre-roll y libre— nunca iluminen el teclado como pista de estímulo.
- El aislamiento de temporizadores por clave compuesta `${channel}_${noteNumber}` se conserva íntegro: el Canal 10 sigue articulando y silenciando sus ticks con independencia del Canal 1.
- Las notas de estímulo del Canal 1 (piano) conservan el comportamiento actual de registro/liberación en `activeStimulusNotes`, de modo que el modo `'assisted'` ilumina únicamente notas musicales reales en las cuatro modalidades.
- El modo `'blind'` no cambia: `App.tsx` ya pasa un arreglo vacío a las vistas y `calculateActiveStimulusNotes` ya devuelve `[]`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `01-midi-audio-hardware`: el requisito "Aislamiento de Temporizadores por Clave Compuesta" se modifica para excluir el Canal 10 del registro en `activeStimulusNotes`, preservando la independencia de temporizadores entre canales.

## Impact

- **Código afectado**: `src/renderer/src/hooks/useMidi.ts` (único punto de cambio: `sendNote`).
- **Comportamiento observable**: en modo `'assisted'`, el teclado deja de iluminar E5/F5 con cada tick de metrónomo en las 4 modalidades; la iluminación por estímulo real no varía.
- **Specs**: delta sobre `openspec/specs/01-midi-audio-hardware/spec.md`.
- **Pruebas**: `src/renderer/src/hooks/useMidi.test.ts` (nuevos escenarios de exclusión del Canal 10; los existentes de `activeStimulusNotes` deben seguir pasando).
- **Sin cambios** en: `stimulusScheduler.ts`, `App.tsx`, vistas, `PianoKeyboard`, `visualAudioSync.ts`, evaluadores ni contratos de dominio.
