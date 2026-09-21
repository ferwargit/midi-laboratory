## Why

La Auditoría V6 (OLA 2.3 de remediación) detectó cuatro defectos que rompen el contrato de **pipeline de dominio puro** de la spec 05 y producen diagnósticos contradictorios: tres filtros avanzados (`inputSource`, `biasFilter`, `isiFilter`) están declarados en `AnalyticsFilterOptions` pero no implementados en `filterSessionsAdvanced`, por lo que la lógica real vive fugada como `.filter()` en la vista React; los umbrales de intervalo entre sesiones (ISI) son magic numbers duplicados en la UI; la primera sesión de la historia (`gap === null`) se clasifica erróneamente como "espaciada >48h"; y `diagnosticReportGenerator.ts` usa un ratio de sesgo direccional de `1.5` mientras el motor canónico usa `1.4`, generando informes contradictorios para los mismos datos.

## What Changes

- **Nuevas constantes SSOT** en `historyAnalytics.ts`: `ISI_THRESHOLDS` (`MASSED_MAX_MS: 900000`, `OPTIMAL_MIN_MS: 43200000`, `OPTIMAL_MAX_MS: 172800000`) y `BIAS_DOMINANCE_RATIO: 1.4`, integradas en la fuente única de umbrales ya existente.
- **Implementación de los filtros fugados** dentro de `filterSessionsAdvanced`: `inputSource` (sobre `inputMethod` de la sesión), `biasFilter` (contra el sesgo dominante regido por `BIAS_DOMINANCE_RATIO`) e `isiFilter` (contra las bandas definidas por `ISI_THRESHOLDS`).
- **Corrección del bug de `gap === null`**: la primera sesión de la cronología no pertenece a ninguna banda de intervalo; solo coincide con `isiFilter === 'all'`, nunca con `'spaced'`.
- **Eliminación del filtrado manual en React** (`AnalyticsView.tsx`): la vista pasa `inputSource`, `biasFilter` e `isiFilter` directamente a `filterSessionsAdvanced`, restaurando el pipeline de dominio puro.
- **Unificación del criterio de sesgo direccional**: `diagnosticReportGenerator.ts` consume `BIAS_DOMINANCE_RATIO` desde la SSOT (o deriva desde `metrics.dominantBias`), eliminando el literal `1.5` divergente.
- **Pruebas unitarias (TDD)** en `historyAnalytics.test.ts` cubriendo los tres filtros, la exclusión de `gap === null` y el ratio `1.4`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `05-analytics-psychometrics`: amplía la SSOT con `ISI_THRESHOLDS` y `BIAS_DOMINANCE_RATIO`; formaliza el soporte completo de los filtros avanzados (`inputSource`, `biasFilter`, `isiFilter`) en `filterSessionsAdvanced` y la exclusión de `gap === null` de las bandas de descanso; refuerza la prohibición de filtrado psicométrico en la capa de presentación y unifica el ratio de sesgo entre el motor y el generador de informes.

## Impact

- **`src/renderer/src/domain/analytics/historyAnalytics.ts`**: dos nuevas constantes exportadas, tres nuevas ramas de filtrado en `filterSessionsAdvanced`, y reemplazo del literal `1.4` en `dominantBias` por la constante.
- **`src/renderer/src/components/views/AnalyticsView.tsx`**: eliminación del bloque de filtrado manual (líneas 159-176) y paso de los tres filtros al dominio. Sin cambio de comportamiento visible para el usuario final, salvo la corrección de la primera sesión bajo `isiFilter: 'spaced'`.
- **`src/renderer/src/domain/analytics/diagnosticReportGenerator.ts`**: reemplazo de los literales `1.5` por `BIAS_DOMINANCE_RATIO`; los informes dejarán de contradecir al motor.
- **`src/renderer/src/domain/analytics/historyAnalytics.test.ts`**: nueva suite de pruebas para filtros y umbrales.
- **`openspec/specs/05-analytics-psychometrics/spec.md`**: delta con los requisitos nuevos/ampliados.
- Sin cambios en persistencia, motor de entrenamiento, IA local ni audio MIDI (out-of-scope de la spec 05).
