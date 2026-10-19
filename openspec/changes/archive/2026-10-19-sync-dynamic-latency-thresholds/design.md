# Design

## Context

Ver `proposal.md` (Why). Estado actual verificado en el código:

- `thresholds.ts:56-57` define el alias `@deprecated COGNITIVE_LATENCY_THRESHOLDS = COGNITIVE_LATENCY_THRESHOLDS_BY_MODE.single_note` (1400/2800 ms).
- Consumidores reales del alias (grep exhaustivo, no solo los 3 archivos del informe F22):
  1. `domain/analytics/latencyStats.ts:4,58` — `computePerNoteLatencyStats(answers)` usa `FAST_MAX_MS` para `fastCount`; hoy no recibe modo.
  2. `components/trainer/AnalyticsCharts.tsx:8,491-545` — línea de referencia, coloreado de barras y etiqueta `1.4s` del eje; además la leyenda (líneas 459-461) y la etiqueta del eje (línea 511) están **hardcodeadas** como literales.
  3. `domain/ai/promptBuilder.ts` — 7 usos (líneas 5, 22, 121, 151, 220, 274, 304); consumidor **no listado en F22**.
  4. Tests: `latencyStats.test.ts:3,128` y `thresholdsConsistency.test.tsx` (líneas 6, 79-82, 102, 107, 151, 187, 191).
- `AnalyticsView.tsx` ya tiene `modeFilter` (store `useAnalyticsStore`) y lo pasa a las demás pestañas (líneas 411-474), pero **no** a `AnalyticsCharts` (línea 456).
- Precedente interno del patrón objetivo: `SessionsTableTab.tsx:61` ya hace `const thresholds = getLatencyThresholds(modeFilter)`.
- El motor ya es mode-aware: `timelineTelemetry.ts:13`, `historyAnalytics.ts:122,196` usan `getLatencyThresholds(sessionMode)`; `diagnosticReportGenerator` usa `getLatencyThresholds(metrics.modeFilter)`.
- Tipo de filtro: `AnalyticsModeFilter = 'all' | 'single_note' | 'intervals' | 'sequences' | 'repertoire'` (`domain/analytics/types.ts:3`); `getLatencyThresholds('all')` cae por diseño en `single_note`, que es exactamente la semántica que el motor aplica hoy para `'all'`.

## Goals / Non-Goals

**Goals:**

- Un único camino de resolución de umbrales de latencia: `getLatencyThresholds(mode)` en motor, gráficos y prompts.
- Eliminar el alias deprecado con cero referencias huérfanas (verificable por grep).
- Gráfico de latencia visualmente coherente con la modalidad activa (líneas de referencia, colores, leyenda y etiquetas de eje dinámicas).
- Compatibilidad retroactiva de la firma de `computePerNoteLatencyStats` (parámetro opcional).

**Non-Goals:**

- No se recalibran los valores de `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` (solo se cambia quién los consume).
- No se toca `pedagogicalDictionary.ts` ni `diagnosticReportGenerator.ts` (ya son mode-aware; F24/F25 los cubren por separado).
- No se refactoriza el barrel `historyAnalytics.ts` (F24) ni se eliminan otros exports muertos (F25).
- No se cambia el esquema de datos ni los registros persistidos.

## Decisions

### D1 — Firma: `computePerNoteLatencyStats(answers, mode?: string)`

- **Elección:** segundo parámetro opcional `mode?: string` (mismo contrato que `getLatencyThresholds(mode?)`: acepta `AnalyticsModeFilter`, `ModalityKey` o string libre; el resolvedor normaliza y hace fallback).
- **Alternativa descartada:** cambiar la firma a `mode: AnalyticsModeFilter` obligatorio — rompería a los 2 call-sites actuales (`AnalyticsCharts.tsx:61` y el barrel) y forzaría a cada llamador a conocer el modo aunque no lo tenga; el parámetro opcional con fallback `single_note` preserva el comportamiento histórico exacto cuando no se indica modo.
- **Alternativa descartada:** inferir el modo desde las respuestas (`DbAnswerRecord` no lleva modalidad; inferirla por heurística reintroduciría el acoplamiento a strings de preset que F21 condena).

### D2 — El gráfico resuelve una vez, con `useMemo`

- **Elección:** en `AnalyticsCharts`, `const thresholds = useMemo(() => getLatencyThresholds(modeFilter), [modeFilter])`; `computePerNoteLatencyStats(answers, modeFilter)` también memoizado sobre `[answers, modeFilter]`.
- **Racional:** evita re-resolver en cada render y mantiene la identidad del objeto estable para `React.memo`.
- **Alternativa descartada:** resolver dentro de cada fragmento SVG — duplicaría llamadas y arriesgaría inconsistencia entre línea de referencia y colores si el filtro cambiara a mitad de render.

### D3 — Leyenda y etiquetas del eje dinámicas, no solo los números

- **Elección:** la leyenda (hoy `● <1.4s (Reflejo)` / `● 1.4s-2.8s (Deducción)` / `● >2.8s (Duda)`) y la etiqueta `1.4s` del eje se construyen interpolando `FAST_LABEL`/`MEDIUM_LABEL`/`SLOW_LABEL` y `FAST_MAX_MS` de la configuración resuelta.
- **Racional:** el hallazgo F22 no es solo numérico: pintar "1.4s" en un gráfico de secuencias sería igual de engañoso que la línea mal ubicada. Los roles pedagógicos (Reflejo/Deducción/Duda) se mantienen como texto fijo porque son independientes de la modalidad.
- **Alternativa descartada:** dejar la leyenda fija y solo mover la línea — incoherencia visible inmediata entre leyenda y línea de referencia.

### D4 — `promptBuilder` resuelve por el modo del prompt, no por un umbral global

- **Elección:** cada builder usa el modo que ya recibe o que ya está en `metrics`:
  - `buildSystemPrompt(mode)` → `getLatencyThresholds(mode)` (solo la rama `single_note` cita etiquetas; con `'all'` cae en `single_note`, igual que hoy).
  - `buildUserPrompt(metrics)` / `buildConsultationUserPrompt(metrics)` → `getLatencyThresholds(metrics.modeFilter)`.
  - `buildMultiSessionComparisonSystemPrompt(mode)` y `buildMultiSessionComparisonPrompt` → `getLatencyThresholds(mode)` / `getLatencyThresholds(metrics.modeFilter)`.
- **Racional:** `metrics.modeFilter` es el filtro bajo el que se computaron `fastResponsesCount`/`mediumResponsesCount`/`slowResponsesCount`, así que las etiquetas citadas siempre describen la clasificación real de los números adyacentes (mismo criterio que ya exige el spec para `cognitiveLatencyAnalysis`).
- **Alternativa descartada:** fijar `single_note` en prompts — perpetuaría la incoherencia F22 en la capa de IA.

### D5 — Eliminación del alias en el mismo cambio que la migración

- **Elección:** migrar consumidores y borrar el export en el mismo cambio, con grep de verificación (`COGNITIVE_LATENCY_THRESHOLDS` con frontera de palabra, excluyendo `..._BY_MODE`) como criterio de aceptación.
- **Alternativa descartada:** dejar el alias un ciclo más — el alias ya está `@deprecated` desde antes y su única función era la compatibilidad que este cambio elimina; mantenerlo obligaría a tests de doble verdad.

### D6 — Estrategia de tests (TDD: expectativas primero)

- **Elección:** actualizar primero los tests que pinchan el comportamiento (protocolo TDD del proyecto, nota del informe V9 §3):
  1. `latencyStats.test.ts`: sustituir la importación del alias por `getLatencyThresholds`; nuevos casos de variación por modo (2000/3000 ms → 0 % en `single_note`, 100 % en `sequences`) y frontera inclusiva por modalidad.
  2. `thresholdsConsistency.test.tsx`: eliminar referencias al alias; añadir aserción de ausencia del export y tests de render del gráfico con `modeFilter='sequences'`/`'intervals'` verificando línea de referencia, colores y leyenda.
  3. `promptBuilder.test.ts`: aserciones de que los prompts citan las etiquetas de la modalidad de `metrics.modeFilter`.
- **Racional:** los tests existentes de `thresholdsConsistency.test.tsx` ya mockean `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` (líneas 366-374), así que el patrón de mock por modalidad existe y se reutiliza.

## Risks / Trade-offs

- **[Riesgo] Regresión visual en el gráfico con filtro `'all'`** → Mitigación: con `'all'` el resolvedor devuelve `single_note`, idéntico al alias eliminado; test de render con `'all'` fija el comportamiento histórico.
- **[Riesgo] Otros consumidores del alias no detectados** → Mitigación: grep de frontera de palabra en todo `src/` como tarea explícita de verificación + `typecheck` (el export deja de existir, así que cualquier import residual rompe la compilación, no falla en silencio).
- **[Riesgo] `AnalyticsCharts` es `memo`: prop nuevo puede romper la memoización si el padre recrea el objeto** → Mitigación: `modeFilter` es un primitivo del store Zustand (identidad estable); el `useMemo` interno depende solo de él.
- **[Trade-off] La firma de `computePerNoteLatencyStats` crece a 2 parámetros** → aceptado: es la vía mínima para mode-awareness sin acoplar el dominio a heurísticas de preset (F21).
- **[Trade-off] Los prompts de IA cambian su texto para modos ≠ `single_note`** → aceptado y deseable: es la corrección F22 aplicada a la capa de IA; los tests de prompt se actualizan en el mismo cambio.

## Migration Plan

1. (TDD) Actualizar tests con las expectativas mode-aware → confirmar Red.
2. Migrar `latencyStats.ts` → `AnalyticsCharts.tsx` + `AnalyticsView.tsx` → `promptBuilder.ts` (Green).
3. Eliminar el alias de `thresholds.ts` y sus referencias en tests.
4. Verificación: grep sin ocurrencias, `npm test`, `typecheck`, `lint` con 0 regresiones.
- **Rollback:** revertir el commit del cambio; no hay migración de datos ni persistencia afectada.

## Open Questions

(ninguna — el alcance, los valores de umbral y la semántica de fallback están definidos por la SSOT vigente y el spec delta.)
