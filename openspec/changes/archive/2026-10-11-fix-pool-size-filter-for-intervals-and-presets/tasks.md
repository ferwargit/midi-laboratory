# Tasks

## 1. Tests TDD - Red Phase (sessionClassification.test.ts)

- [x] 1.1 Crear archivo `src/renderer/src/domain/analytics/sessionClassification.test.ts` con tests para `resolveNominalPoolSize` que fallen (Red): validar que 'Intervalos (6 activos)' devuelve 6, 'Intervalos (4 activos)' devuelve 4, 'nivel 1.0 contraste' devuelve 2, 'nivel 1.1 referencia' devuelve 5, 'nivel 1.3 cromático completo' devuelve 12. Verificar: `npm run test -- sessionClassification.test.ts` falla.

## 2. Tests TDD - Red Phase (sessionFilters.test.ts)

- [x] 2.1 Añadir describe '6. Carga / Tamaño de Pool - Intervalos' en `sessionFilters.test.ts` con tests que fallen (Red): validar que `filterSessionsAdvanced` con `poolSizeFilter: '6'` retorna sesión 'Intervalos (6 activos)' y no 0 sesiones; validar con `poolSizeFilter: '4'` retorna 'Intervalos (4 activos)'. Verificar: `npm run test -- sessionFilters.test.ts` falla.

## 3. Implementación - resolveNominalPoolSize (sessionClassification.ts)

- [x] 3.1 Añadir regex inclusiva `/\((\d+)\s*(?:activos|notas|tonos|intervalos)?\)/i` al inicio de `resolveNominalPoolSize` (antes de bloque 'nivel') para capturar pool numérico en paréntesis. Verificar: test 1.1 pasa.
- [x] 3.2 Añadir reconocimiento de presets de intervalos nivel 1.x: 'nivel 1.0'/'contraste' → 2, 'nivel 1.1'/'nivel 1.2'/'referencia' → 5, 'nivel 1.3'/'nivel 1.4'/'cromático completo' → 12. Colocar antes del match genérico `nivel\s*(\d+)`. Verificar: tests 1.1 y 2.1 pasan.

## 4. Implementación - filterSessionsAdvanced (sessionFilters.ts)

- [x] 4.1 En `filterSessionsAdvanced`, antes del filtro `poolSizeFilter`, calcular `empiricalUniqueCount` por sesión usando `answers` filtrados por `sessionId` (contar `playedNote` únicos). Crear Map `sessionId -> empiricalUniqueCount`. Verificar: test 2.1 pasa con answers disponibles.
- [x] 4.2 Modificar llamada a `resolveNominalPoolSize(s, empiricalUniqueCountMap.get(s.id) || 0)` en el bloque `poolSizeFilter` (línea 117). Verificar: test 2.1 pasa; tests existentes de pool size (describe '6. Carga / Tamaño de Pool') siguen pasando.

## 5. Verificación y Calidad

- [x] 5.1 Ejecutar `npx prettier --write src/renderer/src/domain/analytics/sessionClassification.ts src/renderer/src/domain/analytics/sessionFilters.ts src/renderer/src/domain/analytics/sessionFilters.test.ts src/renderer/src/domain/analytics/sessionClassification.test.ts`. Verificar: formateo aplicado sin errores.
- [x] 5.2 Ejecutar `npm run typecheck`. Verificar: 0 errores TypeScript.
- [x] 5.3 Ejecutar `npm run test`. Verificar: todos los tests pasan limpios (0 fallos, 0 advertencias).

## 6. Integración

- [x] 6.1 Verificación manual en UI: abrir solapa "AI Diagnóstico IA", filtrar por Modalidad: Intervalos, seleccionar pool size 6 en "Toda Carga (Pool)". Verificar: tabla muestra sesiones 'Intervalos (6 activos)' y KPIs reflejan datos correctos (no "No hay sesiones...").