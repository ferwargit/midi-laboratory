## Context

La spec 05 declara que la analítica es un **pipeline de dominio puro**: `historyAnalytics.ts` recibe `DbSessionRecord`/`DbAnswerRecord` inmutables y devuelve modelos derivados, y la capa React solo consume. Hoy eso se rompe para tres filtros: `AnalyticsFilterOptions` declara `inputSource`, `biasFilter` e `isiFilter`, pero `filterSessionsAdvanced` (historyAnalytics.ts:698) los ignora, y `AnalyticsView.tsx:159-176` los reimplementa con `.filter()` y magic numbers (`900000`, `43200000`, `172800000`). Además `diagnosticReportGenerator.ts:84,86` usa `1.5` frente al `1.4` canónico (historyAnalytics.ts:1115), y `AnalyticsView.tsx:170` trata `gap === null` como `'spaced'`.

Restricción técnica central: los tres filtros operan sobre **atributos derivados** (`inputMethod`, `dominantBias`, `interSessionGapMs`) que hoy no viven en el `DbSessionRecord` sino que se computan dentro de `computeAnalyticsMetrics`. El diseño debe hacer que esas derivaciones sean consumibles por el filtro sin acoplar el dominio a React ni duplicar lógica.

## Goals / Non-Goals

**Goals:**

- Que `filterSessionsAdvanced` implemente los tres filtros declarados, operando exclusivamente sobre datos derivados en el propio dominio.
- Concentrar `ISI_THRESHOLDS` y `BIAS_DOMINANCE_RATIO` en la SSOT y eliminar los literales divergentes (`1.5`, `900000`, `43200000`, `172800000`) de la vista y del generador de informes.
- Corregir la clasificación de `gap === null`, que debe quedar fuera de toda banda ISI.
- Reutilizar las mismas funciones puras desde el filtro y desde el cómputo de métricas (cero duplicación del ratio `1.4` y del cálculo de gaps).

**Non-Goals:**

- Rediseñar la UI de analítica, añadir filtros nuevos ni cambiar la taxonomía de bandas ISI (`massed`/`optimal`/`spaced`).
- Modificar el store, la persistencia, el motor adaptativo ni la integración de IA local.
- Cambiar la firma pública observable de `computeAnalyticsMetrics` ni el contrato de `AnalyticsFilterOptions` (sus tipos ya existen y se conservan; `inputSource` sigue `'all' | 'hardware' | 'virtual'`).

## Decisions

### 1. Extraer tres funciones puras compartidas en lugar de exponer campos calculados

En vez de guardar atributos derivados en el registro de base de datos o de dejar que el filtro recorra las métricas ya computadas, se extraen funciones puras reutilizables en `historyAnalytics.ts`:

- `resolveSessionInputMethod(session, answers): 'hardware' | 'virtual' | 'mixed'`
- `resolveSessionDominantBias(session, answers): 'sharp' | 'flat' | 'balanced'` (usa `BIAS_DOMINANCE_RATIO`)
- `computeInterSessionGapMap(sessions): Map<sessionId, { gapMs: number | null; label: string }>` (encapsula la lógica actualmente inline en historyAnalytics.ts:1041-1054)

`computeAnalyticsMetrics` deja de tener el literal `1.4` y el bloque de gaps inline y pasa a llamar a estas funciones, de modo que filtro y métricas **necesariamente** coinciden.

*Alternativa descartada:* añadir los campos al `DbSessionRecord` implicaba migrar el esquema de IndexedDB y duplicar persistencia de datos derivados.

### 2. `filterSessionsAdvanced` recibe `answers` como tercer parámetro opcional

Firma: `filterSessionsAdvanced(sessions, filters, answers: DbAnswerRecord[] = [])`.

Los tres filtros nuevos necesitan las respuestas (para `inputMethod` y `dominantBias`); los filtros existentes no. Se añade parámetro opcional con default `[]` en vez de obligatorio para no romper a `filterSessionsByMode` (wrapper que no aplica filtros nuevos) ni a los tests existentes. Si los filtros nuevos se activan sin respuestas, no se aplican (no-op) en lugar de lanzar.

*Alternativa descartada:* partir `filterSessionsAdvanced` en dos funciones habría multiplicado las superficies de API y roto los call sites internos (`computeAnalyticsMetrics`, `AnalyticsView`, tests) sin ganar claridad.

### 3. El gap map se calcula sobre la cronología del input completo, antes de filtrar

`filterSessionsAdvanced` construye el `computeInterSessionGapMap` sobre el array de entrada ordenado cronológicamente y luego aplica todos los filtros. Así, `gap === null` identifica exclusivamente a la **primera sesión de la historia** recibida, y las bandas ISI reflejan los intervalos reales, no los del subconjunto ya filtrado. Esto es coherente con el call site de la vista, que pasa la lista completa de sesiones del store.

*Trade-off aceptado:* `computeAnalyticsMetrics` sigue computando su propio gap map sobre el subconjunto ya filtrado por modalidad (comportamiento actual, conservado). Como comparten la misma función pura, la divergencia se limita a qué sesión marca como "Inicio" cuando se filtra por modalidad; no afecta a la corrección del filtro ISI, que opera sobre la cronología completa.

### 4. `diagnosticReportGenerator` adopta `BIAS_DOMINANCE_RATIO`, manteniendo su nivel de agregación

Se reemplazan los literales `1.5` de diagnosticReportGenerator.ts:84,86 por `BIAS_DOMINANCE_RATIO` importado de la SSOT. Se conserva el cómputo a nivel de agregado (`metrics.sharpBiasCount` / `metrics.flatBiasCount`) porque es el insumo que ya tiene el generador y el que la spec exige alineado con el motor.

*Alternativa considerada y postergada:* derivar directamente de `metrics.sessionPsychometricsList[].dominantBias` y agregar por mayoría. Más correcto semánticamente (sesgo dominante *por sesión* vs. *global*), pero cambia los umbrales implícitos del agregado y el alcance de la OLA 2.3 es únicamente la unificación del ratio. Se documenta como posible evolución futura.

### 5. `AnalyticsView` elimina el bloque de filtrado manual

Se borran las líneas 159-176 y se pasan `inputSource: selectedInputSource`, `biasFilter: selectedBias` e `isiFilter: selectedIsi` en la llamada a `filterSessionsAdvanced` (junto con `answers`). El resto del `useMemo` (intersección con `metrics.sessionPsychometricsList`, aislamiento manual y ordenamiento) se conserva intacto: esa lógica no es filtrado psicométrico, sino presentación.

## Risks / Trade-offs

- **[Riesgo] Divergencia entre el gap del filtro y el gap mostrado** → Mitigación: ambas derivaciones usan `computeInterSessionGapMap`; la diferencia solo aparece al combinar filtro ISI con filtro de modalidad, y el label mostrado sigue siendo el de las métricas del store.
- **[Riesgo] Cambio de firma de `filterSessionsAdvanced`** → Mitigación: el parámetro es opcional con default; todos los call sites internos (vista, `computeAnalyticsMetrics`, wrapper `filterSessionsByMode`, tests) se actualizan en el mismo cambio y la verificación de tipos cubre la consistencia.
- **[Riesgo] Regresión silenciosa del filtro ISI** → Mitigación: tests de escenarios (`gap === null` excluido de las tres bandas, límites exactos en `MASSED_MAX_MS` / `OPTIMAL_MIN_MS` / `OPTIMAL_MAX_MS`) escritos antes que la implementación, según el protocolo TDD de AGENTS.md.
- **[Trade-off] `inputSource` solo admite `'hardware'`/`'virtual'` en el selector de UI, pero el dominio distingue `'mixed'`** → Aceptado: el dominio modela los tres estados (también usado por CPI); el selector actual limita la elección y no forma parte de este cambio.

## Migration Plan

1. Escribir los tests nuevos (Red) sobre `filterSessionsAdvanced` y `BIAS_DOMINANCE_RATIO`.
2. Añadir constantes SSOT y funciones puras extraídas en `historyAnalytics.ts`.
3. Implementar los tres filtros y refactorizar `computeAnalyticsMetrics` para usar las funciones compartidas (Verde).
4. Limpiar el filtrado manual en `AnalyticsView.tsx`.
5. Unificar el ratio en `diagnosticReportGenerator.ts`.
6. Verificación no interactiva: `npm run typecheck`, `npm run lint`, `npm run test` (vitest run).
7. *Rollback:* al ser un cambio interno sin migración de datos ni cambio de esquema, basta con revertir el commit; no hay estado persistido que validar.

## Open Questions

Ninguna. Los puntos de ambigüedad menores (parámetro opcional vs. obligatorio, agregado global vs. por sesión en el informe) se resolvieron en las decisiones 2 y 4 con las alternativas y su justificación.
