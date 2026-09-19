## 1. Motor de persistencia (databaseEngine.ts)

- [x] 1.1 Incrementar `DB_VERSION` de `5` a `6` en `src/renderer/src/domain/database/databaseEngine.ts` y verificar que `getVersion()` devuelve `6` tras `initialize()`.
- [x] 1.2 Reescribir el bloque `onupgradeneeded` de `AI_REPORTS_STORE`: resolver la referencia del store (`createObjectStore` si no existe en `objectStoreNames`, `transaction.objectStore(...)` en caso contrario) y crear `createdAt` y `modeFilter` con `{ unique: false }` solo si no están en `store.indexNames`. Verificar con la prueba 2.3.
- [x] 1.3 Aplicar el mismo bloque idempotente a `AI_CONSULTATIONS_STORE` (`createdAt` y `modeFilter`). Verificar con la prueba 2.3.
- [x] 1.4 Confirmar que el bloque de `sessions`/`exercise_answers` y el resto del motor quedan intactos (sin cambios de comportamiento) revisando el diff.

## 2. Pruebas

- [x] 2.1 En `databaseEngine.test.ts`, actualizar `expect(DB_VERSION).toBe(5)` a `toBe(6)` y comprobar que la aserción `getVersion()` pasa.
- [x] 2.2 En `s3-db-validation.test.ts`, verificar que la aserción `getVersion() === DB_VERSION` siga pasando (usa la constante, no literal); añadir una aserción explícita `toBe(6)` para fijar la versión canónica.
- [x] 2.3 Añadir en `databaseEngine.test.ts` la prueba "debe crear los índices secundarios de IA en el esquema v6": tras `initialize()`, enumerar `indexNames` de `ai_diagnostics` y `ai_consultations` y afirmar que contienen `createdAt` y `modeFilter`. Verificar que la prueba falla sin el cambio 1.2/1.3 y pasa con él.
- [x] 2.4 Añadir la prueba "migra bases v5 existentes sin pérdida de datos": persistir reportes/consultas, reabrir con un motor v6 y comprobar que los registros se conservan y que la segunda apertura no lanza error por índices duplicados.
- [x] 2.5 Ejecutar `npm run test` (vitest) y verificar que la suite completa de base de datos pasa en verde.

## 3. Especificación (delta)

- [x] 3.1 Confirmar que `specs/07-persistence-storage/spec.md` del cambio declara `DB_VERSION = 6`, los cuatro índices de IA, la idempotencia y la migración no destructiva, junto al escenario de existencia física y al de migración.
- [x] 3.2 Confirmar que la aserción `backup.version === 6` del escenario de exportación queda recogida en el delta (requisito "Exportación Estructurada de Payload Versionado") y afirmada en la prueba de `exportDatabase` de `databaseEngine.test.ts`.
- [x] 3.3 Ejecutar `openspec validate indexeddb-v6-ai-indexes --strict` y resolver cualquier error o warning reportado.

## 4. Verificación final

- [x] 4.1 Ejecutar `npm run typecheck` (typecheck:node + typecheck:web) y verificar que no hay errores de tipos.
- [x] 4.2 Ejecutar `npm run lint` sobre los ficheros modificados y corregir cualquier hallazgo.
- [x] 4.3 Revisar el diff final: solo `databaseEngine.ts`, las dos suites de pruebas y los artefactos de `openspec/changes/indexeddb-v6-ai-indexes/` deben aparecer modificados.
