## Context

`midi-laboratory` centraliza sus umbrales psicométricos en la constante `MASTERY_THRESHOLDS` de `src/renderer/src/domain/analytics/historyAnalytics.ts` (la "SSOT"), pero en la práctica el valor `50` estaba duplicado como literales sueltos en al menos 8 archivos (filtro de sesiones, motor adaptativo, hooks y componentes de UI). El umbral crítico coincide además con la línea base de azar `c = 50%` del 2AFC más pequeño, lo que vacía de significado a la banda "Crítico" (ver `proposal.md` - Why). Por separado, Tailwind CSS v4 depreca las utilidades `bg-gradient-to-r`. La motivación y el alcance están en `proposal.md`; los requisitos formalizados en `specs/05-analytics-psychometrics/spec.md`.

## Goals / Non-Goals

**Goals:**

- Mover la frontera `learning`/`critical` al 60% tocando un único punto canónico (`MASTERY_THRESHOLDS`) y hacer que cada consumidor la lea de ahí, de modo que el valor se propague en lugar de divergir.
- Que la clasificación resultante sea psicométricamente distinguible del azar en el pool mínimo.
- Eliminar las advertencias de deprecación de Tailwind v4 en `LatencySpectrumDiagram.tsx`.

**Non-Goals:**

- No se modifica `MASTERED_MIN` (permanece en 85): la frontera de dominio no está afectada por el problema del azar.
- No se toca la segmentación de `diagnosticReportGenerator` (`AVANZADO >= 85`, `INTERMEDIO >= 65`): es un requisito independiente del informe clínico, no una banda de `MASTERY_THRESHOLDS`. La compuerta de progresión del plan de acción (antes `overallAccuracy >= 80` para "Avanzar a Modalidad 2") sí converge con la SSOT leyendo `MASTERY_THRESHOLDS.MASTERED_MIN`, al detectarse en el barrido final; la segmentación de 85/65 se mantiene por ser un requisito canónico aparte.
- No se modifica `shouldPromoteLevel([...], 85, 3)` de `exerciseGeneratorRules.ts`: el umbral de promoción de nivel es un parámetro de regla de rondas consecutivas, ajeno a la clasificación de maestría; que siga parametrizado es correcto.
- No se altera la heurística de `mostDifficultNotes` (`accuracy < 80`) ni la fórmula IRT de normalización: la precisión cruda almacenada no cambia, solo su clasificación en bandas.
- Sin migración de datos: los registros históricos guardan `accuracyPercentage` crudo; la banda se deriva en lectura.

## Decisions

**1. Cambio de valor + remediación de duplicados, no un nuevo umbral paralelo.**
Se descartó introducir una constante separada (p. ej. `CRITICAL_LEARNING_BOUNDARY`) para no multiplicar fuentes. `LEARNING_MIN` y `CRITICAL_MAX` pasan a `60` en la SSOT existente y los 8 consumidores se reconectan a ella. Alternativa rechazada: mantener `CRITICAL_MAX` y `LEARNING_MIN` con valores distintos (p. ej. `50`/`60`) crearía una banda solapada ambigua entre 50 y 60; mantenerlos ambos en 60 conserva una partición limpia y exclusiva (`critical < 60 <= learning < 85 <= mastered`).

**2. `filterSessionsAdvanced` lee la SSOT en vez de literales.**
Las tres compuertas de `mastery` (`mastered`/`learning`/`critical`) se reescriben contra `MASTERY_THRESHOLDS.MASTERED_MIN`, `.LEARNING_MIN` y `.CRITICAL_MAX`. Esto resuelve simultáneamente el nuevo umbral y la violación preexistente de la SSOT.

**3. Import de la SSOT desde el motor adaptativo, sin ciclo.**
`adaptiveEngine.ts` puede importar `MASTERY_THRESHOLDS` de `../analytics/historyAnalytics` de forma segura: `historyAnalytics` solo importa `../adaptation/types` (tipos), nunca `adaptiveEngine`, por lo que no se crea ciclo de dependencias. Se verificó el grafo de imports in-situ.

**4. Consumidores de UI: leer la constante, no incrustar el número.**
`AnalyticsKpiCards`, `SessionsTableTab`, `SessionDetailModal` (incluida su leyenda `>85% / 50-85% / <50%`), `SingleNoteView`, `SequenceSummaryCard`, `StudioBottomDock` (widget de precisión global, detectado en el barrido final del task 6.5) y `useSingleNoteTrainer` reemplazan `85`/`50` por `MASTERY_THRESHOLDS.MASTERED_MIN`/`CRITICAL_MAX`, de modo que la próxima vez que se mueva el umbral la UI no diverja. En `StudioBottomDock` el corte esmeralda era `80`; se alinea con `MASTERED_MIN` (85) para unificar la escala visual.

**5. Tailwind v4: `bg-gradient-to-r` → `bg-linear-to-r`.**
En v4 las utilidades de gradiente se renombraron (`bg-gradient-*` → `bg-linear-*`); las antiguas emiten advertencia de deprecación. Alcance inicial: 3 ocurrencias en `LatencySpectrumDiagram.tsx` (zonas Reflejo / Deducción / Fatiga). El barrido extendió la migración a las 9 ocurrencias restantes en `AnalyticsView.tsx`, `AiConsultationTab.tsx`, `AiDiagnosticTab.tsx`, `AnalyticsCharts.tsx` y `SessionsTableTab.tsx`, dejando el repo sin ninguna utilidad deprecada. Cambio puramente cosmético-de sintaxis: el CSS generado es idéntico.

## Risks / Trade-offs

- **Reclasificación visible de sesiones existentes (50–59%)** de `learning` a `critical`. → Mitigación: la banda se deriva en tiempo de lectura desde `accuracyPercentage` almacenado, sin migrar datos; las etiquetas de `AnalyticsFilterBar` ya renderizan los rangos desde la SSOT (`≥{MASTERED_MIN}%`, `{LEARNING_MIN}-{MASTERED_MIN}%`, `<{CRITICAL_MAX}%`) y se actualizan solas.
- **Endurecimiento del motor adaptativo:** notas en 50–59% ahora se tratan como "tasa de error alta" y reciben el refuerzo del `adaptiveEngine` antes reservado a `< 50%`. → Trade-off aceptable y coherente con el objetivo psicométrico; no es un cambio de fórmula de pesos, solo del punto de corte.
- **Cobertura de pruebas de los consumidores remediados:** la mayoría no tiene tests directos sobre el punto de corte. → Mitigación: se añaden aserciones de frontera en `historyAnalytics.test.ts` y `thresholdsConsistency.test.tsx`, y se verifica la reintegración con `adaptiveEngine.test.ts` existente.
- **Posibles literales `85`/`50` no detectados** en componentes menos evidentes. → Mitigación: búsqueda exhaustiva de `accuracyPercentage` comparado contra literales en `src/` como tarea final de verificación del change. El barrido halló `StudioBottomDock.tsx` (`overallAccuracy >= 80/50`) y `diagnosticReportGenerator.ts:108` (`overallAccuracy >= 80`), ambos remediados a la SSOT; los únicos literales restantes son la segmentación canónica 85/65 del informe clínico (requisito aparte, non-goal).
