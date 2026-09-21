## MODIFIED Requirements

### Requirement: Esquema Canónico IndexedDB v5

El sistema MUST (DEBE) abrir exactamente una base de datos IndexedDB con nombre canónico `MusicalEarTrainerDB` (`DB_NAME`) y versión canónica `6` (`DB_VERSION`).

- `DB_VERSION` MUST ser `6`, y `getVersion()` MUST devolver `db.version` tras la apertura, o `0` mientras la base no haya sido abierta.
- El motor MUST crear exactamente cuatro _object stores_ con estas claves primarias (`keyPath`):
  - `sessions` (`SESSIONS_STORE`), `keyPath: 'id'`;
  - `exercise_answers` (`ANSWERS_STORE`), `keyPath: 'id'`;
  - `ai_diagnostics` (`AI_REPORTS_STORE`), `keyPath: 'id'`;
  - `ai_consultations` (`AI_CONSULTATIONS_STORE`), `keyPath: 'id'`.
- En `onupgradeneeded` la creación de stores MUST ser idempotente: un store solo se crea si `db.objectStoreNames` no lo contiene; el índice `targetMode` en `sessions` y los índices `sessionId` y `expectedNote` en `exercise_answers` solo se crean si no existen.
- Los almacenes de IA MUST disponer cada uno de dos índices secundarios no únicos: `createdAt` y `modeFilter` sobre `ai_diagnostics` (`AI_REPORTS_STORE`), y `createdAt` y `modeFilter` sobre `ai_consultations` (`AI_CONSULTATIONS_STORE`). Estos cuatro índices MUST crearse en `onupgradeneeded` solo si no existen ya en el `indexNames` del store correspondiente.
- La transición de la versión `5` a la `6` MUST ser una migración no destructiva: los registros preexistentes MUST conservarse íntegros y la apertura repetida de una base ya migrada MUST ser idempotente, sin errores por índices duplicados.

#### Scenario: Apertura con versión canónica y resumen vacío

- **GIVEN** un `DatabaseEngine` recién construido
- **WHEN** se ejecuta `initialize()`
- **THEN** `getVersion()` devuelve `6` y `getSummary()` devuelve un resumen con `totalSessions === 0`

#### Scenario: Versión 0 antes de abrir

- **GIVEN** un `DatabaseEngine` que nunca invocó `initialize()`
- **WHEN** se consulta `getVersion()`
- **THEN** devuelve `0`

#### Scenario: targetMode ausente en registro histórico

- **GIVEN** un `DbSessionRecord` válido sin el campo `targetMode`
- **WHEN** se ejecuta `saveSession(session, [])` y luego `getAllSessions()`
- **THEN** la sesión se persiste y recupera sin error

#### Scenario: Índices secundarios de IA creados físicamente

- **GIVEN** un `DatabaseEngine` recién construido
- **WHEN** se ejecuta `initialize()`
- **THEN** el store `ai_diagnostics` contiene los índices `createdAt` y `modeFilter`
- **AND** el store `ai_consultations` contiene los índices `createdAt` y `modeFilter`

#### Scenario: Migración no destructiva desde la versión 5

- **GIVEN** una base de datos abierta en versión `5` con reportes y consultas de IA persistidos
- **WHEN** se reabre con un motor que declara `DB_VERSION = 6`
- **THEN** `getVersion()` devuelve `6`
- **AND** `getAllAiReports()` y `getAllAiConsultations()` devuelven los registros previos sin pérdida
- **AND** reabrir de nuevo no lanza error por índices ya existentes

### Requirement: Exportación Estructurada de Payload Versionado

La exportación MUST (DEBE) serializar la totalidad de los cuatro almacenes en un payload JSON tipado y auto-descriptivo.

- `exportDatabase` MUST devolver un `DatabaseBackupPayload` con: `version`, `exportedAt`, `summary` y los cuatro arreglos completos `sessions`, `answers`, `aiReports`, `aiConsultations`.
- El campo `version` del payload MUST reflejar la versión canónica de la base abierta, por tanto `6` tras la migración.
- `useDatabaseStore.exportBackupJson` MUST devolver `JSON.stringify(backup, null, 2)` y rechazar si el motor es nulo.

#### Scenario: Exportación contiene todos los datos

- **GIVEN** la base con una sesión y su respuesta persistidos
- **WHEN** se ejecuta `exportDatabase()`
- **THEN** `backup.sessions.length === 1`, `backup.answers.length === 1` y `backup.version === 6`

## RENAMED Requirements

### Requirement: Esquema Canónico IndexedDB v5

**FROM:** Esquema Canónico IndexedDB v5

**TO:** Esquema Canónico IndexedDB v6
