# Tasks

## 1. Pruebas de ciclo de vida (TDD — Red primero)

- [x] 1.1 Ampliar `createMockMidiAccess()` en `src/renderer/src/hooks/useMidi.test.ts` con `addEventListener`/`removeEventListener` como `vi.fn()` que registran el handler `statechange` en una propiedad interna, manteniendo compatibilidad con los tests existentes que disparan `access.onstatechange?.()`. Verificar: la suite actual (`npx vitest run src/renderer/src/hooks/useMidi.test.ts`) sigue en verde tras el cambio de mock.
- [x] 1.2 Añadir test: al desmontar el hook, `removeEventListener('statechange', ...)` se invoca sobre el acceso MIDI con la misma referencia de handler registrada por `addEventListener` (desregistro simétrico). Verificar: el test falla contra la implementación actual (Red) y pasa tras 2.1 (Green).
- [x] 1.3 Añadir test: una transición de dispositivo (desconexión simulada vaciando puertos + disparo de `statechange` + reconexión) NO emite ninguna ráfaga de pánico en `mockOutput.send` (sin CC 120/123/64/121, sin Pitch Bend centrado, sin NoteOff masivo). Verificar: el test falla contra la implementación actual (Red) y pasa tras 2.2 (Green).
- [x] 1.4 Añadir test: el desmonte final del hook SÍ emite la secuencia canónica de pánico global sobre los canales activos `[1, 10]` en `mockOutput.send`. Verificar: el test pasa contra la implementación actual y se mantiene verde tras 2.1-2.2 (guarda de regresión del comportamiento de seguridad).

## 2. Implementación en useMidi.ts

- [x] 2.1 Migrar la suscripción `statechange` en el efecto de solicitud de acceso (`src/renderer/src/hooks/useMidi.ts:196-219`): definir handler nombrado `handleStateChange` dentro del efecto, registrar con `access.addEventListener('statechange', handleStateChange)` y desregistrar en el cleanup con `access.removeEventListener('statechange', handleStateChange)` sobre la misma referencia. Verificar: test 1.2 en Green y suite del hook en verde.
- [x] 2.2 Desacoplar el pánico de desmontaje (`src/renderer/src/hooks/useMidi.ts:221-225`): añadir `sendAllNotesOffRef` sincronizada en el efecto de refs existente (líneas 85-90) y reescribir el efecto de pánico con dependencias `[]` invocando `sendAllNotesOffRef.current()` en el cleanup. Verificar: tests 1.3 y 1.4 en Green y suite del hook en verde.

## 3. Verificación integral

- [x] 3.1 Ejecutar la suite completa `npm test` y confirmar 0 fallos (incluye los 16 tests existentes de `useMidi.test.ts` más los nuevos). Verificar: salida de Vitest sin tests fallidos ni errores no capturados.
- [x] 3.2 Ejecutar `npm run typecheck` y `npm run lint` y confirmar 0 errores. Verificar: ambos comandos terminan con código de salida 0.
- [x] 3.3 Ejecutar `npm run format` (Prettier) sobre los archivos modificados para cumplir la configuración de formato del proyecto. Verificar: `git diff` posterior no muestra re-formateos pendientes.

## 4. Remediación post-verificación (sugerencias del informe /opsx-verify)

- [x] 4.1 Cerrar la paridad literal del escenario "La transición de dispositivo no dispara ráfaga de pánico": test complementario en `useMidi.test.ts` que cambia `selectedOutputId` hacia un segundo puerto disponible y verifica que no hay ráfaga de pánico en ningún puerto, y que el desmonte final emite la secuencia canónica por el puerto vigente vía `sendAllNotesOffRef`. Verificar: `npx vitest run src/renderer/src/hooks/useMidi.test.ts` en verde (20/20).
- [x] 4.2 Alinear `design.md` (D2, Detalle de sincronización) con la implementación real: la sincronización de `sendAllNotesOffRef` reside en su propio `useEffect` dedicado tras la definición de `sendAllNotesOff`, por las reglas `react-hooks/immutability` y `preserve-manual-memoization` del linter de React Compiler. Verificar: lectura del artefacto; sin contradicción diseño-implementación.
- [x] 4.3 Corregir el conteo textual de la tarea 3.1: "los 14 tests existentes" → "los 16 tests existentes" (línea base real pre-fix). Verificar: lectura del artefacto.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied (`/opsx-archive`).
- Verify the archived result.
