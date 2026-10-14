# Design

## Context

El motor psicométrico actual en `psychometrics.ts` usa valores fijos `15.0 RPM` y `1.5s` (línea base de Nota Individual) para todos los modos. Los umbrales de latencia por modalidad ya existen en `thresholds.ts` (`COGNITIVE_LATENCY_THRESHOLDS_BY_MODE`), y `historyAnalytics.ts` / `SessionDetailModal.tsx` ya resuelven el `sessionMode` usando `targetMode` + clasificadores. El cambio conecta estos dos mundos: usa la configuración por modalidad como línea base CPI.

## Goals / Non-Goals

**Goals:**
- Definir `CPI_CONFIG_BY_MODE` con `targetLatencySec` y `targetRpm` por modalidad.
- Modificar `calculateSessionCPI` para aceptar `mode?: string` y usar `CPI_CONFIG_BY_MODE[mode]`.
- Propagar `sessionMode` en `historyAnalytics.ts` y `SessionDetailModal.tsx`.
- Mantener retrocompatibilidad total: `mode` es opcional y defaultea a `'single_note'`.
- Añadir tests TDD que validen retrocompatibilidad y la corrección matemática.

**Non-Goals:**
- Cambiar los umbrales de latencia cognitiva (`COGNITIVE_LATENCY_THRESHOLDS_BY_MODE`) — son un SSOT separado.
- Modificar la fórmula de entropía, normalización IRT o `inputFactor`.
- Tocar persistencia, audio MIDI, o capas de UI distintas a la invocación de CPI.

## Decisions

1. **Estructura de `CPI_CONFIG_BY_MODE`** — Objeto con keys `ModalityKey | 'global'` y valores `{ targetLatencySec: number, targetRpm: number }`. Reutiliza `ModalityKey` existente (`'single_note' | 'intervals' | 'sequences' | 'repertoire'`). Añade `'global'` como alias de `single_note` por claridad semántica.

2. **Valores objetivo (target)** — Derivados de la línea base refleja de cada modalidad (audio + acción física), no de los umbrales cognitivos:
   - `single_note`: 1.5s / 15.0 RPM (base actual)
   - `intervals`: 2.4s / 10.0 RPM (audio ~1.2s + 2 teclas físicas → ~2.1s realista; margen +15%)
   - `sequences`: 3.5s / 7.0 RPM (audio variable + N teclas; alineado con `FAST_MAX_MS: 3500`)
   - `repertoire`: 2.5s / 8.0 RPM (partitura completa; alineado con `FAST_MAX_MS: 2500`)
   - `global`: 1.5s / 15.0 RPM (alias de `single_note`)

3. **Resolución del modo en `calculateSessionCPI`** — `const resolvedMode = (mode || 'single_note').trim().toLowerCase() as keyof typeof CPI_CONFIG_BY_MODE; const config = CPI_CONFIG_BY_MODE[resolvedMode] ?? CPI_CONFIG_BY_MODE.single_note;`. Case-insensitive, inmune a espacios, fallback seguro.

4. **Propagación del `sessionMode`** — En `historyAnalytics.ts` (línea ~148) y `SessionDetailModal.tsx` (línea ~97), ya se computa `sessionMode` con la misma lógica. Se pasa directamente como 6º argumento a `calculateSessionCPI`.

5. **Tests TDD** — En `historyAnalytics.test.ts`, nuevo `describe('calculateSessionCPI - Escalado por Modalidad')`:
   - Test 1: `mode: 'single_note'` / sin argumento → resultado idéntico a valores históricos (retrocompatibilidad exacta).
   - Test 2: `mode: 'intervals'`, 2100ms, 15.3 RPM, 90% normAcc, entropy 2.0, hardware → CPI > 800 (elimina penalización).

## Risks / Trade-offs

- **[Risk] Valores objetivo no calibrados empíricamente** → Mitigación: los valores propuestos son conservadores (alineados con `FAST_MAX_MS` existente + margen). Iterar en producción tras observación real.
- **[Risk] Sesiones históricas sin `targetMode`** → Mitigación: el fallback a clasificadores (`isIntervalSession`, etc.) ya existe y se usa en ambos call sites; el modo resuelto será consistente.
- **[Risk] Cambio en firma de `calculateSessionCPI`** → Mitigación: parámetro opcional al final, default explícito; zero breaking changes en callers existentes.
- **[Trade-off] `global` vs `single_note`** — Se mantiene `global` como alias explícito para uso futuro (p.ej. agregados multi-modalidad), aunque hoy no se usa.