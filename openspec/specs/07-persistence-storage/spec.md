# Capability: Local Persistence, Schema Validation & Backup Engine

## Purpose

Esta capacidad define la **capa de persistencia local** de `midi-laboratory` sobre IndexedDB, el almacenamiento duradero del navegador del renderer. No es una capa pasiva: impone un **contrato de integridad estricto** en el que ningún registro corrupto —nota MIDI fuera de rango físico, tiempo de respuesta negativo, fecha inparseable o campo obligatorio ausente— puede llegar a disco, y garantiza la **integridad referencial en cascada** entre sesiones y sus respuestas hijas dentro de una misma transacción atómica.

La capacidad también es la **capa de portabilidad** del sistema: un motor de backup/exportación serializa la totalidad de los cuatro almacenes a un payload JSON versionado, reimportable en los modos `merge` y `replace`. El store Zustand `useDatabaseStore` expone todo ello de forma reactiva a React, recargando el estado atómico tras cada mutación y purgando la memoria del store de IA (`useAiStore.resetAiMemory()`) cuando la base se vacía por completo.

| Frente     | Unidad canónica                                                                | Responsabilidad                                                               |
| ---------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Esquema    | `domain/database/databaseEngine.ts`                                            | Apertura, `onupgradeneeded` idempotente, versionado                           |
| Motor      | `domain/database/databaseEngine.ts`                                            | CRUD, cascada, resumen ponderado, backup/restore                              |
| Contrato   | `domain/database/types.ts`                                                     | Tipos de registro, `DatabaseSummary`, `DatabaseBackupPayload`, `ImportResult` |
| Validación | `domain/database/recordValidator.ts`                                           | Cuatro type guards puros previos a toda escritura                             |
| Estado     | `stores/useDatabaseStore.ts`                                                   | Estado reactivo, recarga atómica, puente con `useAiStore`                     |
| UI         | `components/views/DatabaseCard.tsx`, `components/trainer/StudioBottomDock.tsx` | Acciones de backup/import, KPIs de resumen, modal de reset                    |

**Alcance (in-scope):** nombre y versión canónica de la base, los cuatro _object stores_ con sus claves primarias e índices reales, el campo `targetMode` con retrocompatibilidad, las cuatro funciones de validación y sus reglas de rechazo, el rechazo atómico pre-persistencia, el borrado en cascada individual y por lotes, la limpieza total con reseteo del store de IA, el cálculo ponderado del resumen, la exportación/importación JSON en ambos modos con su validación de payload, y el store reactivo con su política de errores.

**Fuera de alcance (out-of-scope):** cómputo de métricas psicométricas (Módulo 05), inferencia de IA (Módulo 06), generación/evaluación de estímulos (Módulo 03) y captura MIDI de entrada (Módulo 01).

## Requirements

### Requirement: Esquema Canónico IndexedDB v6

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
- El campo canónico `targetMode` de `DbSessionRecord` MUST pertenecer a `'single_note' | 'intervals' | 'sequences' | 'repertoire'`. El soporte retrocompatible MUST ser automático (es opcional).

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

### Requirement: Ciclo de Vida y Guardia de Inicialización

Toda operación de persistencia MUST (DEBE) estar guardada por el estado de inicialización del motor.

- Cada método público del motor MUST empezar verificando si `this.db` está inicializado, lanzando `Error('Base de datos no inicializada.')` en caso contrario.
- `close()` MUST cerrar la conexión y anular la referencia interna.
- `useDatabaseStore.initialize()` MUST retornar inmediatamente si `isInitialized` ya es `true`.
- Si la apertura de IndexedDB falla, el store MUST capturar el error y registrarlo en `console.error` sin propagar la excepción a la UI.

#### Scenario: Métodos rechazan sin inicializar

- **GIVEN** un `DatabaseEngine` no inicializado
- **WHEN** se invocan sus métodos CRUD o de backup
- **THEN** todos rechazan con un mensaje que coincide con `/no inicializada/i`

#### Scenario: Doble inicialización no reinstancia

- **GIVEN** el store ya inicializado
- **WHEN** se vuelve a llamar a `initialize()`
- **THEN** el motor existente se conserva

### Requirement: Validación Pura de Registros de Sesión

Toda sesión MUST (DEBE) pasar el type guard puro `isValidSessionRecord` antes de cualquier persistencia.

- `id`, `createdAt`, `strategyId`, `instrumentId` y `presetName` MUST ser strings no vacíos. `createdAt` MUST ser parseable por `Date.parse`.
- `totalQuestions` MUST ser entero estrictamente positivo (`> 0`).
- `correctAnswers` MUST ser número con `0 <= correctAnswers <= totalQuestions`.
- `accuracyPercentage` MUST estar en el rango `[0, 100]`.
- `avgResponseTimeMs` y `durationSeconds` MUST ser números no negativos.
- `targetMode`, si está presente, MUST pertenecer a los cuatro modos canónicos.

#### Scenario: Sesión válida aceptada y corrupciones rechazadas

- **GIVEN** una sesión válida con `totalQuestions: 10`, `correctAnswers: 8`, `accuracyPercentage: 80`
- **WHEN** se evalúa `isValidSessionRecord`
- **THEN** devuelve `true`
- **WHEN** se evalúa con `totalQuestions: -5`, `correctAnswers: 15` o `accuracyPercentage: 120`
- **THEN** cada variante devuelve `false`

### Requirement: Validación Pura de Registros de Respuesta

Toda respuesta MUST (DEBE) pasar `isValidAnswerRecord`, que aplica las restricciones físicas del dominio MIDI y de la telemetría metacognitiva.

- `id` y `sessionId` MUST ser strings no vacíos.
- `questionIndex` MUST ser entero estrictamente positivo.
- `expectedNote` y `playedNote` MUST ser enteros en el rango MIDI físico `[0, 127]`.
- `isCorrect` MUST ser booleano estricto.
- `semitoneDistance` MUST ser entero.
- `responseTimeMs` MUST ser no negativo.
- `velocity` MUST estar en `[0, 127]`.
- `createdAt` MUST ser una fecha parseable.
- Campos opcionales: `inputSource` solo `'midi_hardware' | 'virtual_ui'`; `preAnswerListens` y `postErrorListens` enteros no negativos; `postErrorDwellTimeMs` número no negativo.

#### Scenario: Respuesta válida aceptada y corrupciones rechazadas

- **GIVEN** una respuesta válida con `expectedNote: 60`, `playedNote: 60`, `responseTimeMs: 900`
- **WHEN** se evalúa `isValidAnswerRecord`
- **THEN** devuelve `true`
- **WHEN** se evalúa con `expectedNote: -1`, `playedNote: 130` o `responseTimeMs: -100`
- **THEN** cada variante devuelve `false`

#### Scenario: Telemetría metacognitiva validada

- **GIVEN** una respuesta con `preAnswerListens: 2`, `postErrorDwellTimeMs: 2500`
- **WHEN** se evalúa `isValidAnswerRecord`
- **THEN** devuelve `true`
- **WHEN** se evalúa con `preAnswerListens: -1` o `postErrorDwellTimeMs: -500`
- **THEN** cada variante devuelve `false`

### Requirement: Validación Pura de Registros de IA

Los reportes y consultas de IA MUST (DEBE) pasar sus propios type guards antes de persistirse.

- `isValidAiReportRecord` MUST exigir `id`, `createdAt` (parseable), `modelName`, `modeFilter`, `analysisText` como strings no vacíos y `prescription` como objeto no nulo.
- `isValidAiConsultationRecord` MUST exigir `id`, `createdAt` (parseable), `modelName`, `modeFilter`, `userQuery` y `aiResponse` como strings no vacíos.

#### Scenario: Reporte de IA válido aceptado y degradado rechazado

- **GIVEN** un reporte con `prescription` objeto poblado
- **WHEN** se evalúa `isValidAiReportRecord`
- **THEN** devuelve `true`
- **WHEN** se evalúa con `prescription: null` o `id: ''`
- **THEN** cada variante devuelve `false`

### Requirement: Rechazo Atómico Pre-Persistencia

La validación MUST (DEBE) ocurrir antes de abrir cualquier transacción, de modo que un lote con una sola respuesta corrupta aborte la escritura entera de la sesión.

- `saveSession(session, answers)` MUST validar primero la sesión con `isValidSessionRecord`; si falla, MUST rechazar con `Error('Registro de sesión inválido o corrupto.')` sin abrir transacción.
- Luego MUST validar cada respuesta con `isValidAnswerRecord`; la primera inválida MUST rechazar con `Error('Registro de respuesta inválido o corrupto en el índice <i+1>.')`, abortando todo el lote.
- `saveAiReport` y `saveAiConsultation` MUST validar su registro único antes de escribir.

#### Scenario: Una respuesta corrupta aborta la sesión entera

- **GIVEN** una sesión válida y un lote con una respuesta corrupta (`expectedNote: -99`)
- **WHEN** se ejecuta `saveSession(session, [corruptAnswer])`
- **THEN** rechaza con un mensaje que coincide con `/inválido o corrupto/i`
- **AND** `getAllSessions()` devuelve un arreglo vacío

### Requirement: Borrado en Cascada de Respuestas Hijas

La eliminación de una sesión MUST (DEBE) borrar atómicamente todas sus respuestas hijas en `exercise_answers`.

- `deleteSession(sessionId)` MUST delegar en `deleteSessions([sessionId])` (patrón DRY).
- `deleteSessions(sessionIds)` con arreglo vacío MUST resolverse inmediatamente sin abrir transacción.
- El borrado masivo MUST ejecutarse en una única transacción `readwrite` sobre `sessions` y `exercise_answers`.
- Las respuestas hijas MUST localizarse mediante el índice `sessionId` de `exercise_answers` y eliminarse por su clave primaria.

#### Scenario: Borrado individual elimina sesión y respuestas hijas

- **GIVEN** una sesión `'session_to_delete'` con una respuesta hija asociada
- **WHEN** se ejecuta `deleteSession('session_to_delete')`
- **THEN** `getAllSessions()` y `getAllAnswers()` quedan vacíos

#### Scenario: Borrado por lotes elimina varias sesiones

- **GIVEN** dos sesiones `'s_batch_1'` y `'s_batch_2'` persistidas
- **WHEN** se ejecuta `deleteSessions(['s_batch_1', 's_batch_2'])`
- **THEN** `getAllSessions()` está vacío y `summary.totalSessions === 0`

### Requirement: Limpieza Completa y Reseteo del Store de IA

El vaciado total de la base MUST (DEBE) ser atómico sobre los cuatro stores y propagar el reseteo a la memoria volátil de IA.

- `clearDatabase` MUST abrir una única transacción `readwrite` sobre los cuatro stores y llamar `.clear()` en cada uno.
- Tras el vaciado físico, `useDatabaseStore.clearDatabase` MUST llevar `summary` a ceros y las cuatro colecciones a arreglos vacíos.
- Además, MUST invocar `useAiStore.getState().resetAiMemory()` para purgar los diagnósticos cacheados en memoria.

#### Scenario: clearDatabase vacía los cuatro stores

- **GIVEN** la base con sesiones, respuestas y reportes persistidos
- **WHEN** se ejecuta `clearDatabase`
- **THEN** todos los almacenes quedan vacíos

#### Scenario: clearDatabase del store purga la memoria de IA

- **GIVEN** el store con datos y `aiResponsesByMode` poblado
- **WHEN** se ejecuta `useDatabaseStore.getState().clearDatabase()`
- **THEN** `summary.totalSessions === 0` y `useAiStore.getState().aiResponsesByMode.single_note === null`

### Requirement: Resumen Ponderado por Volumen de Preguntas

`getSummary` MUST (DEBE) calcular un `DatabaseSummary` matemáticamente riguroso, usando medias ponderadas por `totalQuestions`.

- Con cero sesiones, MUST devolver el resumen canónico con los cinco campos en 0.
- `totalExercises` MUST ser `Σ totalQuestions` sobre todas las sesiones.
- `overallAccuracy` MUST ser `Math.round((Σ correctAnswers / Σ totalQuestions) * 100)`.
- `overallAvgTimeMs` MUST ser `Math.round(Σ(avgResponseTimeMs × totalQuestions) / Σ totalQuestions)`.
- `totalDurationSeconds` MUST ser `Σ (durationSeconds || 0)`.

#### Scenario: Promedio ponderado exacto por volumen

- **GIVEN** dos sesiones: `s1` con `totalQuestions: 10`, `correctAnswers: 10`, `avgResponseTimeMs: 1000`; y `s2` con `totalQuestions: 90`, `correctAnswers: 45`, `avgResponseTimeMs: 2000`
- **WHEN** se ejecuta `getSummary()`
- **THEN** `overallAccuracy === 55` y `overallAvgTimeMs === 1900`

### Requirement: Exportación Estructurada de Payload Versionado

La exportación MUST (DEBE) serializar la totalidad de los cuatro almacenes en un payload JSON tipado y auto-descriptivo.

- `exportDatabase` MUST devolver un `DatabaseBackupPayload` con: `version`, `exportedAt`, `summary` y los cuatro arreglos completos `sessions`, `answers`, `aiReports`, `aiConsultations`.
- El campo `version` del payload MUST reflejar la versión canónica de la base abierta, por tanto `6` tras la migración.
- `useDatabaseStore.exportBackupJson` MUST devolver `JSON.stringify(backup, null, 2)` y rechazar si el motor es nulo.

#### Scenario: Exportación contiene todos los datos

- **GIVEN** la base con una sesión y su respuesta persistidos
- **WHEN** se ejecuta `exportDatabase()`
- **THEN** `backup.sessions.length === 1`, `backup.answers.length === 1` y `backup.version === 6`

### Requirement: Importación con Modos merge y replace

La importación MUST (DEBE) soportar dos modos semánticamente distintos, con validación previa del payload.

- `importDatabase(backup, mode)` MUST aceptar `mode: 'merge' | 'replace'` (default `'merge'`).
- En modo `replace` MUST llamar a `clearDatabase()` antes de importar.
- En modo `merge` MUST realizarse con `put()`, de forma que los duplicados por clave primaria se sobrescriben y los nuevos se incorporan (idempotente).
- Los registros de los cuatro arrays MUST filtrarse con sus type guards respectivos antes de escribirse.
- En `tx.oncomplete` MUST resolver un `ImportResult` con `success: true` y los cuatro contadores de registros importados.

#### Scenario: Importación replace restaura un backup

- **GIVEN** un backup exportado con 1 sesión y 1 respuesta, y una base vacía
- **WHEN** se ejecuta `importDatabase(backup, 'replace')`
- **THEN** `result.success === true` y `result.sessionsImported === 1`

#### Scenario: Payloads corruptos rechazados

- **GIVEN** un backup nulo o un objeto vacío `{}`
- **WHEN** se ejecuta `importDatabase`
- **THEN** rechaza con error de formato o colecciones inválidas

### Requirement: Validación de Contenido Importado en la Capa del Store

`useDatabaseStore.importBackupJson` MUST (DEBE) aislar a la UI de cualquier JSON malformado, devolviendo siempre un `ImportResult` descriptivo.

- El método MUST parsear con `JSON.parse` y delegar en `engine.importDatabase`.
- Tras una importación exitosa MUST invocar `reloadAllData()`.
- Si `JSON.parse` o la importación fallan, MUST devolver `{ success: false, ... error: <mensaje> }` sin propagar la excepción.

#### Scenario: JSON malformado devuelve ImportResult de error

- **GIVEN** el string `'{ json_invalido_corrupto '`
- **WHEN** se ejecuta `importBackupJson(content)`
- **THEN** devuelve `{ success: false, sessionsImported: 0 }` con `error` definido

### Requirement: Exposición Reactiva y Recarga Atómica

El store MUST (DEBE) exponer a React todo el estado duradero de forma reactiva y recargarlo atómicamente tras cada mutación.

- El estado MUST exponer: `engine`, `summary`, `sessions`, `answers`, `aiReports`, `aiConsultations` e `isInitialized`.
- `reloadAllData` MUST obtener todas las colecciones y persistirlas en el estado en un único `set` atómico.
- Los métodos mutadores (`saveSession`, `deleteSession`, etc.) MUST invocar `reloadAllData` al finalizar.

#### Scenario: saveSession recarga resumen y colecciones

- **GIVEN** el store inicializado y vacío
- **WHEN** se ejecuta `saveSession(session, [])`
- **THEN** `summary.totalSessions === 1` y `sessions[0].id` es el de la sesión guardada

### Requirement: Resiliencia y Notificación de Errores

El store MUST (DEBE) degradarse con gracia ante fallos de cuota, disco o motor inaccesible.

- Los métodos CRUD MUST resolverse limpiamente como `undefined` si `engine` es `null`, sin lanzar excepciones.
- En cambio, `exportBackupJson` e `importBackupJson` DEBEN rechazar si el motor es nulo para que la UI distinga el fallo.

#### Scenario: CRUD con motor nulo no falla

- **GIVEN** el store con `engine: null`
- **WHEN** se invocan `saveSession`, `deleteSession` y `clearDatabase`
- **THEN** todos se resuelven como `undefined` sin lanzar

### Requirement: Componentes de UI de Persistencia

La interfaz MUST (DEBE) exponer las acciones de backup, import y reset, junto a los KPIs del resumen, en los dos puntos de entrada canónicos.

- `DatabaseCard` y `StudioBottomDock` MUST consumir exclusivamente `useDatabaseStore`.
- La exportación MUST descargar un Blob JSON con nombre canónico `midi-laboratory-backup-<YYYY-MM-DD>.json`.
- La importación MUST aceptar solo archivos `.json` e invocar `importBackupJson(content, 'merge')`.
- El botón de reset MUST delegar a la apertura de un modal de confirmación (`onOpenResetModal`), exigiendo confirmación explícita antes de borrar.

#### Scenario: Exportación descarga un archivo con nombre fechado

- **GIVEN** `DatabaseCard` con datos persistidos
- **WHEN** se pulsa `Exportar Backup`
- **THEN** se genera y descarga un Blob `midi-laboratory-backup-<fecha-del-dia>.json`

#### Scenario: Reset requiere confirmación

- **GIVEN** el botón `Resetear DB` visible
- **WHEN** se pulsa
- **THEN** se invoca `onOpenResetModal` y NO se ejecuta `clearDatabase` directamente
