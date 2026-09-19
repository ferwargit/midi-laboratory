## 1. Atomicidad de la importación replace

- [x] 1.1 En `src/renderer/src/domain/database/databaseEngine.ts`, eliminar la llamada `await this.clearDatabase()` de la rama `mode === 'replace'` de `importDatabase` (líneas 347-349). Verificar que `importDatabase` ya no invoca `clearDatabase()` en ningún modo.
- [x] 1.2 Dentro del executor del `Promise` de `importDatabase`, antes de los `.put()`, invocar `.clear()` en los cuatro object stores **solo cuando `mode === 'replace'`**, todo en la misma transacción `readwrite` existente sobre los cuatro stores y sin ningún `await` intermedio. Verificar que clear y put se programan síncronamente en el mismo executor.
- [x] 1.3 Confirmar que `clearDatabase()` público queda sin cambios (sigue abriendo su propia transacción sobre los cuatro stores) y que el modo `merge` y la validación pre-transacción no se alteran. Verificar con `npm run typecheck`.

## 2. Prueba de rollback atómico

- [x] 2.1 Añadir en `src/renderer/src/domain/database/databaseEngine.test.ts` un caso que siembre datos previos (1 sesión con respuestas, 1 reporte y/o 1 consulta de IA) mediante `saveSession`/`saveAiReport` y los confirme con `getAllSessions`/`getAllAnswers`/`getAllAiReports`.
- [x] 2.2 En el mismo caso, interceptar el handle interno `db` (cast a `{ db: IDBDatabase }`), envolver `db.transaction` para que la primera transacción `readwrite` que emita un `.put()` reciba `tx.abort()` vía `queueMicrotask`, simulando un `QuotaExceededError` durante la fase de inserción.
- [x] 2.3 Afirmar que `importDatabase(backup, 'replace')` es rechazada, y que tras el rechazo las sesiones, respuestas y reportes previos siguen presentes íntegros y `getSummary()` refleja los totales previos. Verificar que la prueba falla contra el código pre-fix (regression guard) y pasa tras la corrección.
- [x] 2.4 Ejecutar el suite de persistencia completo y verificar que los casos existentes (incluido el de importación `replace` exitosa) siguen en verde: `npm run test`.

## 3. Calidad y especificación

- [x] 3.1 Ejecutar `npm run lint` y `npm run typecheck` y verificar que ambos pasan sin errores nuevos.
- [x] 3.2 Verificar que el delta spec `openspec/changes/atomic-replace-import/specs/07-persistence-storage/spec.md` refleja la transacción única y el escenario de rollback, y que `openspec validate atomic-replace-import --strict` pasa.
