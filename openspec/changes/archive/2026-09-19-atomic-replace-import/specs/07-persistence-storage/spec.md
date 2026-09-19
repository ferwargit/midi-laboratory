## MODIFIED Requirements

### Requirement: Importación con Modos merge y replace

La importación MUST (DEBE) soportar dos modos semánticamente distintos, con validación previa del payload.

- `importDatabase(backup, mode)` MUST aceptar `mode: 'merge' | 'replace'` (default `'merge'`).
- En modo `replace` MUST vaciar los cuatro object stores y persistir los registros del respaldo dentro de la **misma y única transacción `readwrite`** sobre los cuatro stores: primero `.clear()` sobre cada store y, a continuación, los `.put()` de los registros válidos. En modo `replace` MUST **no** committear el vaciado en una transacción separada previa a la inserción.
- Como consecuencia de la transacción única, si la importación en modo `replace` aborta (cuota excedida, error de disco, error de clonación o aborto explícito de la transacción), el vaciado MUST revertirse automáticamente y los datos preexistentes MUST conservarse íntegros (rollback atómico real, no parcial).
- En modo `merge` MUST realizarse con `put()`, de forma que los duplicados por clave primaria se sobrescriben y los nuevos se incorporan (idempotente).
- Los registros de los cuatro arrays MUST filtrarse con sus type guards respectivos antes de escribirse.
- En `tx.oncomplete` MUST resolver un `ImportResult` con `success: true` y los cuatro contadores de registros importados.
- En `tx.onerror` MUST rechazar la promesa informando el error de la transacción, sin dejar la base en un estado intermedio (parcialmente vaciada o parcialmente importada).

#### Scenario: Importación replace restaura un backup

- **GIVEN** un backup exportado con 1 sesión y 1 respuesta, y una base vacía
- **WHEN** se ejecuta `importDatabase(backup, 'replace')`
- **THEN** `result.success === true` y `result.sessionsImported === 1`

#### Scenario: Importación replace fallida preserva los datos previos

- **GIVEN** una base con sesiones, respuestas y reportes preexistentes, y un backup válido a importar en modo `replace` cuya transacción aborta durante la fase de inserción (p. ej. `QuotaExceededError`)
- **WHEN** se ejecuta `importDatabase(backup, 'replace')`
- **THEN** la promesa MUST ser rechazada
- **AND** las sesiones, respuestas y reportes preexistentes MUST seguir presentes íntegros (el vaciado se revirtió atómicamente)
- **AND** `getSummary()` MUST reflejar exactamente los totales previos a la importación fallida

#### Scenario: Payloads corruptos rechazados

- **GIVEN** un backup nulo o un objeto vacío `{}`
- **WHEN** se ejecuta `importDatabase`
- **THEN** rechaza con error de formato o colecciones inválidas
