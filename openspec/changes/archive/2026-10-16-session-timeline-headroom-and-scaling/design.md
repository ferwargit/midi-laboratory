# Design

## Context

El gráfico SVG de la línea de tiempo vive en el render del componente `SessionDetailModal.tsx`, en un bloque IIFE que define `xStart`, `xEnd`, `yTop = 15`, `yBottom = 135` y `ySpan` (ver `proposal.md - Why`). El eje Y se normaliza con `getY(timeMs) = yBottom - (Math.min(maxTime, timeMs) / maxTime) * ySpan`, de modo que `y` depende por completo de `maxTime`.

Estado actual relevante (línea ~167):

```ts
const maxTime = Math.max(3500, ...questions.map((q) => q.responseTimeMs))
```

`thresholds` ya está disponible en el componente vía `useMemo(() => getLatencyThresholds(session?.targetMode), ...)`, con valores por modalidad: `intervals = 2400ms`, `sequences = 3500ms`, `repertoire = 2500ms`, `single_note = 1400ms` (fallback). La prueba existente `SessionDetailModal.test.tsx` ya cubre render, cierre con Escape, contención del tooltip, coherencia de CPI y umbrales de latencia por modalidad.

## Goals / Non-Goals

**Goals:**

- Garantizar un margen superior de seguridad (headroom) del 15% sobre la respuesta más lenta, de modo que el punto más alto nunca toque `yTop`.
- Redondear `maxTime` a una escala limpia (múltiplo de 500ms) para que la etiqueta superior muestre un valor graduado sin decimales irregulares.
- Dar holgura vertical a los marcadores `👂 xN` (dibujados en `y = p.y - 12`) por debajo de `yTop`.
- Preservar la base mínima de 3.5s en modalidades rápidas.

**Non-Goals:**

- No se modifican umbrales de latencia, cálculo de CPI, ni ninguna estructura de dominio.
- No se cambian `yTop`, `yBottom`, `xStart`, `xEnd` ni la geometría base del viewBox (`900x160`).
- No se rediseña el tooltip ni la lógica de bandas de zona (calentamiento/fatiga).

## Decisions

### Decisión 1: Fórmula de `maxTime` con headroom y redondeo a 500ms

```ts
const minBaseline = Math.max(3500, Math.ceil((thresholds.FAST_MAX_MS * 1.4) / 500) * 500)
const maxResponse = Math.max(...questions.map((q) => q.responseTimeMs), 0)
const targetTime = Math.max(minBaseline, maxResponse * 1.15)
const maxTime = Math.ceil(targetTime / 500) * 500
```

- **Racional del `minBaseline`**: `FAST_MAX_MS * 1.4` garantiza que la línea de umbral FAST quede holgadamente por debajo de `yTop` (se dibuja con `opacity 0.6`), y `Math.ceil(.../500)*500` mantiene la escala limpia. El `Math.max(3500, ...)` conserva la base mínima de 3.5s en modalidades rápidas (p. ej. `single_note`: `1400*1.4 = 1960` → `2000`, así que domina 3500).

- **Racional del `1.15` (headroom 15%)**: coloca la respuesta más lenta a ~80–87% de la altura útil (`yBottom - yTop = 120px`), dejando ~13–20% de margen para los marcadores `👂 xN` en `y = p.y - 12`.

- **Racional de `Math.max(..., 0)`**: evita que `Math.max()` sobre un array vacío devuelva `-Infinity`.

- **Redondeo final a 500ms**: produce etiquetas limpias. Con `8800ms`: `maxResponse * 1.15 = 10120` → `Math.ceil(10120/500)*500 = 10500` → etiqueta `10.5s`.

**Alternativas consideradas:**

- _Fijar `maxTime = maxResponse * 1.15` sin redondeo_: descartado: reintroduce decimales irregulares (`10.1s`, `9.2s`) en la etiqueta.
- _Redondear a 1000ms_: descartado por el enunciado (se prefiere 500ms para granularidad fina; 1000ms puede sobre-elevar demasiado el eje en latencias medias).
- _Añadir margen solo en el render de `getY` (padding)_: descartado: complica la normalización y desalinea la etiqueta superior del valor real del eje.

### Decisión 2: Prueba de regresión orientada al contrato observable

La nueva prueba renderiza el modal con una sesión cuya respuesta máxima es `8800ms` y verifica dos invariantes observables:

1. La etiqueta superior del eje Y (`text` en `x=5, y=yTop+3`) muestra `10.5s` (o el múltiplo limpio esperado).
2. La posición Y del punto más lento (`p.y`) es `> 25`, evidenciando que no colisiona con `yTop = 15` y que existe headroom.

Se asserta sobre el SVG renderizado (contrato de salida del render), no sobre detalles internos de la fórmula, cumpliendo la regla de AGENTS.md "No Tautological Tests". Para localizar los nodos de forma estable se añaden dos `data-testid` no invasivos (sin cambio de comportamiento observable):

- `data-testid="session-timeline-axis-top-label"` en el `text` de la etiqueta superior del eje Y (`x=5, y=yTop+3`), requerido por el invariante 1.
- `data-testid={`session-timeline-point-${p.idx}`}` en el `circle` principal de cada punto de la línea de tiempo; permite recolectar los `cy` renderizados y hallar el punto más lento para verificar el invariante 2.

Además de los dos invariantes anteriores, la suite añade dos pruebas que fijan las verificaciones de la sección 2 de `tasks.md`:

3. **Base mínima de 3.5s en modalidades rápidas**: renderiza una sesión con latencias `900–1300ms` sobre `single_note` (`FAST_MAX_MS = 1400`) y verifica que la etiqueta superior sigue siendo `3.5s`, confirmando que el headroom del 15% no infla el eje en rangos rápidos.
4. **Visibilidad de la línea `FAST_MAX_MS`**: con `maxTime = 10.5s`, verifica que la etiqueta del umbral (`< 1.4s`) se renderiza dentro del gráfico, confirmando que la condición `thresholds.FAST_MAX_MS <= maxTime` se cumple y la línea no queda oculta.

## Risks / Trade-offs

- **[El eje Y crece y comprime la señal visual]** → Mitigación: el headroom es solo del 15%; la distancia relativa entre puntos se preserva porque todos usan el mismo `maxTime` en `getY()`.
- **[La línea de umbral `FAST_MAX_MS` cambia de posición relativa]** → Mitigación: sigue calculándose con `getY(thresholds.FAST_MAX_MS)` y la condición `thresholds.FAST_MAX_MS <= maxTime`; el `minBaseline` garantiza que la condición se mantiene verdadera, evitando que la línea desaparezca.
- **[La prueba puede ser frágil ante cambios de viewBox]** → Mitigación: assertar el valor de etiqueta (`10.5s`) y un umbral de `y` (`> 25`), no una coordenada exacta.
- **[Regresión en sesiones rápidas]** → Mitigación: la prueba de umbrales por modalidad ya existente permanece y `minBaseline` conserva 3.5s.

## Migration Plan

No aplica migración de datos. El cambio es de render puro; el rollback consiste en revertir la fórmula de `maxTime` y eliminar la prueba añadida. No hay despliegue escalonado.
