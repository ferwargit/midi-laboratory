# Tasks

## 1. Prueba de regresión (TDD - Red)

- [x] 1.1 Añadir una prueba en `src/renderer/src/components/views/analytics/SessionDetailModal.test.tsx` que renderice el modal abierto con una sesión cuya `responseTimeMs` máxima sea `8800ms` y verificar que la etiqueta superior del eje Y muestra un valor limpio con margen (`10.5s`), confirmando que la prueba falla contra el código actual (etiqueta `8.8s`) — verificación: `npx vitest run src/renderer/src/components/views/analytics/SessionDetailModal.test.tsx` en rojo.
- [x] 1.2 En la misma prueba, assertar que la posición Y del punto más lento es `> 25` (no colisiona con `yTop = 15`), evidenciando el headroom — verificación: la aserción está presente y falla antes del cambio de implementación.
- [x] 1.3 Añadir un `data-testid` no invasivo al `text` del eje superior (`x=5, y=yTop+3`) para localizar la etiqueta de forma estable, verificando que la suite de pruebas existente sigue compilando sin errores de tipo — verificación: `npm run typecheck` incluye el archivo sin errores nuevos.

## 2. Implementación del cálculo de `maxTime`

- [x] 2.1 Reemplazar en `src/renderer/src/components/views/analytics/SessionDetailModal.tsx` (línea ~167) el cálculo `Math.max(3500, ...questions.map((q) => q.responseTimeMs))` por la fórmula con headroom del 15% y redondeo a múltiplos de 500ms (`minBaseline`, `maxResponse`, `targetTime`, `maxTime`) — verificación: la prueba 1.1 pasa a verde y la etiqueta superior muestra `10.5s` con la sesión de `8800ms`.
- [x] 2.2 Confirmar que las modalidades rápidas conservan la base mínima limpia de `3.5s` (p. ej. `single_note` e Intervalos rápidos) — verificación: pruebas de "Umbrales de Latencia por Modalidad en Gráfico SVG" de `SessionDetailModal.test.tsx` siguen en verde.
- [x] 2.3 Verificar que la línea de umbral `FAST_MAX_MS` sigue visible y por debajo de `yTop` (condición `thresholds.FAST_MAX_MS <= maxTime` verdadera) — verificación: la prueba existente de umbrales pasa y se confirma **programáticamente** que la etiqueta del umbral (`< 1.4s`) se renderiza dentro del gráfico (aserción de presencia en el SVG renderizado), en lugar de una inspección visual manual.

## 3. Calidad y verificación integral

- [x] 3.1 Formatear los archivos tocados con Prettier: `npx prettier --write src/renderer/src/components/views/analytics/SessionDetailModal.tsx src/renderer/src/components/views/analytics/SessionDetailModal.test.tsx` — verificación: comando finaliza sin errores y `git diff` no muestra cambios de formato no intencionales.
- [x] 3.2 Ejecutar `npm run typecheck` — verificación: sin errores de TypeScript.
- [x] 3.3 Ejecutar `npm run test` — verificación: la suite completa (623+ tests) pasa al 100% sin regresiones.
