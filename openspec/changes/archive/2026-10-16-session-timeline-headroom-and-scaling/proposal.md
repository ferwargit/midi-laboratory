# Proposal

## Why

El gráfico SVG de línea de tiempo micro-cronológica en `SessionDetailModal.tsx` calcula `maxTime` como el valor exacto de la respuesta más lenta, sin margen superior. Cuando una sesión registra una latencia alta (por ejemplo `8800ms`), el punto más lento se dibuja exactamente sobre la línea superior de la rejilla (`yTop = 15`), los marcadores de re-escucha post-error (`👂 xN`, dibujados en `y = p.y - 12`) quedan al ras del borde superior (`y ≈ 3`) y la etiqueta del eje superior muestra decimales irregulares (`8.8s`) en lugar de una escala graduada limpia. Esto degrada la legibilidad del panel de diagnóstico y hace que los marcadores se solapen con el borde del gráfico.

## What Changes

- **Headroom del 15% + redondeo a escala limpia en `maxTime`**: el cálculo de `maxTime` en `SessionDetailModal.tsx` pasa de `Math.max(3500, ...questions.map(q => q.responseTimeMs))` a una fórmula que garantiza un margen superior de seguridad y un valor redondeado a múltiplos limpios de `500ms`:
  - `const minBaseline = Math.max(3500, Math.ceil((thresholds.FAST_MAX_MS * 1.4) / 500) * 500)`
  - `const maxResponse = Math.max(...questions.map((q) => q.responseTimeMs), 0)`
  - `const targetTime = Math.max(minBaseline, maxResponse * 1.15)`
  - `const maxTime = Math.ceil(targetTime / 500) * 500`
- **Comportamiento resultante**: en Nota Individual e Intervalos rápidos conserva la base mínima limpia de `3.5s`; en Secuencias o sesiones con latencias altas (p. ej. `8800ms`) escala a un valor limpio (p. ej. `10.5s` / `11.0s`), permitiendo que el punto más alto se ubique a ~80% de la altura y que los marcadores `👂 xN` respiren con holgura por debajo de `yTop`.
- **Prueba de regresión TDD**: nueva prueba en `SessionDetailModal.test.tsx` que renderiza el modal con una respuesta de `8800ms` y verifica que la etiqueta superior del eje Y muestra un valor con margen (p. ej. `10.5s` / `11.0s`) y que la posición Y del punto más lento no colisiona con `yTop` (`p.y > 25px`).
- **Sin cambios de contrato de dominio**: no se modifican umbrales, cálculo de CPI ni ninguna estructura de datos. Es un refinamiento ergonómico de renderizado SVG.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Este cambio es un refinamiento ergonómico de renderizado del gráfico SVG dentro del modal de detalle de sesión. No altera requisitos de comportamiento observable a nivel de spec, ni contratos de dominio, ni umbrales psicométricos; por lo tanto declara `skip_specs: true`.

## Impact

- **Affected code**:
  - `src/renderer/src/components/views/analytics/SessionDetailModal.tsx` (cálculo de `maxTime`).
  - `src/renderer/src/components/views/analytics/SessionDetailModal.test.tsx` (nueva prueba de regresión de headroom y escala).
- **APIs / dependencies**: sin cambios de API pública. No se añaden dependencias; el cálculo usa únicamente `Math` y los `thresholds` ya presentes en el componente.
- **Systems**: únicamente el proceso renderer de Electron. Sin cambios en proceso main, preload, persistencia/MIDI ni en las 7 specs canónicas bajo `openspec/specs/`.
- **Riesgo**: el eje Y ahora se recalcula con un valor mayor; la línea de umbral `FAST_MAX_MS` y las bandas de zona siguen dependiendo de `getY()`, por lo que deben conservar su posición proporcional. La equivalencia visual está cubierta por la prueba añadida.
- **Nota al pie — canonicalización Tailwind v4 (fuera del alcance funcional)**: por una instrucción separada del usuario, en `SessionDetailModal.tsx` se canonicalizaron tres clases utilitarias de Tailwind v4: `z-[9999]` → `z-9999` (líneas 136 y 185) y `w-[260px]` → `w-65` (línea 582). `w-65` equivale a `calc(0.25rem × 65) = 16.25rem = 260px`, por lo que el comportamiento visual es idéntico; `z-9999` mapea a `z-index: 9999`. Es limpieza de estilos sin impacto en el cálculo de `maxTime` ni en este cambio.
