# Tasks

## 1. Limpieza de archivos residuales (F26)

- [x] 1.1 Eliminar `src/renderer/src/components/trainer/StudioTopBar.tsx.backup`, `StudioBottomDock.tsx.backup` y `MidiMonitor.tsx.backup`; verificar con búsqueda global que ningún archivo `.backup` queda bajo `src/` y que ningún import hace referencia a ellos.
- [x] 1.2 Eliminar el directorio vacío `renderer/` en la raíz del repositorio; verificar con `Test-Path renderer` que devuelve `False` y que `git status` no muestra eliminaciones inesperadas.

## 2. Poda de código muerto en dominio musical (F25)

- [x] 2.1 Re-verificar con búsqueda global que `calculateIntervalFromNotes` solo aparece en `intervals.ts` e `intervals.test.ts`; luego eliminar la función (intervals.ts:166-178) y su caso de prueba junto con su entrada en el import de `intervals.test.ts`. Verificar ejecutando `npx vitest run src/renderer/src/domain/music/intervals.test.ts` con 0 fallos.
- [x] 2.2 Re-verificar con búsqueda global que `getTonalContextDescription` solo aparece en `tonalContext.ts` y `tonalContext.test.ts`; luego eliminar la función (tonalContext.ts:90-97), el import ahora huérfano de `midiNoteToName` en `tonalContext.ts` y sus casos de prueba junto con su entrada en el import de `tonalContext.test.ts`. Verificar ejecutando `npx vitest run src/renderer/src/domain/music/tonalContext.test.ts` con 0 fallos.
- [x] 2.3 Re-verificar con búsqueda global que el tipo `NoteName` no tiene consumidores; luego eliminar `export type NoteName` de `noteUtils.ts` (conservar `NOTE_NAMES`). Verificar con `npm run typecheck` sin errores nuevos.
- [x] 2.4 En `confusionMatrix.ts`: reemplazar la definición literal de `PITCH_CLASSES` (líneas 4-17) por `import { NOTE_NAMES } from '../music/noteUtils'` + `export const PITCH_CLASSES = NOTE_NAMES`. Verificar ejecutando los tests existentes de `confusionMatrix`/analytics relacionados con 0 fallos y confirmando que `pitchClasses` en la salida sigue siendo el array de 12 nombres.

## 3. Blindaje de imports y límites de TypeScript (F24 & F26)

- [x] 3.1 En `diagnosticReportGenerator.ts`: cambiar `import { AnalyticsMetrics, MASTERY_THRESHOLDS, BIAS_DOMINANCE_RATIO } from './historyAnalytics'` por `import { AnalyticsMetrics } from './types'` e `import { MASTERY_THRESHOLDS, BIAS_DOMINANCE_RATIO } from './thresholds'`; verificar con búsqueda global que el archivo ya no referencia `historyAnalytics` y que `npm run typecheck` pasa.
- [x] 3.2 En `tsconfig.node.json`: confirmar que la única inclusión que cruza al renderer es `src/renderer/src/domain/ai/appConfig.ts` (necesaria para el test contractual `lmStudioHostSync.test.ts`, hallazgo F5/V7) y añadir un comentario que lo documente; verificar que no existen otras rutas del renderer en el include y que `npm run typecheck` pasa.

## 4. Verificación integral

- [x] 4.1 Ejecutar `npm run lint` con 0 errores (confirma que no quedaron imports huérfanos tras las podas).
- [x] 4.2 Ejecutar `npm run typecheck` con 0 errores (confirma que ningún símbolo eliminado tiene consumidores residuales).
- [x] 4.3 Ejecutar `npm test` completo con 0 fallos y 0 regresiones funcionales; revisar `git status` para confirmar que solo cambiaron los archivos del alcance.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
