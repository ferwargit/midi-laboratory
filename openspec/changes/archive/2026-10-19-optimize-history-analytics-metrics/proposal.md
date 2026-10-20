# Proposal

## Why

La Auditoría V9 identificó el hallazgo **F23** en `computeAnalyticsMetrics` (`src/renderer/src/domain/analytics/historyAnalytics.ts`): un bucle cuadrático O(S×A) que filtra las respuestas de cada sesión dentro del `.map()` de sesiones, una resolución de modalidad duplicada en dos bloques internos, y un round-trip frágil de cadenas en la matriz de confusión (serializar `"${expName} ➔ ${playName}"` y re-parsear con `split(' ➔ ')`). Con historiales largos el costo cuadrático degrada la apertura de la vista de Analítica, y la dependencia de un separador textual es una fragilidad innecesaria en el dominio puro.

## What Changes

- **Pre-agrupación de respuestas por sesión**: construir un `Map<string, DbAnswerRecord[]>` indexado por `sessionId` antes de iterar las sesiones, eliminando el `filteredAnswers.filter(...)` por sesión y reduciendo el costo global de O(S×A) a O(S+A).
- **Resolución de modalidad única**: reemplazar las dos deducciones de modalidad (bloque de sesiones y bucle de respuestas) por una única resolución por sesión con el resolvedor canónico `resolveSessionMode(session)` del SSOT `sessionModality.ts`, reutilizada en ambos bloques.
- **Matriz de confusión tipada**: sustituir el round-trip de strings por un `Map` con clave estructurada que mantenga pares tipados `{ expected, played, count }` sin serializar ni des-serializar texto.
- **Modularización interna**: extraer bloques internos de `computeAnalyticsMetrics` en helpers privados del módulo para reducir su complejidad ciclomática, manteniendo la firma pública y el contrato de retorno `AnalyticsMetrics` 100% idéntico.

No hay cambios de comportamiento observable: mismos valores, mismos órdenes de ordenación, mismos límites (top 5), misma API pública del barrel.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

(ninguna — refactor puro de rendimiento y robustez interna; el comportamiento especificado en `05-analytics-psychometrics` — sesgo direccional, `topConfusions` ordenado y limitado a 5, umbrales por modalidad, psicometría — no cambia. El cambio declara `skip_specs: true` en su `.openspec.yaml`.)

## Impact

- **Código afectado**: únicamente `src/renderer/src/domain/analytics/historyAnalytics.ts` (función `computeAnalyticsMetrics` y helpers privados nuevos del mismo módulo).
- **Consumidores**: sin cambios en sus imports ni en sus resultados — `useAnalyticsStore.ts`, `AnalyticsView.tsx`, `aiDecoupling.test.ts`, `thresholdsConsistency.test.tsx` y `historyAnalytics.test.ts` siguen consumiendo la misma firma desde el barrel.
- **Riesgo**: bajo. La suite existente (`historyAnalytics.test.ts` con ~1121 líneas de aserciones de exactitud matemática, `analyticsStore.test.ts`, `thresholdsConsistency.test.tsx`, `aiDecoupling.test.ts`, tests de gráficos/vistas) actúa como red de regresión; se exige verde completo más `typecheck` y `lint` sin errores.
