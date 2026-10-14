# Tasks

## 1. Configuración SSOT CPI por Modalidad (thresholds.ts)

- [x] 1.1 Añadir `export interface CPIModalityConfig { targetLatencySec: number; targetRpm: number }` y `export const CPI_CONFIG_BY_MODE: Record<ModalityKey | 'global', CPIModalityConfig>` con los valores objetivo en `thresholds.ts` (ver design.md Decisión 2).
- [x] 1.2 Exportar `CPI_CONFIG_BY_MODE` desde el barrel export en `historyAnalytics.ts` (línea 7: `export * from './thresholds'` ya lo incluye, verificar que el export nuevo está accesible).

## 2. Modificación de calculateSessionCPI (psychometrics.ts)

- [x] 2.1 Importar `CPI_CONFIG_BY_MODE` desde `./thresholds` en `psychometrics.ts`.
- [x] 2.2 Modificar la firma: `calculateSessionCPI(normalizedAccuracy, entropyBits, responsesPerMinute, avgResponseTimeMs, inputMethod, mode?: string)`.
- [x] 2.3 Implementar resolución de modo: `const resolvedMode = (mode || 'single_note').trim().toLowerCase() as keyof typeof CPI_CONFIG_BY_MODE; const cpiConfig = CPI_CONFIG_BY_MODE[resolvedMode] ?? CPI_CONFIG_BY_MODE.single_note;`.
- [x] 2.4 Sustituir `15.0` y `1.5` en `speedFactor` por `cpiConfig.targetRpm` y `cpiConfig.targetLatencySec`: `const speedFactor = Math.max(0.3, Math.min(2.5, (responsesPerMinute / cpiConfig.targetRpm) * (cpiConfig.targetLatencySec / latencySec)))`.
- [x] 2.5 Verificar que `npm run typecheck` pasa sin errores.

## 3. Propagación de sessionMode en historyAnalytics.ts

- [x] 3.1 En `computeAnalyticsMetrics`, línea ~148 donde se invoca `calculateSessionCPI`, añadir 6º argumento `sessionMode` (ya computado en línea ~113-121).
- [x] 3.2 Verificar que `npm run typecheck` pasa.

## 4. Propagación de sessionMode en SessionDetailModal.tsx

- [x] 4.1 En el `useMemo` `cpiParams` (línea ~82-105), resolver `sessionMode` igual que en `historyAnalytics.ts`: priorizar `session.targetMode` con fallback a clasificadores `isIntervalSession` / `isSequenceSession` / `isRepertoireSession` / default `'single_note'`.
- [x] 4.2 Pasar `sessionMode` como 6º argumento a `calculateSessionCPI` en la invocación (línea ~97-102).
- [x] 4.3 Verificar que `npm run typecheck` pasa.

## 5. Pruebas Unitarias TDD (historyAnalytics.test.ts)

- [x] 5.1 Añadir import de `calculateSessionCPI` si no existe (ya importado en línea 8).
- [x] 5.2 Crear `describe('calculateSessionCPI - Escalado por Modalidad')` con dos tests:
  - [x] 5.2.1 Test retrocompatibilidad: `calculateSessionCPI(90, 2.0, 20, 1000, 'hardware')` (sin mode) y `calculateSessionCPI(90, 2.0, 20, 1000, 'hardware', 'single_note')` deben producir **exactamente el mismo valor numérico** que la implementación anterior (guardar valor esperado como constante).
  - [x] 5.2.2 Test corrección Intervalos: `calculateSessionCPI(90, 2.0, 15.3, 2100, 'hardware', 'intervals')` debe retornar **> 800** (antes devolvía ~356).
- [x] 5.3 Ejecutar `npm run test` y verificar que todos los tests pasan (incluyendo los existentes).

## 6. Validación final

- [x] 6.1 Ejecutar `npm run typecheck` — debe pasar limpio (0 errores).
- [x] 6.2 Ejecutar `npm run test` — debe pasar limpio (0 fallos).
- [x] 6.3 Ejecutar `openspec validate cpi-modality-scaling --strict` — debe validar sin errores.