## Context

El kernel `useTrainerCore` genera dos identificadores críticos: el `sessionId` (en `startCoreSession`, src/renderer/src/hooks/useTrainerCore.ts:314) y los `questionToken` de anti-carrera (en `generateQuestionToken`, src/renderer/src/hooks/useTrainerCore.ts:210). Amb usan `` `${Date.now()}_${Math.random().toString(36).slice(2, 7)}` ``. Mientras tanto, los cuatro *plug-ins* de modalidad (`useSingleNoteTrainer.ts:358`, `useIntervalTrainer.ts:338`, `useSequenceTrainer.ts:289`, `useRepertoireTrainer.ts:655`) y `scoreParser.ts:236` ya generan sus ids con `crypto.randomUUID()`. Ver motivación completa en `proposal.md - Why`.

El cambio es de una sola expresión por identificador; no hay nuevos módulos, ni cambios en la máquina de estados, ni en los *guards* anti-carrera (`questionTokenRef`, `finalizingSessionsRef`, `isAdvancingRef`), que siguen siendo el mecanismo real de aislamiento.

## Goals / Non-Goals

**Goals:**

- Que `sessionId` y `questionToken` compartan la misma fuente de entropía que el resto de la app (UUIDv4 vía `crypto.randomUUID()`).
- Eliminar la dependencia de la resolución del reloj (`Date.now()` colisiona en llamadas dentro del mismo milisegundo; los tests de `useTrainerCore` encadenan `startCoreSession` + `generateQuestionToken` de forma síncrona, caso en el que la fórmula actual *sí* dependía íntegramiente de `Math.random()`).
- Confirmar (no asumir) compatibilidad de pruebas y de runtime.

**Non-Goals:**

- Unificar la generación de ids en un módulo/domain service compartido: sería una refactor mayor fuera de alcance. Se mantiene la generación *inline* en el kernel, igual que en los *plug-ins*.
- Cambiar `useMidi.ts:95` (ids efímeros de logs de UI).
- Migrar registros históricos persistidos: los `sessionId` antiguos (`session_<ts>_<base36>`) conviven; son cadenas opacas y los validadores no imponen formato.
- Alterar la longitud, prefijos (`session_`, `token_`) o semántica de los identificadores.

## Decisions

**D1 — `crypto.randomUUID()` nativo, sin librería ni *polyfill*/envoltorio.**
`crypto` es un global del renderer de Electron y de jsdom (vitest). Los *plug-ins* ya lo usan en rutas de producción; añadir una dependencia (`uuid`) o un *helper* propio contradiría la meta de estandarización y crearía una tercera fuente de identificadores.
*Alternativa descartada:* extraer un `generateId(prefix)` compartido en `domain/` — útil a largo plazo, pero requiere tocar 6 archivos y cruza la frontera kernel/*plug-ins*; fuera de alcance de un cambio de formato.

**D2 — Conservar los prefijos de *namespace* (`session_`, `${prefix}_`).**
Los prefijos hacen los ids reconocibles en logs, trazas y registros persistidos (ej. `session_`, `token_`, `ans_`, `ans_int_`, `ans_seq_`, `ans_rep_`). No aportan entropía; la unicidad la garantiza el UUID. El formato resultante es `<prefix>_<uuidv4>`, idéntico en espíritu al que ya usan los ids de respuesta.

**D3 — Probar disponibilidad de la API antes de codificar.**
`crypto.randomUUID()` requiere *secure context* en navegadores. Se verificó: (a) los *plug-ins* ya dependen de él en `handleUserNotePlayed` (ruta caliente de producción), y (b) en el entorno jsdom de vitest (jsdom ^29) se ejecutó una prueba *probe* efímera que confirmó `typeof crypto.randomUUID === 'function'` y salida conforme a RFC 4122 v4. Conclusión: no se introduce riesgo nuevo y no hace falta *mock* ni *polyfill* en tests.

**D4 — Tratamiento de las pruebas existentes.**
Inspección (`grep` sobre `*.test.ts`): ningún test aserte hoy el formato literal del `sessionId`/`questionToken`; `useTrainerCore.test.ts` y `s1-session-snapshot.test.ts` consumen `result.current.sessionId` dinámicamente. Por tanto el cambio es compatible por construcción. Se aprovechará para **añadir** aserciones explícitas de formato/unicidad (materializando el nuevo escenario del spec), en lugar de limitarse a que "siga pasando".

## Risks / Trade-offs

- **[Identificadores más largos]** `session_<uuid>` (42 chars) vs `session_<ts>_<base36>` (~24 chars). Impacto despreciable: se persisten en IndexedDB (campos de texto) y se retienen en memoria durante la sesión. → Sin mitigación necesaria.
- **[Secure context]** Si el renderer llegara a servirse en un contexto no seguro, `crypto.randomUUID` lanzaría `TypeError`. → Ya no es un riesgo nuevo: los *plug-ins* lo usan en producción desde antes de este cambio. Si en el futuro se detectara, el síntoma sería inmediato y localizable.
- **[Tests acoplados al reloj]** La fórmula actual mezclaba `Date.now()` en el identificador; algunos tests podrían (en teoría) comparar identificadores esperados. → Verificado: ninguno lo hace. Las aserciones nuevas usan patrones regex, no valores literales.
- **[Disparidad temporal con el spec]** Hasta aplicar el cambio, el spec canónico sigue describiendo la fórmula antigua. → El delta spec queda como fuente de verdad provisional; la aplicación (`/opsx-apply`) actualiza el spec canónico al archivar.

## Migration Plan

1. Aplicar las dos sustituciones en `useTrainerCore.ts`.
2. Añadir aserciones de formato en los tests.
3. Verificar: `npm run typecheck`, `npm run lint`, `npm run test`.
4. No se requiere migración de datos: los `sessionId` históricos son cadenas opacas para validadores, *stores* y analíticas (los *fixtures* de tests usan literales como `'s1'`, `'session_to_delete'`, que siguen siendo válidos).
5. **Rollback**: revertir las dos líneas y restaurar la fórmula `Date.now()`; sin estado que migrar ni versionado de datos implicado.

## Open Questions

Ninguna. La única incertidumbre material (disponibilidad de `crypto.randomUUID` en jsdom y Electron) se resolvió empíricamente durante la planificación (D3).
