# Design

## Context

El componente `SessionDetailModal` (`src/renderer/src/components/views/analytics/SessionDetailModal.tsx`) renderiza en su cabecera un badge "Score CPI" que actualmente calcula el valor con una fórmula local divergente (línea 155):

```tsx
{analysis.session.correctAnswers * 12 + analysis.totalQuestions * 2}
```

Esta fórmula NO corresponde al `calculateSessionCPI` de `psychometrics.ts`, que es la función canónica SSOT definida en la especificación 05 (`05-analytics-psychometrics`, Requirement: Índice de Rendimiento Cognitivo (CPI)). La tabla `SessionsTableTab` consume `item.cpiScore` de `DetailedSessionAnalysis`, que sí usa `calculateSessionCPI` con los parámetros canónicos correctos (vía `computeAnalyticsMetrics` en `historyAnalytics.ts`).

### Diagnóstico exacto de la discrepancia 1123 vs 816

Para la sesión de ejemplo ('Nivel 2 (C a G)', 60 preguntas, 180s, 97% precisión, Roland FP-8):

**Tabla (correcto):** `calculateSessionCPI` con parámetros canónicos:
- `normalizedAccuracy`: IRT sobre poolSize=5 (Nivel 2 = C a G = 5 notas). `c = 1/5 = 0.2`. `rawAcc = 0.97`. `normAcc = ((0.97 - 0.2) / (1 - 0.2)) * 100 = 96.25 ≈ 96`.
- `entropyBits = log2(5) = 2.32`.
- `responsesPerMinute = (60 / 180) * 60 = 20.0`.
- `avgResponseTimeMs`: tomado de `session.avgResponseTimeMs`.
- `inputMethod = 'hardware'` (Roland FP-8 → todas las respuestas son `midi_hardware`).
- `entropyFactor = max(0.5, 2.32 / 3.0) = 0.773`.
- `latencySec = max(0.6, avgResponseTimeMs / 1000)`.
- `speedFactor = clamp((20.0 / 15.0) * (1.5 / latencySec), 0.3, 2.5)`.
- `inputFactor = 1.0` (hardware).
- Resultado: **1123** (confirmado en producción).

**Modal (incorrecto):** fórmula local `correctAnswers * 12 + totalQuestions * 2`:
- `correctAnswers ≈ 58` (97% de 60).
- `totalQuestions = 60`.
- `58 * 12 + 60 * 2 = 696 + 120 = 816`.
- Resultado: **816** (confirmado en producción).

**Causa raíz:** `SessionDetailModal.tsx` usa una fórmula ad-hoc (`correctAnswers * 12 + totalQuestions * 2`) que:
1. NO aplica la corrección por azar (IRT) → no descuenta el azar.
2. NO aplica el factor de entropía → no pondera la dificultad del pool.
3. NO aplica el factor de velocidad/latencia → no distingue cadencia ni latencia.
4. NO aplica el factor de método de entrada → no diferencia hardware de virtual.
5. Usa `correctAnswers * 12` (un factor arbitrario) en lugar de `normalizedAccuracy * 10` de la fórmula canónica.

## Goals / Non-Goals

**Goals:**
- Que el badge "Score CPI" de `SessionDetailModal` muestre exactamente el mismo valor que la tabla `SessionsTableTab` para la misma sesión.
- Eliminar la fórmula local divergente y consumir `calculateSessionCPI` con los parámetros canónicos correctos.
- Garantizar que ambos consumidores (tabla y modal) lean de la misma SSOT (`calculateSessionCPI` de `psychometrics.ts`).
- Añadir una prueba unitaria que verifique la coherencia y evite regresiones.

**Non-Goals:**
- No modificar la función `calculateSessionCPI` ni sus parámetros canónicos (ya están definidos en la SSOT).
- No modificar la tabla `SessionsTableTab` (ya usa la SSOT correctamente).
- No modificar el formato de visualización del badge (sigue siendo texto plano con emoji de maestría).
- No refactorizar la arquitectura general del modal (la estructura actual es válida).
- No cambiar la interfaz pública del componente (`SessionDetailModalProps`).

## Decisions

### Decisión 1: ¿Consumir `calculateSessionCPI` directamente o consumir `cpiScore` de `DetailedSessionAnalysis`?

**Opción A (escogida):** Calcular `calculateSessionCPI` dentro de `SessionDetailModal` con los parámetros canónicos derivados de `session` y `sessionAnswers`.

**Opción B (rechazada):** Pasar `cpiScore` de `DetailedSessionAnalysis` como prop al modal.

**Razonamiento:**
- La Opción A preserva la autosuficiencia del componente `SessionDetailModal`: recibe `session: DbSessionRecord | null` y `answers: DbAnswerRecord[]` y puede calcular todo lo que necesita internamente sin acoplarse al flujo de `computeAnalyticsMetrics`.
- La Opción B exigiría modificar la interfaz del componente (agregar un prop `cpiScore`) y además acoplarlo al `DetailedSessionAnalysis`, lo cual duplicaría información ya disponible en `session` y `answers`.
- La Opción A es más coherente con el patrón actual: el modal ya calcula `analysis` (timeline) y `notePerformances` internamente; agregar el CPI calculado internamente es consistente con esa arquitectura.

**Alternativa futura (no implementada):** Si se quisiera eliminar toda la duplicación, se podría añadir un prop opcional `cpiScore?: number` que, si está presente, el modal lo usaría directamente; si no, lo calcularía internamente. Esto se deja como mejora futura.

### Decisión 2: ¿Dónde calcular los parámetros canónicos dentro del modal?

**Opción A (escogida):** Calcularlos en un `useMemo` separado (`cpiParams`) que dependa de `session` y `sessionAnswers`.

**Opción B (rechazada):** Calcularlos inline en el JSX.

**Razonamiento:**
- El cálculo de `poolSize`, `normalizedAccuracy`, `entropyBits`, `responsesPerMinute` e `inputMethod` es relativamente costoso (requiere iterar `sessionAnswers` y resolver regex). Calcularlo inline en cada render sería ineficiente.
- Un `useMemo` dedicado permite cachear el resultado y evitar recálculos innecesarios.
- El `useMemo` ya existe para `sessionAnswers` y `analysis`; agregar otro para `cpiParams` es consistente.

### Decisión 3: ¿Usar `resolveNominalPoolSize` o calcular el poolSize manualmente?

**Opción A (escogida):** Importar y usar `resolveNominalPoolSize` de `sessionClassification.ts`.

**Opción B (rechazada):** Calcular el poolSize manualmente en el modal.

**Razonamiento:**
- `resolveNominalPoolSize` es la función SSOT para resolver el poolSize nominal de una sesión. Replicarla manualmente en el modal violaría el principio SSOT.
- La función ya está exportada desde `historyAnalytics.ts` (barrel export) y `sessionClassification.ts`.

### Decisión 4: ¿Usar `resolveSessionInputMethod` o inferir el inputMethod manualmente?

**Opción A (escogida):** Importar y usar `resolveSessionInputMethod` de `sessionClassification.ts`.

**Opción B (rechazado):** Inferir el inputMethod manualmente en el modal.

**Razonamiento:**
- `resolveSessionInputMethod` es la función SSOT para inferir el método de entrada de una sesión. Replicarla manualmente violaría el principio SSOT.
- La función ya está exportada desde `historyAnalytics.ts`.

### Decisión 5: ¿Cálculo del normalizedAccuracy?

**Opción A (escogida):** Replicar la fórmula IRT de `computeAnalyticsMetrics` dentro del `useMemo` de `cpiParams`.

**Opción B (rechazada):** Extraer la fórmula IRT a una función independiente y usarla en ambos lugares.

**Razonamiento:**
- La fórmula IRT es simple y está definida en la especificación 05. Replicarla en el modal es aceptable porque es una fórmula de un solo paso: `normAcc = ((rawAcc/100 - c) / (1 - c)) * 100`, donde `c = 1/poolSize`.
- Extraerla a una función independiente sería una mejora futura de refactorización que está fuera del alcance de este cambio.
- El riesgo de divergencia es bajo porque la fórmula es simple y está documentada en la especificación.

### Decisión 6: ¿Qué hacer con la fórmula actual del badge?

**Opción A (escogida):** Eliminarla completamente y reemplazarla por la llamada a `calculateSessionCPI`.

**Opción B (rechazada):** Mantenerla como fallback si `calculateSessionCPI` devuelve 0.

**Razonamiento:**
- La fórmula actual es incorrecta y debe ser eliminada, no mantenida como fallback.
- Si `calculateSessionCPI` devuelve 0 (por `normalizedAccuracy <= 0`), es el comportamiento correcto: una sesión con precisión <= azar no debe tener score CPI.
- Mantener una fórmula fallback incorrecta crearía confusión y mantendría el bug en casos edge.

### Decisión 7: ¿Cálculo del entropyBits?

**Opción A (escogida):** Calcular `Math.log2(poolSize)` con `Number(...toFixed(2))`.

**Opción B (rechazada):** Usar el `entropyBits` de `analysis` (timeline).

**Razonamiento:**
- El `entropyBits` no está disponible en el `SessionTimelineAnalysis` (el return de `analyzeSessionTimeline`). Solo está disponible en el `DetailedSessionAnalysis` (el return de `computeAnalyticsMetrics`).
- El cálculo es simple: `Math.log2(poolSize)` y debe hacerse en el `useMemo` de `cpiParams`.

### Decisión 8: ¿Cálculo del responsesPerMinute?

**Opción A (escogida):** Calcular `(session.totalQuestions / session.durationSeconds) * 60` con `Number(...toFixed(1))`.

**Opción B (rechazada):** Calcularlo a partir de `sessionAnswers` (conteo de preguntas / tiempo total de respuestas).

**Razonamiento:**
- La especificación 05 y `computeAnalyticsMetrics` usan `session.totalQuestions / session.durationSeconds * 60`, no el conteo de respuestas individuales.
- Usar la misma fórmula garantiza coherencia con la tabla.

## Risks / Trade-offs

### Riesgo 1: Duplicación de la fórmula IRT en el modal

**Riesgo:** La fórmula IRT (`normAcc = ((rawAcc - c) / (1 - c)) * 100`) está replicada en `computeAnalyticsMetrics` y ahora también en el `useMemo` de `cpiParams`. Si la fórmula cambia en el futuro, debe actualizarse en ambos lugares.

**Mitigación:**
- La fórmula está documentada en la especificación 05 (Requirement: Corrección por Azar) y es simple (una sola línea).
- La prueba unitaria que se añade verifica que el valor mostrado en el modal coincide con `calculateSessionCPI`, lo cual detectaría una divergencia.
- Mejora futura: extraer la fórmula IRT a una función independiente `calculateNormalizedAccuracy(rawAccuracy, poolSize)` en `psychometrics.ts` y usarla en ambos lugares.

### Riesgo 2: Importar funciones adicionales en el modal

**Riesgo:** El modal actualmente importa `analyzeSessionTimeline`, `computeNotePerformancesFromAnswers`, `reconstructSessionConfig` desde `historyAnalytics`. Agregar imports de `calculateSessionCPI`, `resolveNominalPoolSize`, `resolveSessionInputMethod` aumenta las dependencias del componente.

**Mitigación:**
- Todas las funciones están exportadas desde `historyAnalytics.ts` (barrel export), así que los imports son consistentes con el patrón actual.
- Las funciones son puras y no tienen efectos secundarios.
- El coste de las importaciones adicionales es despreciable (ya están en el bundle de la app).

### Riesgo 3: El poolSize podría variar entre la tabla y el modal

**Riesgo:** La tabla calcula `poolSize` con `resolveNominalPoolSize(session, uniqueExpected.size)` donde `uniqueExpected` es el conteo de notas únicas de `filteredAnswers`. El modal calculará `poolSize` con `resolveNominalPoolSize(session, uniqueExpected.size)` donde `uniqueExpected` es el conteo de notas únicas de `sessionAnswers`. Si las respuestas filtradas difieren, el poolSize podría variar.

**Mitigación:**
- La tabla filtra respuestas por `validSessionIds` (ids de las sesiones filtradas por `modeFilter`). El modal filtra respuestas por `a.sessionId === session.id`. Para una sesión individual, ambos conjuntos de respuestas deben ser idénticos (el modal solo muestra las respuestas de esa sesión específica).
- El `poolSize` nominal se resuelve primero por el `presetName` (regex), que es independiente del conteo empírico. Solo en el fallback final se usa `empiricalUniqueCount`, que debería ser el mismo.
- Si hubiera una discrepancia, la prueba unitaria la detectaría.

### Riesgo 4: El test de integridad depende de la estabilidad del valor de `calculateSessionCPI`

**Riesgo:** La prueba unitaria asertará que el badge muestra exactamente el valor devuelto por `calculateSessionCPI`. Si la función canónica cambia (por una mejora de algoritmo), la prueba deberá actualizarse.

**Mitigación:**
- Esto es deseado: la prueba debe mantener la coherencia entre el modal y la SSOT. Si la SSOT cambia, la prueba debe reflejar el nuevo valor esperado.
- El enfoque de la prueba es "el modal y la tabla deben mostrar el mismo valor", no "el valor debe ser exactamente X". Esto se logra comparando el valor mostrado en el badge con el valor devuelto por `calculateSessionCPI` con los mismos parámetros.

## Migration Plan

Este cambio no requiere migración de datos ni pasos de despliegue especiales:

1. **Implementación:** Modificar `SessionDetailModal.tsx` para calcular el CPI con los parámetros canónicos.
2. **Test:** Añadir la prueba unitaria en `SessionDetailModal.test.tsx`.
3. **Validación:** Ejecutar `npm run typecheck` y `npm run test` para verificar que los 600 tests pasan.
4. **Despliegue:** Normal. No hay cambios de schema, datos ni APIs.

### Rollback

Si el cambio introduce un bug, basta revertir el commit de `SessionDetailModal.tsx` y `SessionDetailModal.test.tsx`. No hay migraciones ni cambios persistentes.

## Open Questions

Ninguna. Todas las decisiones técnicas están resueltas en esta sección. El diagnóstico exacto de la discrepancia (816 vs 1123) está documentado en la sección Context, y las decisiones de implementación están justificadas en Decisions.