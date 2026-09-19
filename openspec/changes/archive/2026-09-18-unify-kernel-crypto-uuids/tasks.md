## 1. Código del kernel

- [x] 1.1 En `src/renderer/src/hooks/useTrainerCore.ts:210`, reemplazar la generación del token en `generateQuestionToken` por `` `${prefix}_${crypto.randomUUID()}` `` y verificar con `npm run typecheck` que no hay errores de tipos (crypto es un global ya usado en los *plug-ins*).
- [x] 1.2 En `src/renderer/src/hooks/useTrainerCore.ts:314`, reemplazar la generación del `sessionId` en `startCoreSession` por `` `session_${crypto.randomUUID()}` `` y verificar con `npm run typecheck`.

## 2. Pruebas

- [x] 2.1 En `src/renderer/src/hooks/useTrainerCore.test.ts`, añadir un test que, tras `startCoreSession()` + `generateQuestionToken('token')`, afirme `sessionId` matchea `^session_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` y `questionToken` matchea `^token_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` (escenario "Identificadores de sesión y token con entropía UUIDv4").
- [x] 2.2 En el mismo test, afirmar que dos invocaciones consecutivas de `startCoreSession`/`generateQuestionToken` producen identificadores distintos (unicidad).
- [x] 2.3 Revisar `src/renderer/src/hooks/s1-session-snapshot.test.ts` y el resto de tests que mencionan `sessionId`/`questionToken`: confirmar que ninguno asume el formato `Date.now()`+base-36 ni un valor literal dependiente del reloj. De aparecer alguno, adaptarlo a regex/dinamismo.
- [x] 2.4 Ejecutar `npm run test` (vitest run) y verificar que la suite completa pasa, incluidos los tests nuevos.

## 3. Spec y validación

- [x] 3.1 Confirmar que el delta spec `openspec/changes/unify-kernel-crypto-uuids/specs/02-trainer-core-engine/spec.md` refleja `crypto.randomUUID()` y ya no contiene la fórmula `Date.now()` + base-36 en los dos *bullets* de formato.
- [x] 3.2 Ejecutar `openspec validate unify-kernel-crypto-uuids --strict` y verificar que pasa sin errores.

## 4. Verificación final

- [x] 4.1 Ejecutar `npm run typecheck` (typecheck:node + typecheck:web) y verificar resultado limpio.
- [x] 4.2 Ejecutar `npm run lint` y verificar resultado limpio.
- [x] 4.3 Ejecutar `npm run test` completo y verificar que no hay regresiones (suite verde).
