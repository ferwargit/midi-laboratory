# Capability: Local Persistence, Schema Validation & Backup Engine

## Propósito y Alcance

Esta capacidad define la **capa de persistencia local** de `midi-laboratory` sobre IndexedDB, el
almacenamiento duradero del navegador del renderer. No es una capa pasiva: impone un **contrato de
integridad estricto** en el que ningún registro corrupto —nota MIDI fuera de rango físico, tiempo de
respuesta negativo, fecha inparseable o campo obligatorio ausente— puede llegar a disco, y garantiza
la **integridad referencial en cascada** entre sesiones y sus respuestas hijas dentro de una misma
transacción atómica.

La capacidad también es la **capa de portabilidad** del sistema: un motor de backup/exportación
serializa la totalidad de los cuatro almacenes a un payload JSON versionado, reimportable en los
modos `merge` y `replace`. El store Zustand `useDatabaseStore` expone todo ello de forma reactiva a
React, recargando el estado atómico tras cada mutación y purgando la memoria del store de IA
(`useAiStore.resetAiMemory()`) cuando la base se vacía por completo.

| Frente | Unidad canónica | Responsabilidad |
| --- | --- | --- |
| Esquema | `domain/database/databaseEngine.ts` → `DB_NAME`, `DB_VERSION`, constantes de store | Apertura, `onupgradeneeded` idempotente, versionado |
| Motor | `domain/database/databaseEngine.ts` → `DatabaseEngine` | CRUD, cascada, resumen ponderado, backup/restore |
| Contrato | `domain/database/types.ts` | Tipos de registro, `DatabaseSummary`, `DatabaseBackupPayload`, `ImportResult` |
| Validación | `domain/database/recordValidator.ts` | Cuatro type guards puros previos a toda escritura |
| Estado | `stores/useDatabaseStore.ts` | Estado reactivo, recarga atómica, puente con `useAiStore` |
| UI | `components/views/DatabaseCard.tsx`, `components/trainer/StudioBottomDock.tsx` | Acciones de backup/import, KPIs de resumen, modal de reset |

**Alcance (in-scope):** nombre y versión canónica de la base, los cuatro _object stores_ con sus
claves primarias e índices reales, el campo `targetMode` con retrocompatibilidad, las cuatro
funciones de validación y sus reglas de rechazo, el rechazo atómico pre-persistencia, el borrado en
cascada individual y por lotes, la limpieza total con reseteo del store de IA, el cálculo ponderado
del resumen, la exportación/importación JSON en ambos modos con su validación de payload, y el store
reactivo con su política de errores.

**Fuera de alcance (out-of-scope):** el cómputo de métricas psicométricas derivadas (Módulo 05), la
inferencia de IA y sus prescripciones (Módulo 06), la generación/evaluación de estímulos (Módulo 03)
y la captura MIDI de entrada (Módulo 01). Esta capa persiste registros ya calculados por esos
módulos; no los interpreta.

> **Convención terminológica:** este documento usa términos RFC 2119. `MUST` (DEBE) y `MUST NOT`
> (NO DEBE) marcan requerimientos invariables del contrato. `SHOULD` (DEBERÍA) marca una práctica
> fuertemente recomendada con excepciones justificadas.

---

## Arquitectura de Base de Datos

### Requirement: Esquema Canónico IndexedDB v5

El sistema DEBE abrir exactamente una base de datos IndexedDB con nombre canónico
`MusicalEarTrainerDB` (`DB_NAME`) y versión canónica `5` (`DB_VERSION`).

- `DB_VERSION` MUST ser `5`, y `getVersion()` MUST devolver `db.version` tras la apertura, o `0`
  mientras la base no haya sido abierta.
- El motor DEBE crear exactamente cuatro _object stores_, con estas claves primarias (`keyPath`):
  - `sessions` (constante `SESSIONS_STORE`), `keyPath: 'id'`;
  - `exercise_answers` (constante `ANSWERS_STORE`), `keyPath: 'id'`;
  - `ai_diagnostics` (constante `AI_REPORTS_STORE`), `keyPath: 'id'`;
  - `ai_consultations` (constante `AI_CONSULTATIONS_STORE`), `keyPath: 'id'`.
- En el callback `onupgradeneeded` la creación DEBE ser idempotente: un store solo MUST crearse si
  `db.objectStoreNames` no lo contiene ya; y el índice `targetMode` solo MUST crearse si
  `indexNames` no lo contiene. Esto permite evolucionar versiones anteriores sin error.

> **Nota de precisión técnica:** los identificadores físicos de store son `exercise_answers`,
> `ai_diagnostics` y `ai_consultations` —no `answers`/`aiReports`/`aiConsultations` como aparecen en
> algunas descripciones—. Asimismo, los **ínicos índices creados por el esquema** son `targetMode`
> en `sessions`, y `sessionId` y `expectedNote` en `exercise_answers`. Los stores de IA **no crean
> índices**. El orden cronológico descendente por `createdAt` que consumen las vistas NO se obtiene
> de un índice: se aplica en JavaScript tras `getAll()` (`sessions`, `ai_diagnostics`,
> `ai_consultations`; `exercise_answers` se devuelve sin ordenar). La especificación se atiene al
> código y a su suite de tests (`databaseEngine.test.ts`, `s3-db-validation.test.ts`).

- El campo canónico `targetMode` de `DbSessionRecord` MUST pertenecer al conjunto
  `'single_note' | 'intervals' | 'sequences' | 'repertoire'` (`SessionTargetMode`).
- El soporte retrocompatible MUST ser automático: `targetMode` es **opcional** en el registro y en la
  validación; un registro histórico sin el campo DEBE seguir siendo válido y persistible, y son los
  clasificadores superiores (Módulos 04/05) quienes lo inferirán en lectura.

#### Scenario: Apertura con versión canónica y resumen vacío

- **GIVEN** un `DatabaseEngine` recién construido
- **WHEN** se ejecuta `initialize()`
- **THEN** `getVersion()` devuelve `5` y `getSummary()` devuelve un resumen con
  `totalSessions === 0`, `totalExercises === 0` y `totalDurationSeconds === 0`

#### Scenario: Versión 0 antes de abrir

- **GIVEN** un `DatabaseEngine` que nunca invocó `initialize()`
- **WHEN** se consulta `getVersion()`
- **THEN** devuelve `0`

#### Scenario: targetMode ausente en registro histórico

- **GIVEN** un `DbSessionRecord` válido sin el campo `targetMode`
- **WHEN** se ejecuta `saveSession(session, [])` y luego `getAllSessions()`
- **THEN** la sesión se persiste y recupera sin error (retrocompatibilidad)

---

### Requirement: Ciclo de Vida y Guardia de Inicialización

Toda operación de persistencia DEBE estar guardada por el estado de inicialización del motor.

- Cada método público del motor DEBE empezar por `if (!this.db) throw new Error('Base de datos no
  inicializada.')`. La lista completa MUST incluir: `saveSession`, `deleteSessions`,
  `saveAiReport`, `saveAiConsultation`, `getAllAiConsultations`, `getAllAiReports`,
  `getAllSessions`, `getAllAnswers`, `getSummary`, `exportDatabase`, `importDatabase` y
  `clearDatabase`.
- `close()` MUST cerrar la conexión y anular la referencia interna; llamadas posteriores a
  cualquier método MUST fallar con el error de no inicializada.
- El store `useDatabaseStore` DEBE inicializar el motor una sola vez: `initialize()` MUST retornar
  inmediatamente si `isInitialized` ya es `true`, sin volver a instanciar `DatabaseEngine`.
- Si la apertura de IndexedDB falla (p. ej. bloqueo de permiso del navegador), el store MUST
  capturar el error y registrarlo en `console.error('Error al inicializar IndexedDB:', err)`, sin
  propagar la excepción a la UI.

#### Scenario: Métodos rechazan sin inicializar

- **GIVEN** un `DatabaseEngine` no inicializado
- **WHEN** se invocan `saveSession`, `deleteSessions`, `saveAiReport`, `saveAiConsultation`,
  `getAllSessions`, `getAllAnswers`, `getSummary`, `exportDatabase`, `importDatabase` o
  `clearDatabase`
- **THEN** todos rechazan con un mensaje que coincide con `/no inicializada/i`

#### Scenario: Doble inicialización no reinstancia

- **GIVEN** el store ya inicializado (`isInitialized === true`)
- **WHEN** se vuelve a llamar a `initialize()`
- **THEN** `DatabaseEngine.prototype.initialize` no es invocado y el motor existente se conserva

#### Scenario: Fallo de apertura de IndexedDB se captura

- **GIVEN** un `DatabaseEngine.prototype.initialize` que rechaza con `IndexedDB blocked`
- **WHEN** el store ejecuta `initialize()`
- **THEN** la promesa se resuelve sin lanzar y se invoca `console.error` con ese mensaje

---

## Validación Estricta de Esquemas

### Requirement: Validación Pura de Registros de Sesión

Toda sesión DEBE pasar el type guard puro `isValidSessionRecord` antes de cualquier persistencia. La
función NO DEBE lanzar ni mutar; solo devuelve un booleano y afina el tipo.

- `id`, `createdAt`, `strategyId`, `instrumentId` y `presetName` MUST ser strings no vacíos (sin
  espacios solos). `createdAt` además DEBE ser parseable por `Date.parse` sin devolver `NaN`.
- `totalQuestions` MUST ser entero estrictamente positivo (`> 0`).
- `correctAnswers` MUST ser número con `0 <= correctAnswers <= totalQuestions` — un recuento
  mayor que el total de preguntas es un registro corrupto.
- `accuracyPercentage` MUST estar en el rango `[0, 100]`.
- `avgResponseTimeMs` y `durationSeconds` MUST ser números no negativos.
- `targetMode`, si está presente, MUST pertenecer a los cuatro modos canónicos; si es `undefined`
  el registro DEBE seguir siendo válido (retrocompatibilidad).

#### Scenario: Sesión válida aceptada y corrupciones rechazadas

- **GIVEN** una sesión válida con `totalQuestions: 10`, `correctAnswers: 8`,
  `accuracyPercentage: 80`
- **WHEN** se evalúa `isValidSessionRecord`
- **THEN** devuelve `true`
- **WHEN** se evalúa con `id: ''`, `strategyId: ''`, `instrumentId: ''`, `presetName: ''`,
  `totalQuestions: -5`, `totalQuestions: 3.5`, `correctAnswers: 15` (supera el total),
  `accuracyPercentage: 120`, `accuracyPercentage: -10`, `avgResponseTimeMs: -100`,
  `durationSeconds: -10` o `createdAt: 'fecha_invalida'`
- **THEN** cada variante devuelve `false`

---

### Requirement: Validación Pura de Registros de Respuesta

Toda respuesta DEBE pasar `isValidAnswerRecord`, que aplica las restricciones físicas del dominio
MIDI y de la telemetría metacognitiva.

- `id` y `sessionId` MUST ser strings no vacíos.
- `questionIndex` MUST ser entero estrictamente positivo.
- `expectedNote` y `playedNote` MUST ser enteros en el rango MIDI físico `[0, 127]`.
- `isCorrect` MUST ser booleano estricto (un string `'true'` DEBE rechazarse).
- `semitoneDistance` MUST ser entero (un valor fraccionario como `1.5` DEBE rechazarse).
- `responseTimeMs` MUST ser no negativo — un tiempo de respuesta negativo es physically impossible
  y síntoma de corrupción.
- `velocity` MUST estar en `[0, 127]`.
- `createdAt` MUST ser una fecha parseable.
- Los campos opcionales, si están presentes, DEBEN validarse: `inputSource` solo `'midi_hardware'`
  o `'virtual_ui'`; `preAnswerListens` y `postErrorListens` enteros no negativos;
  `postErrorDwellTimeMs` número no negativo.
- `reasonTelemetry` es un string libre (admite vacío) y NO DEBE validarse como obligatorio.

#### Scenario: Respuesta válida aceptada y corrupciones rechazadas

- **GIVEN** una respuesta válida con `expectedNote: 60`, `playedNote: 60`, `responseTimeMs: 900`,
  `velocity: 90`
- **WHEN** se evalúa `isValidAnswerRecord`
- **THEN** devuelve `true`
- **WHEN** se evalúa con `expectedNote: -1`, `playedNote: 130` (fuera de rango MIDI),
  `responseTimeMs: -100`, `velocity: 150`, `velocity: -5`, `isCorrect: 'true'`,
  `semitoneDistance: 1.5`, `questionIndex: -1`, `createdAt: 'fecha_invalida'` o
  `inputSource: 'invalido'`
- **THEN** cada variante devuelve `false`

#### Scenario: Telemetría metacognitiva validada

- **GIVEN** una respuesta con `preAnswerListens: 2`, `postErrorListens: 1`,
  `postErrorDwellTimeMs: 2500`
- **WHEN** se evalúa `isValidAnswerRecord`
- **THEN** devuelve `true`
- **WHEN** se evalúa con `preAnswerListens: -1`, `postErrorListens: -2` o
  `postErrorDwellTimeMs: -500`
- **THEN** cada variante devuelve `false`

---

### Requirement: Validación Pura de Registros de IA

Los reportes y consultas de IA DEBEN pasar sus propios type guards antes de persistirse, de forma
que un payload de IA degradado nunca contamine el almacén duradero.

- `isValidAiReportRecord` MUST exigir `id`, `createdAt` (parseable), `modelName`, `modeFilter` y
  `analysisText` como strings no vacíos, y `prescription` como objeto no nulo. La validez profunda
  de la prescripción interna es responsabilidad del Módulo 06; aquí solo se garantiza su existencia
  estructural.
- `isValidAiConsultationRecord` MUST exigir `id`, `createdAt` (parseable), `modelName`,
  `modeFilter`, `userQuery` y `aiResponse` como strings no vacíos. Los campos opcionales
  `topicConceptId` y `associatedMetricsSnapshot` NO DEBEN invalidar el registro si están ausentes.

#### Scenario: Reporte de IA válido aceptado y degradado rechazado

- **GIVEN** un reporte con `prescription` objeto poblado
- **WHEN** se evalúa `isValidAiReportRecord`
- **THEN** devuelve `true`
- **WHEN** se evalúa con `id: ''`, `modelName: ''`, `modeFilter: ''`, `analysisText: ''`,
  `prescription: null` o `createdAt: 'fecha_invalida'`
- **THEN** cada variante devuelve `false`

#### Scenario: Consulta del tutor válida aceptada y rechazada

- **GIVEN** una consulta con `userQuery` y `aiResponse` poblados
- **WHEN** se evalúa `isValidAiConsultationRecord`
- **THEN** devuelve `true`
- **WHEN** se evalúa con `id: ''`, `modelName: ''`, `modeFilter: ''`, `userQuery: ''`,
  `aiResponse: ''` o `createdAt: 'fecha_invalida'`
- **THEN** cada variante devuelve `false`

---

### Requirement: Rechazo Atómico Pre-Persistencia

La validación DEBE ocurrir **antes** de abrir cualquier transacción, de modo que un lote con una
sola respuesta corrupta aborte la escritura entera de la sesión.

- `saveSession(session, answers)` MUST validar primero la sesión con `isValidSessionRecord`; si
  falla, MUST rechazar con `Error('Registro de sesión inválido o corrupto.')` **sin abrir
  transacción**.
- Luego MUST iterar las respuestas validando cada una con `isValidAnswerRecord`; la primera
  inválida MUST rechazar con `Error('Registro de respuesta inválido o corrupto en el índice <i+1>.')`
  (basado en 1), abortando la persistencia de la sesión y del resto del lote.
- `saveAiReport` y `saveAiConsultation` MUST validar su registro único y rechazar con
  `'inválido o corrupto'` en caso contrario.
- Solo tras superar la validación, la escritura DEBE envolverse en una transacción `readwrite`
  sobre los stores implicados, resolviendo en `tx.oncomplete` y rechazando en `tx.onerror`.

#### Scenario: Una respuesta corrupta aborta la sesión entera

- **GIVEN** una sesión válida y un lote con una respuesta corrupta (`expectedNote: -99`,
  `responseTimeMs: -500`, `createdAt: 'invalid_date'`)
- **WHEN** se ejecuta `saveSession(session, [corruptAnswer])`
- **THEN** rechaza con un mensaje que coincide con `/inválido o corrupto/i`
- **AND** `getAllSessions()` devuelve un arreglo vacío — nada se persistió

#### Scenario: Cabecera de sesión corrupta rechazada

- **GIVEN** una sesión con `id: ''` y `totalQuestions: -5`
- **WHEN** se ejecuta `saveSession(session, [])`
- **THEN** rechaza con `/inválido/i`

---

## Integridad Referencial y Operaciones en Cascada

### Requirement: Borrado en Cascada de Respuestas Hijas

La eliminación de una sesión DEBE borrar atómicamente todas sus respuestas hijas, sin dejar
registros huérfanos en `exercise_answers`.

- `deleteSession(sessionId)` MUST delegar en `deleteSessions([sessionId])` — no DEBE implementar
  una segunda ruta de borrado (patrón DRY).
- `deleteSessions(sessionIds)` con un arreglo vacío MUST resolverse inmediatamente sin abrir
  transacción.
- El borrado masivo DEBE ejecutarse en una **única transacción** `readwrite` sobre `sessions` y
  `exercise_answers`, de forma que la eliminación de sesiones y de respuestas sea atómica: o se
  completa todo, o nada.
- Las sesiones MUST borrarse por clave directa (`sessionsStore.delete(id)` para cada id).
- Las respuestas hijas DEBE localizarse mediante un cursor sobre el índice `sessionId` de
  `exercise_answers` (`openKeyCursor`); para cada clave cuyo `sessionId` pertenezca al conjunto
  objetivo, MUST eliminarse por su clave primaria (`answersStore.delete(cursor.primaryKey)`).
- La operación NO DEBE escanear ni depender de los registros de IA: sus stores no participan en la
  transacción.

#### Scenario: Borrado individual elimina sesión y respuestas hijas

- **GIVEN** una sesión `'session_to_delete'` con una respuesta hija asociada
- **WHEN** se ejecuta `deleteSession('session_to_delete')`
- **THEN** `getAllSessions()` y `getAllAnswers()` están vacíos, y el resumen refleja
  `totalSessions === 0`

#### Scenario: Borrado por lotes elimina varias sesiones

- **GIVEN** dos sesiones `'s_batch_1'` y `'s_batch_2'` persistidas
- **WHEN** se ejecuta `deleteSessions(['s_batch_1', 's_batch_2'])`
- **THEN** `getAllSessions()` está vacío y `summary.totalSessions === 0`

#### Scenario: Arreglo vacío no falla

- **GIVEN** el motor inicializado
- **WHEN** se ejecuta `deleteSessions([])`
- **THEN** se resuelve sin error y sin alterar los datos existentes

---

### Requirement: Limpieza Completa y Reseteo del Store de IA

El vaciado total de la base DEBE ser atómico sobre los cuatro stores y DEBE propagar el reseteo a
la memoria volátil de IA.

- `clearDatabase` MUST abrir una única transacción `readwrite` sobre los cuatro stores y llamar
  `.clear()` en cada uno; solo MUST resolver en `tx.oncomplete`.
- Tras el vaciado físico, `useDatabaseStore.clearDatabase` DEBE llevar el estado reactivo a ceros:
  `summary` con todos sus contadores en `0` y las cuatro colecciones (`sessions`, `answers`,
  `aiReports`, `aiConsultations`) a arreglos vacíos.
- Además, DEBE invocar `useAiStore.getState().resetAiMemory()` para purgar los diagnósticos
  cacheados en memoria, de forma que la UI no muestre análisis huérfanos de una base ya vacía.
- Esta purga en cascada DEBE ser consistente: tras `clearDatabase`, `aiResponsesByMode.single_note`
  (y el resto de modalidades) MUST ser `null`.

#### Scenario: clearDatabase vacía los cuatro stores

- **GIVEN** la base con una sesión, sus respuestas y un reporte de IA persistidos
- **WHEN** se ejecuta `clearDatabase` a nivel de motor
- **THEN** `getAllSessions()`, `getAllAnswers()` y `getAllAiReports()` están vacíos

#### Scenario: clearDatabase del store purga la memoria de IA

- **GIVEN** el store con una sesión y una consulta de IA persistidas, y `aiResponsesByMode` poblado
- **WHEN** se ejecuta `useDatabaseStore.getState().clearDatabase()`
- **THEN** `summary.totalSessions === 0`, `sessions`, `aiReports` y `aiConsultations` son arreglos
  vacíos, y `useAiStore.getState().aiResponsesByMode.single_note === null`

---

## Agregación Ponderada de Resumen

### Requirement: Resumen Ponderado por Volumen de Preguntas

`getSummary` DEBE calcular un `DatabaseSummary` matemáticamente riguroso, usando medias ponderadas
por `totalQuestions` para no distorsionar el promedio global.

- Con cero sesiones, MUST devolver el resumen canónico con los cinco campos en `0`:
  `totalSessions`, `totalExercises`, `overallAccuracy`, `overallAvgTimeMs`, `totalDurationSeconds`.
- `totalExercises` MUST ser `Σ totalQuestions` sobre todas las sesiones.
- `overallAccuracy` MUST ser `Math.round((Σ correctAnswers / Σ totalQuestions) * 100)`, o `0` si no
  hay ejercicios. Esta es inherentemente una **media ponderada**: cada sesión aporta su volumen real
  de aciertos y preguntas.
- `overallAvgTimeMs` MUST ser `Math.round(Σ(avgResponseTimeMs × totalQuestions) / Σ totalQuestions)`,
  o `0` si no hay ejercicios. Esto evita que una sesión de 5 preguntas pese lo mismo que una de 100
  en el promedio de latencia.
- `totalDurationSeconds` MUST ser `Σ (durationSeconds || 0)`, tolerando sesiones sin duración.

#### Scenario: Promedio ponderado exacto por volumen

- **GIVEN** dos sesiones: `s1` con `totalQuestions: 10`, `correctAnswers: 10`,
  `avgResponseTimeMs: 1000`, `durationSeconds: 20`; y `s2` con `totalQuestions: 90`,
  `correctAnswers: 45`, `avgResponseTimeMs: 2000`, `durationSeconds: 180`
- **WHEN** se ejecuta `getSummary()`
- **THEN** `totalSessions === 2`, `totalExercises === 100`, `overallAccuracy === 55` (la media
  simple sería 75, incorrecta), `overallAvgTimeMs === 1900` (la media simple sería 1500,
  incorrecta) y `totalDurationSeconds === 200`

#### Scenario: Base vacía devuelve resumen cero

- **GIVEN** una base sin sesiones
- **WHEN** se ejecuta `getSummary()`
- **THEN** los cinco campos del resumen son `0`

---

## Motor de Backup y Restauración JSON

### Requirement: Exportación Estructurada de Payload Versionado

La exportación DEBE serializar la totalidad de los cuatro almacenes en un payload JSON tipado y
auto-descriptivo.

- `exportDatabase` MUST devolver un `DatabaseBackupPayload` con: `version` (la del motor abierto,
  vía `getVersion()`), `exportedAt` (`new Date().toISOString()`), `summary` (el `getSummary()`
  actual), y los cuatro arreglos completos `sessions`, `answers`, `aiReports`, `aiConsultations`
  tal cual los devuelven los `getAll*` (respetando su orden cronológico descendente).
- La exportación NO DEBE filtrar ni transformar registros: es una foto fiel del estado duradero.
- `useDatabaseStore.exportBackupJson` MUST devolver `JSON.stringify(backup, null, 2)` (JSON
  formateado con 2 espacios), y DEBE rechazar con `'Base de datos no inicializada.'` si el motor es
  nulo.

#### Scenario: Exportación contiene todos los datos

- **GIVEN** la base con una sesión y su respuesta persistidas
- **WHEN** se ejecuta `exportDatabase()`
- **THEN** `backup.sessions.length === 1`, `backup.answers.length === 1`, `backup.version === 5` y
  `exportedAt` es una fecha ISO válida

#### Scenario: Serialización JSON formateada

- **GIVEN** el store con datos
- **WHEN** se ejecuta `exportBackupJson()`
- **THEN** el resultado es un string que contiene el identificador de la sesión y es parseable

---

### Requirement: Importación con Modos merge y replace

La importación DEBE soportar dos modos semánticamente distintos, con validación previa del payload.

- `importDatabase(backup, mode)` MUST aceptar `mode: 'merge' | 'replace'` con valor por defecto
  `'merge'`.
- Antes de tocar la base, MUST validar la forma del payload: si `backup` no es objeto, MUST rechazar
  con `'Formato de archivo de respaldo inválido.'`; si `backup.sessions` o `backup.answers` no son
  arreglos, MUST rechazar con `'El respaldo no contiene colecciones válidas de sesiones o
  respuestas.'`.
- En modo `replace` MUST llamar a `clearDatabase()` **antes** de importar, purgando la base actual.
- En modo `merge` NO MUST purgar nada: la importación se realiza con `put()`, de forma que un
  registro cuya clave primaria ya existe **se sobrescribe** y los nuevos se incorporan — el merge es
  idempotente por clave.
- Los registros de los cuatro arrays DEBE filtrarse con sus type guards respectivos antes de
  escribirse: solo se persisten los válidos. Si una colección de IA (`aiReports`/`aiConsultations`)
  está ausente, MUST tratarse como vacía (coalescencia a `[]`), sin fallar.
- La escritura MUST ser una única transacción `readwrite` sobre los cuatro stores; en
  `tx.oncomplete` MUST resolver un `ImportResult` con `success: true` y los cuatro contadores
  `sessionsImported`, `answersImported`, `aiReportsImported`, `aiConsultationsImported` reflejando
  los registros válidos efectivamente escritos. En `tx.onerror` MUST rechazar con un mensaje
  descriptivo del error de transacción.

#### Scenario: Importación replace restaura un backup

- **GIVEN** un backup exportado con 1 sesión y 1 respuesta, y una base previamente vaciada
- **WHEN** se ejecuta `importDatabase(backup, 'replace')`
- **THEN** `result.success === true`, `result.sessionsImported === 1`, `result.answersImported === 1`
  y los datos quedan persistidos

#### Scenario: Payloads corruptos rechazados

- **GIVEN** un backup nulo y un objeto vacío `{}`
- **WHEN** se ejecuta `importDatabase(null)` y `importDatabase({})`
- **THEN** el primero rechaza con `/inválido/i` y el segundo con `/colecciones válidas/i`

#### Scenario: Registro de IA ausente no rompe la importación

- **GIVEN** un backup con `sessions` y `answers` válidos pero sin los campos `aiReports` ni
  `aiConsultations`
- **WHEN** se ejecuta `importDatabase(backup, 'merge')`
- **THEN** la importación procede exitosamente con `aiReportsImported: 0` y
  `aiConsultationsImported: 0`

---

### Requirement: Validación de Contenido Importado en la Capa del Store

`useDatabaseStore.importBackupJson` DEBE aislar a la UI de cualquier JSON malformado, devolviendo
siempre un `ImportResult` descriptivo.

- El método MUST recibir el contenido crudo como string, parsearlo con `JSON.parse` y delegar en
  `engine.importDatabase`.
- Tras una importación exitosa MUST invocar `reloadAllData()` para que el estado reactivo refleje
  los nuevos datos de forma atómica.
- Si `JSON.parse` o la importación fallan, NO MUST propagar la excepción: MUST capturarla y devolver
  `{ success: false, sessionsImported: 0, answersImported: 0, aiReportsImported: 0,
  aiConsultationsImported: 0, error: <mensaje> }`.
- Si el motor es nulo, MUST rechazar con `'Base de datos no inicializada.'` (no se traga el error,
  a diferencia de los CRUD).

#### Scenario: JSON malformado devuelve ImportResult de error

- **GIVEN** el string `'{ json_invalido_corrupto '`
- **WHEN** se ejecuta `importBackupJson(content)`
- **THEN** devuelve `{ success: false, sessionsImported: 0 }` con `error` definido, sin lanzar

#### Scenario: Importación exitosa recarga el estado reactivo

- **GIVEN** un backup válido y la base vacía
- **WHEN** se ejecuta `importBackupJson(jsonString, 'replace')`
- **THEN** `result.success === true` y `sessions.length === 1` en el estado reactivo tras la
  recarga atómica

---

## Estado Global Reactivo

### Requirement: Exposición Reactiva y Recarga Atómica

El store DEBE exponer a React todo el estado duradero de forma reactiva y recargarlo atómicamente
tras cada mutación.

- El estado MUST exponer: `engine` (`DatabaseEngine | null`), `summary` (`DatabaseSummary` con
  ceros iniciales), `sessions`, `answers`, `aiReports`, `aiConsultations` (arreglos vacíos
  iniciales) e `isInitialized` (`false` inicial).
- `reloadAllData` MUST obtener en secuencia `getSummary`, `getAllSessions`, `getAllAnswers`,
  `getAllAiReports` y `getAllAiConsultations`, y persistirlos en el estado en un **único `set`**
  atómico.
- Los métodos mutadores `saveSession`, `deleteSession`, `deleteSessions`, `saveAiReport` y
  `saveAiConsultation` DEBE, tras completar la operación del motor, llamar a `reloadAllData` para
  que el resumen y las colecciones queden sincronizados — ningún método MUST devolver datos
  parciales o desactualizados.
- `initialize` MUST, tras la apertura exitosa, ejecutar `reloadAllData` para hidratar el estado
  inicial desde disco.

#### Scenario: saveSession recarga resumen y colecciones

- **GIVEN** el store inicializado y vacío
- **WHEN** se ejecuta `saveSession(session, [])` con `durationSeconds: 45`
- **THEN** `summary.totalSessions === 1`, `summary.totalDurationSeconds === 45` y
  `sessions[0].id` es el de la sesión guardada

#### Scenario: deleteSession actualiza resumen

- **GIVEN** una sesión con respuestas persistidas
- **WHEN** se ejecuta `deleteSession(id)`
- **THEN** `sessions` y `answers` están vacíos y `summary.totalSessions === 0`

---

### Requirement: Resiliencia y Notificación de Errores

El store DEBE degradarse con gracia ante fallos de cuota, disco o motor inaccesible.

- Los métodos CRUD (`saveSession`, `deleteSession`, `deleteSessions`, `saveAiReport`,
  `saveAiConsultation`, `clearDatabase`, `reloadAllData`) NO DEBEN lanzar si `engine` es `null`:
  MUST resolverse limpiamente como `undefined`, de forma que un componente que los invozca nunca
  reciba una excepción no manejada.
- En cambio, `exportBackupJson` e `importBackupJson` DEBEN propagar el fallo (rechazando con
  `'Base de datos no inicializada.'`), pues el llamador UI necesita distinguir el error para
  notificarlo al usuario.
- Las fallas de cuota o de transacción de disco que lleguen al motor DEBEN surfaced a la UI por los
  callbacks de error: `saveSession` rechaza con el error del validador o de `tx.error`, y la UI lo
  muestra en el mensaje de estado.

#### Scenario: CRUD con motor nulo no falla

- **GIVEN** el store con `engine: null`
- **WHEN** se invocan `reloadAllData`, `saveSession`, `deleteSession`, `deleteSessions`,
  `saveAiReport`, `saveAiConsultation` y `clearDatabase`
- **THEN** todos se resuelven como `undefined` sin lanzar

#### Scenario: Backup con motor nulo notifica el error

- **GIVEN** el store con `engine: null`
- **WHEN** se invocan `exportBackupJson()` e `importBackupJson('{}')`
- **THEN** ambos rechazan con `'Base de datos no inicializada.'`

---

### Requirement: Componentes de UI de Persistencia

La interfaz DEBE exponer las acciones de backup, import y reset, junto a los KPIs del resumen, en
los dos puntos de entrada canónicos.

- `DatabaseCard` y `StudioBottomDock` DEBEN consumir exclusivamente `useDatabaseStore` (selectores
  `summary`, `exportBackupJson`, `importBackupJson`), sin acceder al motor directamente.
- La exportación MUST descargar un Blob JSON con nombre canónico
  `midi-laboratory-backup-<YYYY-MM-DD>.json` (fecha ISO truncada al día), usando `URL.createObjectURL`
  y revocándolo tras la descarga.
- La importación MUST aceptar solo archivos `.json` (atributo `accept`), leerlos con `FileReader`
  como texto, e invocar `importBackupJson(content, 'merge')`.
- El resultado de la importación DEBE mostrarse al usuario: un mensaje de éxito con los contadores
  (`sessionsImported`/`answersImported`), o un mensaje de fallo con `result.error` (o un texto por
  defecto como `'Archivo inválido'`/`'Archivo corrupto'`). Los mensajes de estado DEBEN
  auto-limpiarse tras unos segundos.
- `StudioBottomDock` DEBE colorear la precisión global con la escala umbral: `>= 80` esmeralda,
  `>= 50` ámbar, resto rosa, y mostrar el tiempo medio en segundos con 2 decimales.
- El botón de reset NO MUST ejecutar el borrado directamente: MUST delegar a la apertura de un modal
  de confirmación (`onOpenResetModal`), de forma que la acción destructiva requiera confirmación
  explícita.

#### Scenario: Exportación descarga un archivo con nombre fechado

- **GIVEN** `DatabaseCard` con datos persistidos
- **WHEN** se pulsa `Exportar Backup`
- **THEN** se genera un Blob `application/json` y se descarga como
  `midi-laboratory-backup-<fecha-del-dia>.json`, mostrándose el mensaje de éxito

#### Scenario: Importación exitosa notifica contadores

- **GIVEN** un archivo de backup válido seleccionado en el input `.json`
- **WHEN** se completa la lectura y la importación
- **THEN** la UI muestra `✅ Importadas N sesiones y M respuestas.` con los contadores reales, y el
  input se resetea

#### Scenario: Importación fallida notifica el error

- **GIVEN** un archivo JSON corrupto o con esquema incompatible
- **WHEN** se intenta importar
- **THEN** la UI muestra `❌ Fallo en importación: <error>` y ninguna excepción se propaga al
  renderizado

#### Scenario: Reset requiere confirmación

- **GIVEN** el botón `Resetear DB` / `Reset DB` visible
- **WHEN** se pulsa
- **THEN** se invoca `onOpenResetModal` y NO se ejecuta `clearDatabase` directamente; el borrado
  solo ocurre tras la confirmación del modal

