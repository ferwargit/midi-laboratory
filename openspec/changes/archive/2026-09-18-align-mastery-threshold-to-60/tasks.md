## 1. SSOT — Umbral canónico y filtro de sesiones

- [x] 1.1 En `src/renderer/src/domain/analytics/historyAnalytics.ts`, actualizar `MASTERY_THRESHOLDS`: `LEARNING_MIN: 50` → `60` y `CRITICAL_MAX: 50` → `60` (dejar `MASTERED_MIN: 85` intacto). Verificar: `thresholdsConsistency.test.tsx` sigue pasando la aserción `MASTERED_MIN === 85`.
- [x] 1.2 En el mismo archivo, reescribir las tres compuertas de `mastery` de `filterSessionsAdvanced` (líneas ~794-797) para que lean `MASTERY_THRESHOLDS.MASTERED_MIN` / `.LEARNING_MIN` / `.CRITICAL_MAX` en lugar de los literales `85`/`50`. Verificar: una sesión de `accuracyPercentage: 59` cae en `critical` y una de `60` cae en `learning`.

## 2. Remediación SSOT — Motor adaptativo y hooks

- [x] 2.1 En `src/renderer/src/domain/adaptation/adaptiveEngine.ts`, importar `MASTERY_THRESHOLDS` desde `../analytics/historyAnalytics` y reemplazar los literales: `perf.accuracyPercentage < 50` (línea ~115) → `< MASTERY_THRESHOLDS.CRITICAL_MAX`; `perf.accuracyPercentage >= 85` (líneas ~117 y ~149) → `>= MASTERY_THRESHOLDS.MASTERED_MIN`. Verificar: `npm run test -- adaptiveEngine` pasa y `npm run typecheck` no reporta ciclo de imports.
- [x] 2.2 En `src/renderer/src/hooks/useSingleNoteTrainer.ts`, reemplazar `perf.accuracyPercentage >= 85` (línea ~159) y `perf.accuracyPercentage < 85` (línea ~404) por `MASTERY_THRESHOLDS.MASTERED_MIN`. Verificar: `npm run test -- useSingleNoteTrainer` pasa.

## 3. Remediación SSOT — Componentes de UI

- [x] 3.1 En `src/renderer/src/components/views/SingleNoteView.tsx`, importar `MASTERY_THRESHOLDS` y reemplazar `accuracyPercentage < 85` (lista de notas débiles, línea ~39) y la escalera de colores `>= 85` / `>= 50` (líneas ~407-411) por `MASTERED_MIN` / `CRITICAL_MAX`. Verificar: `npm run typecheck` sin errores.
- [x] 3.2 En `src/renderer/src/components/views/analytics/AnalyticsKpiCards.tsx`, reemplazar `normalizedOverallAccuracy >= 85` / `>= 50` (líneas ~33-37) por `MASTERY_THRESHOLDS`. Verificar: con `normalizedOverallAccuracy === 60` el KPI renderiza en ámbar.
- [x] 3.3 En `src/renderer/src/components/views/analytics/SessionsTableTab.tsx`, reemplazar `item.normalizedAccuracy >= 85` / `>= 50` (líneas ~539-543) por `MASTERY_THRESHOLDS`. Verificar: `npm run typecheck` sin errores.
- [x] 3.4 En `src/renderer/src/components/views/analytics/SessionDetailModal.tsx`, reemplazar `accuracyPercentage >= 85` (línea ~119) por `MASTERED_MIN` y la leyenda hardcoded `>85% / 50-85% / <50%` (líneas ~626-628) por interpolaciones de `MASTERY_THRESHOLDS`. Verificar: la leyenda renderiza `>85%`, `60-85%`, `<60%`.
- [x] 3.5 En `src/renderer/src/components/trainer/SequenceSummaryCard.tsx`, reemplazar `accuracyPercentage < 85` (línea ~62) por `MASTERED_MIN`. Verificar: `npm run typecheck` sin errores.

## 4. Modernización Tailwind CSS v4

- [x] 4.1 En `src/renderer/src/components/views/guide/LatencySpectrumDiagram.tsx`, reemplazar las 3 ocurrencias de `bg-gradient-to-r` por `bg-linear-to-r` (líneas 20, 23 y 26). Verificar: compila sin advertencias de deprecación y `thresholdsConsistency.test.tsx` (que renderiza este componente) sigue pasando.

## 5. Pruebas del nuevo umbral

- [x] 5.1 En `src/renderer/src/domain/analytics/historyAnalytics.test.ts`, añadir un caso `describe('filterSessionsAdvanced - Umbral de maestría 60')` con sesiones a `59`, `60`, `84` y `85` de precisión, asertando: `critical` incluye solo `< 60`, `learning` incluye `60..84`, `mastered` incluye `>= 85`. Verificar: `npm run test -- historyAnalytics` pasa.
- [x] 5.2 En `src/renderer/src/domain/analytics/thresholdsConsistency.test.tsx`, ampliar la aserción de constantes canónicas: añadir `expect(MASTERY_THRESHOLDS.LEARNING_MIN).toBe(60)` y `expect(MASTERY_THRESHOLDS.CRITICAL_MAX).toBe(60)`. Verificar: `npm run test -- thresholdsConsistency` pasa.
- [x] 5.3 En `src/renderer/src/domain/analytics/thresholdsConsistency.test.tsx`, añadir un scenario de UI que renderice `AnalyticsKpiCards` con `normalizedOverallAccuracy === 60` y afirme el color ámbar derivado de la SSOT. Verificar: `npm run test -- thresholdsConsistency` pasa.

## 6. Especificación y verificación final

- [x] 6.1 Confirmar que el delta en `openspec/changes/align-mastery-threshold-to-60/specs/05-analytics-psychometrics/spec.md` contiene `LEARNING_MIN: 60` y `CRITICAL_MAX: 60` bajo `## MODIFIED Requirements`, sin mención del 50% legado. Verificar: `openspec validate align-mastery-threshold-to-60 --strict` exitoso.
- [x] 6.2 Ejecutar `npm run typecheck` y verificar: 0 errores.
- [x] 6.3 Ejecutar `npm run lint` y verificar: 0 errores (y sin nuevas advertencias).
- [x] 6.4 Ejecutar `npm run test` completo y verificar: toda la suite pasa, sin tests deshabilitados o saltados.
- [x] 6.5 Barrido final: buscar en `src/` comparaciones de `accuracyPercentage` / `normalizedAccuracy` contra literales `85`/`50` y confirmar que ninguna quedó sin remediar (excepto los non-goals documentados: `shouldPromoteLevel` y la segmentación de `diagnosticReportGenerator`). Verificar: el listado de hallazgos restantes coincide exactamente con los non-goals de `design.md`.

## 7. Resoluciones post-verificación (warnings del /opsx-verify)

- [x] 7.1 Resolver WARNING: en `src/renderer/src/domain/analytics/diagnosticReportGenerator.ts`, importar `MASTERY_THRESHOLDS` y reemplazar la compuerta de progresión hardcodeada `overallAccuracy >= 80` (línea ~108) por `>= MASTERY_THRESHOLDS.MASTERED_MIN`, de modo que "Avanzar a Modalidad 2" converja con la SSOT. La segmentación canónica 85/65 del resumen ejecutivo se mantiene (requisito aparte). Verificar: `npm run test -- historyAnalytics` y `thresholdsConsistency` pasan; design.md actualizado.
- [x] 7.2 Resolver SUGGESTION: migrar las 9 ocurrencias restantes de `bg-gradient-to-r` → `bg-linear-to-r` en `AnalyticsView.tsx`, `AiConsultationTab.tsx`, `AiDiagnosticTab.tsx`, `AnalyticsCharts.tsx` y `SessionsTableTab.tsx`. Verificar: grep de `bg-gradient-to-r` en `src/` devuelve 0 resultados y `npm run lint` sin advertencias.
- [x] 7.3 Re-ejecutar `npm run typecheck`, `npm run lint` y `npm run test` completos tras las resoluciones. Verificar: 0 errores de tipo, 0 warnings de lint, 288 tests en 52 archivos pasando.
