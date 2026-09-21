## Context

`DatabaseEngine.importDatabase` (src/renderer/src/domain/database/databaseEngine.ts:333-387) valida el payload, y luego, si `mode === 'replace'`, ejecuta `await this.clearDatabase()` (líneas 347-349) antes de abrir una **segunda** transacción `readwrite` sobre los cuatro stores para los `.put()`. `clearDatabase()` abre y commitea su propia transacción (líneas 389-405), por lo que el vaciado es durable antes de que exista siquiera la transacción de importación: un fallo posterior deja la base vacía. Ver `proposal.md` (Why) para la motivación del hallazgo F4-01 (P0).

## Goals / Non-Goals

**Goals:**

- Que el vaciado y la inserción de una importación `replace` compartan una sola transacción IndexedDB, de modo que cualquier aborto revierta el vaciado.
- Que el cambio sea local a `importDatabase`: sin tocar la firma pública, `clearDatabase()`, `types.ts` ni el store.
- Disponer de una prueba que falle con el código actual (regression guard real) y pase con el fix.

**Non-Goals:**

- No se añade retry, ni reintentos parciales, ni importación por lotes (_chunking_) — quedan fuera del alcance de F4-01.
- No se modifica `clearDatabase()` (sigue siendo la vía del reseteo total explícito desde la UI, con su contrato actual de transacción única sobre los cuatro stores).
- No se cambia el modo `merge` ni la validación pre-transacción.

## Decisions

**D1 — Vaciar e insertar en la transacción de importación ya existente.**
La rama `replace` deja de llamar a `clearDatabase()` y, dentro de la transacción `readwrite` sobre los cuatro stores que el método ya abre para los `.put()`, invoca `.clear()` en los cuatro `objectStore` **antes** de los `.put()`. Es el cambio mínimo: la transacción, el manejo de `oncomplete`/`onerror` y el `ImportResult` ya existen.

- _Alternativa descartada_: dar a `clearDatabase()` un parámetro opcional para recibir una transacción externa. Rechazada: complica la API pública de un método cuyo contrato canónico (requisito "Limpieza Completa y Reseteo del Store de IA") exige abrir su propia transacción, y acopla dos casos de uso con requisitos opuestos.
- _Alternativa descartada_: pre-computar y reescribir fuera de IndexedDB (patrón log/compensación). Rechazada: IndexedDB no ofrece atomicidad entre transacciones; reimplementar rollback manual es innecesario cuando la transacción única ya lo da de forma nativa.

**D2 — Todas las operaciones se programan de forma síncrona en el mismo executor.**
Los `.clear()` y los `.put()` se emiten sin ningún `await` intermedio dentro del executor del `Promise`. IndexedDB commitea una transacción cuando la cola de tareas se vacía; mezclar `await` entre operaciones de la misma transacción es justo el patrón que rompe la atomicidad (este mismo bug). Ya hay precedentes válidos en el archivo (`saveSession`, `deleteSessions` programan todo en un único executor).

**D3 — Orden clear → put preserva la semántica de success.**
En éxito, el resultado observable es idéntico al actual: stores vaciados y luego repoblados con los registros válidos. Claves duplicadas dentro del propio payload se resuelven por última-escritura, igual que hoy. El filtrado con type guards y el rechazo de payloads inválidos se mantienen **antes** de abrir la transacción.

**D4 — Prueba de rollback mediante aborto dirigido a la transacción que hace `put`.**
La prueba siembra datos previos (sesión + respuesta + reporte), intercepta el handle interno `db` y envuelve `db.transaction` de modo que la primera transacción `readwrite` que emita un `.put()` reciba `tx.abort()` (vía `queueMicrotask`). Así se apunta exclusivamente a la fase de inserción:

- Con el código actual: la transacción de `clearDatabase()` (que solo hace `.clear()`, sin `put`) commitea intacta; el aborto golpea a la transacción de importación → la base queda vacía → **la prueba falla**.
- Con el fix: hay una sola transacción; el aborto la revierte entera → los datos previos permanecen → **la prueba pasa**.

Esto convierte el caso en un regression guard genuino, no en una tautología.

## Risks / Trade-offs

- **[Transacción auto-commiteada por evento no bloqueado]** Si una operación asíncrona se colara entre `.clear()` y `.put()`, IndexedDB podría commitear el vaciado antes de la inserción. → Mitigación: D2; la prueba D4 aborta justamente en la fase de `put`, por lo que una regresión de este tipo se detectaría.
- **[Cambio de comportamiento ante fallo]** Una importación `replace` fallida ahora deja la base con los datos previos en vez de vacía. Es el objetivo, pero es observable: `useDatabaseStore.importBackupJson` ya rechaza y **no** llama `reloadAllData()` en el camino de fallo, por lo que la UI muestra los datos previos de forma consistente. Ningún consumidor depende de la base vacía tras un fallo.
- **[Fidelidad de `fake-indexeddb`]** La prueba depende de que el shim respete la semántica de `abort()` y rollback. → Mitigación: el suite ya depende de `fake-indexeddb/auto` y de transacciones multistore; verificar en implementación que el aborto efectivamente preserve los registros.
- **[Rendimiento]** Una sola transacción retiene los cuatro stores durante toda la inserción. Insignificante para volúmenes de usuario individual; la importación es una operación explícita y poco frecuente.

## Migration Plan

- Sin cambio de esquema (`DB_VERSION` se mantiene en `6`), sin migración de datos y sin cambio en la firma pública. Despliegue normal.
- Rollback: revertir `databaseEngine.ts` a su estado previo (no hay estado persistedo nuevo ni formato de payload que evolucione).
- El delta spec se sincroniza con `openspec/specs/07-persistence-storage/spec.md` al archivar el cambio (`/opsx-archive`); hasta entonces el requisito canónico vigente es el del main spec.

## Open Questions

Ninguna. La técnica de aborto de la prueba (D4) es la única con margen de implementación; si `fake-indexeddb` no propagara el aborto como se espera, se sustituirá por forzar `tx.onerror`/`tx.error` —misma técnica objetivo, mismo caso de prueba.
