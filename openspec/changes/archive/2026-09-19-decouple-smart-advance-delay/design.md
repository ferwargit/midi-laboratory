## Context

Hoy `recordAnswer` computa el retardo de auto-avance con un ternario binario (originalmente en `useTrainerCore.ts:459`, ahora desplazado a `useTrainerCore.ts:461-466`):

```ts
const delay = mode === 'auto_slow' ? autoAdvanceSlowDelayMs : autoAdvanceFastDelayMs
```

Como solo hay dos constantes, todo modo que no sea `'auto_slow'` — es decir, `'auto_fast'` **y** `'smart'` (en acierto) — cae en `autoAdvanceFastDelayMs`. La spec canónica refuerza este acoplamiento (`02-trainer-core-engine/spec.md:21` y la tabla del requisito "Modos de Avance"). Ver `proposal.md - Why` para la motivación del desacoplamiento.

## Goals / Non-Goals

**Goals:**

- Que cada uno de los tres modos con auto-avance lea una constante dedicada y sobrescribible de forma independiente.
- Conservar exactamente la conducta observable actual con los valores por defecto (`smart` sigue en 1500 ms).
- Mantener la invariant SSOT: un único lugar (`DEFAULT_APP_CONFIG.midi`) define cada retardo.

**Non-Goals:**

- No se introduce configuración persistida por usuario ni UI de ajuste de retardos: siguen siendo constantes de dominio.
- No se modifica la máquina de estados, la telemetría metacognitiva ni la lógica de `shouldWaitManual`.
- No se alteran los plug-ins trainers: heredan el nuevo default sin cambios de API.

## Decisions

### Decisión 1: Tres constantes dedicadas en `MidiConfig` (no un mapa por modo)

**Elección:** añadir `autoAdvanceSmartDelayMs: number` junto a las dos existentes, en vez de reemplazar las constantes escalares por un `Record<AdvanceMode, number>`.

**Rationale:** las constantes escalares son el patrón establecido por `debounceWindowMs`, `hungNoteWatchdogMs` y los retardos actuales; además son referenciadas nominalmente en las specs 01 y 02. Un mapa por modo acoplaría el módulo de configuración al tipo unión `AdvanceMode` (que hoy vive en `domain/exercise/types.ts`) y forzaría una dependencia de dominio cruzada. Por el mismo motivo, no se exporta un helper `delayForMode(mode)` en `appConfig.ts`: la selección se mantiene en el kernel, que ya importa `AdvanceMode`.

**Alternativa considerada:** `autoAdvanceDelays: Record<Exclude<AdvanceMode,'manual'>, number>` — rechazada por acoplamiento de dominio y por romper la forma nominal que consumen las specs.

### Decisión 2: Selección explícita por modo, no ternario encadenado

**Elección:** reemplazar el ternario por una selección legible y exhaustiva:

```ts
const delay =
  mode === 'auto_slow'
    ? autoAdvanceSlowDelayMs
    : mode === 'auto_fast'
      ? autoAdvanceFastDelayMs
      : autoAdvanceSmartDelayMs
```

**Rationale:** `'smart'` es el default del hook (`defaultAdvanceMode = 'smart'`), por lo que dejarlo como rama residual del ternario es precisamente el bug de acoplamiento que se corrige; debe ser una rama nombrada explícitamente. Esta forma es exhaustiva por construcción para los tres modos con auto-avance y deja a `'manual'` fuera por reachablese solo cuando `shouldWaitManual` es falso.

**Alternativa considerada:** `switch` con `default: throw` — rechazada por introducir un fallo en tiempo de ejecución en un path de UI; el hook debe degradarse con gracia.

### Decisión 3: Precedencia de retardos — option del hook > constante SSOT

**Elección:** `autoAdvanceSmartDelayMs?: number` en `TrainerCoreOptions` con default `DEFAULT_APP_CONFIG.midi.autoAdvanceSmartDelayMs`, idéntico al mecanismo que ya usan `autoAdvanceFastDelayMs` y `autoAdvanceSlowDelayMs`. Precedencia: override explícito de la modalidad > constante SSOT.

**Rationale:** presicia simétrica con las dos opciones existentes y permite que una modalidad concreta (p. ej. repertorio, con frases más largas) calibre su propia pausa sin tocar la SSOT global. El `useCallback` de `recordAnswer` debe añadir `autoAdvanceSmartDelayMs` a su arreglo de dependencias, so pena de stale-closure silencioso.

### Decisión 4: Las tables SSOT de Purpose se editan en la spec canónica, no en el delta

**Elección:** la única delta formal con `## MODIFIED Requirements` es `02-trainer-core-engine` (requisito "Modos de Avance (AdvanceMode)"). Los inventarios SSOT que viven en secciones `## Purpose` de ambas specs (la lista de `02` y la tabla de `01`) se actualizan por edición directa de `openspec/specs/<cap>/spec.md`, pues las deltas no pueden expresar cambios de `## Purpose`.

**Rationale:** la herramienta ignora cualquier `## Purpose` en una delta de capacidad existente; la edición directa es el mecanismo sancionado. Ver `tasks.md` para los pasos atómicos.

## Risks / Trade-offs

- **[Stale closure en `recordAnswer`]** → si se olvida añadir `autoAdvanceSmartDelayMs` al arreglo de dependencias del `useCallback`, el override de una modalidad no tomaría efecto. Mitigación: caso de prueba dedicado en `useTrainerCore.test.ts` con fake timers, que fallaría visiblemente.
- **[Deriva entre la spec canónica y la delta]** → al editar las tablas SSOT de Purpose directamente, la delta `02` y la spec canónica podrían desincronizarse si alguien reescribe la tabla a mano. Mitigación: el cambio incluye ambos ediciones en el mismo tasks.md y la verificación se hace sobre `openspec/specs/`.
- **[Cobertura incompleta de la tabla de la spec 01]** → la tabla SSOT de `01` solo enumera constantes; una omisión no rompería compilación. Mitigación: tarea explícita de revisión en `tasks.md`.
- **[Default idéntico puede ocultar el desacoplamiento]** → con 1500 ms en ambas, una regresión que vuelva a la constante de `auto_fast` pasaría inadvertida. Mitigación: el caso de prueba usa `1200` ms como override para evidenciar la independencia.

## Migration Plan

No requiere migración ni rollback especial: el cambio es retrocompatible por construction (el default de `autoAdvanceSmartDelayMs` es `1500`, valor que `'smart'` ya usaba de facto). Un rollback consiste en revertir la constante y restaurar el ternario original.
