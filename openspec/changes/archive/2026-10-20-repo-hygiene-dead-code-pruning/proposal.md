# Proposal

## Why

La auditoría V9 del repositorio identificó tres hallazgos de higiene y mantenibilidad (F24, F25, F26): archivos `.backup` residuales y un directorio vacío en la raíz, funciones/tipos muertos y duplicación de constantes en el dominio musical, y un import desde el barrel `historyAnalytics` que arriesga ciclos latentes de módulos. Limpiarlos ahora reduce el ruido del código, elimina superficies de confusión para futuras modificaciones y blinda los límites de imports antes de que crezcan.

## What Changes

- **Eliminación de archivos residuales (F26)**: borrar `StudioTopBar.tsx.backup`, `StudioBottomDock.tsx.backup` y `MidiMonitor.tsx.backup` en `src/renderer/src/components/trainer/`, y eliminar el directorio vacío `renderer/` en la raíz del repositorio.
- **Poda de código muerto en dominio musical (F25)**:
  - Eliminar `calculateIntervalFromNotes` de `src/renderer/src/domain/music/intervals.ts` (sin consumidores fuera de su propio test) y sus casos de prueba en `intervals.test.ts`.
  - Eliminar `getTonalContextDescription` de `src/renderer/src/domain/music/tonalContext.ts` (sin consumidores fuera de su propio test) y sus casos en `tonalContext.test.ts`.
  - Eliminar el tipo no utilizado `NoteName` de `src/renderer/src/domain/music/noteUtils.ts`.
  - En `src/renderer/src/domain/analytics/confusionMatrix.ts`: reutilizar `NOTE_NAMES` importado desde `../music/noteUtils` para definir `PITCH_CLASSES = NOTE_NAMES`, eliminando la duplicación literal de los 12 nombres de nota.
- **Blindaje de imports y límites de TypeScript (F24 & F26)**:
  - En `src/renderer/src/domain/analytics/diagnosticReportGenerator.ts`: reemplazar el import del barrel `./historyAnalytics` por imports directos desde `./types` (`AnalyticsMetrics`) y `./thresholds` (`MASTERY_THRESHOLDS`, `BIAS_DOMINANCE_RATIO`).
  - En `tsconfig.node.json`: sanear la inclusión `src/renderer/src/domain/ai/appConfig.ts` para que la configuración del proceso principal no cruce hacia el dominio del renderer; resolver primero la causa raíz (el import cruzado en `src/main/lmStudioHostSync.test.ts`).
- **Verificación**: suite completa (`npm test`), `npm run typecheck` y `npm run lint` con 0 errores y 0 regresiones funcionales.

No hay cambios de comportamiento observable: es una refactorización de higiene pura (eliminación de código muerto, deduplicación y saneamiento de imports).

## Capabilities

### New Capabilities

(ninguna — cambio de refactorización pura sin comportamiento nuevo observable; `skip_specs: true` declarado en `.openspec.yaml`)

### Modified Capabilities

(ninguna — ningún requisito a nivel de spec cambia; el comportamiento externo del sistema permanece idéntico)

## Impact

- **Archivos eliminados**: 3 archivos `.backup` en `src/renderer/src/components/trainer/`; directorio vacío `renderer/` en la raíz.
- **Archivos modificados**: `src/renderer/src/domain/music/intervals.ts`, `intervals.test.ts`, `tonalContext.ts`, `tonalContext.test.ts`, `noteUtils.ts`, `src/renderer/src/domain/analytics/confusionMatrix.ts`, `diagnosticReportGenerator.ts`, `tsconfig.node.json`, y el import cruzado en `src/main/lmStudioHostSync.test.ts` (o la ubicación de la constante compartida que lo origina).
- **Riesgos**: bajo — todo el código eliminado está verificado como sin consumidores en producción; el único punto delicado es el include de `tsconfig.node.json`, cuya causa raíz (import de `appConfig` desde `src/main`) debe resolverse en el mismo cambio para no romper `typecheck`.
- **Sin impacto en**: APIs públicas, persistencia, empaquetado ni comportamiento en runtime.
