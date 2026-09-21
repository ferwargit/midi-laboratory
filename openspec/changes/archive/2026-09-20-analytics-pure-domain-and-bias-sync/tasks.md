## 1. Pruebas TDD (Red primero)

- [x] 1.1 Añadir en `historyAnalytics.test.ts` los tests del filtro `inputSource` (sesiones `hardware`/`virtual`/`mixed` y caso `'all'`) y verificar que fallan antes de implementar (el filtro hoy no existe)
- [x] 1.2 Añadir tests del filtro `biasFilter` (sesión `sharp` vs `balanced`) y verificar que fallan
- [x] 1.3 Añadir tests del filtro `isiFilter` (gaps `600000`, `50000000`, `200000000` mapeando a `massed`/`optimal`/`spaced`) y verificar que fallan
- [x] 1.4 Añadir test explícito de la corrección F-02: sesión con `gap === null` (primera de la cronología) excluida de `'spaced'` pero incluida con `'all'`; verificar que falla
- [x] 1.5 Añadir test de `BIAS_DOMINANCE_RATIO === 1.4` y de que `dominantBias` respeta ese ratio; verificar que falla
- [x] 1.6 Añadir test de `diagnosticReportGenerator` afirmando que `directionalBiasAnalysis` declara sesgo agudo para `sharpBiasCount: 7` / `flatBiasCount: 2` (coincidiendo con el motor, sin factor `1.5`); verificar que falla

## 2. SSOT en historyAnalytics.ts

- [x] 2.1 Añadir la constante `ISI_THRESHOLDS = { MASSED_MAX_MS: 900000, OPTIMAL_MIN_MS: 43200000, OPTIMAL_MAX_MS: 172800000 } as const` junto a `COGNITIVE_LATENCY_THRESHOLDS`/`MASTERY_THRESHOLDS`
- [x] 2.2 Añadir la constante `BIAS_DOMINANCE_RATIO = 1.4 as const` y verificar que se exporta
- [x] 2.3 Extraer las funciones puras `resolveSessionInputMethod`, `resolveSessionDominantBias` (usando `BIAS_DOMINANCE_RATIO`) y `computeInterSessionGapMap` (encapsulando historyAnalytics.ts:1041-1054)
- [x] 2.4 Refactorizar `computeAnalyticsMetrics` para que consuma las tres funciones extraídas, eliminando el literal `1.4` (línea 1115) y el bloque inline de gaps; verificar que las métricas existentes no cambian

## 3. Filtros avanzados en filterSessionsAdvanced

- [x] 3.1 Extender la firma a `filterSessionsAdvanced(sessions, filters, answers: DbAnswerRecord[] = [])` y actualizar `filterSessionsByMode` y `computeAnalyticsMetrics` como call sites
- [x] 3.2 Implementar la rama `inputSource` comparando contra `resolveSessionInputMethod`
- [x] 3.3 Implementar la rama `biasFilter` comparando contra `resolveSessionDominantBias`
- [x] 3.4 Implementar la rama `isiFilter` usando `computeInterSessionGapMap` sobre la cronología del input completo, con la exclusión de `gap === null` de las tres bandas
- [x] 3.5 Verificar que los tests 1.1-1.5 pasan (Verde) y que la suite completa de `historyAnalytics.test.ts` sigue en verde

## 4. Restauración del pipeline en AnalyticsView.tsx

- [x] 4.1 Eliminar el bloque de filtrado manual (líneas 159-176) de `displayedAnalysisList`
- [x] 4.2 Pasar `inputSource: selectedInputSource`, `biasFilter: selectedBias`, `isiFilter: selectedIsi` y `answers` en la llamada a `filterSessionsAdvanced`
- [x] 4.3 Verificar con `npm run typecheck` que no quedan referencias a los filtros manuales y que las props del `AnalyticsFilterBar` se mantienen

## 5. Unificación del ratio en diagnosticReportGenerator.ts

- [x] 5.1 Importar `BIAS_DOMINANCE_RATIO` desde `historyAnalytics` y reemplazar los literales `1.5` (líneas 84 y 86)
- [x] 5.2 Verificar que el test 1.6 pasa y que no quedan literales `1.5` ni `1.4` sueltos en el archivo

## 6. Verificación final y limpieza

- [x] 6.1 Ejecutar `npm run typecheck` y confirmar que no reporta errores
- [x] 6.2 Ejecutar `npm run lint` y confirmar que no reporta errores nuevos
- [x] 6.3 Ejecutar `npm run test` (vitest run, modo no interactivo) y confirmar que toda la suite pasa
- [x] 6.4 Confirmar mediante búsqueda en `src/renderer` que los literales `900000`, `43200000`, `172800000`, `1.5` y `1.4` ya no aparecen fuera de la SSOT
- [x] 6.5 (Agregado durante 6.4) `SessionsTableTab.tsx:431-435` replicaba los magic numbers ISI en la capa de presentación; reemplazados por `ISI_THRESHOLDS` desde la SSOT

## 7. Corrección de warnings de verificación (W1-W4)

- [x] 7.1 (W1) Añadir aserciones explícitas de los 3 valores de `ISI_THRESHOLDS` al bloque SSOT de `historyAnalytics.test.ts`
- [x] 7.2 (W2) Añadir test de conjunción múltiple (`mode` + `inputSource` + `biasFilter`) en `filterSessionsAdvanced`
- [x] 7.3 (W4) Hacer no-op seguras las ramas `inputSource` y `biasFilter` cuando `answers` está vacío, según la Decisión 2 de `design.md`
- [x] 7.4 (W3) Acotar la redacción del escenario "Umbrales ISI concentrados en la SSOT" excluyendo timeouts no psicométricos de dominios independientes
- [x] 7.5 Re-ejecutar `npm run typecheck`, `npm run lint` y `npm run test` confirmando suite limpia
