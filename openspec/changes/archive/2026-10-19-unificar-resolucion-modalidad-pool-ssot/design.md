# Design

## Context

Ver `proposal.md` (Why) y el delta de specs para los requisitos. Estado actual observado:

- **Tres copias de la heurística** (F21): `sessionClassification.ts:60-105` (`resolveNominalPoolSize`), `sessionFilters.ts:99-130` (matriz `isLevel1/2/3/4/isPentatonic/isCustom/isDirectMatch`) y `longitudinal.ts:28-60` (mapeo `pName.includes('nivel N')` → `EXERCISE_PRESETS` con arrays de fallback hardcodeados). Adicionalmente, la cadena de resolución de modalidad (`targetMode || isInterval → isSequence → isRepertoire → single_note`) está duplicada en `historyAnalytics.ts:113-121` y `historyAnalytics.ts:187-195`, y variante en `longitudinal.ts:13-20`.
- **Fuentes canónicas de presets**: `domain/music/presets.ts` (`EXERCISE_PRESETS`, 6 presets con `notes[]`), `domain/music/intervals.ts` (`INTERVAL_PRESETS`, 5 presets con `intervalSemitones[]`), `domain/music/sequences.ts` (`SEQUENCE_PRESETS`, 5 presets con `candidateNotes[]` + `length`). Ninguna de las tres importa de analítica (sin ciclo de imports).
- **Composición de `presetName`** (observada en los entrenadores): notas sueltas `${resolveNotePresetName(notes)} • ${formatTag}` (nombre canónico + sufijo); intervalos `Intervalos (N activos) • tag` (etiqueta genérica con conteo, **no** el nombre del preset); secuencias `Secuencias (N notas) • tag`; repertorio `${title} (${hand}) • C.x-C.y`.
- **Consumidores de `resolveNominalPoolSize`**: `sessionFilters.ts:165` y `historyAnalytics.ts:93`; firma actual `(session, empiricalUniqueCount: number)`.
- **API pública**: el barrel `historyAnalytics.ts` re-exporta `sessionClassification` completo (OLA 4.3, Decisión 1: ~35 sitios consumidores no deben cambiar imports).
- Todos los entrenadores actuales persisten `targetMode` canónico; los registros sin él son exclusivamente históricos.

## Goals / Non-Goals

**Goals:**

- Un único módulo SSOT (`sessionModality.ts`) dueño de: resolución de modalidad, resolución de pool nominal y matching de preset para filtros.
- Pool anclado a los tres catálogos canónicos de presets; heurísticas de strings relegadas a fallback defensivo para registros heredados.
- Refactor de los 3 consumidores + las 2 cadenas de `historyAnalytics.ts` sin cambiar la superficie pública del barrel.
- Suite data-driven que verifique el pool contra la cantidad real de notas/elementos de cada preset de los tres catálogos.

**Non-Goals:**

- No cambiar la composición de `presetName` en los entrenadores (los labels genéricos `Intervalos (N activos)` / `Secuencias (N notas)` siguen igual).
- No migrar ni transformar datos históricos en IndexedDB.
- No tocar persistencia (Módulo 02), estrategias adaptativas (Módulo 04) ni IA local (Módulo 06).
- No rediseñar `AnalyticsFilterOptions` ni la UI de la barra de filtros.

## Decisions

### Decisión 1: Módulo nuevo `sessionModality.ts` en `domain/analytics/`, no dentro de `sessionClassification.ts`

**Qué**: el SSOT vive en un archivo propio que importa de `../music/presets`, `../music/intervals`, `../music/sequences` y `../database/types`. `sessionClassification.ts` conserva sus exports actuales pero delega internamente.

**Por qué**: `sessionClassification.ts` ya mezcla 5 responsabilidades (formato, pool, ISI, input, sesgo, modalidad); extraer evita que el archivo siga creciendo y hace explícita la dependencia hacia los catálogos de música. Alternativa descartada: añadir al archivo existente (menos churn, pero perpetúa el archivo-drawer y acopla el import de catálogos a un módulo que otros dominios consumen).

### Decisión 2: `resolveSessionMode` con prioridad única repertorio → intervalos → secuencias → notas sueltas; `null` = no clasificable

**Qué**: firma `resolveSessionMode(session: DbSessionRecord): SessionMode | null` (`SessionMode = SessionTargetMode`). Orden de fallback para registros sin `targetMode`: (1) heurísticas de repertorio, (2) intervalos, (3) secuencias, (4) notas sueltas; sin coincidencia → `null`.

**Por qué**: hoy los predicados son independientes y una sesión legacy puede aceptar dos modos a la vez, mientras que `historyAnalytics.ts` y `longitudinal.ts` ya imponen de facto una prioridad (intervalos antes que secuencias). Un resolvedor total con orden único elimina la ambigüedad. El orden repertorio-primero reproduce el comportamiento actual de los predicados (`isSequenceSession`/`isIntervalSession` devuelven `false` si es repertorio); intervalos-antes-que-secuencias reproduce la cadena de `historyAnalytics.ts`.

**Manejo de `null`**:
- Predicados `is*Session` → `resolveSessionMode(s) === modo` (con `null` ningún predicado acepta: idéntico al comportamiento actual de `isSingleNoteSession`, que hoy exige evidencia positiva).
- `historyAnalytics.ts` (umbrales de latencia) → `resolveSessionMode(session) ?? 'single_note'` (idéntico al final de su cadena actual).
- `longitudinal.ts` → `const mode = resolveSessionMode(session); const targetMode = mode === 'repertoire' || mode === null ? 'single_note' : mode` (reproduce el comportamiento actual: repertorio se re-testea como notas sueltas).

**Alternativa descartada**: devolver siempre `'single_note'` como default dentro del resolvedor — rompería el contrato de exclusividad de los predicados de filtro (sesiones hoy no clasificables pasarían el filtro `single_note`).

### Decisión 3: `resolveNominalPoolSize(session, answers?)` con cadena de 3 niveles

**Qué**: firma nueva `(session: DbSessionRecord, answers?: DbAnswerRecord[]): number`. Cadena:

1. **Canónico**: segmento de contenido = `presetName.split('•')[0].trim()` (convención ya usada en `computeLongitudinalComparisons`); comparación normalizada (trim + lowercase) contra los nombres de los tres catálogos → `notes.length` / `intervalSemitones.length` / `candidateNotes.length`.
2. **Heurístico (fallback histórico)**: la cadena actual de `resolveNominalPoolSize` verbatim (regex de paréntesis → niveles 1.x antes que genéricos → niveles enteros → pentatónica → notas personalizadas), con `Math.max(2, …)` en cada rama.
3. **Empírico**: `new Set(answers.filter(a => a.sessionId === session.id).map(a => a.expectedNote)).size`, con piso 2; sin respuestas → 2.

**Por qué cambiar la firma a `answers?`**: elimina que cada consumidor precalcule `empiricalUniqueCount` (hoy `sessionFilters` mantiene un mapa auxiliar y `historyAnalytics` un Set intermedio). El conteo empírico es un detalle del fallback, no del contrato. Los 2 call-sites de producción y los tests se migran mecánicamente. Alternativa descartada: mantener `empiricalUniqueCount: number` (menos churn en tests, pero propaga la responsabilidad del pre-cálculo que el SSOT debe absorber).

**Orden canónico-primero es seguro**: ningún nombre canónico contiene el patrón `(N activos|notas|tonos|intervalos)` que captura la regex de paréntesis (los paréntesis de `INTERVAL_PRESETS` son `2m vs 8J`, `2M, 3M, …` — no matchean), y los nombres canónicos de `EXERCISE_PRESETS` ya resuelven igual por la vía heurística (`Nivel 1 (C, D, E)` → 3). Los únicos cambios de resultado son correcciones: `Rango G4 a G5` → 13 (antes caía al empírico) y presets de secuencia 2.x → `candidateNotes.length` (antes `nivel 2` genérico → 5).

**Limitación conocida (documentada, no corregida)**: para labels genéricos de secuencia (`Secuencias (3 notas)`) el pool resuelto es la longitud de la secuencia (3), no el pool de candidatos — el pool real de una sesión de secuencia personalizada no se persiste en el registro. Se preserva el comportamiento histórico; cambiarlo requeriría persistir el pool en `DbSessionRecord` (fuera de alcance).

### Decisión 4: `matchesSessionPreset(session, targetPresetName)` canónico-primero para el filtro de preset

**Qué**: el bloque 4 de `filterSessionsAdvanced` delega en esta función: (1) coincidencia exacta normalizada del segmento de contenido contra el nombre canónico del target; (2) fallback: la matriz heurística actual (`isLevel1/2/3/4`, `isPentatonic`, `isCustom`, `isDirectMatch`) verbatim.

**Por qué el fallback es imprescindible**: los registros históricos de intervalos guardan `Nivel 1.1: Intervalos Clásicos • Bloque 10 preguntas` (sin el paréntesis de semitonos del nombre canónico), que hoy matchea por la heurística laxa `nivel 1`; el matching exacto puro los excluiría del filtro. El target del filtro proviene de `AnalyticsFilterBar` (nombres canónicos de los catálogos según el modo activo + `Personalizadas`), por lo que la vía canónica cubre todos los casos nuevos.

### Decisión 5: Predicados `is*Session` como delegadores; barrel intacto

**Qué**: `isRepertoireSession`, `isSequenceSession`, `isIntervalSession`, `isSingleNoteSession` permanecen exportados desde `sessionClassification.ts` (y por ende del barrel) pero su cuerpo es `resolveSessionMode(s) === '…'`. `historyAnalytics.ts` añade `export * from './sessionModality'` al barrel y reemplaza sus dos cadenas de modo por `resolveSessionMode(session) ?? 'single_note'`.

**Por qué**: preserva la Decisión 1 de OLA 4.3 (los ~35 sitios consumidores no cambian imports) mientras el conocimiento vive en un solo lugar.

### Decisión 6: Tests data-driven sobre los catálogos, no sobre literales

**Qué**: `sessionModality.test.ts` itera `EXERCISE_PRESETS`, `INTERVAL_PRESETS` y `SEQUENCE_PRESETS` (`it.each`) afirmando `resolveNominalPoolSize(sessionWithName(preset.name)) === preset.notes.length | intervalSemitones.length | candidateNotes.length`. Los tests existentes (`sessionClassification.test.ts`, `sessionFilters.test.ts`, `longitudinal.test.ts`) se actualizan mecánicamente a la nueva firma conservando los valores afirmados.

**Por qué**: si mañana se añade un preset a cualquier catálogo, el test lo cubre sin edición; un literal duplicado en el test recrearía exactamente el problema F21.

## Risks / Trade-offs

- **[Registros legacy que matcheaban 2 modos a la vez ahora clasifican a uno solo]** → Mitigación: la prioridad elegida reproduce la cadena de facto de `historyAnalytics`/`longitudinal`; el impacto queda acotado a registros sin `targetMode` (los entrenadores actuales lo persisten siempre); los tests existentes de filtros y clasificación actúan de guarda de regresión.
- **[Cambio de firma de `resolveNominalPoolSize` rompe compilación de call-sites no detectados]** → Mitigación: solo 2 call-sites de producción (ambos en el alcance) + tests; `npm run typecheck` como compuerta.
- **[Matching canónico por nombre se rompe si se renombra un preset]** → Mitigación: es exactamente la fragilidad que se reduce — el renombrado solo afecta a la vía canónica y el fallback heurístico histórico sigue resolviendo los registros viejos; `resolveNotePresetName` sigue generando nombres desde los presets, no a mano.
- **[Pool de secuencias genéricas sigue siendo la longitud, no el pool de candidatos]** → Mitigación: limitación documentada en Decisión 3; corregirla exige persistir el pool en el registro de sesión (cambio de esquema, fuera de alcance).
- **[Doble resolución (canónica + heurística) en cada sesión del pipeline]** → Mitigación: la vía canónica es una comparación de strings O(1) por sesión contra ≤16 presets; el costo es despreciable frente al filtrado existente.

## Migration Plan

1. Crear `sessionModality.ts` + `sessionModality.test.ts` (TDD: primero los tests data-driven en rojo).
2. Delegar `sessionClassification.ts` (pool + predicados) y migrar sus tests a la nueva firma.
3. Refactorizar `sessionFilters.ts` (bloque preset + call-site del pool) y `longitudinal.ts` (modo + notas).
4. Refactorizar `historyAnalytics.ts` (barrel + 2 cadenas de modo + call-site del pool).
5. Compuerta: `npm test` (suite completa), `npm run typecheck`, `npm run lint` — 0 regresiones.

Rollback: revert del commit único del cambio; no hay migración de datos ni cambios de esquema.
