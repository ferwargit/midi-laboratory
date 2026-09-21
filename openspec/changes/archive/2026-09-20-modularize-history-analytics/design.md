## Context

`historyAnalytics.ts` (1342 líneas) es el módulo más grande del dominio de analítica y el único punto de entrada de la spec `05-analytics-psychometrics`: 35 sitios importan de él (stores `useAnalyticsStore`/`useAiStore`, hook `useSingleNoteTrainer`, `AnalyticsView` y sus 11 subcomponentes, `adaptiveEngine`, `promptBuilder`, `lmStudioService`, `fallbackGenerator`, `diagnosticReportGenerator` y 8 archivos de test). Contiene 5 constantes SSOT, 18 interfaces/tipos, 4 clasificadores de sesión, ~16 funciones de dominio y el orquestador `computeAnalyticsMetrics`. Verificado en esta planificación: la auditoría V6 ya remedió la mayoría de defectos (OLA 2.3 unificó la SSOT de umbrales), pero sobreviven cinco hallazgos de la Auditoría Frente 3 — F-06/F-14 (`resolveNominalPoolSize`, historyAnalytics.ts:375-390), F-09 (`computeLongitudinalComparisons`, historyAnalytics.ts:1112), F-13 (`analyzeSessionTimeline`, historyAnalytics.ts:670-692) y F-16 (`pedagogicalDictionary.ts`:108-109) — cuya corrección es más segura dentro de la extracción modular que sobre el monolito.

Restricción técnica central: la refactorización debe ser **de comportamiento cero para la API pública**. Cualquier consumidor que hoy escribe `import { X } from '.../historyAnalytics'` debe seguir resolviendo el mismo símbolo, con la misma firma y el mismo valor de retorno, o la spec 05 y la suite completa fallan.

## Goals / Non-Goals

**Goals:**

- Fragmentar el monolito en submódulos de 50–150 líneas con una única responsabilidad cada uno, maximizando cohesión y minimizando acoplamiento inter-módulo.
- Preservar el 100% de la API pública mediante barrel export, de modo que ningún consumidor externo requiera edición.
- Corregir F-06/F-14, F-09, F-13 y F-16 en el mismo cambio, con pruebas TDD que fijen los casos borde.
- Mantener la SSOT de umbrales como única fuente: los submódulos importan de `thresholds.ts`, nunca duplican literales.

**Non-Goals:**

- Cambiar firmas, contratos de tipos o valores de retorno de ninguna función pública (`computeAnalyticsMetrics`, `filterSessionsAdvanced`, `analyzeSessionTimeline`, etc. se conservan idénticos).
- Añadir nuevas métricas, filtros, umbrales ni capacidades de analítica.
- Modificar la capa de presentación, stores, persistencia, motor de entrenamiento ni integración de IA local.
- Renombrar o mover la ruta de importación canónica `domain/analytics/historyAnalytics` (permanece como puerta de entrada barrel).
- Resolver la divergencia menor entre el gap map del filtro y el de las métricas (documentada en OLA 2.3, Decisión 3); queda fuera de alcance.

## Decisions

### 1. Barrel export en `historyAnalytics.ts` en vez de migrar imports de consumidores

`historyAnalytics.ts` se conserva como punto de entrada y se reescribe como:

```ts
export * from './thresholds'
export * from './types'
export * from './sessionClassification'
export * from './psychometrics'
export * from './latencyStats'
export * from './timelineTelemetry'
export * from './confusionMatrix'
export * from './sessionFilters'
export * from './longitudinal'

export function computeAnalyticsMetrics(...) { /* orquestador */ }
```

Los 35 sitios consumidores no se tocan. El orquestador es la única función que permanece implementada en `historyAnalytics.ts` (orquesta `filterSessionsAdvanced` → `computeInterSessionGapMap` → `resolveNominalPoolSize`/`calculateSessionCPI`/`resolveSessionDominantBias`/`resolveSessionInputMethod`/`resolveSessionFormat` → `computeLongitudinalComparisons`).

*Alternativa descartada:* actualizar los 35 import sites a los submódulos nuevos. Multiplica el riesgo de regresión, ensucia el diff y mezcla reorganización de imports con correcciones de comportamiento, dificultando la revisión.

### 2. `resolveNominalPoolSize` se exporta desde `sessionClassification.ts` y queda alcanzada por el barrel

Hoy es función privada de módulo (sin `export`). Al dividir el archivo, `sessionFilters.ts` (rama `poolSizeFilter`) y el orquestador necesitan consumirla desde otro archivo, por lo que debe ser `export`-ada en `sessionClassification.ts`.

Originalmente se planteó excluirla del barrel para no ensanchar la API pública. **En la implementación se desestimó esa exclusión** y se acepta que `export * from './sessionClassification'` la re-exporta, por dos razones: (a) `export *` no permite excluir símbolos individuales sin caer en una lista frágil de re-exports con nombre, que debería mantenerse sincronizada a mano ante cualquier evolución futura de `sessionClassification.ts`, contradiciendo el objetivo de simplicidad y robustez del barrel; y (b) el ensanche es estrictamente *additive*: ningún consumidor externo la importa ni la usa, por lo que no hay rotura ni cambio de comportamiento observable; es visibilidad intra-paquete ganada, no un contrato nuevo.

*Alternativa descartada:* duplicar la lógica en `sessionFilters.ts` — reintroduciría exactamente el tipo de divergencia que la spec 05 prohíbe.

### 3. Asignación de funciones a submódulos por cohesión, no por conteo de líneas

La taxonomía respeta la separación ya existente en los tests y en la propia spec 05 (psicometría / cognición / algoritmo):

| Submódulo | Contenido | Líneas aprox. |
|---|---|---|
| `thresholds.ts` | `COGNITIVE_LATENCY_THRESHOLDS`, `MASTERY_THRESHOLDS`, `ISI_THRESHOLDS`, `BIAS_DOMINANCE_RATIO` | ~25 |
| `types.ts` | 18 interfaces y tipos (`AnalyticsMetrics`, `DetailedSessionAnalysis`, `SessionTimelineAnalysis`, `ConfusionMatrix2DData`, `AnalyticsFilterOptions`, `LongitudinalComparison`, …) | ~200 |
| `sessionClassification.ts` | `resolveSessionFormat`, `resolveNominalPoolSize` (F-06/F-14), `formatInterSessionGap`, `computeInterSessionGapMap`, `InterSessionGapInfo`, `resolveSessionInputMethod`, `resolveSessionDominantBias`, `isSingleNoteSession`/`isIntervalSession`/`isSequenceSession`/`isRepertoireSession` | ~185 |
| `psychometrics.ts` | `calculateSessionCPI` | ~20 |
| `latencyStats.ts` | `computePerNoteLatencyStats`, `computeNotePerformancesFromAnswers` | ~145 |
| `timelineTelemetry.ts` | `analyzeSessionTimeline` (F-13) | ~155 |
| `confusionMatrix.ts` | `computePitchClassConfusionMatrix`, `PITCH_CLASSES` | ~50 |
| `sessionFilters.ts` | `filterSessionsAdvanced`, `filterSessionsByMode` | ~165 |
| `longitudinal.ts` | `computeLongitudinalComparisons` (F-09), `reconstructSessionConfig` | ~180 |

`types.ts` y `sessionClassification.ts` superan las 150 líneas por pura cantidad de contratos y de ramas de clasificación; partirlos por partir (p. ej. `types-psychometrics.ts` vs `types-filters.ts`) reduciría cohesión sin ganar mantenibilidad.

**Aclaración sobre el rango 50–150:** se asume como guía orientativa de diseño, no como límite duro. Los módulos que lo superan (`timelineTelemetry.ts` ~174, `sessionFilters.ts` ~178, `longitudinal.ts` ~185, `types.ts` ~187, `sessionClassification.ts` ~213) son altamente cohesivos — cada uno agrupa una única familia de funciones que se invocan mutuamente y se aprueba su tamaño actual; partirlos añadiría saltos de archivo y acoplamiento indirecto sin mejorar la legibilidad. La métrica verificable de este cambio es la reducción de `historyAnalytics.ts` (1342 → ~254 líneas) y la preservación total de la API pública.

**Nota sobre `ConfusionMatrix2DData.pitchClasses`:** en `types.ts` se tipó como `readonly string[]` en lugar de `typeof PITCH_CLASSES` (tupla literal) para prevenir de raíz una dependencia circular: `types.ts` no puede importar `PITCH_CLASSES` de `confusionMatrix.ts` porque este último importa sus tipos de `types.ts`. El valor runtime asignado sigue siendo exactamente la constante `PITCH_CLASSES` (`confusionMatrix.ts`), y los tres sitios que lo consumen lo tratan de forma segura como array — `ConfusionMatrixTab.tsx` itera con `.map()` e indexa por posición, `historyAnalytics.test.ts` afirma `.length === 12`, y `confusionMatrix.ts` lo asigna como valor de retorno — por lo que el ensanche de tipo es inocuo y no rompe a ningún consumidor (verificado por `npm run typecheck`).

### 4. Corrección F-06/F-14 — regex con límites de dígito y piso `>= 2` en toda rama

`resolveNominalPoolSize` actual usa `name.includes('nivel 1')`, que colisiona con `"nivel 10"` / `"nivel 11"` / `"nivel 12"` (subcadena). Se reemplaza la cadena de `includes` por una **única regex numérica** con límites de palabra/dígito:

```ts
const match = name.match(/nivel\s*(\d+)/i)
if (match) {
  const level = parseInt(match[1], 10)
  if (level === 1) return 3
  if (level === 2) return 5
  if (level === 3 || name.includes('octava diatónica')) return 8
  if (level === 4 || name.includes('cromático')) return 13
}
if (name.includes('pentatónica')) return 6
const custom = name.match(/notas\s*(?:personalizadas)?\s*\((\d+)\)/i)
if (custom) return Math.max(2, parseInt(custom[1], 10))
return Math.max(2, empiricalUniqueCount)
```

El piso `Math.max(2, ...)` se aplica a las dos ramas derivadas (custom y empírica), garantizando `poolSize >= 2` y, por tanto, `Math.log2(poolSize) >= 1` y `chanceBaseline <= 0.5` aguas abajo en `computeAnalyticsMetrics`.

### 5. Corrección F-09 — `totalAttempts` como suma de preguntas evaluadas

`computeLongitudinalComparisons` asignaba `sorted.length` (cantidad de sesiones del grupo). Pasa a:

```ts
totalAttempts: items.reduce((acc, it) => acc + (it.session.totalQuestions || 0), 0)
```

Usar `session.totalQuestions` (no respuestas individuales) porque `DetailedSessionAnalysis` expone la sesión y porque el agrupamiento es por contenido/instrumento, no por respuestas.

### 6. Corrección F-13 — semántica de "sin datos" en `analyzeSessionTimeline`

Para `total === 0` las métricas derivadas eran `100` (`firstListenConfidencePercent`, `errorRepairRatePercent`, y la precisión de cada mitad por el fallback `length === 0 → 100`), presentando un 100% espurio. Se introduce una guarda temprana: cuando no hay respuestas, `firstListenConfidencePercent`, `errorRepairRatePercent`, `firstHalfAccuracy` y `secondHalfAccuracy` valen `0` (y `avgLatencyMs`/`overallAccuracy` ya valen `0`). El resto del contrato (incluido `repairEffectivenessPercent: null`) se conserva. Para sesiones no vacías con mitades impares, el fallback `100` existente se mantiene intacto, pues es comportamiento cubierto por la suite actual.

### 7. Corrección F-16 — documentación de clamps en `pedagogicalDictionary.ts`

El concepto `cpi_score` documenta la fórmula sin los pisos/techos que `calculateSessionCPI` sí aplica (`Math.max(0.5, …)` en entropía, `Math.max(0.6, …)` en latencia, `Math.max(0.3, Math.min(2.5, …))` en velocidad). La cadena de `formulaOrCalculation` se amplía:

```
CPI = Oído Real × máx(0.5; Entropía/3.0) × (RPM/15.0) × (1.5s/máx(0.6s; Latencia)) × [0.3 – 2.5] × Factor Entrada × 10
```

Cambio puramente documental: el diccionario es insumo de `promptBuilder` y de la UI, y `formulaOrCalculation.length > 5` (test existente) se sigue cumpliendo.

### 8. `pedagogicalDictionary.ts` importa `COGNITIVE_LATENCY_THRESHOLDS` desde `thresholds.ts`

Su único import de `historyAnalytics` es esa constante. Tras la modularización pasa a `from './thresholds'`, rompiendo la dependencia circular implícita barrel→submódulo→barrel. El resto de submódulos hace lo propio: importan de `thresholds.ts`/`types.ts`, nunca del barrel.

## Risks / Trade-offs

- **[Riesgo] Símbolos duplicados entre submódulos al re-exportar** → `export * from` falla en tiempo de compilación si dos módulos exportan el mismo nombre. Mitigación: la taxonomía de la Decisión 3 asigna cada símbolo exactamente a un módulo; `types.ts` es el único exportador de interfaces y `thresholds.ts` el único de constantes. `npm run typecheck` lo detecta inmediatamente.
- **[Riesgo] Import circular** (p. ej. `sessionClassification` → `types`, `sessionFilters` → `sessionClassification`) → Mitigación: la capa descendente estricta es `thresholds` → `types` → funciones → orquestador; ningún submódulo importa de `historyAnalytics.ts` (el barrel), solo de sus hermanos. La Decisión 8 elimina el único caso real (pedagogicalDictionary).
- **[Riesgo] Regresión silenciosa en las 16 funciones movidas** → Mitigación: la suite existente (774 líneas en `historyAnalytics.test.ts` + `thresholdsConsistency.test.tsx`) queda ejecutándose **sin modificación de contrato** sobre el barrel; cualquier desviación se manifiesta en rojo. Se ejecuta antes de mover nada (baseline verde).
- **[Riesgo] Cambio de comportamiento de F-13 mal interpretado como regresión** → Mitigación: la rama `total === 0` no está cubierta por tests actuales (verificado: no existe caso de sesión vacía en `historyAnalytics.test.ts`), por lo que la corrección no rompe assertions existentes; los tests nuevos se escriben primero (TDD).
- **[Riesgo] F-06/F-14 cambia `poolSize` de presets existentes en producción** → Mitigación: la regex nueva es retrocompatible con los nombres canónicos (`"Nivel 1 (C, D, E) • Cronometrado 1m"`, `"Notas personalizadas (11)"`); solo difiere para colisiones de subcadena (`"nivel 10"`), que eran exactamente el defecto. Tests nuevos fijan ambos casos.
- **[Trade-off] `types.ts` y `sessionClassification.ts` superan 150 líneas** → Aceptado (Decisión 3): partir contratos por dominio añade saltos de archivo sin ganar cohesión.
- **[Trade-off] `resolveNominalPoolSize` gana visibilidad intra-paquete** → Aceptado (Decisión 2): es la única forma de compartir la lógica entre filtro y orquestador sin duplicación.

## Migration Plan

1. Registrar baseline: `npm run test` (vitest run) en verde antes de tocar código.
2. Escribir tests TDD (Red) de los casos borde F-06/F-14, F-09, F-13 y F-16 sobre el barrel actual; verificar que fallan.
3. Crear `thresholds.ts` y `types.ts` (cero dependencias) y mover constantes/interfaces; re-exportar desde el barrel.
4. Mover el resto de submódulos en orden de dependencia ascendente: `psychometrics`, `latencyStats`, `confusionMatrix`, `sessionClassification`, `timelineTelemetry`, `sessionFilters`, `longitudinal`; cada uno importa solo de `thresholds`/`types`.
5. Reducir `historyAnalytics.ts` a orquestador + barrel; actualizar `pedagogicalDictionary.ts` a `./thresholds`.
6. Aplicar las cuatro correcciones (F-06/F-14, F-09, F-13, F-16) en sus submódulos; verificar que los tests TDD pasan (Verde) y que la suite preexistente sigue al 100%.
7. Verificación final no interactiva: `npm run typecheck`, `npm run lint`, `npm run test`.
8. *Rollback:* cambio interno sin migración de datos ni cambio de esquema; basta con revertir el commit. No hay estado persistido que validar (los `poolSize` corregidos son derivados en tiempo de cómputo, no almacenados).

## Open Questions

Ninguna. Los puntos de ambigüedad menores (dónde alojar `computeInterSessionGapMap` y `resolveSessionInputMethod`/`resolveSessionDominantBias` — no listados explícitamente en el requerimiento, asignados a `sessionClassification.ts` por cohesión con el resto de resolvedores de sesión; y el exceso de líneas de `types.ts`) se resolvieron en las Decisiones 3 y 8.
