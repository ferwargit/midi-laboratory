# Proposal

## Why

La auditoría V9 (hallazgo **F21**) detectó que la derivación de la modalidad pedagógica y del tamaño nominal del pool de notas está **triplicada** en tres módulos de analítica mediante heurísticas de cadenas (`.includes('nivel 1')`, regex sobre `presetName`):

- `src/renderer/src/domain/analytics/sessionClassification.ts:60-105` (`resolveNominalPoolSize`)
- `src/renderer/src/domain/analytics/sessionFilters.ts:99-130` (matriz de matching de preset por nivel)
- `src/renderer/src/domain/analytics/longitudinal.ts:28-60` (`reconstructSessionConfig`, mapeo preset → notas)

Esto viola DRY, ya provocó colisiones históricas (F-06/F-14: "nivel 10" contiene "nivel 1"; presets 1.x vs genéricos) y vuelve frágil la analítica ante cualquier renombramiento de presets: cada cambio de nomenclatura exige corregir tres sitios desincronizados.

## What Changes

- **Nuevo módulo SSOT** `src/renderer/src/domain/analytics/sessionModality.ts`:
  - `resolveSessionMode(session: DbSessionRecord): SessionMode | null` — resolución de modalidad basada **primariamente en el campo canónico `targetMode`**, con heurísticas de strings solo como fallback defensivo para registros históricos sin `targetMode`.
  - `resolveNominalPoolSize(session: DbSessionRecord, answers?: DbAnswerRecord[]): number` — resolución del pool **vinculada directamente a los presets canónicos** (`EXERCISE_PRESETS`, `INTERVAL_PRESETS`, `SEQUENCE_PRESETS`), con la heurística de strings relegada a fallback para registros heredados y el conteo empírico de notas únicas como último recurso.
  - `matchesSessionPreset(session, targetPresetName): boolean` — matching de preset para el filtro de la barra de analítica, canónico primero y heurístico después.
- **Refactor de los 3 consumidores** para delegar en el SSOT (sin cambiar su API pública ni el barrel `historyAnalytics.ts`):
  - `sessionClassification.ts`: `resolveNominalPoolSize` y los predicados `is*Session` pasan a ser delegadores del módulo SSOT.
  - `sessionFilters.ts`: el bloque de filtro por preset (matriz `isLevel1/2/3/4/isPentatonic/isCustom/isDirectMatch`) delega en `matchesSessionPreset`.
  - `longitudinal.ts`: `reconstructSessionConfig` consume `resolveSessionMode` y la resolución canónica de preset del SSOT, eliminando su copia local del mapeo preset → notas.
  - `historyAnalytics.ts`: las dos cadenas duplicadas de resolución de modalidad (`targetMode || isInterval → isSequence → isRepertoire`) se reemplazan por `resolveSessionMode`.
- **Tests**: nueva suite data-driven `sessionModality.test.ts` que verifica, para **cada preset definido** en `presets.ts`, `intervals.ts` y `sequences.ts`, que el pool resuelto coincide con la cantidad real de notas/elementos del preset; actualización mecánica de los call-sites de `resolveNominalPoolSize` en los tests existentes.

## Capabilities

### New Capabilities

(ninguna — la resolución de modalidad/pool pertenece a la capacidad de analítica existente)

### Modified Capabilities

- `05-analytics-psychometrics`: la resolución del `poolSize` nominal pasa a estar anclada a los presets canónicos del sistema (con heurística de strings solo como fallback histórico); la modalidad de sesión se resuelve desde un SSOT único basado en `targetMode`; el matching de preset en `filterSessionsAdvanced` y la reconstrucción de prescripción de re-testeo delegan en ese SSOT.

## Impact

- **Código afectado** (solo `src/renderer/src/domain/analytics/`):
  - Nuevo: `sessionModality.ts`, `sessionModality.test.ts`.
  - Modificados: `sessionClassification.ts`, `sessionFilters.ts`, `longitudinal.ts`, `historyAnalytics.ts` (barrel + 2 cadenas de modo) y sus tests (`sessionClassification.test.ts`, `sessionFilters.test.ts`, `longitudinal.test.ts`).
- **API**: `resolveNominalPoolSize` cambia su segundo parámetro de `empiricalUniqueCount: number` a `answers?: DbAnswerRecord[]` (los dos call-sites de producción y los tests se migran mecánicamente; el barrel `historyAnalytics.ts` preserva el resto de la superficie pública).
- **Comportamiento**: sin cambios observables para los registros actuales (todos los entrenadores persisten `targetMode` y los nombres de preset vigentes); los registros históricos sin `targetMode` o con nomenclatura antigua se resuelven por las mismas heurísticas de siempre, ahora centralizadas. Casos antes mal resueltos (p. ej. `Rango G4 a G5` → 13 notas, presets de secuencia 2.x) pasan a resolverse correctamente desde los presets canónicos.
- **Riesgos**: prioridad única de modalidad para registros legacy que matcheaban varias heurísticas a la vez (documentado en design.md); suite completa `npm test`, `typecheck` y `lint` como compuerta de 0 regresiones.
