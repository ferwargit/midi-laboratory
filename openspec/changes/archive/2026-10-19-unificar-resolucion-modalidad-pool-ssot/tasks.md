# Tasks

## 1. Módulo SSOT `sessionModality.ts` (TDD)

- [x] 1.1 Crear `src/renderer/src/domain/analytics/sessionModality.test.ts` con tests data-driven en rojo: (a) `it.each` sobre `EXERCISE_PRESETS`, `INTERVAL_PRESETS` y `SEQUENCE_PRESETS` afirmando que el pool de una sesión cuyo `presetName` es el nombre canónico del preset coincide con `notes.length` / `intervalSemitones.length` / `candidateNotes.length`; (b) modalidad desde `targetMode` canónico; (c) fallback legacy con prioridad repertorio → intervalos → secuencias → notas sueltas y `null` sin señales; (d) fallback heurístico del pool (`Intervalos (6 activos) • …` → 6, `Nivel 1 (C, D, E) • …` → 3); (e) pool empírico con piso 2 (4 notas únicas → 4, sin respuestas → 2); (f) matching canónico-primero de preset con sufijo `•` y fallback heurístico. Verificar con `npx vitest run src/renderer/src/domain/analytics/sessionModality.test.ts` que falla por falta de implementación.
- [x] 1.2 Implementar `sessionModality.ts` con `resolveSessionMode(session): SessionMode | null`, `resolveNominalPoolSize(session, answers?): number` y `matchesSessionPreset(session, targetPresetName): boolean` según las Decisiones 2–4 de design.md (segmento de contenido = `presetName.split('•')[0]`, comparación normalizada trim+lowercase, cadena canónico → heurístico → empírico con piso 2). Verificar que la suite de 1.1 pasa en verde.

## 2. Delegación en `sessionClassification.ts`

- [x] 2.1 Refactorizar `resolveNominalPoolSize` para delegar en `sessionModality.ts` manteniendo la firma nueva `(session, answers?)`, y reescribir los cuerpos de `isRepertoireSession`, `isSequenceSession`, `isIntervalSession` e `isSingleNoteSession` como `resolveSessionMode(s) === '…'` (Decisión 5). Verificar que ningún literal de heurística de pool/modalidad queda duplicado fuera del SSOT (búsqueda de `nivel\s*` y `activos|notas|tonos` en `src/renderer/src/domain/analytics` solo arroja `sessionModality.ts`).
- [x] 2.2 Migrar mecánicamente los call-sites de `resolveNominalPoolSize` en `sessionClassification.test.ts` a la nueva firma conservando los valores afirmados (helper local `makeAnswers(n)` para los casos empíricos). Verificar con `npx vitest run src/renderer/src/domain/analytics/sessionClassification.test.ts` en verde.

## 3. Consumidores: `sessionFilters.ts` y `longitudinal.ts`

- [x] 3.1 Refactorizar `filterSessionsAdvanced`: el bloque 4 (preset) delega en `matchesSessionPreset` y el bloque 6 (pool) invoca `resolveNominalPoolSize(s, answers)` eliminando el mapa `empiricalUniqueCountMap`. Verificar con `npx vitest run src/renderer/src/domain/analytics/sessionFilters.test.ts` en verde (los 4 casos del fix pool-size-filter-for-intervals-and-presets incluidos).
- [x] 3.2 Refactorizar `reconstructSessionConfig`: modalidad vía `resolveSessionMode` (repertorio/no clasificable → `single_note`) y notas de `single_note` vía la resolución canónica del SSOT, eliminando el mapeo local `pName.includes('nivel N')` → `EXERCISE_PRESETS` con arrays hardcodeados. Verificar con `npx vitest run src/renderer/src/domain/analytics/longitudinal.test.ts src/renderer/src/domain/analytics/longitudinal.mock.test.ts` en verde.

## 4. Barrel y orquestador `historyAnalytics.ts`

- [x] 4.1 Añadir `export * from './sessionModality'` al barrel y reemplazar las dos cadenas duplicadas de modalidad (`historyAnalytics.ts:113-121` y `:187-195`) por `resolveSessionMode(session) ?? 'single_note'`; migrar el call-site de `resolveNominalPoolSize(session, uniqueExpected.size)` a `resolveNominalPoolSize(session, sAnswers)`. Verificar con `npx vitest run src/renderer/src/domain/analytics/historyAnalytics.test.ts` en verde (incluye el test F-06/F-14 de dos dígitos y piso ≥ 2).

## 5. Verificación integral

- [x] 5.1 Ejecutar la suite completa `npm test` y confirmar 0 fallos (≈405+ tests, incluidos los nuevos data-driven).
- [x] 5.2 Ejecutar `npm run typecheck` y `npm run lint` y confirmar 0 errores, validando que ningún call-site de `resolveNominalPoolSize` quedó sin migrar.
- [x] 5.3 Ejecutar `openspec validate --strict` sobre el cambio y confirmar que los artefactos y el delta de specs son válidos.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
