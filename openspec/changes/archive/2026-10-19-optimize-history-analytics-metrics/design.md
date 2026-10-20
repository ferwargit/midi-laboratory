# Design

## Context

`computeAnalyticsMetrics` (`src/renderer/src/domain/analytics/historyAnalytics.ts:45-279`) es el motor de agregación de la vista de Analítica. Estado actual relevante (F23, Auditoría V9):

1. **Bucle cuadrático**: dentro de `filteredSessions.map(...)`, la línea 96 ejecuta `filteredAnswers.filter((a) => a.sessionId === session.id)` → O(S×A). Con historiales de miles de respuestas y cientos de sesiones, cada apertura de la vista repite el escaneo completo de respuestas por cada sesión.
2. **Duplicación de resolución de modalidad**: `resolveSessionMode(session) ?? 'single_note'` se calcula en el bloque de sesiones (línea 123) y de nuevo, por respuesta, en el bucle de agregación (línea 190). `resolveSessionMode` es determinista sobre los campos de la sesión, por lo que el segundo cálculo es redundante.
3. **Round-trip de strings**: la matriz de confusión serializa cada par como `` `${expName} ➔ ${playName}` `` (línea 203) y luego lo descompone con `key.split(' ➔ ')` (línea 217) para reconstruir `ConfusionPair`. La clave textual es frágil (depende de que ningún nombre de nota contenga el separador) y obliga a parsear texto que ya existía tipado.

Restricciones: el contrato de retorno `AnalyticsMetrics` y la firma pública exportada por el barrel NO cambian; los 35 sitios consumidores (stores, hooks, views, dominio IA/adaptación y tests) no deben modificar imports. La suite existente de analítica es la red de regresión.

## Goals / Non-Goals

**Goals:**

- Reducir el costo algorítmico global de `computeAnalyticsMetrics` de O(S×A) a O(S+A).
- Eliminar la resolución de modalidad duplicada usando el SSOT `resolveSessionMode` una única vez por sesión.
- Eliminar el round-trip de strings en la agregación de `topConfusions` mediante una estructura `Map` con pares tipados.
- Reducir la complejidad ciclomática de la función extrayendo helpers privados cohesivos dentro del mismo módulo.
- Suite completa de tests en verde (`npm test`), `typecheck` y `lint` sin regresiones.

**Non-Goals:**

- No cambiar el contrato `AnalyticsMetrics`, `ConfusionPair`, `DetailedSessionAnalysis` ni ningún tipo exportado.
- No modificar consumidores (`useAnalyticsStore`, `AnalyticsView`, tests) ni la superficie del barrel.
- No tocar otros módulos de analítica (`confusionMatrix.ts` 2D, `psychometrics.ts`, `longitudinal.ts`, `sessionFilters.ts`).
- No introducir memoización/caché entre invocaciones (el costo O(S+A) por invocación es el objetivo).
- No cambiar valores numéricos, órdenes de ordenación, límites (top 5) ni umbrales.

## Decisions

### D1 — Pre-agrupación con `Map<string, DbAnswerRecord[]>` por `sessionId`

Construir una única pasada sobre `filteredAnswers` (O(A)) llenando `answersBySessionId`, y en el `.map()` de sesiones leer `answersBySessionId.get(session.id) ?? []` (O(1) amortizado por sesión) → O(S+A) total.

- *Alternativa descartada*: `Map<string, {cursor: number}>` con índice pre-ordenado por sesión — más complejo, sin beneficio adicional.
- *Alternativa descartada*: `Object.groupBy` — requiere runtime target moderno y no aporta ventaja sobre `Map` aquí.

### D2 — Resolución de modalidad única por sesión, reutilizada en ambos bloques

Resolver `sessionMode` una vez por sesión y reutilizarlo en ambos bloques (psicometría y agregación por respuesta) mediante un mapa intermedio `SessionLatencyContext` (`Map<string, { mode, thresholds }>`, `buildSessionLatencyContexts`): una única pasada sobre las sesiones filtra resuelve el modo con el SSOT `resolveSessionMode(session) ?? 'single_note'` y precalcula `getLatencyThresholds(mode)`, almacenando ambos por `sessionId`. Compartir el valor entre los dos bucles exige almacenarlo; el mapa es la estructura mínima para ello y elimina el recálculo por respuesta (misma función SSOT, misma semántica `?? 'single_note'`).

- *Alternativa descartada*: reutilizar la resolución inline del bloque de sesiones sin estructura intermedia — inviable, porque la variable local del `.map()` de sesiones no es accesible desde el bucle de agregación posterior; compartir el valor requiere almacenarlo de forma explícita.
- *Alternativa descartada*: recalcular `resolveSessionMode(session)` por respuesta (comportamiento previo a F23) — redundante, la función es determinista sobre los campos de la sesión.
- Nota: `getLatencyThresholds(sessionMode)` también pasa a resolverse una vez por sesión (precalculado en el contexto) en lugar de por respuesta.

### D3 — Matriz de confusión con `Map` de clave estructurada tipada

Reemplazar `Map<string, number>` + `split(' ➔ ')` por un `Map<string, ConfusionPair>` donde la clave interna es un compuesto tipado (p. ej. `${expectedNote}|${playedNote}` sobre los números MIDI, no sobre los nombres) y el valor acumula `{ expected: expName, played: playName, count }`. La conversión a nombres (`midiNoteToName`) ocurre una sola vez por par al crear la entrada. La proyección final a `ConfusionPair[]` ordena por `count` descendente y corta en 5, idéntico al comportamiento actual.

- *Por qué clave numérica y no textual de nombres*: los números MIDI son la fuente tipada original; usarlos como clave elimina por completo la ambigüedad del separador y el parseo inverso.
- *Alternativa descartada*: `Map<ConfusionPair, number>` con clave por referencia — los objetos no son claves válidas por valor.
- *Alternativa descartada*: matriz 12×12 por clases de tono — perdería la distinción por octava que `topConfusions` conserva hoy (nombres completos, no pitch classes).

### D4 — Modularización en helpers privados del mismo módulo

Extraer del cuerpo monolítico bloques cohesivos como funciones privadas (no exportadas) del módulo, p. ej.:

- `buildAnswersBySession(answers)` → agrupación D1.
- `analyzeSessionPsychometrics(session, sAnswers, gapInfo)` → bloque por sesión (pool, entropía, normalización, porcentajes, CPI).
- `aggregateAnswerStats(...)` → acumuladores globales (correctos, tiempo, buckets de latencia, sesgos, confusión, notas).

La función pública orquesta: filtrar → agrupar → mapear sesiones → agregar respuestas → proyectar. Objetivo: reducir la complejidad ciclomática de `computeAnalyticsMetrics` sin cambiar su firma ni su contrato.

- *Alternativa descartada*: nuevo archivo `metricsAggregator.ts` — rompería la cohesión del módulo y obligaría a tocar el barrel; el cambio se limita a `historyAnalytics.ts`.

## Risks / Trade-offs

- **[Regresión numérica sutil]** → La suite existente aserta exactitud matemática (CPI, entropía, normalización, sesgos, umbrales por modalidad, `topConfusions`). Se ejecuta la suite completa de analítica + `npm test` íntegro, `typecheck` y `lint`; cualquier desviación bloquea el cambio.
- **[Orden de `topConfusions` con empates]** → El orden actual entre pares con el mismo `count` depende del orden de inserción del `Map`. La nueva estructura conserva el orden de inserción de primera aparición del par, por lo que el orden resultante es equivalente; los tests existentes lo verifican.
- **[Sesiones sin respuestas]** → `answersBySessionId.get(id)` puede devolver `undefined`; el helper debe tratarlo como lista vacía (`?? []`), igual que hoy produce `sAnswers = []` y `totalAns = Math.max(1, 0)`. Cubierto por tests existentes de sesiones vacías.
- **[Complejidad ciclomática desplazada, no reducida]** → Extraer helpers mueve ramas, no las elimina. Mitigación: los helpers son cohesivos y de una sola responsabilidad; la función pública queda como orquestador lineal. No se persigue una métrica numérica concreta, sino legibilidad y testabilidad estructural.

## Migration Plan

Cambio interno de un único módulo, sin migración de datos ni de esquema. Despliegue con el build normal. Rollback: revertir el commit del módulo; no hay estado persistente afectado.

## Open Questions

(ninguna)
