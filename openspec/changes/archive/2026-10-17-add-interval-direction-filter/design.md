# Design

## Context

Ver proposal.md — Why. Estado actual relevante:

- `DbSessionRecord` no persiste la dirección del intervalo. La única fuente de verdad es la telemetría por respuesta: `useIntervalTrainer.ts` (línea 352) graba `reasonTelemetry: "${semitones} st (${direction})"` con `direction ∈ {ascending, descending, harmonic}` (el tipo `IntervalDirection` de `domain/music/intervals.ts`).
- `filterSessionsAdvanced` ya implementa 11 dimensiones de filtro con patrones establecidos: filtros dependientes de respuestas (`inputSource`, `biasFilter`) son no-op seguros cuando `answers` está vacío; `isiFilter` precomputa un mapa fuera del bucle.
- `AnalyticsView.tsx` es el dueño del estado de todos los filtros secundarios y delega el 100% del filtrado a `filterSessionsAdvanced` (exigido por la spec 05: prohibido encadenar `.filter()` propios en la vista).
- `AnalyticsFilterBar.tsx` recibe cada filtro como par `selectedX` / `onXChange` y calcula `hasActiveFilters` para habilitar "Limpiar".

## Goals / Non-Goals

**Goals:**

- Filtrar sesiones de Intervalos por la dirección del estímulo entrenado, derivada de `reasonTelemetry`.
- Mantener el contrato de pipeline de dominio puro: todo el conocimiento del filtro vive en `sessionFilters.ts`.
- Selector de UI visible solo en modalidad `intervals`, coherente con el comportamiento del resto de filtros.

**Non-Goals:**

- No se modifica el esquema de base de datos ni se añade persistencia de dirección a nivel de sesión.
- No se añade la dirección como columna de `SessionsTableTab` ni KPI agregado (posible follow-up).
- No se altera la lógica de generación de estímulos del entrenador (`exerciseGeneratorRules.ts`).

## Decisions

### D1 — Derivación de la dirección desde `reasonTelemetry`, no desde notas

La dirección del estímulo se extrae de `reasonTelemetry` con el patrón `/\((ascending|descending|harmonic)\)/i` sobre las respuestas de la sesión.

- **Por qué:** es la única fuente que registra la dirección *del estímulo* (lo que el entrenador pidió), ya persistida sin migración. Derivarla de `expectedNote`/`playedNote` es imposible: el registro guarda la nota objetivo y la nota tocada por el usuario, no la tónica raíz del intervalo.
- **Alternativa descartada:** añadir un campo `direction` a `DbSessionRecord`/`DbAnswerRecord`. Requiere migración de datos históricos y toca el módulo de persistencia (07), fuera del alcance.
- **Precedente:** `longitudinal.ts` ya parsea `reasonTelemetry` con regex (`/(\d+)\s*st/i`, `/Secuencia:\s*\[([^\]]+)\]/i`), y la spec 05 canonicaliza ese patrón para la reconstrucción de presets. El nuevo parser sigue la misma convención.

### D2 — Semántica de sesión "dirección pura" (uniformidad)

Una sesión coincide con `directionFilter = X` (X ≠ `'all'`) si y solo si:

1. Es sesión de Intervalos (`isIntervalSession(s)`), y
2. Tiene al menos una respuesta con dirección parseable, y
3. **Todas** sus respuestas con dirección parseable tienen dirección `X`.

- **Por qué:** el caso de uso es auditar sesiones entrenadas en una dirección exclusiva ("ver solo las sesiones ascendentes"). Una sesión en modo `both` mezcla estímulos ascendentes y descendentes en su interior; no es una "sesión ascendente" aunque domine una dirección. La semántica de uniformidad es determinista, fácil de testear y coincide con la intuición del selector "Solo Ascendente".
- **Alternativa descartada:** dirección dominante por mayoría (estilo `dominantBias`). Introduce un umbral de dominancia arbitrario y haría que una sesión `both` con 60% ascendentes pasara por "ascendente", contradiciendo la etiqueta "Solo".
- **Caso borde — respuestas sin dirección parseable** (telemetría vacía/legacy): se ignoran para el predicado; la sesión se rige por las parseables. Si ninguna es parseable, la sesión no coincide con ninguna dirección específica (queda excluida con filtro activo). Registrado como supuesto en proposal/tasks.

### D3 — `'harmonic'` como cuarta opción del filtro

El tipo `IntervalDirection` incluye `'harmonic'` (intervalos tocados simultáneos) y el entrenador lo graba en telemetría, por lo que el filtro lo expone con etiqueta "Harmónico/Mixto". Nota: el valor de configuración del entrenador es `'both'` (aleatoriza dirección), pero `'both'` nunca aparece grabado — cada respuesta individual registra su dirección efectiva. Por eso el filtro no ofrece `'both'`.

### D4 — Visibilidad condicional y reset al salir de Intervalos

- El selector se renderiza solo cuando `modeFilter === 'intervals'` (patrón análogo a `dynamicPresets`, que ya depende de la modalidad).
- Al cambiar la modalidad fuera de `intervals`, `AnalyticsView` resetea `selectedDirection` a `'all'`. **Por qué:** un filtro oculto pero activo sería invisible para el usuario y contaminaría `hasActiveFilters`/resultados sin explicación aparente.
- El reset se implementa en el manejador de cambio de modalidad (o `useEffect` sobre `modeFilter`), no en el componente de la barra, para mantener `AnalyticsFilterBar` como componente presentacional sin estado de sincronización.

### D5 — No-op seguro sin respuestas

Con `answers` vacío y `directionFilter ≠ 'all'`, el filtro no excluye nada (comportamiento no-op), replicando la Decisión 2 del design de los filtros `inputSource`/`biasFilter`. Evita que la analítica quede vacía en contextos sin telemetría cargada.

### D6 — Colocación del predicado en `sessionFilters.ts`

El parser de dirección (`resolveSessionStimulusDirection` o equivalente) vive en `sessionFilters.ts` (o en `sessionClassification.ts` si se reutiliza desde más sitios). No en `types.ts` (solo tipos) ni en la vista (prohibido por spec 05). Se precomputa un mapa `sessionId → direcciones parseables` fuera del bucle de filtrado, siguiendo el patrón de `empiricalUniqueCountMap` y `gapMap`.

## Risks / Trade-offs

- **[Sesiones históricas con `reasonTelemetry` vacío]** → Con filtro de dirección activo quedan excluidas (no parseable = sin dirección conocida). Mitigación: comportamiento documentado en D2 y test de regresión; el no-op sin respuestas (D5) cubre el caso de importaciones sin telemetría.
- **[Acoplamiento a formato de telemetría]** → El regex depende del formato `"N st (direction)"` que `useIntervalTrainer` graba. Mitigación: el formato es estable desde su introducción y ya es base de dos parsers canónicos (spec 05); se añade test que fija el contrato del parser.
- **[Filtro activo invisible al cambiar de modalidad]** → Mitigado por el reset automático (D4) y test de UI en `AnalyticsFilterBar.test.tsx` / flujo de `AnalyticsView`.
- **[Rendimiento]** → Un mapa adicional por sesión es O(sesiones + respuestas), mismo orden que los mapas existentes; sin impacto esperado.

## Migration Plan

Sin migración de datos ni despliegue especial: cambio aditivo y retrocompatible (dimensión opcional). Rollback trivial revirtiendo los 4 archivos afectados.

## Open Questions

(ninguna — las decisiones D2/D3/D4 cubren los supuestos menores; quedan registrados como asumidos)
