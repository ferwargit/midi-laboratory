## Context

Modernización visual de controles de práctica bajo Dark Studio DAW. Los cuatro Views comparten decks de configuración y control de tempo. No hay cambio de comportamiento; se preservan callbacks onChange y handlers.

## Goals / Non-Goals

**Goals:**
- Aplicar estilo Dark Studio DAW a faders, LEDs, selectores y decks.
- Fader de tempo dual con micro-ajuste ±1 BPM y lectura tabular.
- LEDs de metrónomo con pulso y altura fija para CLS = 0.
- Conmutadores segmentados estilo rack con micro-interacción.
- Unificación de selectores y etiquetas de sección.

**Non-Goals:**
- No modificar lógica de trainers, store, cálculos BPM o tests.
- No introducir nuevas dependencias.
- No cambiar contratos de props o eventos.

## Decisions

**Estética de fader**
- Usar `accent-cyan-500` y `track bg-slate-800` para consistencia Dark Studio. Alternativa `emerald` descartada por reserva de éxito/mastery.
- Micro-botones compactos a izquierda/derecha del slider para acceso fino sin abrir modal.

**Lectura dual**
- `tabular-nums font-mono text-cyan-400 font-semibold` para evitar jitter. Formato `${bpm} BPM (~${ms}ms/negra)`.

**LEDs de metrónomo**
- Contenedor con altura reservada fija. Downbeat `bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.6)]`, débiles `bg-slate-400` / `bg-amber-400`. No animaciones costosas en render path.

**Conmutadores segmentados**
- Patrón pill con `active:scale-[0.98]` y estados activos cian/púrpura. Evita librería externa; usa Tailwind + estado local.

**Unificación de decks**
- `<select>` con clase base `bg-slate-900/90 border border-slate-700/60 rounded-lg text-slate-200 text-xs px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none`.
- Etiquetas `text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2`.
- Tarjetas de presets reutilizan Card.tsx para consistencia.

**Compatibilidad**
- Edits solo de JSX/ clases; no tocar lógica. Formateo con Prettier tras cambios.

## Risks / Trade-offs

**Regresión visual** → Mitigación: mantener pruebas existentes y typecheck; revisar snapshots manuales.
**CLS por LEDs** → Altura fija y contenedor reservado.
**Inconsistencia de clases** → Mitigación: clases base documentadas y aplicadas uniformemente.

## Migration Plan

- Aplicar cambios por vista, validar render y callbacks.
- `npx prettier --write` en archivos modificados.
- `npm run typecheck` y `npm run test` para validar 573 tests.
