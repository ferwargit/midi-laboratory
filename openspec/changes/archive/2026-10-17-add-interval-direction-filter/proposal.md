# Proposal

## Why

Al entrenar en la modalidad de Intervalos el usuario configura la dirección del estímulo (`ascending`, `descending`, `both`), y el entrenador graba esa dirección en la telemetría de cada respuesta (`reasonTelemetry: "N st (ascending|descending|harmonic)"`). Sin embargo, la pestaña de Analítica no permite auditar el rendimiento histórico por dirección: `AnalyticsFilterBar` no ofrece el selector y `filterSessionsAdvanced` no filtra por este criterio. Esto deja una dimensión de entrenamiento relevante fuera del alcance del análisis psicométrico, impidiendo responder preguntas como "¿rendimiento de mis sesiones puramente ascendentes frente a las descendentes?".

## What Changes

- Ampliar `AnalyticsFilterOptions` (en `src/renderer/src/domain/analytics/types.ts`) con la dimensión `directionFilter?: 'all' | 'ascending' | 'descending' | 'harmonic'`.
- Implementar en `filterSessionsAdvanced` (`src/renderer/src/domain/analytics/sessionFilters.ts`) el predicado de filtrado por dirección del estímulo, derivado de la telemetría de respuestas de la sesión. Sin respuestas, el filtro es no-op seguro (patrón existente de `inputSource`/`biasFilter`).
- Añadir en `AnalyticsFilterBar.tsx` el selector desplegable "Dirección del Intervalo" (Todas las Direcciones / Solo Ascendente / Solo Descendente / Harmónico/Mixto), visible exclusivamente cuando `modeFilter === 'intervals'`.
- Cablear el nuevo estado `selectedDirection` en `AnalyticsView.tsx` (estado, paso de props, inclusión en `filterSessionsAdvanced`, reset en "Limpiar" y al abandonar la modalidad de Intervalos).
- Pruebas unitarias TDD en `sessionFilters.test.ts` (rojo → verde) y actualización de los mocks de props en `AnalyticsFilterBar.test.tsx`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

(ninguna — `skip_specs: true`)

Justificación: la spec `05-analytics-psychometrics` ya exige (req. 14) que `filterSessionsAdvanced` implemente "la totalidad de las dimensiones declaradas en `AnalyticsFilterOptions`", un contrato genérico que cubre cualquier dimensión nueva sin modificar su texto. Este cambio es una extensión natural del sistema de filtros avanzados ya especificado: añade una dimensión más al contrato existente, sin alterar requisitos observables a nivel de spec.

## Impact

- **Dominio:** `src/renderer/src/domain/analytics/types.ts` (interfaz `AnalyticsFilterOptions`), `src/renderer/src/domain/analytics/sessionFilters.ts` (`filterSessionsAdvanced`).
- **UI:** `src/renderer/src/components/views/analytics/AnalyticsFilterBar.tsx` (nuevo selector condicional), `src/renderer/src/components/views/AnalyticsView.tsx` (estado y cableado).
- **Tests:** `src/renderer/src/domain/analytics/sessionFilters.test.ts` (nuevos casos), `src/renderer/src/components/views/analytics/AnalyticsFilterBar.test.tsx` (mock de props).
- **Sin cambios en:** esquema de base de datos (`DbSessionRecord`/`DbAnswerRecord` intactos — la dirección se deriva de `reasonTelemetry` ya persistido), `computeAnalyticsMetrics` (propaga `advancedFilters` genéricamente), specs OpenSpec.
- **Compatibilidad:** la nueva dimensión es opcional (`directionFilter?`); los 35 sitios consumidores del barrel `historyAnalytics.ts` no requieren cambios de import.
