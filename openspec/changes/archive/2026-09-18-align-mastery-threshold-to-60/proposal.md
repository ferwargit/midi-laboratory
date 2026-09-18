## Why

El umbral crítico de maestría actual (50%) coincide exactamente con la línea base de azar de un ejercicio 2AFC (two-alternative forced choice) con `poolSize = 2`, donde `c = 1/2 = 50%`. Esta coincidencia degenerada hace que la banda "Crítico" absorba el ruido de azar: un alumno que responde puramente al azar y uno que genuinamente no discrimina quedan clasificados de forma idéntica, y la frontera `learning`/`critical` mapea a `NormAcc = 0` en la fórmula IRT (`NormAcc = ((RawAcc - c)/(1-c)) * 100`), colapsando "Crítico" con "habilidad nula no medible". Elevar la frontera a 60% restaura la significancia psicométrica: es la primera banda que se separa de forma robusta del azar en el pool más pequeño (teoría de discriminación auditiva de Karpinski, que exige una precisión sostenidamente por encima de la línea de chance para declarar discriminación perceptual real), y proyecta la frontera a `NormAcc = 20` en el pool de 2 notas, devolviendo a la banda "En Aprendizaje" un significado medible. En paralelo, el compilador de Tailwind CSS v4 marca como obsoletas las clases `bg-gradient-to-r`, que deben migrarse a su forma canónica `bg-linear-to-r`.

## What Changes

- **BREAKING** — `MASTERY_THRESHOLDS` en `historyAnalytics.ts`: `LEARNING_MIN` y `CRITICAL_MAX` pasan de `50` a `60`. `MASTERED_MIN` se mantiene en `85`. La banda **Crítico** ahora es `< 60%` y **En Aprendizaje** abarca `60%–84%`. Sesiones con precisión entre 50% y 59% se reclasifican de `learning` a `critical`.
- **BREAKING** — `filterSessionsAdvanced` deja de usar los literales `85`/`50` hardcodeados y lee `MASTERY_THRESHOLDS`, aplicando `60` como frontera entre `learning` y `critical`.
- Remediación SSOT: se reemplazan los literales `85`/`50` duplicados fuera de la fuente única de verdad por lecturas de `MASTERY_THRESHOLDS` en `adaptiveEngine.ts`, `SingleNoteView.tsx`, `useSingleNoteTrainer.ts`, `SequenceSummaryCard.tsx`, `SessionDetailModal.tsx`, `AnalyticsKpiCards.tsx`, `SessionsTableTab.tsx` y `StudioBottomDock.tsx`, para que el nuevo umbral se propague a la UI y al motor adaptativo en lugar de divergir.
- Pruebas unitarias: `historyAnalytics.test.ts` y `thresholdsConsistency.test.tsx` validan el nuevo umbral del 60% y la frontera `learning`/`critical`; se verifican los consumidores remediados.
- Modernización Tailwind CSS v4 en `LatencySpectrumDiagram.tsx`: `bg-gradient-to-r` → `bg-linear-to-r` (líneas 20, 23 y 26), eliminando las 3 advertencias de deprecación del compilador.
- Delta de especificación canónica en `05-analytics-psychometrics`: el requisito de `MASTERY_THRESHOLDS` se actualiza al 60% y se elimina la nota de precisión técnica legada del 50%.

## Capabilities

### New Capabilities

_None — no se introducen capacidades nuevas._

### Modified Capabilities

- `05-analytics-psychometrics`: el requisito "Fuente Única de Verdad de Umbrales Psicoacústicos" cambia los valores canónicos de `MASTERY_THRESHOLDS` (`LEARNING_MIN` y `CRITICAL_MAX` de `50` a `60`, frontera `learning`/`critical` en `60%`) y refuerza que los consumidores lean la SSOT en lugar de literales.

## Impact

- **Dominio (SSOT):** `src/renderer/src/domain/analytics/historyAnalytics.ts` (constante `MASTERY_THRESHOLDS` y filtro `filterSessionsAdvanced`).
- **Motor adaptativo:** `src/renderer/src/domain/adaptation/adaptiveEngine.ts` (razones de selección y ponderación de notas).
- **UI:** `SingleNoteView.tsx`, `SessionDetailModal.tsx`, `SequenceSummaryCard.tsx`, `AnalyticsKpiCards.tsx`, `SessionsTableTab.tsx`, `StudioBottomDock.tsx` (colores, leyendas y listas de notas débiles) y `LatencySpectrumDiagram.tsx` (clases Tailwind v4).
- **Hooks:** `useSingleNoteTrainer.ts` (compuerta de maestría de sesión y chequeo de notas dominadas).
- **Pruebas:** `historyAnalytics.test.ts`, `thresholdsConsistency.test.tsx`, `adaptiveEngine.test.ts` y, si aplica, `useSingleNoteTrainer.test.ts`.
- **Especificación:** `openspec/specs/05-analytics-psychometrics/spec.md` (delta).
- **Sin dependencias nuevas ni cambios de API pública:** `MASTERY_THRESHOLDS` conserva sus claves; solo cambian sus valores.
