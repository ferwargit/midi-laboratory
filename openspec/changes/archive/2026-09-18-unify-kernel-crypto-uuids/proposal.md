## Why

El micro-kernel (`useTrainerCore`) todavía genera sus identificadores —`sessionId` y los `questionToken` de anti-carrera— con la fórmula histórica `` `${Date.now()}_${Math.random().toString(36).slice(2, 7)}` ``, mientras que **el resto de la aplicación ya estandarizó en `crypto.randomUUID()`**: los cuatro _plug-ins_ de modalidad (`useSingleNoteTrainer`, `useIntervalTrainer`, `useSequenceTrainer`, `useRepertoireTrainer`) y `scoreParser` generan sus ids con UUIDv4. Esta dualidad es inconsistente y mantiene una fuente de identificadores con entropía débil (~36⁵ ≈ 60 millones de combinaciones dependientes de la resolución del reloj), teóricamente colisionable en generaciones dentro del mismo milisegundo y predecible/ordenable por marca temporal. Estandarizar el kernel en `crypto.randomUUID()` (122 bits de aleatoriedad criptográfica, RFC 4122 v4) elimina la clase entera de colisiones teóricas, quita la dependencia de la granularidad del reloj y unifica la política de identidad de toda la app.

## What Changes

- `generateQuestionToken(prefix = 'token')` (src/renderer/src/hooks/useTrainerCore.ts:210) pasa a generar `` `${prefix}_${crypto.randomUUID()}` ``.
- `startCoreSession` (src/renderer/src/hooks/useTrainerCore.ts:314) pasa a generar `` `session_${crypto.randomUUID()}` ``.
- Se elimina del spec canónico la nota de precisión técnica que fijaba la fórmula `Date.now() + base-36` como parte _del contrato_; el formato exigido pasa a ser el prefijo namespace + UUIDv4.
- Se revisan las pruebas que tocan estos identificadores (`useTrainerCore.test.ts`, `s1-session-snapshot.test.ts`) para confirmar compatibilidad y, donde aporte valor, afirmar explícitamente el nuevo formato.

No hay cambios en la política de invalidación de tokens, en los _guards_ anti-carrera (`finalizingSessionsRef`, `questionTokenRef`) ni en la longitud/semántica de los prefijos (`session_`, `token_`…): la superficie observable se limita a la entropia y el formato del identificador.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `02-trainer-core-engine`: el requisito **Identidad de Sesión, Tokens y Protección Anti-Carrera** cambia su exigencia de formato de identificadores: `sessionId` y `questionToken` DEBEN generarse con `crypto.randomUUID()` en lugar de la fórmula `Date.now()` + `Math.random().toString(36)`.

## Impact

- **Código**: `src/renderer/src/hooks/useTrainerCore.ts` (2 líneas de generación de identificadores). No se tocan los _plug-ins_ de modalidad (ya usan `crypto.randomUUID()`).
- **Persistencia / telemetría**: los `DbSessionRecord.sessionId` y `DbAnswerRecord.sessionId` persistidos pasan a ser `session_<uuidv4>`; los registros históricos existentes (formato `session_<ts>_<base36>`) conviven sin problema, pues solo se usan como cadena opaca de identidad, y los validadores (`recordValidator`) no imponen el formato heredado.
- **Tests**: `src/renderer/src/hooks/useTrainerCore.test.ts` y `src/renderer/src/hooks/s1-session-snapshot.test.ts` hoy consumen `result.current.sessionId` dinámicamente y no aserten el formato literal (verificado), por lo que son compatibles; se añadirán aserciones explícitas de formato. Entorno jsdom de vitest verificado: soporta `crypto.randomUUID()` nativamente.
- **Runtime**: `crypto.randomUUID()` requiere _secure context_; el renderer de Electron (file:///localhost) ya lo es y la app ya depende de esta API en rutas de producción (los _plug-ins_ la usan en `handleUserNotePlayed`), por lo que no se introduce riesgo nuevo.
- **Dependencias**: ninguna nueva; `crypto` es una API global del navegador/Electron.
- **No-objetivo**: `useMidi.ts:95` (`id: Date.now() + Math.random()` para logs) queda fuera de alcance; es infraestructura de UI efímera, no identidad de sesión.
