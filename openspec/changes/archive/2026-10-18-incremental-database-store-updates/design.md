# Design

## Context

`useDatabaseStore` (Zustand, `src/renderer/src/stores/useDatabaseStore.ts`) mantiene en memoria: `summary`, `sessions`, `answers`, `aiReports`, `aiConsultations`. Hoy, todos los mutadores terminan con `await reloadAllData()`, que ejecuta 5 lecturas completas a IndexedDB (`getSummary` + 4 `getAll*`) y un `set` que reemplaza todo el estado (ver proposal.md — Why).

Datos observados del motor (`src/renderer/src/domain/database/databaseEngine.ts`):

- `getAllSessions`, `getAllAiReports`, `getAllAiConsultations` ordenan por `createdAt` descendente; `getAllAnswers` no ordena.
- `getSummary` calcula agregados ponderados por `totalQuestions` a partir de la lista completa de sesiones: `totalSessions`, `totalExercises = Σ totalQuestions`, `overallAccuracy = round(Σ correct / Σ totalQuestions × 100)`, `overallAvgTimeMs = round(Σ(avgResponseTimeMs × totalQuestions) / Σ totalQuestions)`, `totalDurationSeconds = Σ(durationSeconds || 0)`.
- `saveSession` / `saveAiReport` / `saveAiConsultation` usan `put` (upsert por clave primaria `id`), por lo que una re-escritura del mismo `id` es un reemplazo legítimo.
- `deleteSessions` borra en cascada las respuestas hijas localizadas por el índice `sessionId`.
- `clearDatabase` ya actualiza el estado incrementalmente (no llama a `reloadAllData`).

## Goals / Non-Goals

**Goals:**

- Convertir las escrituras (`saveSession`, `deleteSession`, `deleteSessions`, `saveAiReport`, `saveAiConsultation`) en actualizaciones incrementales del estado: cero lecturas a IndexedDB tras la persistencia.
- Preservar exactamente el estado final observable actual (mismas colecciones, mismo orden canónico, mismo `summary`) para que ningún consumidor (`DatabaseCard`, `StudioBottomDock`, `useAnalyticsStore`, vistas de historial) necesite cambios.
- Reservar `reloadAllData()` exclusivamente para `initialize` e `importBackupJson`.
- Cubrir el comportamiento con tests que demuestren la ausencia de lecturas completas en escrituras.

**Non-Goals:**

- No se modifica `DatabaseEngine` (su API, esquema v6, validadores ni transacciones).
- No se introduce persistencia derivada ni índices nuevos en IndexedDB.
- No se cambia ninguna firma pública de `DatabaseState`.
- No se toca `useAiStore` ni la lógica de reseteo en cascada de `clearDatabase`.

## Decisions

### D1: Recalcular `summary` desde la lista de sesiones en memoria (no matemática incremental por deltas)

Se extrae un helper puro `computeSummaryFromSessions(sessions: DbSessionRecord[]): DatabaseSummary` con la misma matemática ponderada de `getSummary`, y cada mutador lo aplica sobre el array de sesiones ya actualizado.

- **Por qué**: la matemática del resumen incluye divisiones ponderadas (`overallAccuracy`, `overallAvgTimeMs`) donde la actualización por deltas es propensa a errores de redondeo y acumulación de drift; recalcular sobre el array en memoria es O(n) en CPU pura sobre datos ya residentes (microsegundos para tamaños realistas de historial), mientras que el coste O(n) problemático — las 5 lecturas asíncronas completas a IndexedDB — desaparece por completo.
- **Alternativa descartada**: mantener contadores delta (`totalSessions += 1`, etc.). Requiere lógica distinta por operación (suma en save, resta en delete, reemplazo en upsert) y deriva del valor canónico con el tiempo; el recálculo desde memoria es idempotente y siempre coincide con `getSummary`.
- **Ubicación del helper**: junto al store en `useDatabaseStore.ts` (no exportado por el motor, que no debe conocer el estado del store). Si el equipo prefiere, puede vivir en `domain/database/summaryMath.ts`; decisión de implementación menor.

### D2: Upsert con re-ordenación canónica por `createdAt` descendente

Para `sessions`, `aiReports` y `aiConsultations`: upsert (filtrar el `id` existente si lo hay, añadir el nuevo) seguido de `sort` por `createdAt` descendente, replicando el orden de `getAllSessions`/`getAllAiReports`/`getAllAiConsultations`. Para `answers`: upsert por `id` sin re-ordenación (el motor tampoco ordena `getAllAnswers`).

- **Por qué**: garantiza que el estado incremental sea indistinguible del que produciría una recarga completa, que es el criterio de equivalencia de los tests.
- **Alternativa descartada**: inserción binaria en posición ordenada — micro-optimización innecesaria; el sort de un array ya en memoria es trivial frente al coste eliminado.

### D3: Borrado incremental por filtrado con `Set` de ids

`deleteSessions(ids)` construye un `Set` con los ids eliminados y filtra `sessions` por `id ∉ Set` y `answers` por `sessionId ∉ Set`, en un único `set` atómico junto al `summary` recalculado. `deleteSession` delega en la misma lógica con un array de un elemento.

- **Por qué**: coincide con la semántica de cascada del motor (borra sesiones + respuestas hijas por índice `sessionId`) y evita dobles pasadas.

### D4: Actualización del estado solo tras persistencia exitosa

Cada mutador conserva el patrón actual: `await engine.<operación>()` primero; el `set` incremental ocurre después. Un rechazo del motor propaga la excepción (comportamiento actual) y deja el estado en memoria intacto.

- **Por qué**: es la garantía de consistencia memoria↔disco más simple posible; cualquier estrategia optimista requeriría rollback y no aporta valor en este flujo (la UI ya espera la promesa).

### D5: `reloadAllData` queda con exactamente dos llamadores

Se eliminan las llamadas desde los cinco mutadores. `initialize` e `importBackupJson` lo conservan sin cambios. No se renombra ni se marca como privado (el store ya lo expone y un test existente lo invoca directamente con motor nulo).

- **Alternativa descartada**: hacer `reloadAllData` privado y exponer solo `refreshFromDisk()` — cambio de API pública innecesario para este alcance.

### D6: Estrategia de tests — espías sobre el prototipo del motor

Los tests de no-lectura-completa usan `vi.spyOn(DatabaseEngine.prototype, 'getAllSessions')` (y los otros cuatro métodos) para afirmar `not.toHaveBeenCalled()` tras `saveSession`/`deleteSession`, y `toHaveBeenCalledTimes(1)` (o el conteo esperado) en los tests de `initialize` e `importBackupJson`. Los tests de equivalencia de estado reutilizan los fixtures existentes del archivo de tests.

- **Por qué**: el contrato observable es "el estado final es correcto Y no se re-leen las tablas"; espiar el prototipo es el mecanismo ya usado en el archivo (`vi.spyOn(DatabaseEngine.prototype, 'initialize')`).

## Risks / Trade-offs

- [Divergencia memoria↔disco si el estado incremental no refleja lo persistido] → Mitigado por D4 (set solo tras `await` exitoso) y por los tests de equivalencia (upsert/orden/summary idénticos a la recarga completa). `importBackupJson` e `initialize` siguen siendo puntos de re-sincronización total.
- [Drift del `summary` si la matemática del helper difiere de `getSummary`] → El helper replica exactamente las fórmulas de `getSummary` (incluido `Math.round` y `durationSeconds || 0`); los tests comparan el `summary` incremental contra el que devuelve el motor tras la misma operación.
- [Registros con `createdAt` idéntico] → El orden entre empates puede diferir del de una recarga completa (el motor no define desempate). Impacto cosmético; no se añade desempate artificial para no divergir del comportamiento actual de `getAllSessions`.
- [Sobrecoste O(n) en CPU del recálculo de `summary` en bases muy grandes] → Aceptado conscientemente: es cómputo en memoria sin I/O; el objetivo del hallazgo F14.2 es eliminar las lecturas completas a IndexedDB, no la complejidad algorítmica en RAM.
- [Consumidores que dependan de que cada escritura dispare una "recarga" observable] → Ninguno detectado: los consumidores leen el estado reactivo del store, cuyo valor final es idéntico. La suite completa (`npm test`), `typecheck` y `lint` deben confirmar 0 regresiones.

## Migration Plan

Cambio interno de un único módulo, sin migración de datos ni de esquema. Despliegue: commit único tras pasar `npm test`, `typecheck` y `lint`. Rollback: revert del commit; no hay estado persistido alterado por el cambio.

## Open Questions

(ninguna)
