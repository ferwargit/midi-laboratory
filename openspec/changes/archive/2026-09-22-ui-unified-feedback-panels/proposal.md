## Why

Los cuatro paneles de feedback del trainer (`FeedbackPanel`, `IntervalFeedbackPanel`, `SequenceFeedbackPanel`, `RepertoireFeedbackPanel`) comparten una estética inconsistente y altos valores de `h-28` fijos que varían entre `rounded-lg`, `rounded-2xl` y distintos niveles de opacidad/backdrop. Esto produce saltos de layout (CLS > 0) al transitar entre estados de espera y feedback con resultado, y rompe la identidad visual unified "Dark Studio DAW" del proyecto. La FASE 3.1 de Frontend busca estandarizar y modernizar estos paneles sin alterar su contrato público.

## What Changes

- Unificar el contenedor de los 4 paneles bajo la clase OLED hardware:
  `bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 shadow-inner` más una altura mínima estable (`min-h-*`) para garantizar CLS = 0 entre estados.
- Estandarizar la ficha de comparación (Estímulo Esperado / Respuesta Tocada) con la paleta del design system:
  - Esperado: borde sutil cian (`border-cyan-500/30 bg-cyan-950/20 text-cyan-300 font-mono tabular-nums`).
  - Acierto: esmeralda (`border-emerald-500/30 bg-emerald-950/20 text-emerald-300`).
  - Desvío/error: ámbar/carmesí (`border-amber-500/30 bg-amber-950/20 text-amber-300`).
- En `SequenceFeedbackPanel`: fichas de notas alineadas horizontalmente con indicadores visuales de acierto y contorno melódico.
- En `RepertoireFeedbackPanel`: barras de progreso de streak (1x a 10x) y porcentaje rítmico/altura con tipografía tabular.
- Integrar botones de avance manual (`<SkipForward />`) y repetición (`<RotateCcw />`) usando las variantes del `Button` modernizado (`variant="primary"` / `"secondary"`).
- Preservar al 100% las props públicas de cada panel (sin breaking changes).
- Actualizar/ampliar las pruebas en `s4-ux-feedback.test.tsx` verificando que los 4 paneles renderizan correctamente sus fichas y botones.

## Capabilities

### New Capabilities

- `feedback-panels-oled`: Estética y estructura unificada de paneles de feedback OLED del trainer.

### Modified Capabilities

- Ninguno (no hay spec-level behavior change; los paneles mantienen su contrato público y semántica de props). Se declara `skip_specs: true`.

## Impact

- **Archivos modificados:**
  - `src/renderer/src/components/trainer/FeedbackPanel.tsx`
  - `src/renderer/src/components/trainer/IntervalFeedbackPanel.tsx`
  - `src/renderer/src/components/trainer/SequenceFeedbackPanel.tsx`
  - `src/renderer/src/components/trainer/RepertoireFeedbackPanel.tsx`
- **Pruebas:** `src/renderer/src/components/trainer/s4-ux-feedback.test.tsx` (ampliación).
- **Dependencias:** `src/renderer/src/components/ui/Button.tsx` (ya modernizado; se reutiliza sin cambios).
- **Verificación:** `npm run typecheck`, `npm run test` (vitest run), `npm run lint`, `npx prettier --write`.
- **Riesgo:** Bajo. Cambio puramente visual/estético con props públicas inmutables.
