## 1. Modernizar FeedbackPanel (Nota Individual)

- [x] 1.1 Reemplazar contenedor por `min-h-[112px] w-full bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between relative overflow-hidden select-none shadow-inner` y verificar que la clase unificada está presente en el contenedor raíz.
- [x] 1.2 Unificar fichas de comparación: ficha `Esperada` con `border-cyan-500/30 bg-cyan-950/20 text-cyan-300 font-mono tabular-nums`; ficha `Tocaste` con `border-emerald-500/30 bg-emerald-950/20 text-emerald-300` si acierto, o `border-amber-500/30 bg-amber-950/20 text-amber-300` si desvío.
- [x] 1.3 Reemplazar botón de avance manual por `Button variant="primary" size="sm"` con `<Play />` y verificar que el texto `Siguiente Pregunta ➔` y el badge `Espacio` siguen visibles.
- [x] 1.4 Verificar que `FeedbackPanelProps` no cambia (props públicas inmutables).

## 2. Modernizar IntervalFeedbackPanel (Intervalos)

- [x] 2.1 Aplicar contenedor unificado OLED (`min-h-[112px] ... shadow-inner`) y verificar que el contenedor raíz tiene la clase correcta.
- [x] 2.2 Unificar fichas: `Intervalo Esperado` (cian) y `Tocaste` (esmeralda si `isIntervalCorrect`, ámbar/carmesí si error), con `tabular-nums`.
- [x] 2.3 Mantener badge de dirección (`Ascendente`/`Descendente`) con color cian y verificar su presencia en estado de espera.
- [x] 2.4 Reemplazar botón de avance manual por `Button variant="primary" size="sm"` con `<Play />` y verificar texto `Siguiente Intervalo ➔`.

## 3. Modernizar SequenceFeedbackPanel (Secuencias)

- [x] 3.1 Aplicar contenedor unificado OLED y verificar clase en contenedor raíz.
- [x] 3.2 Renderizar fichas de notas alineadas horizontalmente usando `ComparisonChip` (correcto=esmeralda, error=ámbar/carmesí) por cada elemento de `noteByNoteEvaluation`.
- [x] 3.3 Añadir badge de contorno melódico (cian) cuando `isContourCorrect` sea true y verificar su presencia.
- [x] 3.4 Reemplazar botón de avance manual por `Button variant="primary" size="sm"` con `<Play />` y verificar texto `Siguiente ➔ (Espacio)`.

## 4. Modernizar RepertoireFeedbackPanel (Repertorio)

- [x] 4.1 Aplicar contenedor unificado OLED y verificar clase en contenedor raíz.
- [x] 4.2 Renderizar badge de streak (`currentStreak / streakTarget`) en ámbar y barras de progreso de streak de 1x a 10x.
- [x] 4.3 Unificar fichas de métricas (`Afinación`, `Ritmo`) con `tabular-nums` y colores esmeralda/cian según porcentaje.
- [x] 4.4 Botón de repetir (`onRepeatSlice`) usando `Button variant="secondary" size="sm"` con `<RotateCcw />` y verificar texto `Escuchar (R)` en estado de espera.
- [x] 4.5 Botón de avance manual usando `Button variant="primary" size="sm"` con `<Play />` y verificar texto `Siguiente Paso ➔ (Espacio)`.

## 5. Ampliar pruebas en s4-ux-feedback.test.tsx

- [x] 5.1 Añadir suite de pruebas para `IntervalFeedbackPanel` verificando fichas de intervalo y botón de avance manual.
- [x] 5.2 Añadir suite de pruebas para `SequenceFeedbackPanel` verificando fichas de notas por nota y badge de contorno.
- [x] 5.3 Añadir suite de pruebas para `RepertoireFeedbackPanel` verificando badge de streak, fichas de métricas y botones `secondary`/`primary`.
- [x] 5.4 Actualizar suite existente de `FeedbackPanel` para verificar clases unificadas (`bg-slate-950/90 border-slate-800/80 rounded-xl p-4 shadow-inner`) y fichas con paleta cian/esmeralda/ámbar.

## 6. Verificación global

- [x] 6.1 Ejecutar `npm run typecheck` y verificar cero errores de tipado.
- [x] 6.2 Ejecutar `npm run test` (vitest run) y verificar que todos los tests pasan limpios.
- [x] 6.3 Ejecutar `npm run lint` y verificar cero advertencias.
- [x] 6.4 Ejecutar `npx prettier --write` sobre los 4 paneles + archivo de pruebas y verificar que `npm run format` produce cero diffs.
- [x] 6.5 Validar con `openspec validate ui-unified-feedback-panels --strict` y verificar cero advertencias.
