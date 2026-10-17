# Design

## Context

La SSOT de umbrales ya está calibrada por modalidad en `src/renderer/src/domain/analytics/thresholds.ts` (`COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` con 4 entradas y `getLatencyThresholds(mode)` con fallback a `single_note`), pero tres superficies de presentación siguen ancladas a la constante deprecada `COGNITIVE_LATENCY_THRESHOLDS` (alias de `single_note`):

- `pedagogicalDictionary.ts` importa `COGNITIVE_LATENCY_THRESHOLDS` y solo interpola sus etiquetas en `practicalTakeaway`; `formulaOrCalculation` es una fórmula genérica sin fundamento psicométrico ni etiquetas por modalidad.
- `diagnosticReportGenerator.ts` importa `COGNITIVE_LATENCY_THRESHOLDS` vía `historyAnalytics.ts` y redacta `cognitiveLatencyAnalysis` con etiquetas de `single_note` aunque `metrics.modeFilter` sea otra modalidad.
- `LatencySpectrumDiagram.tsx` importa `COGNITIVE_LATENCY_THRESHOLDS` vía `historyAnalytics.ts` y renderiza una única escala fija (marcadores `0.0s` / fast / med / `5.0s+`), sin selector de modalidad.

El motor de clasificación (`historyAnalytics.ts`, `timelineTelemetry.ts`) ya resuelve umbrales por sesión con `getLatencyThresholds(sessionMode)`, por lo que el informe puede quedar en sincronía contractual con el motor usando `metrics.modeFilter`.

## Goals / Non-Goals

**Goals:**

- Cero hardcoding de literales de tiempo fuera de `thresholds.ts` en los tres archivos objetivo.
- Textos clínicos y pedagógicos derivados 100% de la SSOT por modalidad.
- Diagrama de la Guía Psicoacústica con escala por modalidad (selector interactivo).
- Tests de consistencia que garanticen la propagación automática ante cambios en `thresholds.ts`.
- Suite completa (629+ tests) y `npm run typecheck` en verde.

**Non-Goals:**

- No se modifican valores ni la API de `thresholds.ts` (ni `CPI_CONFIG_BY_MODE` ni otros umbrales).
- No se rediseña el layout visual del diagrama más allá del selector de modalidad y los marcadores dinámicos.
- No se tocan otros conceptos del diccionario ni otras secciones del informe (sesgo, plan de acción).
- No se elimina todavía la constante deprecada `COGNITIVE_LATENCY_THRESHOLDS` de `thresholds.ts` (otros consumidores pueden migrar en cambios futuros); solo se deja de consumir en los tres archivos objetivo.

## Decisions

1. **Diccionario: interpolación en tiempo de construcción del módulo.**
   `formulaOrCalculation` y `practicalTakeaway` de `cognitive_latency` se construyen con template literals que iteran `Object.entries(COGNITIVE_LATENCY_THRESHOLDS_BY_MODE)` (o las 4 claves explícitas) e interpolan `FAST_LABEL` / `MEDIUM_LABEL` / `SLOW_LABEL` por modalidad, citando Donders/Sternberg. Alternativa considerada: convertir `PEDAGOGICAL_DICTIONARY` en una función que reciba el modo activo — se descarta porque rompería la API `getConcept(id)` consumida por tooltips y tests, y el diccionario debe ser un catálogo estático consultable.

2. **Informe: resolución por `metrics.modeFilter`.**
   `generateDiagnosticReport` resuelve `const thresholds = getLatencyThresholds(metrics.modeFilter)` y usa solo `thresholds.*` en `cognitiveLatencyAnalysis`. Alternativa considerada: inferir la modalidad desde las sesiones — se descarta porque `AnalyticsMetrics` ya expone `modeFilter` y es exactamente el filtro que el motor usó para clasificar las respuestas, garantizando sincronía informe-motor. El fallback interno de `getLatencyThresholds` (a `single_note`) cubre `modeFilter: 'all'` y valores no reconocidos sin romper el informe.

3. **Diagrama: selector de modalidad con estado local.**
   `LatencySpectrumDiagram.tsx` añade `useState<ModalityKey>('single_note')` y un selector (botones por modalidad); los marcadores se calculan con `(thresholds.FAST_MAX_MS / 1000).toFixed(1) + 's'` y `(thresholds.MEDIUM_MAX_MS / 1000).toFixed(1) + 's'`, y las zonas usan las etiquetas de la configuración resuelta. Alternativa considerada: renderizar las 4 modalidades en paralelo — se descarta como diseño principal por densidad visual; el selector es más claro y el paralelo queda como opción si el usuario lo prefiere en revisión. El marcador superior derecho `5.0s+` se sustituye por el `SLOW_LABEL` de la modalidad activa para eliminar el último literal de tiempo.

4. **Importación directa desde la SSOT.**
   Los tres archivos importan desde `./thresholds` (o `../../../domain/analytics/thresholds` en el componente) en lugar del barrel `historyAnalytics.ts`, dejando de depender del re-export y de la constante deprecada. Alternativa: seguir vía barrel — se descarta porque perpetúa el acoplamiento al alias deprecado.

5. **Tests de consistencia como contrato de propagación.**
   En `thresholdsConsistency.test.tsx` se añaden aserciones que derivan las etiquetas esperadas de `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` (no literales duplicados) y un caso de mutación: alterar dinámicamente el objeto de umbrales (p. ej. `vi.spyOn` sobre el módulo o mutación controlada del objeto en un test con cleanup) y verificar que el texto del diccionario y del informe contienen la etiqueta mutada. Los tests existentes que asertaban `< 1.4s` literal en `pedagogicalDictionary.test.ts` se actualizan a aserciones dinámicas equivalentes.

   **Registro de implementación (post-verify):** el test de propagación utiliza `vi.doMock('./thresholds')` (con `importOriginal`, restauración en `finally` y `vi.doUnmock` + `vi.resetModules` en `afterEach`) en lugar de una mutación runtime directa del objeto exportado. Motivo: los template literals del diccionario se evalúan estáticamente al cargar el módulo (`pedagogicalDictionary.ts` construye `formulaOrCalculation` y `practicalTakeaway` en tiempo de import), por lo que mutar el objeto tras la carga no propaga a los textos; el mock de módulo simula fielmente una edición del archivo SSOT. Además, el factory del mock debe sobreescribir también `getLatencyThresholds` porque la función original cierra sobre el objeto del módulo original (mutar solo el export del `Record` no altera su closure). El escenario canónico "Informe sin datos no se rompe" cuenta con prueba unitaria directa en el mismo bloque (métricas con `totalAnswers: 0`, sin excepciones, `executiveSummary` con "No se registran sesiones" y `concreteActionPlan.length > 0`).

6. **Rama de equilibrio del informe consume la SSOT dinámicamente.**
   En `diagnosticReportGenerator.ts`, la rama else de `cognitiveLatencyAnalysis` (equilibrio entre velocidad y precisión) interpola `${thresholds.MEDIUM_LABEL}` en lugar de quedar como texto fijo sin etiqueta, manteniendo la regla de que todo el análisis de latencia se redacta exclusivamente con etiquetas dinámicas de la configuración resuelta por `metrics.modeFilter`.

## Risks / Trade-offs

- [Tests existentes acoplados a la escala `single_note`] → Se actualizan `pedagogicalDictionary.test.ts` y cualquier aserción de texto del informe a etiquetas derivadas de la SSOT; se ejecuta la suite completa para detectar acoplamientos residuales (p. ej. `knowledgeGuide.test.ts`).
- [`modeFilter: 'all'` mezcla modalidades con umbrales distintos] → El informe citará la configuración de `single_note` (fallback documentado de `getLatencyThresholds`); se documenta en el texto del informe que la escala corresponde a la modalidad base cuando el filtro es global. Comportamiento aceptable y ya usado por el motor en agregados.
- [Mutación del objeto SSOT en tests puede filtrarse a otros tests] → Se restaura el valor original en `afterEach`/`finally` y se prefiere `vi.mock`/`vi.spyOn` con restore automático.
- [El selector añade estado visual al diagrama] → Cambio contenido al componente; sin efectos en el store global ni en otros componentes de la guía.

## Migration Plan

1. TDD: escribir primero los tests de consistencia (Red).
2. Migrar `pedagogicalDictionary.ts`, luego `diagnosticReportGenerator.ts`, luego `LatencySpectrumDiagram.tsx` (Green por pasos).
3. Actualizar aserciones legacy acopladas a literales.
4. Verificación final: `npm run typecheck` + `npm run test` (629+ tests).
5. Rollback: revertir los 3 archivos + tests; no hay cambios de esquema, persistencia ni API pública.

## Open Questions

- Ninguna bloqueante. La elección selector-vs-paralelo en el diagrama queda como decisión registrada (selector); puede revisarse en la fase de apply sin afectar specs ni tareas.
