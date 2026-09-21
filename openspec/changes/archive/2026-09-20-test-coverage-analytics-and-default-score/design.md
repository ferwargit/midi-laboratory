## Context

Cuatro módulos de dominio quedan fuera del paraguas de pruebas según el
reporte de cobertura de Vitest: `defaultScore.ts` (0% líneas), y las ramas de
`sessionFilters.ts` (55%), `longitudinal.ts` (51%) y `latencyStats.ts` (58%).
Toda la lógica de producción ya existe y está especificada en las
capacidades `03-practice-modalities`, `04-adaptation-algorithms` y
`05-analytics-psychometrics`; el diseño que sigue trata solo sobre **cómo
ejercitar dichas ramas con pruebas unitarias** sin alterar producción.

Fuente de referencia para convenciones: `historyAnalytics.test.ts`, que ya
testea funciones del barril (`historyAnalytics.ts` re-exporta
`sessionFilters`, `longitudinal` y `latencyStats`).

## Goals / Non-Goals

**Goals:**

- Llevar la cobertura de ramas de los cuatro módulos objetivo a 95%+.
- Blindar los casos de borde documentados: filtros encadenados de
  `filterSessionsAdvanced`, reconstrucción histórica de
  `reconstructSessionConfig`, y la cronometría nula/por-octava de
  `computePerNoteLatencyStats`.
- Reutilizar el estilo de fixtures in-memory existente (objetos
  `DbSessionRecord` / `DbAnswerRecord` generados por factorías locales, ver
  D2) para mantener cero dependencias nuevas.

**Non-Goals:**

- No se modifica comportamiento de producción ni se tocan las specs
  canónicas (por eso `skip_specs: true`).
- Los filtros que requieren `answers` (`inputSource`, `biasFilter`, banda
  ISI) **sí se cubren** en `sessionFilters.test.ts`: además de las ramas sin
  respuestas (no-op seguro cuando `answers` está vacío), se ejercitan las
  ramas con respuestas de los 11 grupos de filtros, incluyendo hardware/virtual
  para `inputSource`, sharp/flat/balanced para `biasFilter` y las bandas
  massed/optimal/spaced para ISI. Esta cobertura adicional es lo que lleva al
  100% de ramas al módulo.
- No se introduce infraestructura de mocks compartida: el único mock es
  `EXERCISE_PRESETS`, confinado a `longitudinal.mock.test.ts`, y no hay tests
  de integración/UI.

## Decisions

### D1: Importar desde el módulo fuente, no desde el barril

Las nuevas suites importan `filterSessionsAdvanced` desde `./sessionFilters`,
`reconstructSessionConfig`/`computeLongitudinalComparisons` desde
`./longitudinal`, y `computePerNoteLatencyStats` desde `./latencyStats`, en
lugar de usar `./historyAnalytics`.

- **Rationale**: localiza el fallo en el módulo correcto al correr suites
  individuales y evita acoplar la nueva suite a la superficie completa del
  barril.
- **Alternativa descartada**: importar del barril (como hace
  `historyAnalytics.test.ts`); válida pero difumina la autoría de las ramas.

### D2: Fixtures locales por archivo, generados por funciones factoría

Cada suite declara sus propios datos como funciones factoría locales
(`makeSession` / `makeAnswer` y, donde se necesita, `makeDetail`), que
reciben un `Partial<DbSessionRecord>` / `Partial<DbAnswerRecord>` y lo
extienden por spread sobre un objeto con los valores por defecto del
dominio.

- **Rationale**: cada caso de prueba expone solo los campos que lo
  justifican, sin repetir los 10+ campos obligatorios de los records; las
  factorías viven dentro del propio archivo, por lo que cada suite sigue
  siendo autocontenida y determinista, sin dependencias compartidas entre
  módulos.
- **Alternativa descartada**: literales de objeto completos duplicados en
  cada caso (como hace `historyAnalytics.test.ts`); válida, pero produce
  ruido repetitivo en las ramas con muchos variantes (formatos, presets).
- **Alternativa descartada**: factorizar un helper compartido
  (`analyticsFixtures.ts`); añadiría un archivo extra y desacoplaría los datos
  del caso que los justifica.

### D3: Mapa de ramas objetivo por suite

**`defaultScore.test.ts`** (rama única de exportación):
1. `typeof DEFAULT_PARTITURA_XML === 'string'` y longitud > 0.
2. `parseMusicXml(DEFAULT_PARTITURA_XML)` → aserciones sobre el contrato
   observable de `ScoreDataModel`: `title === 'Partitura 1'`,
   `baseBpm === 86` (extraído de `<sound tempo="86"/>`),
   `timeSignature.beats === 2 && beatType === 4`, `totalMeasures === 8`,
   `events.length > 0`, existencia de eventos melódicos (`!isRest`), eventos
   acordes (`isChord`, por los `<chord/>` del compás 8) y
   `harmonicProgression.length > 0` (cifrado C y G/B).

**`sessionFilters.test.ts`** (los 11 grupos de filtros de
`filterSessionsAdvanced`, con y sin `answers`):
- Modalidad: `single_note`, `intervals`, `sequences`, `repertoire`, `all`.
- Instrumento: `instrumentId !== 'all'` (match y no-match).
- Estrategia: `strategyId !== 'all'` (match y no-match).
- Preset: cubrir los alias `nivel 3`/`octava diatónica`, `nivel 1`, `nivel 2`,
  `nivel 4`/`cromático`, `pentatónica`, `personalizadas`/`notas (` y la
  coincidencia directa (`isDirectMatch`).
- Formato: `time_all`, `time_1`, `time_3`, `time_5`, `time_10`,
  `questions_all`, `questions_5`, `questions_10`, `questions_20`, `mastery` —
  con fixtures cuyo `resolveSessionFormat` devuelva cada
  `formatType`/`nominalMinutes`/`nominalQuestions` esperado.
- Pool: `poolSizeFilter` numérico vs `resolveNominalPoolSize`.
- Búsqueda: `searchQuery` que coincida por `presetName`, por `instrumentId`,
  por `strategyId`, y un caso parcial; más el caso
  `searchQuery.trim().length === 0` (no-op).
- Fuente de entrada (`inputSource`): no-op sin `answers`; `hardware`/`virtual`
  con respuestas (rama `mixed` cubierta como caso no-match).
- Sesgo direccional (`biasFilter`): no-op sin `answers`; `sharp`/`flat`/
  `balanced` con respuestas.
- Banda ISI: la primera sesión de la cronología (`gap === null`) se excluye de
  toda banda; `massed`, `optimal` y `spaced` con `answers` no requeridos (el
  mapa de gap se construye solo sobre `createdAt`).

**`longitudinal.test.ts`**:
- `reconstructSessionConfig` con sesión de intervalos: respuestas con
  `reasonTelemetry` que matcheen `/(\d+)\s*st/i` → `recommendedIntervals`
  deduplicado y ordenado; y caso sin telemetría → fallback `[2,4,5,7,12]`.
- Sesión de secuencias: telemetría con `Secuencia: [...]` de ≥3 notas →
  `recommendedNotes` + `sequenceLength` correctos; y caso que cae a
  `a.expectedNote` cuando no hay match de secuencia.
- Fallback de notas seguras: respuestas repetidas/insuficientes
  (`uniqueNotes.length < 2`) → `[60,62,64]`; y `uniqueNotes.length >= 2` →
  notas únicas ordenadas.
- `computeLongitudinalComparisons` con grupo de 3 sesiones (mismo
  `instrumentId` + `presetName` con separador `•`): la más antigua es
  `baselineSession`, la más reciente `latestSession`, y `totalAttempts`
  acumula `totalQuestions` de todo el grupo.

**`longitudinal.mock.test.ts`** (suite aislada, ramas defensivas de presets):
- Aísla el módulo con `vi.mock('../music/presets', () => ({ EXERCISE_PRESETS: [] }))`
  para que `EXERCISE_PRESETS.find(...)?.notes` resuelva a `undefined` y se
  ejerciten los fallbacks `|| [...]` de `reconstructSessionConfig` (niveles 1-4
  y pentatónica), inalcanzables mientras el catálogo real siempre contiene
  esos ids.
- Sigue el precedente de `src/renderer/src/domain/ai/lmStudioService.mock.test.ts`.
  Se mantiene en un archivo separado porque `vi.mock` es hoisted al inicio del
  archivo: mezclarlo con la suite principal anularía las resoluciones de
  presets reales usadas por el resto de los casos.

**`latencyStats.test.ts`**:
- Ninguna respuesta correcta → `fastestNote === null`, `slowestNote === null`,
  `avgLatencyMs === 0` por nota, `fastReflexPercent === 0`,
  `fastestOctave === null`.
- `expectedNote < 0` se ignora (rama `continue`).
- Clasificación por octavas: notas en octava 3 (p.ej. MIDI 48–59) → etiqueta
  "Octava 3 (Grave...)", octava 4 (60–71) → "Octava 4 (Central...)", otras →
  "Octava N (Aguda)"; y `fastestOctave` apunta a la octava de menor
  `avgLatencyMs`.
- `fastCount` activado solo bajo `COGNITIVE_LATENCY_THRESHOLDS.FAST_MAX_MS`.

### D4: Aserciones sobre contrato observable

Todas las aserciones son sobre valores de retorno y estructura del modelo
devuelto (`ScoreDataModel`, `AiExercisePrescription`,
`PerNoteLatencyAnalysis`, arregles filtrados), nunca sobre estado interno ni
sobre réplicas de la implementación.

## Risks / Trade-offs

- **[Riesgo] Fixtures acoplados a los presets reales de `EXERCISE_PRESETS`**
  → `reconstructSessionConfig` resuelve notas desde `EXERCISE_PRESETS.find`;
  si un preset se renombra, el test fallaría aunque la rama sea correcta.
  **Mitigación**: asertar sobre las notas del fallback documentado cuando el
  preset existente no se encuentre, y cubrir además la rama `else`
  (deducción desde respuestas) que no depende de presets.
- **[Riesgo] Cobertura 95%+ es un objetivo, no garantía** → puede quedar
  alguna rama muerta o inalcanzable (p.ej. formatos `infinite` no listados
  en los `format` del filtro). **Mitigación**: tras implementar, correr
  `npx vitest run --coverage` y registrar en tasks.md cualquier rama
  residual con su justificación.
- **[Trade-off] Duplicación de fixtures entre suites** → se acepta a cambio
  de suites autocontenidas y deterministas (ver D2).

## Migration Plan

No hay migración: el cambio es aditivo y de solo pruebas. Rollback = eliminar
los cinco archivos `*.test.ts` creados. Verificación: `npm run test`
(vitest run) en modo no-interactivo, más `npm run typecheck` y `npm run lint`.

## Open Questions

Ninguna. Los detalles de los fixtures (valores concretos de
`reasonTelemetry`, BPM, octavas) se resuelven en implementación a partir de
los contratos observables ya leídos en los módulos fuente.
