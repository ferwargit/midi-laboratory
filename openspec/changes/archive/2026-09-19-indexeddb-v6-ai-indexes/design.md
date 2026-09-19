## Context

Hoy `MusicalEarTrainerDB` está en `DB_VERSION = 5`. El bloque `onupgradeneeded` de `databaseEngine.ts:31` ya es idempotente para `sessions` (crea el store si falta y el índice `targetMode` solo si no está en `indexNames`) y para `exercise_answers` (crea store e índices `sessionId`/`expectedNote` dentro de la rama de creación). En cambio, `ai_diagnostics` y `ai_consultations` (líneas 52-58) se crean con un `createObjectStore` desnudo y **ningún índice**, por lo que `getAllAiReports()`/`getAllAiConsultations()` dependen de `getAll()` + `sort()` en memoria. Ver `proposal.md` para la motivación de escalabilidad.

La migración es de complejidad moderada: toca el esquema versionado, debe ser no destructiva y debe verificarse retroactivamente. Por eso se redacta este diseño.

## Goals / Non-Goals

**Goals:**

- Llevar el esquema canónico a `DB_VERSION = 6` añadiendo `createdAt` y `modeFilter` como índices secundarios no únicos en ambos almacenes de IA.
- Garantizar que una base v5 existente migre a v6 sin pérdida de datos y que reaperturas sucesivas no fallen.
- Verificar físicamente la existencia de los índices desde las pruebas unitarias, no solo inferirla del código.

**Non-Goals:**

- No se reescriben `getAllAiReports()` ni `getAllAiConsultations()` para usar los índices (el `getAll()` + `sort()` actual se mantiene; la lectura indexada se explota en el futuro). La simple existencia de los índices ya elimina el bloqueo arquitectural.
- No se añaden índices a `sessions` ni `exercise_answers` más allá de los existentes.
- No se cambia la forma de `DatabaseBackupPayload` ni de los type guards; los respaldos v5 siguen siendo importables.

## Decisions

### Decisión 1: Crear los índices de IA con el patrón idempotente de `sessions`, no el de `exercise_answers`

El bloque de `exercise_answers` (líneas 46-50) crea los índices **dentro** de la rama `if (!db.objectStoreNames.contains(...))`. Eso solo es idempotente de forma indirecta: si el store ya existía, la rama entera se saltaba y los índices nunca se creaban. Para los almacenes de IA es justo el caso problemático: la base v5 **ya tiene** los stores sin índices, así que al migrar a v6 la rama de creación se saltaría y los índices nunca llegarían a existir.

Por eso se adopta el patrón de `sessions` (líneas 36-44): resolver la referencia al store —`createObjectStore` si no existe, `transaction.objectStore(...)` en caso contrario— y luego crear cada índice con una guarda individual sobre `store.indexNames.contains('createdAt')` / `contains('modeFilter')`. Así la migración de v5→v6 crea los índices sobre el store preexistente, y una base nueva los crea en la misma pasada.

**Alternativa descartada:** crear los índices dentro de la rama de creación del store. Fallaría silenciosamente en la migración de bases v5 reales, que es precisamente el objetivo del cambio.

### Decisión 2: Índices no únicos, sobre campos validados como obligatorios

Los índices se declaran `{ unique: false }` porque tanto `createdAt` como `modeFilter` admiten duplicados por construcción (varios reportes comparten `modeFilter: 'single_note'`). Es seguro indexarlos porque `isValidAiReportRecord` y `isValidAiConsultationRecord` ya exigen ambos campos como strings no vacíos y `createdAt` parseable, de modo que ningún registro válido quedará fuera del índice (no se generan claves `undefined`).

**Alternativa descartada:** indexar `id` —innecesario, ya es el `keyPath`.

### Decisión 3: Verificación retroactiva vía la transacción de `onupgradeneeded`

La existencia física de los índices se comprueba en pruebas abriendo la conexión y enumerando `db.transaction(store).objectStore(store).indexNames` (con `fake-indexeddb`, que soporta `createIndex` e `indexNames`). Esto valida el esquema real, no una suposición del código. Para el escenario de migración no destructiva se simula la base v5 insertando registros antes de la apertura v6 dentro de la misma prueba, comprobando que sobreviven.

### Decisión 4: `_object store_` y nombres de índice literales en las pruebas

Los índices se referencian por nombre literal (`'createdAt'`, `'modeFilter'`) en las aserciones, en lugar de derivarlos de constantes nuevas, para que la prueba sea un contrato independiente del código de producción y detecte renombres accidentales.

## Risks / Trade-offs

- **[Riesgo] `fake-indexeddb` no replica el `onupgradeneeded` de versiones anteriores** → Las pruebas de migración simulan el estado v5 dentro de la propia prueba (insertar datos, reabrir con versión 6), lo suficiente para verificar idempotencia y conservación de registros. El comportamiento en navegadores reales es equivalente porque la lógica se basa en `objectStoreNames`/`indexNames`, que son la API estándar.
- **[Riesgo] Duplicación de código entre los dos bloques de IA** → Ambos stores reciben cuatro líneas casi idénticas. Se acepta la duplicación por simetría con el estilo existente del archivo antes que introducir un helper que cambiaría la forma del `onupgradeneeded` y dificultaría la revisión del diff.
- **[Trade-off] Los índices se crean pero las lecturas no los usan aún** → Supone un coste de escritura/Espacio mínimo y transitorio; el valor es habilitar consultas indexadas futuras sin otra migración de versión.
- **[Riesgo] `"precision note"` de la spec** → El usuario solicitó retirar "la nota que indica que los almacenes de IA no tenían índices". No existe tal nota literal en `openspec/specs/07-persistence-storage/spec.md`; lo más próximo es el listado de stores (líneas 32-33) que solo declara `keyPath: 'id'`. El delta actualiza ese listado y añade la cláusula explícita de índices, cumpliendo la intención.

## Migration Plan

1. Incrementar `DB_VERSION` a `6`.
2. Ampliar `onupgradeneeded` con la resolución idempotente de cada store de IA y la creación condicional de los cuatro índices.
3. Actualizar las aserciones de versión y añadir las pruebas de existencia física y de migración no destructiva.
4. Verificar con `npm run typecheck` y `npm run test` (vitest).

**Rollback:** revertir `DB_VERSION` a `5` y el bloque de índices. Una base ya migrada a v6 se reabre sin problema en v5: los índices adicionales son ignorados por la versión inferior y los registros son compatibles (no se alteró ningún `keyPath` ni la forma de los registros).

## Open Questions

Ninguna. Los nombres de índice, las decisiones de unicidad y la estrategia de prueba están determinados por el estado actual del código y los validadores existentes.
