## Why

El modo `'smart'` comparte la constante `autoAdvanceFastDelayMs` (1500 ms) con el modo `'auto_fast'`, de modo que ambos quedan acoplados a un mismo retardo. Esto impide afinar de forma independiente la pausa pedagógica del auto-avance inteligente (que solo avanza tras un acierto) sin arrastrar también al modo `auto_fast`. Desacoplar ambas constantes les da a cada modo su propio SSOT y habilita calibración pedagógica diferenciada.

## What Changes

- Se añade `autoAdvanceSmartDelayMs: number` a la interfaz `MidiConfig` con valor por defecto `1500` en `DEFAULT_APP_CONFIG.midi` (`src/renderer/src/domain/ai/appConfig.ts`).
- Se añade la opción `autoAdvanceSmartDelayMs?: number` a `TrainerCoreOptions`, con default tomado de `DEFAULT_APP_CONFIG.midi.autoAdvanceSmartDelayMs` (`src/renderer/src/hooks/useTrainerCore.ts`).
- El cálculo de retardo en `recordAnswer` deja de ser un ternario binario y pasa a seleccionar la constante dedicada por modo: `'auto_slow'` → `autoAdvanceSlowDelayMs`, `'auto_fast'` → `autoAdvanceFastDelayMs`, `'smart'` → `autoAdvanceSmartDelayMs`.
- Se amplía la cobertura de pruebas: existencia/valor de la nueva constante en `appConfig.test.ts` y un caso en `useTrainerCore.test.ts` que verifica que sobreescribir `autoAdvanceSmartDelayMs` afecta a `'smart'` sin alterar a `'auto_fast'`.
- Se actualizan las especificaciones canónicas de `02-trainer-core-engine` (tabla SSOT y tabla del requisito "Modos de Avance") y `01-midi-audio-hardware` (tabla SSOT de `DEFAULT_APP_CONFIG.midi`).

**Compatibilidad:** el default de `1500` conserva la conducta observable actual, por lo que es un cambio retrocompatible y no constituye un breaking change.

## Capabilities

### New Capabilities

<!-- Ninguna: no se introduce una capacidad nueva, solo se refine el comportamiento de capacidades existentes. -->

### Modified Capabilities

- `02-trainer-core-engine`: el requisito "Modos de Avance (AdvanceMode)" cambia su regla de selección de retardo — el modo `'smart'` deja de leer `autoAdvanceFastDelayMs` y pasa a leer su constante dedicada `autoAdvanceSmartDelayMs`; la lista SSOT de retardos del kernel gana esa constante. Es la única capacidad con archivo delta formal (`specs/02-trainer-core-engine/spec.md`).

> **Nota:** la tabla SSOT de `## Purpose` de `01-midi-audio-hardware` también incorpora `autoAdvanceSmartDelayMs = 1500`, pero se actualizó directamente en su archivo canónico (`openspec/specs/01-midi-audio-hardware/spec.md`) — las deltas de OpenSpec no pueden expresar cambios de `## Purpose`, por lo que no existe archivo delta para esa capacidad. Ver `design.md`, Decisión 4.

## Impact

- **Configuración dominio**: `src/renderer/src/domain/ai/appConfig.ts` (interfaz `MidiConfig` y objeto `DEFAULT_APP_CONFIG`).
- **Kernel de sesión**: `src/renderer/src/hooks/useTrainerCore.ts` (interfaz `TrainerCoreOptions`, lista de parámetros del hook, cuerpo de `recordAnswer` y su arreglo de dependencias del `useCallback`).
- **Pruebas**: `src/renderer/src/domain/ai/appConfig.test.ts` y `src/renderer/src/hooks/useTrainerCore.test.ts`.
- **Especificaciones**: `openspec/specs/02-trainer-core-engine/spec.md` y `openspec/specs/01-midi-audio-hardware/spec.md`.
- **Consumidores**: los cuatro plug-ins trainers (`useSingleNoteTrainer`, `useIntervalTrainer`, `useSequenceTrainer`, `useRepertoireTrainer`) NO requieren cambios — heredan el nuevo default automáticamente y la opción es opcional.
- **Verificación**: `npm run typecheck` y `npm run test` (vitest).
