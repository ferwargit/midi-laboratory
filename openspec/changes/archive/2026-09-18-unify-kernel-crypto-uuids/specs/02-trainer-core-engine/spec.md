## MODIFIED Requirements

### Requirement: Identidad de Sesión, Tokens y Protección Anti-Carrera

El kernel DEBE aislar sesiones consecutivas y descartar respuestas o avances desfasados.

- `startCoreSession` MUST generar un `sessionId` con el formato `` `session_${crypto.randomUUID()}` ``, donde el componente aleatorio es un UUIDv4 (RFC 4122) criptográficamente aleatorio.
- `generateQuestionToken(prefix = 'token')` MUST generar un token con el formato `` `${prefix}_${crypto.randomUUID()}` ``.
- La entropía de ambos identificadores MUST provenir exclusivamente de `crypto.randomUUID()`: NO MUST combinarse con `Date.now()` ni con `Math.random()`, y MUST ser única dentro de una misma ejecución del renderer con probabilidad despreciable de colisión.
- `recordAnswer` MUST exigir un `questionToken` no nulo; sin él, la respuesta se descarta.
- `stopCoreSession` y `resetCoreToConfig` MUST invalidar el token (`questionTokenRef = null`).
- `finalizeAndSaveSession` MUST ser reentrante: el guard `finalizingSessionsRef` MUST impedir doble persistencia de la misma sesión.

#### Scenario: Nota MIDI recibida con sesión inactiva descartada

- **GIVEN** un trainer de notas montado sin sesión iniciada
- **WHEN** llega una nota del usuario (`handleUserNotePlayed(60)`)
- **THEN** `lastResult === null` y `sessionHistory.length === 0`

#### Scenario: Cambio de modalidad aísla sesiones

- **GIVEN** un trainer de notas detenido y un trainer de intervalos recién iniciado
- **WHEN** llega una nota perteneciente al ejercicio viejo de notas
- **THEN** la sesión de notas permanece inactiva y la de intervalos activa, sin contaminación de historial

#### Scenario: Identificadores de sesión y token con entropía UUIDv4

- **GIVEN** un kernel en reposo
- **WHEN** se invoca `startCoreSession()` y `generateQuestionToken('token')`
- **THEN** `sessionId` cumple `^session_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` y `questionToken` cumple `^token_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`
- **AND** dos invocaciones consecutivas producen identificadores distintos
