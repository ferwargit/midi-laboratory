## 1. Suite defaultScore (music)

- [x] 1.1 Crear `src/renderer/src/domain/music/defaultScore.test.ts` importando `DEFAULT_PARTITURA_XML` desde `./defaultScore` y `parseMusicXml` desde `./scoreParser`; verificar que el archivo existe y `npm run typecheck` pasa.
- [x] 1.2 Afirmar que `DEFAULT_PARTITURA_XML` es un string de longitud > 0.
- [x] 1.3 Afirmar el contrato de `parseMusicXml(DEFAULT_PARTITURA_XML)`: `title === 'Partitura 1'`, `baseBpm === 86`, `timeSignature` 2/4, `totalMeasures === 8`, existencia de eventos (`events.length > 0`), al menos un evento acorde (`isChord`) y `harmonicProgression.length > 0`.
- [x] 1.4 Ejecutar `npx vitest run src/renderer/src/domain/music/defaultScore.test.ts --coverage` y verificar que `defaultScore.ts` alcanza 100% de líneas.

## 2. Suite sessionFilters (analytics)

- [x] 2.1 Crear `src/renderer/src/domain/analytics/sessionFilters.test.ts` importando `filterSessionsAdvanced` desde `./sessionFilters` y declarando fixtures literales `DbSessionRecord` con distintos `instrumentId`, `strategyId`, `presetName` y formatos; verificar que el archivo existe y `npm run typecheck` pasa.
- [x] 2.2 Probar filtro por instrumento específico (`instrumentId !== 'all'`) con caso match y no-match, y afirmar que el resultado respeta el filtro.
- [x] 2.3 Probar filtro por estrategia específica (`strategyId !== 'all'`) con caso match y no-match.
- [x] 2.4 Probar filtro por preset cubriendo los alias: `nivel 1`, `nivel 2`, `nivel 3`/`octava diatónica`, `nivel 4`/`cromático`, `pentatónica`, `personalizadas`/`notas (` y la coincidencia directa.
- [x] 2.5 Probar los sub-formatos de tiempo (`time_all`, `time_1`, `time_3`, `time_5`, `time_10`) y de preguntas (`questions_all`, `questions_5`, `questions_10`, `questions_20`) más `mastery`, construyendo fixtures cuyo `resolveSessionFormat` devuelva los `nominalMinutes`/`nominalQuestions` esperados.
- [x] 2.6 Probar el filtro por tamaño de pool (`poolSizeFilter` numérico vs `resolveNominalPoolSize`) con caso match y no-match.
- [x] 2.7 Probar la búsqueda por texto (`searchQuery`) coincidente por `presetName`, por `instrumentId`, por `strategyId`, un caso parcial, y el caso `trim().length === 0` (no-op).
- [x] 2.8 Ejecutar `npx vitest run src/renderer/src/domain/analytics/sessionFilters.test.ts --coverage` y verificar que las ramas de `sessionFilters.ts` alcanzan 95%+.

## 3. Suite longitudinal (analytics)

- [x] 3.1 Crear `src/renderer/src/domain/analytics/longitudinal.test.ts` importando `reconstructSessionConfig` y `computeLongitudinalComparisons` desde `./longitudinal`; verificar que el archivo existe y `npm run typecheck` pasa.
- [x] 3.2 Probar `reconstructSessionConfig` sobre sesión de intervalos: telemetría con `reasonTelemetry` que matchee `/(\d+)\s*st/i` produce `recommendedIntervals` deduplicado y ordenado, y el caso sin telemetría cae al fallback `[2, 4, 5, 7, 12]`.
- [x] 3.3 Probar `reconstructSessionConfig` sobre sesión de secuencias: telemetría `Secuencia: [...]` con ≥3 notas fija `recommendedNotes` y `sequenceLength`, y el caso sin match añade `a.expectedNote` al conjunto.
- [x] 3.4 Probar el fallback de notas seguras: respuestas repetidas/vacías (`uniqueNotes.length < 2`) producen `[60, 62, 64]`, y `>= 2` notas únicas producen esas notas ordenadas.
- [x] 3.5 Probar `computeLongitudinalComparisons` con un grupo de 3 sesiones (mismo `instrumentId` y `presetName` con separador `•`): la más antigua es `baselineSession`, la más reciente `latestSession`, y `totalAttempts` acumula los `totalQuestions` del grupo.
- [x] 3.6 Ejecutar `npx vitest run src/renderer/src/domain/analytics/longitudinal.test.ts --coverage` y verificar que las ramas de `longitudinal.ts` alcanzan 95%+.

## 4. Suite latencyStats (analytics)

- [x] 4.1 Crear `src/renderer/src/domain/analytics/latencyStats.test.ts` importando `computePerNoteLatencyStats` desde `./latencyStats`; verificar que el archivo existe y `npm run typecheck` pasa.
- [x] 4.2 Probar el conjunto donde ninguna respuesta es correcta: `fastestNote === null`, `slowestNote === null`, `avgLatencyMs === 0` y `fastReflexPercent === 0` en cada nota, y `fastestOctave === null`.
- [x] 4.3 Probar que respuestas con `expectedNote < 0` son ignoradas (no aparecen en `notes`).
- [x] 4.4 Probar la clasificación por octavas: octava 3 con etiqueta "Octava 3 (Grave...)", octava 4 con "Octava 4 (Central...)" y otra octava con "Octava N (Aguda)"; y `fastestOctave` apunta a la de menor `avgLatencyMs`.
- [x] 4.5 Probar el conteo de respuestas rápidas (`fastReflexPercent`) usando `COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS` como frontera.
- [x] 4.6 Ejecutar `npx vitest run src/renderer/src/domain/analytics/latencyStats.test.ts --coverage` y verificar que las ramas de `latencyStats.ts` alcanzan 95%+.

## 5. Verificación integral

- [x] 5.1 Ejecutar `npm run test` (vitest run, modo no-interactivo) y afirmar que toda la suite existe verde.
- [x] 5.2 Ejecutar `npx vitest run --coverage` y verificar que `defaultScore.ts`, `sessionFilters.ts`, `longitudinal.ts` y `latencyStats.ts` superan el 95% de ramas; documentar cualquier rama residual no cubierta con su justificación.
- [x] 5.3 Ejecutar `npm run typecheck` y `npm run lint` y afirmar que ambos pasan sin errores nuevos.

### Cobertura final medida (rama completa)

| Módulo                        | Ramas  | Líneas | Funciones |
| ----------------------------- | ------ | ------ | --------- |
| `music/defaultScore.ts`       | 100%   | 100%   | 100%      |
| `analytics/sessionFilters.ts` | 100%   | 100%   | 100%      |
| `analytics/longitudinal.ts`   | 98.82% | 100%   | 100%      |
| `analytics/latencyStats.ts`   | 97.22% | 100%   | 100%      |

Total del proyecto: 85.24% ramas / 95.99% líneas (desde 77.54% / 93.85%).

### Ramas residuales no cubiertas (justificación)

- `longitudinal.ts:69` — rama implícita (else) del `else if (targetMode === 'sequences')`.
  Inalcanzable: la variable `targetMode` solo puede tomar los valores
  `'single_note' | 'intervals' | 'sequences'`, por lo que la última condición
  del encadenado nunca se evalúa como falsa.
- `latencyStats.ts:70` — brazo `: 0` del ternario `stat.totalCount > 0 ? ... : 0`.
  Inalcanzable: toda nota presente en `noteMap` tiene `totalCount` incrementado
  al menos una vez, luego la condición siempre es verdadera.
- Ninguna de las dos es cubrible sin modificar código de producción (quitar
  ramas defensivas), lo cual está fuera del alcance de este cambio.
