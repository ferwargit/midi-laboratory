# Proposal

## Why

En producción se detectó una discrepancia de cálculo del Score CPI entre la tabla de sesiones (`SessionsTableTab`) y el inspector de detalle (`SessionDetailModal`). Para una misma tabla de sesiones (ej. 'Nivel 2 (C a G)', 60 preguntas en 180s, 97% precisión, Roland FP-8), la tabla muestra 'SCORE CPI: 1123', pero al abrir `SessionDetailModal` el badge de cabecera muestra 'Score CPI: 816 pts'. Esto viola el principio de Single Source of Truth (SSOT) establecido en la especificación 05 (`05-analytics-psychometrics`), que exige que todo el sistema consuma la misma función canónica `calculateSessionCPI` de `psychometrics.ts` con los mismos parámetros canónicos.

## What Changes

- **Modify** `src/renderer/src/components/views/analytics/SessionDetailModal.tsx`:
  - Reemplazar la fórmula local divergente (`analysis.session.correctAnswers * 12 + analysis.totalQuestions * 2`) en la cabecera del modal por una llamada a `calculateSessionCPI` con los mismos parámetros canónicos utilizados en `computeAnalyticsMetrics` de `historyAnalytics.ts`.
  - Los parámetros canónicos a usar:
    - `normalizedAccuracy`: calculada con el mismo `poolSize` nominal (via `resolveNominalPoolSize`) y la misma fórmula IRT que la tabla.
    - `entropyBits`: `log2(poolSize)` con 2 decimales.
    - `responsesPerMinute`: `(session.totalQuestions / session.durationSeconds) * 60` (si `durationSeconds > 0`).
    - `avgResponseTimeMs`: `session.avgResponseTimeMs`.
    - `inputMethod`: inferido de `sessionAnswers` (verificando si todas las respuestas son `midi_hardware` → `'hardware'`, `virtual_ui` → `'virtual'`, o `'mixed'`).

- **Add Test** en `SessionDetailModal.test.tsx`:
  - Añadir una prueba que renderice el modal con una sesión y respuestas mockeadas (hardware MIDI) y aserte que el badge de cabecera 'Score CPI' muestra el valor exacto devuelto por `calculateSessionCPI` (sin discrepancia con la tabla).

- **No breaking changes**: la interfaz publica del componente no cambia; solo se corrige el cálculo interno del badge.

## Capabilities

### New Capabilities
- Ninguno. Este cambio no introduce nuevas capacidades.

### Modified Capabilities
- Ninguno a nivel de especificación. El cambio restaura el cumplimiento de la especificación existente `05-analytics-psychometrics` (Requirement: Índice de Rendimiento Cognitivo (CPI) y Requirement: Componentes de Analítica). No se modifica el comportamiento del sistema más allá de corregir un cálculo divergente en la UI.

## Impact

- **Archivos afectados**:
  - `src/renderer/src/components/views/analytics/SessionDetailModal.tsx` (corrección del cálculo del badge CPI).
  - `src/renderer/src/components/views/analytics/SessionDetailModal.test.tsx` (nueva prueba unitaria).
- **Dependencias**: `calculateSessionCPI` (de `psychometrics.ts` / `historyAnalytics.ts`), `resolveNominalPoolSize`, `resolveSessionInputMethod` (de `sessionClassification.ts`).
- **Riesgo**: Bajo. Es una corrección de consistencia de presentación que elimina una duplicación de lógica. No afecta a la tabla ni a otros consumidores de `calculateSessionCPI`.
- **Validación**: `openspec validate unify-session-cpi-calculation --strict` debe pasar. Los 600 tests existentes deben seguir pasando al 100%.