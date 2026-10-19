# Spec Delta — 07-persistence-storage

## MODIFIED Requirements

### Requirement: Exposición Reactiva y Recarga Atómica

El store MUST (DEBE) exponer a React todo el estado duradero de forma reactiva y mantenerlo consistente con IndexedDB tras cada mutación, actualizándolo de forma incremental en las escrituras.

- El estado MUST exponer: `engine`, `summary`, `sessions`, `answers`, `aiReports`, `aiConsultations` e `isInitialized`.
- `reloadAllData` MUST obtener todas las colecciones y persistirlas en el estado en un único `set` atómico.
- Los métodos mutadores (`saveSession`, `deleteSession`, `deleteSessions`, `saveAiReport`, `saveAiConsultation`) MUST actualizar el estado de forma incremental tras la persistencia exitosa, SIN invocar `reloadAllData` y SIN ejecutar lecturas completas de las tablas de IndexedDB.
- `reloadAllData` MUST invocarse únicamente desde `initialize` (inicialización de la app) y desde `importBackupJson` (restauración de respaldos). Ningún otro método del store MUST invocarlo.
- `clearDatabase` MUST continuar actualizando el estado directamente (resumen a ceros y colecciones vacías) sin recarga completa.

#### Scenario: saveSession recarga resumen y colecciones

- **GIVEN** el store inicializado y vacío
- **WHEN** se ejecuta `saveSession(session, [])`
- **THEN** `summary.totalSessions === 1` y `sessions[0].id` es el de la sesión guardada

#### Scenario: saveSession actualiza el estado sin recarga completa

- **GIVEN** el store inicializado y vacío
- **WHEN** se ejecuta `saveSession(session, [])`
- **THEN** NO se invocan `getSummary`, `getAllSessions`, `getAllAnswers`, `getAllAiReports` ni `getAllAiConsultations` del motor

#### Scenario: initialize realiza la recarga completa canónica

- **GIVEN** el store con `isInitialized: false`
- **WHEN** se ejecuta `initialize` con éxito
- **THEN** se invoca `reloadAllData` y el estado refleja el contenido completo de IndexedDB

#### Scenario: importBackupJson realiza la recarga completa canónica

- **GIVEN** el store inicializado
- **WHEN** se ejecuta `importBackupJson` con un payload válido
- **THEN** tras la importación se invoca `reloadAllData` y el estado refleja el contenido completo de IndexedDB

## ADDED Requirements

### Requirement: Upsert Incremental de Sesiones y Respuestas

Tras la persistencia exitosa de `saveSession(session, answers)`, el store MUST (DEBE) incorporar la sesión y sus respuestas a las colecciones en memoria con semántica upsert por `id`, sin re-leer IndexedDB.

- La sesión y cada respuesta MUST reemplazar cualquier entrada previa con el mismo `id` (sin duplicados).
- Tras el upsert, `sessions` MUST conservar el orden canónico por `createdAt` descendente.

#### Scenario: saveSession incorpora sesión y respuestas manteniendo el orden

- **GIVEN** el store con una sesión previa de `createdAt` más reciente
- **WHEN** se ejecuta `saveSession` con una sesión nueva de `createdAt` anterior
- **THEN** `sessions` contiene ambas con la más reciente en primer lugar y `answers` contiene las respuestas nuevas

#### Scenario: saveSession reemplaza una sesión existente

- **GIVEN** el store con una sesión de `id` conocido persistida
- **WHEN** se ejecuta `saveSession` con un registro del mismo `id` y datos actualizados
- **THEN** `sessions` contiene exactamente una entrada para ese `id` con los datos actualizados

### Requirement: Borrado Incremental en Memoria

Tras el borrado exitoso de `deleteSession(sessionId)` o `deleteSessions(sessionIds)`, el store MUST (DEBE) eliminar del estado en memoria las sesiones indicadas y todas sus respuestas hijas, sin re-leer IndexedDB.

- `sessions` MUST dejar de contener las sesiones cuyo `id` pertenezca al lote eliminado.
- `answers` MUST dejar de contener las respuestas cuyo `sessionId` pertenezca al lote eliminado.
- Las sesiones y respuestas no afectadas MUST permanecer intactas en memoria.

#### Scenario: deleteSessions filtra sesiones y respuestas hijas del estado

- **GIVEN** el store con dos sesiones y sus respuestas hijas en memoria
- **WHEN** se ejecuta `deleteSessions([idA])`
- **THEN** `sessions` ya no contiene `idA`, `answers` ya no contiene respuestas con `sessionId === idA`, y la sesión `idB` y sus respuestas permanecen

### Requirement: Recálculo del Resumen desde Memoria

Tras cada escritura o borrado incremental, el store MUST (DEBE) recalcular `summary` a partir del estado en memoria de sesiones, aplicando la misma matemática ponderada del resumen canónico.

- El `summary` recalculado MUST coincidir con el que produce la lectura completa del motor (`getSummary`) para el mismo conjunto de sesiones.
- El recálculo MUST ocurrir en la misma actualización de estado que la mutación de las colecciones.

#### Scenario: el summary incremental coincide con el canónico

- **GIVEN** el store con sesiones persistidas
- **WHEN** se ejecuta `saveSession` con una sesión nueva
- **THEN** el `summary` en memoria es idéntico al que devuelve `engine.getSummary()` tras la misma operación

### Requirement: Consistencia del Estado ante Fallo de Persistencia

La actualización incremental del estado MUST (DEBE) ocurrir únicamente después de que la persistencia en el motor haya resuelto con éxito.

- Si la persistencia rechaza, las colecciones en memoria y `summary` MUST permanecer sin alterar por esa operación.
- El rechazo MUST propagarse al llamador igual que en el comportamiento actual del store.

#### Scenario: fallo de persistencia no altera el estado en memoria

- **GIVEN** el store inicializado
- **WHEN** `saveSession` rechaza porque el motor falla la persistencia
- **THEN** las colecciones en memoria y `summary` permanecen sin cambios respecto a su valor previo
