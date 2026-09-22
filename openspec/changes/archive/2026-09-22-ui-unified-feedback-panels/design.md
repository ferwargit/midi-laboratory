## Context

Cuatro paneles de feedback (`FeedbackPanel`, `IntervalFeedbackPanel`, `SequenceFeedbackPanel`, `RepertoireFeedbackPanel`) comparten un contenedor `h-28` fijo pero con variaciones:

- `FeedbackPanel`: `rounded-2xl p-4 bg-zinc-950/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)]`
- `IntervalFeedbackPanel`: `rounded-xl p-3.5 bg-zinc-950/90 border border-zinc-800 shadow-inner`
- `SequenceFeedbackPanel`: `rounded-lg p-3 bg-zinc-950/90 border border-zinc-800`
- `RepertoireFeedbackPanel`: `rounded-2xl p-3.5 bg-zinc-950/90 border border-zinc-800 shadow-2xl backdrop-blur-xl`

Esto produce CLS al transitar entre `isWaitingAnswer` y `lastResult`. El design system (AGENTS.md) exige:

- Base: `bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 shadow-inner`
- Tabular numerics obligatorio para valores dinámicos.
- Estados de acierto/desvío con paleta cian/esmeralda/ámbar/carmesí.
- Botones usando `Button` con variantes `primary` / `secondary`.

## Goals / Non-Goals

**Goals:**

- Unificar contenedor OLED con `min-h-[112px]` (equivalente a `h-28` pero estable) para CLS = 0.
- Estandarizar fichas de comparación con colores de diseño y `tabular-nums`.
- Usar `Button` modernizado para acciones (avance manual, repetir).
- Mantener 100% compatibilidad de props públicas.

**Non-Goals:**

- Cambiar tipos de props, nombres de eventos o semántica de evaluación.
- Modificar lógica de negocio (`ExerciseResult`, `IntervalExerciseResult`, etc.).
- Añadir animaciones complejas más allá de las transiciones Tailwind existentes.

## Decisions

### 1. Clase contenedor unificada

**Decisión:** Usar `min-h-[112px] w-full bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between relative overflow-hidden select-none shadow-inner` en los 4 paneles.
**Rationale:** `min-h` garantiza altura reservada aunque el contenido cambie; `shadow-inner` da la profundidad OLED; `slate-950/90` + `slate-800/80` coincide con el panel base del design system. Alternativa considerada: `h-28` fijo → rechazada por CLS en estados vacíos.

### 2. Fichas de comparación (Comparison Chips)

**Decisión:** Componente interno `ComparisonChip` compartido (inline o micro-componente) con tres variantes visuales:

- `expected`: `border-cyan-500/30 bg-cyan-950/20 text-cyan-300 font-mono tabular-nums`
- `correct`: `border-emerald-500/30 bg-emerald-950/20 text-emerald-300 font-mono tabular-nums`
- `deviation`: `border-amber-500/30 bg-amber-950/20 text-amber-300 font-mono tabular-nums` (error → carmesí para desviación grave).
  **Rationale:** Evita duplicación de clases; centraliza paleta; `tabular-nums` evita jitter horizontal en MIDI note numbers.

### 3. Botones de acción

**Decisión:**

- Avance manual (`onAdvanceNext`): `Button variant="primary" size="sm"` + `<Play />` icon.
- Repetir (`onRepeatSlice` solo en Repertoire): `Button variant="secondary" size="sm"` + `<RotateCcw />` icon.
- Estado "avanzando automáticamente": mantener `<SkipForward />` + texto muted.
  **Rationale:** Reutiliza `Button` ya auditado; `primary` (cian) para acción principal, `secondary` (slate) para acción auxiliar.

### 4. Estados por panel

- **FeedbackPanel (Nota Individual):** Fichas `Esperada` (cian) vs `Tocaste` (esmeralda/ámbar-carmesí según acierto/desvío).
- **IntervalFeedbackPanel:** Ficha `Intervalo Esperado` (cian) vs `Tocaste` (esmeralda/rojo según corrección). Mantener `direction` badge cian.
- **SequenceFeedbackPanel:** Grid horizontal de fichas por nota; cada ficha usa `ComparisonChip` con variante `correct`/`deviation`; indicador de contorno melódico (badge cian si `isContourCorrect`).
- **RepertoireFeedbackPanel:** Fila de métricas (`Afinación`, `Ritmo`) con `tabular-nums`; badge streak ámbar; botón repetir (secondary) + botón avance (primary).

### 6. Subcomponent Private Optimization

**Decisión:** Mantener `StreakProgressBars` como subcomponente privado y memoizado dentro de `RepertoireFeedbackPanel.tsx` mediante `React.memo`.
**Rationale:** Maximiza la cohesión local y evita la proliferación innecesaria de archivos para un componente de consumo único. El rendimiento se mantiene óptimo gracias a `React.memo` que previene re-renders innecesarios cuando las props `currentStreak` y `streakTarget` no cambian.

### 5. Testing strategy

**Decisión:** Ampliar `s4-ux-feedback.test.tsx` con 4 suites (una por panel) verificando:

- Render de contenedor con clase unificada (`bg-slate-950/90 border-slate-800/80 rounded-xl p-4 shadow-inner`).
- Presencia de fichas `expected`/`correct`/`deviation` con clases de color correctas.
- Botones `primary`/`secondary` con iconos correctos en estados `isWaitingManualAdvance`.
- Sin regresiones en tests existentes.

## Risks / Trade-offs

| Risk                                                         | Mitigation                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Cambio visual rompe snapshots visuales no automatizados      | Solo tests unitarios (RTL); no hay visual regression tests. Validación manual opcional.                          |
| `min-h-[112px]` deja espacio extra en pantallas muy pequeñas | `p-4` ya da padding; `min-h` solo actúa como floor. Mobile usa `md:` breakpoints en textos.                      |
| Duplicación de `ComparisonChip` inline vs extraído           | Inline en cada panel por simplicidad; si crece, extraer a `src/components/trainer/ComparisonChip.tsx` en futuro. |
| `RepertoireFeedbackPanel` tiene `onRepeatSlice` único        | Se mantiene; botón `secondary` solo aparece en ese panel.                                                        |
