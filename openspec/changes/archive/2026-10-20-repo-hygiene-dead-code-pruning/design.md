# Design

## Context

Verificado contra el código actual (auditoría V9, hallazgos F24/F25/F26):

- Los 3 archivos `.backup` existen en `src/renderer/src/components/trainer/` y el directorio `renderer/` en la raíz está vacío (0 entradas).
- `calculateIntervalFromNotes` (intervals.ts:166) y `getTonalContextDescription` (tonalContext.ts:90) solo tienen consumidores en sus propios tests; `NoteName` (noteUtils.ts:3) no tiene ningún consumidor.
- `confusionMatrix.ts:4-17` duplica literalmente los 12 nombres de nota que `noteUtils.ts` ya exporta como `NOTE_NAMES`.
- `diagnosticReportGenerator.ts:1` importa `AnalyticsMetrics, MASTERY_THRESHOLDS, BIAS_DOMINANCE_RATIO` desde el barrel `./historyAnalytics`, cuando `AnalyticsMetrics` vive en `./types` y las constantes en `./thresholds`. El barrel a su vez importa de `./types`, `./thresholds`, `./psychometrics`, `./sessionModality`, etc., por lo que el atajo por el barrel crea rutas de dependencia innecesarias con riesgo de ciclo.
- `tsconfig.node.json` incluye `src/renderer/src/domain/ai/appConfig.ts` porque `src/main/lmStudioHostSync.test.ts:3` importa `DEFAULT_APP_CONFIG` desde ahí. Ese import cruzado es **deliberado**: es el test de regresión contractual (hallazgo F5, auditoría V7) que acopla el host canónico de LM Studio del renderer (SSOT) con la allowlist del Main para detectar desviaciones.

Ver proposal.md para la motivación completa.

## Goals / Non-Goals

**Goals:**

- Repositorio sin archivos residuales ni directorios vacíos.
- Dominio musical sin funciones/tipos muertos ni duplicación de `NOTE_NAMES`.
- `diagnosticReportGenerator.ts` dependiendo solo de submódulos directos, nunca del barrel.
- `tsconfig.node.json` con inclusiones justificadas y documentadas.
- `npm test`, `npm run typecheck` y `npm run lint` en 0 errores.

**Non-Goals:**

- No refactorizar el barrel `historyAnalytics` ni sus 35 sitios consumidores (solo se corrige el import de `diagnosticReportGenerator.ts`).
- No mover `DEFAULT_APP_CONFIG` a un módulo compartido `src/shared/` (refactor desproporcionado para este cambio de higiene).
- No tocar comportamiento en runtime ni APIs públicas.

## Decisions

1. **Poda con verificación de consumidores previa.** Cada símbolo eliminado se valida con búsqueda global antes de borrar (ya verificado en planificación; se re-verifica en implementación por si el árbol cambió). Alternativa: dejar código muerto con `@deprecated` — rechazada porque la auditoría pide eliminación y el historial de git lo preserva.

2. **`PITCH_CLASSES = NOTE_NAMES` con re-export tipado.** En `confusionMatrix.ts`, importar `NOTE_NAMES` desde `../music/noteUtils` y definir `export const PITCH_CLASSES = NOTE_NAMES`. `NOTE_NAMES` ya es `as const`, por lo que el tipo literal se preserva y los consumidores de `PITCH_CLASSES` (indexado por `% 12` y el campo `pitchClasses` de `ConfusionMatrix2DData`) no cambian. Alternativa: duplicar el array con un comentario — rechazada, es exactamente el problema F25.

3. **Limpieza de imports huérfanos derivados.** Al eliminar `getTonalContextDescription`, el import `midiNoteToName` en `tonalContext.ts` queda huérfano y debe eliminarse en el mismo paso (si no, `lint` falla). Igual con `calculateIntervalFromNotes` en el import de `intervals.test.ts`.

4. **`tsconfig.node.json`: sanear = documentar la única inclusión cruzada necesaria.** El include de `src/renderer/src/domain/ai/appConfig.ts` es necesario para tipar el test contractual `lmStudioHostSync.test.ts`; eliminarlo rompería `typecheck` y debilitaría el guard F5. El saneamiento consiste en: (a) verificar que no existan otras inclusiones que crucen al renderer (hoy no las hay — el resto del include es `electron.vite.config.*`, `src/main/**`, `src/preload/**`), y (b) añadir un comentario en `tsconfig.node.json` que documente por qué esa única ruta del renderer está incluida, para que futuras auditorías no la marquen como cruce innecesario. Alternativa considerada: mover `DEFAULT_APP_CONFIG` a `src/shared/` — rechazada porque toca a todos los consumidores del renderer y excede el alcance de higiene.

5. **Imports directos en `diagnosticReportGenerator.ts`.** `AnalyticsMetrics` desde `./types`; `MASTERY_THRESHOLDS, BIAS_DOMINANCE_RATIO` desde `./thresholds` (ambos verificados en los submódulos). Se elimina por completo la dependencia del barrel. Alternativa: mantener el barrel y solo reordenar — rechazada, no elimina el riesgo de ciclo F24.

## Risks / Trade-offs

- [Regresión por eliminación de símbolo aún referenciado dinámicamente] → Búsqueda global de cada símbolo antes de borrar + `typecheck` y `test` completos como puerta de salida.
- [Cambio de identidad de `PITCH_CLASSES` (misma referencia que `NOTE_NAMES`)] → El array es inmutable (`as const`) y solo se lee; los tests existentes de `confusionMatrix` validan el comportamiento.
- [Test contractual F5 sin tipado si se elimina el include por error] → Decisión 4 mantiene el include documentado; `typecheck` lo detectaría de inmediato.
- [Imports del barrel reintroducidos en el futuro] → Fuera de alcance automatizarlo; el patrón de imports directos queda establecido en `diagnosticReportGenerator.ts` como convención.

## Migration Plan

Cambio local sin despliegue: los pasos son eliminaciones y ediciones de imports verificables con la suite existente. Rollback = `git revert` del commit único de higiene.

## Open Questions

(ninguno)
