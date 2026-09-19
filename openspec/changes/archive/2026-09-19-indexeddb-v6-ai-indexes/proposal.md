## Why

Los almacenes de IA (`ai_diagnostics` y `ai_consultations`) son los únicos _object stores_ de `MusicalEarTrainerDB` que hoy carecen de índices secundarios: toda lectura se realiza con `getAll()` seguido de un `sort()` en memoria sobre `createdAt` (ver `databaseEngine.ts:186` y `:204`). Esta estrategía de _full table scan_ más ordenamiento en memoria degrada de forma cuadrática conforme el usuario acumula históricos voluminosos de consultas y reportes de IA, y bloquea cualquier futura consulta filtrada por modo (`modeFilter`) sin volver a escanear la colección entera. Elevar el esquema a `DB_VERSION = 6` introduciendo índices secundarios sobre `createdAt` y `modeFilter` en ambos almacenes resuelve el cuello de botella de escalabilidad de lectura antes de que el volumen de datos lo haga crítico.

## What Changes

- **Incremento de versión canónica**: `DB_VERSION` pasa de `5` a `6` en `src/renderer/src/domain/database/databaseEngine.ts`.
- **Índices secundarios en `ai_diagnostics`** (`AI_REPORTS_STORE`): `createdAt` y `modeFilter`, ambos no únicos, creados de forma idempotente en `onupgradeneeded`.
- **Índices secundarios en `ai_consultations`** (`AI_CONSULTATIONS_STORE`): `createdAt` y `modeFilter`, ambos no únicos, creados de forma idempotente en `onupgradeneeded`.
- **Migración no destructiva**: las bases existentes (v5) migran a v6 conservando todos los registros; la creación de stores y índices ya existentes se omite comprobando `objectStoreNames` e `indexNames`.
- **Pruebas**: se actualizan las aserciones de `getVersion()`/`DB_VERSION` en `databaseEngine.test.ts` y `s3-db-validation.test.ts`, y se añaden pruebas unitarias que verifican la existencia física de los 4 índices nuevos.
- **Especificación canónica**: el requisito "Esquema Canónico IndexedDB" de `07-persistence-storage` se actualiza a v6, lista los índices de los almacenes de IA y retira la descripción que los presentaba sin índices.

No hay cambios **BREAKING** para el flujo de usuario: la migración es transparente y las APIs públicas del motor no alteran sus firmas. Los respaldos exportados (`DatabaseBackupPayload.version`) reflejarán simplemente `6` en lugar de `5`.

## Capabilities

### New Capabilities

<!-- Ninguna: no se introduce una capacidad nueva, solo se evoluciona el esquema de una capacidad existente. -->

### Modified Capabilities

- `07-persistence-storage`: el requisito "Esquema Canónico IndexedDB" sube su versión de `5` a `6` y amplía el contrato de `onupgradeneeded` para exigir la creación idempotente de los índices secundarios `createdAt` y `modeFilter` en `ai_diagnostics` y `ai_consultations`.

## Impact

- **Código fuente**: `src/renderer/src/domain/database/databaseEngine.ts` (constante `DB_VERSION` y bloque `onupgradeneeded`).
- **Pruebas**: `src/renderer/src/domain/database/databaseEngine.test.ts` y `src/renderer/src/domain/database/s3-db-validation.test.ts`.
- **Especificación**: `openspec/specs/07-persistence-storage/spec.md` (requisito de esquema canónico y su escenario de apertura).
- **Dependencias**: ninguna nueva; se usa la API estándar `IDBObjectStore.createIndex` ya empleada para `sessions` y `exercise_answers`.
- **Sistemas**: sin impacto en otros módulos; `06-local-ai-integration` y `05-analytics-psychometrics` consumen los mismos registros sin cambios de contrato. La importación de respaldos v5 sigue funcionando dado que los índices se reconstruyen en la apertura.
