# Tasks

## 1. Tests de Consistencia SSOT (TDD — Red)

- [x] 1.1 En `src/renderer/src/domain/analytics/thresholdsConsistency.test.tsx`, añadir test que valide que `getConcept('cognitive_latency')?.formulaOrCalculation` contiene exactamente las etiquetas `FAST_LABEL` y `MEDIUM_LABEL` de `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` para las 4 modalidades (`single_note`, `intervals`, `sequences`, `repertoire`), derivadas dinámicamente de la SSOT (sin literales duplicados). Verificar: el test falla (Red) con `npx vitest run src/renderer/src/domain/analytics/thresholdsConsistency.test.tsx`.
- [x] 1.2 Añadir test que valide que `generateDiagnosticReport` con métricas `modeFilter: 'intervals'` interpola dinámicamente `getLatencyThresholds('intervals').FAST_LABEL` en `cognitiveLatencyAnalysis` y no contiene la etiqueta de `single_note`. Verificar: el test falla (Red).
- [x] 1.3 Añadir test de propagación: mutar temporalmente un `FAST_LABEL` de `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` (con restauración en `afterEach`) y verificar que el texto del diccionario y del informe contienen la etiqueta mutada. Verificar: el test falla (Red) antes de la implementación.

## 2. Diccionario Pedagógico (pedagogicalDictionary.ts)

- [x] 2.1 Sustituir el import de `COGNITIVE_LATENCY_THRESHOLDS` por `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` desde `./thresholds` en `src/renderer/src/domain/analytics/pedagogicalDictionary.ts`. Verificar: `npm run typecheck` sin errores de import.
- [x] 2.2 Reconstruir `cognitive_latency.formulaOrCalculation` interpolando dinámicamente `${COGNITIVE_LATENCY_THRESHOLDS_BY_MODE[mode].FAST_LABEL}` y `${COGNITIVE_LATENCY_THRESHOLDS_BY_MODE[mode].MEDIUM_LABEL}` para las 4 modalidades, citando el fundamento psicométrico (Donders/Sternberg: descuento del tiempo de emisión acústica y ejecución motora secuencial). CERO literales de tiempo. Verificar: test 1.1 en Green.
- [x] 2.3 Reconstruir `cognitive_latency.practicalTakeaway` explicando que una latencia en torno a los umbrales calibrados de la SSOT (p. ej. `MEDIUM_MAX_MS` de `intervals` o de `sequences`) es velocidad de reflejo automático, interpolando las etiquetas sin fijar valores. Verificar: test 1.3 (parte diccionario) en Green.
- [x] 2.4 Actualizar `pedagogicalDictionary.test.ts`: sustituir la aserción literal `toContain('< 1.4s')` por aserciones dinámicas contra `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE`. Verificar: `npx vitest run src/renderer/src/domain/analytics/pedagogicalDictionary.test.ts` en verde.

## 3. Generador de Informes (diagnosticReportGenerator.ts)

- [x] 3.1 Sustituir el import de `COGNITIVE_LATENCY_THRESHOLDS` por `getLatencyThresholds` desde `./thresholds` en `src/renderer/src/domain/analytics/diagnosticReportGenerator.ts`. Verificar: `npm run typecheck` sin errores.
- [x] 3.2 En `generateDiagnosticReport`, resolver `const thresholds = getLatencyThresholds(metrics.modeFilter)` y reescribir `cognitiveLatencyAnalysis` interpolando exclusivamente `${thresholds.FAST_LABEL}` / `${thresholds.MEDIUM_LABEL}` / `${thresholds.SLOW_LABEL}`; prohibido cualquier literal rígido como `< 1.4s`. Verificar: tests 1.2 y 1.3 (parte informe) en Green.
- [x] 3.3 Verificar que no quedan literales de tiempo de latencia en el archivo (búsqueda de `1.4s`, `2.4s`, `2.8s`, `3.5s`, `5.0s` como cadenas). Verificar: `Select-String` sobre el archivo sin coincidencias de etiquetas de tiempo.

## 4. Guía Psicoacústica (LatencySpectrumDiagram.tsx)

- [x] 4.1 Sustituir el import de `COGNITIVE_LATENCY_THRESHOLDS` (vía `historyAnalytics`) por `COGNITIVE_LATENCY_THRESHOLDS_BY_MODE` y `getLatencyThresholds` desde `../../../domain/analytics/thresholds`. Verificar: `npm run typecheck` sin errores.
- [x] 4.2 Añadir selector interactivo de modalidad (`useState<ModalityKey>('single_note')` + botones para las 4 modalidades) y resolver `const thresholds = getLatencyThresholds(mode)` para el render. Verificar: el diagrama cambia de escala al seleccionar cada modalidad (inspección del render en test o manual).
- [x] 4.3 Calcular las marcas de tiempo dinámicamente: `(thresholds.FAST_MAX_MS / 1000).toFixed(1) + 's'` y `(thresholds.MEDIUM_MAX_MS / 1000).toFixed(1) + 's'`, y sustituir el literal `5.0s+` por el `SLOW_LABEL` de la modalidad activa. Verificar: sin literales de tiempo en el componente (`Select-String`).
- [x] 4.4 Añadir test de render que valide que el diagrama muestra las etiquetas y marcas de la modalidad seleccionada (p. ej. seleccionar `intervals` renderiza `getLatencyThresholds('intervals').FAST_LABEL`). Verificar: test en verde.

## 5. Verificación Integral

- [x] 5.1 Ejecutar `npm run typecheck` y confirmar cero errores.
- [x] 5.2 Ejecutar `npm run test` y confirmar que los 629+ tests pasan limpios (incluye `knowledgeGuide.test.ts` y cualquier test de UI que consuma los textos sincronizados).
- [x] 5.3 Confirmar que `thresholds.ts` no fue modificado (`git diff src/renderer/src/domain/analytics/thresholds.ts` vacío) y que la SSOT sigue siendo la única fuente de literales de tiempo.
