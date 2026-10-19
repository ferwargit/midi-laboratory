# Tasks

## 1. Helper de resumen y tests de equivalencia (TDD)

- [x] 1.1 Escribir tests en `useDatabaseStore.test.ts` que fijen el contrato del helper puro de resumen: dado un array de `DbSessionRecord`, produce el mismo `DatabaseSummary` que `engine.getSummary()` para los mismos datos (casos: 0 sesiones, 1 sesión, múltiples sesiones con `durationSeconds` ausente). Verificar que fallan (Red) antes de implementar.
- [x] 1.2 Implementar `computeSummaryFromSessions(sessions: DbSessionRecord[]): DatabaseSummary` en `src/renderer/src/stores/useDatabaseStore.ts` replicando exactamente las fórmulas de `DatabaseEngine.getSummary` (medias ponderadas por `totalQuestions`, `Math.round`, `durationSeconds || 0`). Verificar con `npm test -- useDatabaseStore` en verde.

## 2. Escritura incremental de sesiones

- [x] 2.1 Escribir tests (Red) en `useDatabaseStore.test.ts` con espías sobre `DatabaseEngine.prototype` (`getSummary`, `getAllSessions`, `getAllAnswers`, `getAllAiReports`, `getAllAiConsultations`) que afirmen: tras `saveSession` exitoso, el estado en memoria contiene la sesión y sus respuestas (upsert por `id`, orden `createdAt` descendente en `sessions`), `summary` coincide con el valor canónico, y ninguno de los cinco métodos de lectura completa fue invocado. Incluir el caso de re-guardado del mismo `id` (reemplazo, sin duplicados).
- [x] 2.2 Modificar `saveSession` en `useDatabaseStore.ts`: tras `await engine.saveSession(...)`, actualizar `sessions` (upsert + sort por `createdAt` desc), `answers` (upsert por `id`) y `summary` (vía `computeSummaryFromSessions`) en un único `set`, sin invocar `reloadAllData`. Verificar los tests de 2.1 en verde y que los tests existentes de `saveSession` siguen pasando.

## 3. Borrado incremental

- [x] 3.1 Escribir tests (Red) que afirmen: tras `deleteSession` y `deleteSessions`, las sesiones y sus respuestas hijas desaparecen del estado en memoria, las demás sesiones/respuestas permanecen, `summary` se recalcula correctamente, y no se invocan los cinco métodos de lectura completa del motor.
- [x] 3.2 Modificar `deleteSession` y `deleteSessions` en `useDatabaseStore.ts`: tras el `await` del motor, filtrar `sessions` por `id` y `answers` por `sessionId` (usando un `Set` de ids eliminados) y recalcular `summary` en un único `set`, sin `reloadAllData`. Verificar tests de 3.1 y los existentes de borrado en verde.

## 4. Escritura incremental de registros de IA

- [x] 4.1 Escribir tests (Red) que afirmen: tras `saveAiReport` y `saveAiConsultation`, el registro aparece en su colección con upsert por `id` y orden `createdAt` descendente, `summary` no cambia, y no se invocan los cinco métodos de lectura completa del motor.
- [x] 4.2 Modificar `saveAiReport` y `saveAiConsultation` en `useDatabaseStore.ts`: tras el `await` del motor, upsert incremental de la colección correspondiente en un único `set`, sin `reloadAllData`. Verificar tests de 4.1 y los existentes de IA en verde.

## 5. Reserva de la recarga completa

- [x] 5.1 Escribir tests que afirmen que `initialize` (con `isInitialized: false`) y `importBackupJson` (payload válido) invocan `reloadAllData`/las lecturas completas del motor exactamente una vez, y que `clearDatabase` no las invoca. Verificar en verde (comportamiento actual ya correcto; los tests fijan el guardián de regresión).
- [x] 5.2 Verificar con `rg "reloadAllData" src/renderer/src/stores/useDatabaseStore.ts` que las únicas llamadas restantes están en `initialize` e `importBackupJson` (más su definición).
  > Nota de trazabilidad: `rg` no está disponible en este entorno; la verificación se realizó con `grep` estándar (herramienta Grep de OpenCode sobre PowerShell), con resultado equivalente: las únicas llamadas en código de producción están en `initialize` (línea 118) e `importBackupJson` (línea 220), además de su definición y declaración de interfaz.

## 6. Verificación integral

- [x] 6.1 Ejecutar la suite completa `npm test` con 0 fallos, incluyendo los tests existentes de `useDatabaseStore`, `useAnalyticsStore`, `useAiStore` y `s3-store-segmentation` (consumidores del estado de la base).
- [x] 6.2 Ejecutar `npm run typecheck` y `npm run lint` con 0 errores, y aplicar el formateador del proyecto sobre los archivos modificados.
