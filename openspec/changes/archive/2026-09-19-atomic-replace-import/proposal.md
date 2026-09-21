## Why

La importación en modo `replace` no es atómica: `importDatabase` (src/renderer/src/domain/database/databaseEngine.ts:347-349) ejecuta `await this.clearDatabase()`, que commitea su propia transacción **antes** de abrir la transacción de importación. Si la importación posterior falla (p. ej. `QuotaExceededError`, aborto de transacción, error de clonación), la base queda **100% vacía** y los datos previos del usuario se pierden de forma irrecuperable. Es el hallazgo crítico F4-01 (P0): una operación de restauración de respaldo puede destruir el único respaldo de datos real que existe en la máquina del usuario.

## What Changes

- `importDatabase(backup, 'replace')` deja de invocar a `clearDatabase()` como paso separado. El vaciado (`.clear()` sobre los cuatro stores) y la inserción (`.put()` de los registros válidos) se ejecutan ahora dentro de la **misma y única transacción `readwrite`** sobre los cuatro object stores.
- Como consecuencia, un aborto de la transacción (cuota, error de disco, clonación) revierte automáticamente el vaciado: los datos previos quedan preservados íntegros.
- El método público `clearDatabase()` **no cambia**; conserva su contrato actual (una transacción atómica sobre los cuatro stores) y sigue siendo la vía para el reseteo total explícito desde la UI.
- Se añade una prueba unitaria en `databaseEngine.test.ts` que fuerza un aborto durante la fase de inserción de una importación `replace` y verifica que los datos previos (sesiones, respuestas, reportes) permanecen íntegros.
- Se actualiza el requisito canónico de importación en `openspec/specs/07-persistence-storage/spec.md`: el modo `replace` pasa de "llamar a `clearDatabase()` antes de importar" a "vaciar e importar en una única transacción atómica", con un escenario de rollback.

## Capabilities

### New Capabilities

_(Ninguna — no se introduce una capacidad nueva; se corrige la garantía de atomicidad de una capacidad existente.)_

### Modified Capabilities

- `07-persistence-storage`: el requisito "Importación con Modos merge y replace" cambia su regla de modo `replace`: el vaciado de los cuatro stores y la inserción de registros MUST ejecutarse en una única transacción `readwrite` atómica, de forma que un aborto MUST preservar los datos previos (rollback). Se añade un escenario de importación `replace` fallida con preservación íntegra de los datos existentes.

## Impact

- **Código**: `src/renderer/src/domain/database/databaseEngine.ts` — solo `importDatabase` (rama `mode === 'replace'`). `clearDatabase()` y el resto del motor quedan sin cambios.
- **Pruebas**: `src/renderer/src/domain/database/databaseEngine.test.ts` — nuevo caso de rollback atómico (simula un aborto en la fase de `put`).
- **Especificación**: `openspec/specs/07-persistence-storage/spec.md` — delta sobre el requisito de importación (y su escenario), sincronizado al archivar el cambio.
- **Dependencias/APIs**: sin cambios en la firma pública `importDatabase(backup, mode): Promise<ImportResult>`, en `types.ts` ni en `useDatabaseStore`. El comportamiento externo observable exitoso es idéntico; solo cambia la garantía ante fallo (que hoy es destructiva).
- **Riesgo de regresión**: bajo. El modo `merge` no se toca y el camino de éxito de `replace` produce el mismo resultado final. La única diferencia observable es que una importación `replace` fallida ahora deja la base en su estado previo en lugar de vacía.
