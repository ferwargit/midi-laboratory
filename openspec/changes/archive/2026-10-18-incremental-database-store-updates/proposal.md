# Proposal

## Why

La auditoría V8 (hallazgo F14.2) identificó que cada operación de escritura en `useDatabaseStore` (`saveSession`, `deleteSession`, `deleteSessions`, `saveAiReport`, `saveAiConsultation`) invoca `reloadAllData()`, que ejecuta 5 lecturas completas a IndexedDB (`getSummary`, `getAllSessions`, `getAllAnswers`, `getAllAiReports`, `getAllAiConsultations`) y reemplaza la totalidad del estado en memoria. Esto hace que el cierre de cada ejercicio sea O(n) respecto al tamaño histórico de la base de datos, degradando la latencia percibida justo en el momento crítico del flujo de entrenamiento (fin de sesión → vuelta al estudio).

## What Changes

- `saveSession`: tras persistir en `DatabaseEngine`, actualiza el estado de Zustand de forma incremental — incorpora (upsert) la sesión y sus respuestas a las listas en memoria manteniendo el orden canónico por `createdAt` descendente, y recalcula `summary` a partir del estado en memoria, sin re-leer las tablas de IndexedDB.
- `deleteSession` / `deleteSessions`: tras el borrado en cascada del motor, filtra los registros eliminados (sesiones y sus respuestas hijas) del estado en memoria y recalcula `summary`, sin re-leer IndexedDB.
- `saveAiReport` / `saveAiConsultation`: tras persistir, incorpora (upsert) el registro a su colección en memoria manteniendo el orden por `createdAt` descendente, sin re-leer IndexedDB.
- `reloadAllData()` se preserva sin cambios y queda reservado para su uso exclusivo y legítimo: la inicialización de la app (`initialize`) y la restauración/importación de respaldos (`importBackupJson`). `clearDatabase` ya actualiza el estado incrementalmente y no se modifica.
- Se extrae un helper puro de recálculo de `DatabaseSummary` a partir de la lista de sesiones en memoria (misma matemática ponderada que `getSummary`), reutilizable por las escrituras incrementales.
- Tests en `useDatabaseStore.test.ts` que verifiquen: persistencia + actualización incremental del estado sin lecturas completas de IndexedDB en escrituras, borrado limpio en memoria, y que `initialize` e `importBackupJson` continúan realizando la recarga completa canónica.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `07-persistence-storage`: el requisito "Exposición Reactiva y Recarga Atómica" cambia — los métodos mutadores ya NO invocan `reloadAllData` tras cada escritura; en su lugar actualizan el estado de forma incremental (upsert/filtrado + recálculo de `summary` desde memoria). `reloadAllData` queda reservado para `initialize` e `importBackupJson`. El resto de requisitos de la capacidad (esquema, validación, cascada, backup/import, resumen ponderado) no cambian.

## Impact

- **Código afectado**: `src/renderer/src/stores/useDatabaseStore.ts` (único archivo de producción modificado). Opcionalmente un helper puro nuevo en el mismo módulo o en `src/renderer/src/domain/database/` para el recálculo de `summary`.
- **Tests afectados**: `src/renderer/src/stores/useDatabaseStore.test.ts` — los tests existentes de escritura/borrado siguen pasando (el estado final observable es idéntico); se añaden tests de no-lectura-completa y de orden canónico.
- **Consumidores**: `DatabaseCard`, `StudioBottomDock`, `useAnalyticsStore` y demás consumidores del store no requieren cambios — el estado final tras cada mutación es equivalente al actual; solo cambia el camino para llegar a él (menos lecturas a IndexedDB).
- **Riesgos**: divergencia entre estado en memoria e IndexedDB si una escritura incremental no refleja exactamente lo persistido (mitigado: la actualización ocurre solo tras el `await` exitoso del motor); degradación del orden canónico de las listas (mitigado: upsert con re-ordenación por `createdAt` descendente, igual que `getAllSessions`/`getAllAiReports`).
- **Sin cambios de API pública**: las firmas de `DatabaseState` no cambian.
