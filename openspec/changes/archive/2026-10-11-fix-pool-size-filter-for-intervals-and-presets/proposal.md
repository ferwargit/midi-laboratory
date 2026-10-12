# Proposal

## Why

En la solapa "AI Diagnóstico IA", al filtrar por Modalidad: Intervalos y seleccionar un tamaño de pool en el desplegable "Toda Carga (Pool)", la tabla y los KPIs devuelven 0 sesiones analizadas ("No hay sesiones que coincidan con los filtros aplicados") a pesar de existir sesiones con ese tamaño exacto de pool (ej: 'Intervalos (6 activos)', 'Intervalos (4 activos)'). La causa raíz es que `resolveNominalPoolSize` en `sessionClassification.ts` solo reconoce patrones de 'nivel 1/2/3/4' y 'notas personalizadas (N)', sin reconocer la nomenclatura de intervalos 'Intervalos (N activos)' ni presets de intervalos. Al no hacer match, cae al valor por defecto (2), provocando que `filterSessionsAdvanced` descarte erróneamente todas las sesiones de intervalos al filtrar por pool.

## What Changes

1. **Ampliar `resolveNominalPoolSize`** en `src/renderer/src/domain/analytics/sessionClassification.ts`:
   - Añadir regex inclusiva para capturar la carga numérica nominal entre paréntesis: `/\((\d+)\s*(?:activos|notas|tonos|intervalos)?\)/i`, permitiendo resolver correctamente 'Intervalos (6 activos)' → 6, 'Intervalos (4 activos)' → 4, etc.
   - Añadir reconocimiento de presets de intervalos:
     * 'nivel 1.0' o 'contraste' → 2
     * 'nivel 1.1', 'nivel 1.2' o 'referencia' → 5
     * 'nivel 1.3', 'nivel 1.4' o 'cromático completo' → 12

2. **Corregir `filterSessionsAdvanced`** en `src/renderer/src/domain/analytics/sessionFilters.ts`:
   - Al filtrar por `poolSizeFilter`, asegurar que para cada sesión se compute el poolSize pasando el conteo empírico de respuestas de esa sesión (si `allAnswers` está disponible) a `resolveNominalPoolSize`, garantizando consistencia absoluta entre la columna visual CARGA (POOL) de la tabla y el predicado de filtro.

3. **Pruebas Unitarias (Protocolo TDD)**:
   - En `sessionFilters.test.ts` y `sessionClassification.test.ts`:
     * Escribir pruebas unitarias primero en Rojo con sesiones de intervalos nombradas 'Intervalos (6 activos)' e 'Intervalos (4 activos)'.
     * Validar que `resolveNominalPoolSize` devuelve 6 y 4 respectivamente.
     * Validar que `filterSessionsAdvanced` con `poolSizeFilter: '6'` devuelve únicamente la sesión de 6 activos y no 0 sesiones.

4. **Calidad y Verificación**:
   - Formatear con Prettier (`npx prettier --write`).
   - Ejecutar `npm run typecheck` y `npm run test` (todos los tests deben pasar limpios).

## Capabilities

### New Capabilities
- `interval-pool-resolution`: Capacidad de resolver el tamaño nominal del pool para sesiones de intervalos y presets de intervalos, reconociendo nomenclatura como 'Intervalos (N activos)' y presets de nivel 1.x.

### Modified Capabilities
- `pool-size-filtering`: Modificación del comportamiento de filtrado por tamaño de pool para que funcione correctamente con sesiones de intervalos, usando el conteo empírico de respuestas cuando está disponible.

## Impact

- **Archivos afectados**:
  - `src/renderer/src/domain/analytics/sessionClassification.ts` (resolveNominalPoolSize)
  - `src/renderer/src/domain/analytics/sessionFilters.ts` (filterSessionsAdvanced)
  - `src/renderer/src/domain/analytics/sessionFilters.test.ts` (nuevas pruebas)
  - `src/renderer/src/domain/analytics/sessionClassification.test.ts` (nuevas pruebas, si se crea)
- **APIs afectadas**: `resolveNominalPoolSize` (nueva regex + presets) y `filterSessionsAdvanced` (uso de empiricalUniqueCount).
- **Dependencias**: Ninguna nueva; se reutiliza la lógica existente de clasificación.
- **Sistemas afectados**: UI de diagnóstico IA (solapa de filtros de sesiones).