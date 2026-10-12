# Design

## Context

El bug se origina en `sessionClassification.ts` función `resolveNominalPoolSize` (líneas 56-79) y se propaga a `sessionFilters.ts` en `filterSessionsAdvanced` (líneas 115-119). Actualmente `resolveNominalPoolSize` solo reconoce:
- Patrones de 'nivel 1/2/3/4' → devuelve 3, 5, 8, 13 respectivamente
- 'pentatónica' → 6
- 'notas personalizadas (N)' → N (con piso Math.max(2, N))
- Default: `Math.max(2, empiricalUniqueCount)` → mínimo 2

No reconoce:
- Nomenclatura de intervalos: `'Intervalos (N activos)'` → debería devolver N
- Presets de intervalos de nivel 1.x:
  - 'nivel 1.0' / 'contraste' → 2
  - 'nivel 1.1' / 'nivel 1.2' / 'referencia' → 5
  - 'nivel 1.3' / 'nivel 1.4' / 'cromático completo' → 12

En `filterSessionsAdvanced`, al filtrar por `poolSizeFilter`, se llama a `resolveNominalPoolSize(s, 0)` pasando siempre 0 como `empiricalUniqueCount`. Esto fuerza la rama default que devuelve mínimo 2, descartando sesiones de intervalos con pool size > 2.

## Goals / Non-Goals

**Goals:**
1. `resolveNominalPoolSize` reconoce la nomenclatura `'Intervalos (N activos)'` y extrae N correctamente.
2. `resolveNominalPoolSize` reconoce los presets de intervalos de nivel 1.x (contraste, referencia, cromático completo).
3. `filterSessionsAdvanced` pasa el conteo empírico real de respuestas únicas por sesión a `resolveNominalPoolSize` cuando `allAnswers` está disponible.
4. Cobertura completa de pruebas unitarias (TDD) para ambos casos.

**Non-Goals:**
- Cambiar la interfaz pública de `resolveNominalPoolSize` (mantiene misma firma).
- Modificar el almacenamiento de sesiones o la estructura de `DbSessionRecord`.
- Añadir nuevos filtros UI; solo corregir el comportamiento existente.

## Decisions

### Decision 1: Regex inclusiva para capturar pool numérico entre paréntesis
**Elección**: Añadir regex `/\((\d+)\s*(?:activos|notas|tonos|intervalos)?\)/i` antes de la rama de 'notas personalizadas'.
**Rationale**: Captura cualquier variante semántica dentro de paréntesis (activos, notas, tonos, intervalos) sin false positives. Se ejecuta antes que la rama 'nivel' para tener prioridad sobre colisiones numéricas.
**Alternativas consideradas**:
- Regex más específica solo para 'activos' → Rechazada: no cubriría 'notas'/'tonos' en otros presets.
- Parsing por `presetName.split('(')` → Rechazada: frágil ante espacios, mayúsculas, variantes.

### Decision 2: Reconocimiento de presets de intervalos nivel 1.x
**Elección**: Añadir bloque dedicado tras regex paréntesis, antes de 'nivel' genérico:
```typescript
if (name.includes('nivel 1.0') || name.includes('contraste')) return 2
if (name.includes('nivel 1.1') || name.includes('nivel 1.2') || name.includes('referencia')) return 5
if (name.includes('nivel 1.3') || name.includes('nivel 1.4') || name.includes('cromático completo')) return 12
```
**Rationale**: Los presets 1.x son semánticamente distintos de niveles 1/2/3/4 enteros. Su pool size no sigue la progresión 3→5→8→13. Deben resolverse explícitamente para evitar caer en `level === 1` (que devuelve 3).
**Alternativas consideradas**:
- Extender regex `nivel\s*(\d+(\.\d+)?)` → Rechazada: complejidad innecesaria y riesgo de colisión con 'nivel 10+'.
- Mapeo en objeto/Map → Rechazada: overhead para 3 entradas; if-else es legible y performante.

### Decision 3: Pasar empiricalUniqueCount real en filterSessionsAdvanced
**Elección**: En `filterSessionsAdvanced`, antes del filtro poolSizeFilter, calcular un Map `sessionId -> empiricalUniqueCount` usando `answers` filtrados por sesión, y pasarlo a `resolveNominalPoolSize(s, empiricalCount)`.
**Rationale**: Garantiza consistencia absoluta: la columna visual CARGA (POOL) en la tabla usa el mismo cómputo que el predicado de filtro. Sin answers, cae a 0 → rama default con piso 2 (comportamiento legacy seguro).
**Alternativas consideradas**:
- Calcular dentro de `resolveNominalPoolSize` recibiendo `answers[]` → Rechazada: rompe separación de responsabilidades (clasificación no debe conocer DB).
- Usar `session.totalQuestions` → Rechazada: no refleja respuestas reales (puede haber menos respuestas que preguntas).

### Decision 4: Estructura de pruebas TDD
**Elección**: Añadir tests en `sessionFilters.test.ts` (describe '6. Carga / Tamaño de Pool - Intervalos') y crear `sessionClassification.test.ts` para `resolveNominalPoolSize`.
**Rationale**: Separa responsabilidades: classification tests validan lógica pura de resolución; filters tests validan integración completa con filtros.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| **False positives regex paréntesis**: match en 'Nivel 1 (C, D, E)' donde (C, D, E) no es pool size | Regex requiere `\d+` seguido de keywords semánticas (activos/notas/tonos/intervalos). 'Nivel 1 (C, D, E)' no matchea porque no hay dígitos + keywords. |
| **Colisión 'nivel 1.1' con 'nivel 1'**: `name.includes('nivel 1')` capturaría 'nivel 1.1' | Bloque 1.x se ejecuta ANTES del match genérico `nivel\s*(\d+)`. 'nivel 1.1' no llega a la rama level===1. |
| **Sesiones sin answers**: empiricalUniqueCount = 0 → default pool 2 | Comportamiento legacy preservado; no rompe filtros existentes. UI muestra pool 2 como fallback. |
| **Performance**: Map empiricalUniqueCount por sesión en cada filtro | `answers` típicamente < 10k registros; Map O(n) es trivial. Se puede memoizar por sesión si se vuelve bottleneck. |

## Migration Plan

1. **Paso 1 (Rojo)**: Escribir tests fallando en `sessionClassification.test.ts` y `sessionFilters.test.ts` para:
   - `resolveNominalPoolSize('Intervalos (6 activos)', 0)` → 6
   - `resolveNominalPoolSize('Intervalos (4 activos)', 0)` → 4
   - `resolveNominalPoolSize('nivel 1.0: contraste', 0)` → 2
   - `resolveNominalPoolSize('nivel 1.1: referencia', 0)` → 5
   - `resolveNominalPoolSize('nivel 1.3: cromático completo', 0)` → 12
   - `filterSessionsAdvanced` con poolSizeFilter='6' retorna sesión 'Intervalos (6 activos)'
2. **Paso 2 (Verde)**: Implementar cambios en `sessionClassification.ts` y `sessionFilters.ts` para pasar tests.
3. **Paso 3 (Refactor)**: Ejecutar `npx prettier --write`, `npm run typecheck`, `npm run test`.
4. **Rollback**: `git checkout` de los 2 archivos modificados + tests nuevos (eliminados).

## Open Questions

Ninguna. El diseño está completamente definido y no hay ambigüedades que afecten specs, approach o task breakdown.