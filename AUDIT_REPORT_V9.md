# Informe de Auditoría de Empaquetado ASAR, Dependencias y Calidad de Dominio — V9

**Fecha:** 18 de octubre de 2026
**Proyecto:** `midi-ear-trainer` (midi-laboratory)
**Numeración:** continúa desde F14 (Auditoría V8 — Rendimiento, Gestión de Recursos y React 19)

---

## 0. Alcance y Metodología

### Alcance

| Área | Archivos auditados |
|---|---|
| Dependencias | `package.json`, `package-lock.json`, `node_modules` (medición de tamaños) |
| Empaquetado | `electron-builder.yml`, `node_modules/app-builder-lib/out/fileMatcher.js` (verificación de comportamiento por defecto) |
| Configuración de build | `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `vitest.config.ts`, `eslint.config.mjs` |
| Dominio musical | `src/renderer/src/domain/music/` (9 módulos) y `src/renderer/src/domain/analytics/` (12 módulos) |
| Proceso principal | `src/main/index.ts`, `src/preload/index.ts` (contexto de empaquetado) |

**Exclusiones explícitas:** `node_modules/`, `.git/`, `out/`, `dist/` y assets binarios.

### Metodología

- **Análisis estático con REA** (`analyze_javascript_application` sobre `src/`): 199 archivos relevantes, 198 módulos JavaScript parseados, 164.568 nodos AST visitados, 2.504 hallazgos. Evidencia retenida: `ev_41e0cc1e67fb0e30b1ba98917c824d77c96749aa439505a85ed7129b8a6acd7b` (resumen proyectado: `ev_2071ad76…`).
- **Lectura directa de fuentes** de los 21 módulos de los dominios `music/` y `analytics/`.
- **Verificación de grafo de imports** por `grep` exhaustivo de consumidores (35 sitios del barrel `historyAnalytics`, consumidores de cada export del dominio musical).
- **Medición empírica de tamaños** en disco de `node_modules`, carpetas de trabajo y salida de build (`out/`).
- **Inspección del código fuente de electron-builder** (`app-builder-lib`) para verificar el comportamiento por defecto del patrón `files` (emparejamiento con `dot: true`, inclusión por defecto `**/*`, lista `excludedNames`).

---

## 1. Resumen Ejecutivo

| Área | Veredicto | Síntesis |
|---|---|---|
| **Empaquetado ASAR** | 🔴 Crítico | ~95 MB de peso muerto en el instalador: artefactos de trabajo (~58 MB) + dependencias ya bundleadas por Vite (~37,6 MB) |
| **Clasificación de dependencias** | 🟠 Deficiente | 4 paquetes mal clasificados en `dependencies` (tooling de build Tailwind + librerías de solo-renderer) |
| **Configuración de build** | 🟡 Funcional con deuda | Placeholders de release, configuración implícita excesiva, sin source maps de producción |
| **Dominio musical/analytics** | 🟢 Sólido | Sin dependencias circulares detectadas; 1 duplicación arquitectónica tripartita y 1 export deprecado aún en producción |

### Diagnóstico principal

El ASAR actual incluiría aproximadamente **95 MB de contenido no runtime**:

1. **~58 MB de artefactos de trabajo** empaquetados por omisión del patrón `files` (`.opencode/` 52,8 MB, `coverage/` 2,3 MB, `.codebase-memory/` 1,8 MB, `openspec/` 1,0 MB, `repomix-output.xml` 315 KB, informes MD de raíz ~80 KB).
2. **~37,6 MB de `node_modules` innecesarios**: `lucide-react` (33,6 MB, tree-shakeado a ~40 iconos en el bundle del renderer) y el stack Tailwind v4 (~4 MB, incluido el binario nativo `@tailwindcss/oxide-win32-x64-msvc` de 3,04 MB).

**Reducción potencial estimada: ~95 MB (≈60-70 % del ASAR).**

### Aspectos positivos verificados

- **Sin dependencias circulares** en el grafo `music/` ↔ `analytics/` ↔ `ai/` ↔ `adaptation/` (verificado import por import; los cruces entre dominios son imports de tipos, que se borran en compilación).
- **Sin source maps filtrados a producción**: 0 archivos `.map` en `out/` y sin `sourceMappingURL` en los bundles.
- **Seguridad del proceso principal**: `sandbox: true` + `contextIsolation: true` (`src/main/index.ts:60-61`), allowlist de permisos de sesión y guardia de navegación.
- **Tree-shaking de lucide-react funcional** en el bundle del renderer (~40 iconos instanciados en el chunk final).
- **Tests colocados** junto a cada módulo del dominio, con cobertura de regresión de auditorías anteriores (F-04, F-06/F-14, F-09, F-13 documentados en comentarios).

---

## 2. Hallazgos Detallados

### F15 — `electron-builder.yml` no excluye artefactos de trabajo: ~58 MB empaquetados en el ASAR

- **Severidad:** Alto
- **Archivo:** `electron-builder.yml:5-11`
- **Impacto:** peso del instalador/ASAR

**Evidencia:**

1. El bloque `files` contiene **solo patrones de negación** (`!**/.vscode/*`, `!src/*`, …). Verificado en `node_modules/app-builder-lib/out/fileMatcher.js:281-284`: cuando el matcher solo contiene patrones de ignorado, electron-builder antepone el patrón por defecto `**/*` como inclusión.
2. `fileMatcher.js:16` define `minimatchOptions = { dot: true }` → los directorios ocultos **sí** se emparejan. La lista `excludedNames` (`fileMatcher.js:17-20`) cubre `.git`, `.idea`, `.circleci`, `.nyc_output`, … pero **no** `.opencode`, `.engram`, `.codebase-memory`, `coverage` ni `openspec`. electron-builder no respeta `.gitignore`.
3. Tamaños medidos en disco:

| Artefacto | Tamaño |
|---|---|
| `.opencode/` | 52,77 MB |
| `coverage/` | 2,3 MB |
| `.codebase-memory/` | 1,79 MB |
| `openspec/` | 1,04 MB |
| `repomix-output.xml` | 315 KB |
| MDs de raíz (`AUDIT_REPORT_V8.md`, specs, etc.) | ~80 KB |

**Nota:** `package-lock.json` sí está excluido por defecto (verificado en `excludedNames`) y `src/**` queda correctamente fuera por `!src/*`.

---

### F16 — `lucide-react` en `dependencies`: ~33,6 MB duplicados en el ASAR

- **Severidad:** Alto
- **Archivo:** `package.json:29`
- **Impacto:** peso del ASAR

**Evidencia:**

1. `lucide-react@1.47.0` ocupa **33,6 MB** en `node_modules` (su `dist/` solo: 23,7 MB; el campo `files` del paquete incluye `dist` + `dynamic*`).
2. El renderer se **bundlea completamente con Vite** (`out/renderer/assets/index-*.js`, 1.240,9 KB, con ~40 iconos tree-shakeados — verificado por conteo de `createLucideIcon` en el chunk). En runtime el renderer carga desde `file://` y **nunca resuelve `node_modules`**.
3. electron-builder empaqueta las `dependencies` de producción en `node_modules` dentro del ASAR → los 33,6 MB viajan al instalador aunque el bundle ya contiene solo los iconos usados.

**Contexto:** `react`/`react-dom` ya están correctamente en `devDependencies` (bundleados por Vite); `lucide-react` y `zustand` (0,09 MB) merecen el mismo tratamiento.

---

### F17 — `@tailwindcss/vite` + `tailwindcss` en `dependencies`: tooling de build empaquetado (~4 MB)

- **Severidad:** Medio
- **Archivo:** `package.json:28,30`
- **Impacto:** peso del ASAR

**Evidencia:**

1. Tailwind v4 es un **plugin de Vite** (`electron.vite.config.ts:4,15`): el CSS se genera en build time (`out/renderer/assets/index-*.css`, 121,4 KB). En runtime no se importa nada de Tailwind.
2. Tamaños medidos: `tailwindcss` 0,74 MB + `@tailwindcss/vite` 0,01 MB + `@tailwindcss/oxide` 0,03 MB + `@tailwindcss/oxide-win32-x64-msvc` **3,04 MB** (binario nativo) + `@tailwindcss/node` 0,12 MB ≈ **3,94 MB**.
3. Al estar en `dependencies`, electron-builder los empaqueta (con `npmRebuild: false` ni siquiera los reconstruye — solo los copia).

**Clasificación correcta:** deben ser `devDependencies`.

---

### F18 — Placeholders de release engineering en `electron-builder.yml` e inconsistencia de `appId`

- **Severidad:** Medio
- **Archivos:** `electron-builder.yml:1,36,41-43`; `src/main/index.ts:110`
- **Impacto:** riesgo de release / identidad de aplicación

**Evidencia:**

| Línea | Contenido | Problema |
|---|---|---|
| `electron-builder.yml:1` | `appId: com.electron.app` | Placeholder del template |
| `electron-builder.yml:36` | `maintainer: electronjs.org` | Placeholder |
| `electron-builder.yml:41-43` | `publish: generic → https://example.com/auto-updates` | Placeholder; hoy inerte (main no usa `autoUpdater`), pero fallará en runtime si se activa |
| `src/main/index.ts:110` | `electronApp.setAppUserModelId('com.electron')` | **No coincide** con el `appId` declarado (afecta notificaciones/identidad de proceso en Windows) |

---

### F19 — Configuración de empaquetado subóptima: compresión por defecto y `asarUnpack` redundante

- **Severidad:** Bajo
- **Archivo:** `electron-builder.yml:12-13` (y ausencia de `compression`)
- **Impacto:** peso del instalador

**Evidencia:**

1. No se declara `compression:` → electron-builder usa `normal`. Para una app sin módulos nativos runtime (tras F17), `compression: maximum` reduce el instalador NSIS sin coste runtime.
2. `asarUnpack: resources/**` desempaqueta `resources/icon.png` (35,9 KB), pero `src/main/index.ts:4` lo importa vía `?asset` (electron-vite lo copia junto a `out/main`), por lo que la copia desempaquetada es duplicación redundante.
3. `files` no excluye `*.backup` (hoy inocuo porque `!src/*` los cubre, pero frágil si se mueven de sitio).

---

### F20 — `electron.vite.config.ts` con `main`/`preload` vacíos: sin source maps de producción y chunk único de 1,24 MB

- **Severidad:** Bajo
- **Archivo:** `electron.vite.config.ts:7-16`
- **Impacto:** diagnóstico en producción / arranque

**Evidencia:**

1. `main: {}` y `preload: {}` delegan todo en defaults de electron-vite (externalización de `dependencies` — correcta y necesaria para `@electron-toolkit/*` — y minificación esbuild).
2. Verificado en `out/`: **0 archivos `.map`** y sin `sourceMappingURL` en `out/main/index.js` ni en el chunk del renderer → los stack traces de producción (crashes de main/preload) serán ilegibles.
3. El renderer produce **un único chunk de 1.240,9 KB** sin `manualChunks` ni code-splitting. Para carga desde disco local el impacto es menor que en web, pero el parseo inicial (con react-dom embebido) penaliza el arranque en máquinas modestas.

---

### F21 — Triplicación del conocimiento "nivel → pool de notas" acoplado a strings de `presetName`

- **Severidad:** Medio
- **Archivos:** `sessionClassification.ts:60-105`; `sessionFilters.ts:99-130`; `longitudinal.ts:28-60`
- **Impacto:** mantenibilidad / riesgo de regresión silenciosa

**Evidencia — tres copias independientes del mismo mapeo:**

1. `sessionClassification.ts:60-105` — `resolveNominalPoolSize`: heurísticas `name.includes('nivel 1.0')`, regex `/nivel\s*(\d+)/`, `'pentatónica'`, `'cromático'`…
2. `sessionFilters.ts:99-130` — bloque 4 del filtro: **reimplementa** las mismas heurísticas (`isLevel3`, `isLevel1`, `isPentatonic`, `isCustom`…) con lógica propia.
3. `longitudinal.ts:28-60` — `reconstructSessionConfig`: **tercera copia** del mapeo (`pName.includes('nivel 1')` → preset `level_1_c_d_e`, etc.).

**Análisis:** el SSOT real son los `name` de `presets.ts:10-47`, `intervals.ts:115-156` y `sequences.ts:13-59`, pero tres módulos codifican ese conocimiento como literales de string independientes. Renombrar un preset (p. ej. "Nivel 3 (Octava Diatónica C4-C5)") rompe la analítica **silenciosamente**. El propio `resolveNominalPoolSize` documenta colisiones históricas ("nivel 10" contiene "nivel 1" — corrección F-06/F-14, líneas 49-58), síntoma de la fragilidad estructural.

---

### F22 — Export deprecado `COGNITIVE_LATENCY_THRESHOLDS` aún consumido en producción con semántica desfasada

- **Severidad:** Medio
- **Archivos:** `thresholds.ts:56-57`; `latencyStats.ts:4,58`; `AnalyticsCharts.tsx:8,491-545`
- **Impacto:** corrección visual / deuda de deprecación

**Evidencia:**

1. `thresholds.ts:56-57` — el alias está marcado `@deprecated` ("Kept for backward compatibility").
2. Consumo activo en producción: `latencyStats.ts:4,58` y `AnalyticsCharts.tsx:8,491-545`.
3. El alias fija umbrales de `single_note` (FAST 1.400 ms / MEDIUM 2.800 ms), pero `AnalyticsCharts.tsx:491-545` los usa para dibujar líneas de reflejo y clasificar colores en gráficos de **todas** las modalidades, mientras el motor (`timelineTelemetry.ts:13`, `historyAnalytics.ts:122,196`) sí usa `getLatencyThresholds(sessionMode)` (intervals: 2.400/3.800; sequences: 3.500/5.000).

**Impacto:** incoherencia visual/motor: una respuesta de 3 s en secuencias es "deducción" para el motor pero se pinta como lenta en el gráfico.

---

### F23 — `computeAnalyticsMetrics`: complejidad ciclomática alta, cómputo O(S×A) y round-trip de strings

- **Severidad:** Medio
- **Archivo:** `historyAnalytics.ts:39-284`
- **Impacto:** mantenibilidad / degradación progresiva de la vista de analítica

**Evidencia:**

1. Función única de ~245 líneas con complejidad ciclomática estimada >20 (bucles anidados, ternarios encadenados, 3 bloques de agregación).
2. `historyAnalytics.ts:90` — `filteredAnswers.filter((a) => a.sessionId === session.id)` **dentro** de `.map()` sobre sesiones → O(S×A). Con historiales largos (miles de respuestas × cientos de sesiones) degrada linealmente. El patrón correcto ya existe en `sessionFilters.ts:50-58` (pre-agrupación por `Map`).
3. `historyAnalytics.ts:113-121` vs `187-195` — la resolución de `sessionMode` (ternario anidado con `isIntervalSession/isSequenceSession/isRepertoireSession`) está **duplicada** dentro de la misma función.
4. `historyAnalytics.ts:208-224` — el mapa de confusión serializa pares como `"${expName} ➔ ${playName}"` y luego hace `key.split(' ➔ ')` para reconstruir el objeto: round-trip frágil y costoso.

---

### F24 — Barrel `historyAnalytics` con 9 re-exports y consumo interno del propio barrel

- **Severidad:** Bajo
- **Archivos:** `historyAnalytics.ts:7-15`; `diagnosticReportGenerator.ts:1`; `pedagogicalDictionary.ts:120`
- **Impacto:** mantenibilidad / riesgo latente de ciclo

**Evidencia:**

1. `historyAnalytics.ts:7-15` — `export *` de 9 módulos; verificado por grep que **35 sitios** consumen exclusivamente el barrel (ningún archivo externo importa los submódulos directamente).
2. `diagnosticReportGenerator.ts:1` — importa `AnalyticsMetrics, MASTERY_THRESHOLDS, BIAS_DOMINANCE_RATIO` **desde el barrel** en lugar de `./types` y `./thresholds`. Hoy no hay ciclo (el barrel no re-exporta `diagnosticReportGenerator`), pero si alguien añade ese módulo al barrel se forma `historyAnalytics → diagnosticReportGenerator → historyAnalytics`. Fragilidad latente.
3. `pedagogicalDictionary.ts:120` — la fórmula CPI documentada está **hardcodeada** para `single_note` (`RPM/15.0 × 1.5s/…`) mientras `psychometrics.ts:20-28` es mode-aware (`CPI_CONFIG_BY_MODE`): drift documental garantizado al evolucionar la fórmula.
4. Sin colisiones de nombres entre los 9 módulos re-exportados (verificado export por export) — positivo hoy, riesgo latente con `export *` (los duplicados se descartan silenciosamente en ESM).

**Contexto:** el barrel fue una decisión documentada (comentario en líneas 4-6, "OLA 4.3, Decisión 1") para no tocar 35 sitios consumidores; es legítimo, pero conviene blindarlo.

---

### F25 — Exportaciones muertas o huérfanas en el dominio musical

- **Severidad:** Bajo
- **Archivos:** `intervals.ts`, `tonalContext.ts`, `noteUtils.ts`, `thresholds.ts`, `confusionMatrix.ts`, `sessionClassification.ts`
- **Impacto:** mantenibilidad / ruido de API pública

**Evidencia (verificada por grep exhaustivo de consumidores):**

| Export | Ubicación | Estado |
|---|---|---|
| `calculateIntervalFromNotes` | `intervals.ts:166-178` | Solo lo usa su propio test (`intervals.test.ts:6,23-30`). Muerto en producción |
| `getTonalContextDescription` | `tonalContext.ts:90-97` | Solo su propio test (`tonalContext.test.ts:7,45-49`). Muerto en producción |
| tipo `NoteName` | `noteUtils.ts:3` | **Nunca importado** en todo `src/` |
| `CPIModalityKey` / `CPIModalityConfig` | `thresholds.ts:78-83` | Exportados sin consumidores externos |
| `LatencyThresholdConfig` | `thresholds.ts:1` | Exportado sin consumidores externos |
| `TonalContextOption` / `MidiChordStep` | `tonalContext.ts:5,12` | Exportados sin consumidores externos |
| `PITCH_CLASSES` | `confusionMatrix.ts:4-17` | **Duplica** literalmente `NOTE_NAMES` de `noteUtils.ts:1` (mismos 12 nombres) |
| `formatInterSessionGap` (export) | `sessionClassification.ts:107-117` | Usada internamente por `computeInterSessionGapMap`, pero su export solo lo consume el test del barrel |

**Impacto:** peso marginal en bundle (tree-shaking lo elimina), pero ruido de API pública y superficie de mantenimiento.

---

### F26 — Artefactos muertos en el árbol fuente y cruce de límites en `tsconfig.node.json`

- **Severidad:** Bajo
- **Archivos:** `src/renderer/src/components/trainer/*.backup`; `renderer/` (raíz); `tsconfig.node.json:7`
- **Impacto:** higiene del repositorio

**Evidencia:**

1. Tres copias de seguridad dentro de `src/`: `StudioTopBar.tsx.backup`, `StudioBottomDock.tsx.backup` (7,8 KB), `MidiMonitor.tsx.backup`. Excluidas del ASAR por `!src/*` y del typecheck (extensión `.backup`), pero son ruido que confunde a tooling y desarrolladores.
2. Directorio `renderer/` **vacío** en la raíz del repositorio (residuo).
3. `tsconfig.node.json:7` incluye `src/renderer/src/domain/ai/appConfig.ts` en el proyecto **node** únicamente porque `src/main/lmStudioHostSync.test.ts:3` (un test) importa `DEFAULT_APP_CONFIG` desde el dominio del renderer. El código de producción de main no lo usa — cruce de límites main↔renderer solo por conveniencia de test.

---

## 3. Hoja de Ruta Priorizada

| # | Prioridad | Recomendación | Hallazgos | Ahorro/Beneficio estimado |
|---|---|---|---|---|
| R1 | **P0** | Excluir artefactos de trabajo en `electron-builder.yml` | F15 | **−58 MB** en ASAR |
| R2 | **P0** | Reclasificar dependencias a `devDependencies` | F16, F17 | **−37,6 MB** en ASAR |
| R3 | **P1** | Unificar resolución modalidad/pool en SSOT | F21 | Elimina 3 copias del mapeo |
| R4 | **P1** | Migrar consumidores del export deprecado | F22 | Coherencia motor/gráfico |
| R5 | **P1** | Refactor de `computeAnalyticsMetrics` | F23 | O(S×A) → O(S+A) |
| R6 | **P2** | Placeholders de release + compresión | F18, F19 | Release saneado |
| R7 | **P2** | Config explícita de electron-vite | F20 | Diagnóstico en producción |
| R8 | **P3** | Limpieza de código muerto y guardas ESLint | F24, F25, F26 | Mantenibilidad |

### R1 (P0) — Exclusiones en `electron-builder.yml`

```yaml
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.{js,ts,mjs,cjs}'
  - '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'
  - '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
  # Nuevas exclusiones (F15):
  - '!coverage/**'
  - '!{.opencode,.engram,.codebase-memory,.vscode}/**'
  - '!openspec/**'
  - '!repomix-output.xml'
  - '!*.backup'
  - '!{AUDIT_REPORT_*.md,PROJECT_EXPLANATION_*.md,README_V1.md,TECH_STACK_ANALYSIS.md,REPERTOIRE_LEARNING_*.md,ARCHITECTURE.md}'
  - '!renderer/**'
```

**Verificación:** `npm run build:unpack` y comparar el tamaño de `app.asar` antes/después (objetivo: −58 MB).

### R2 (P0) — Reclasificación de dependencias

Mover a `devDependencies`: `lucide-react`, `zustand`, `@tailwindcss/vite`, `tailwindcss`.

Deben permanecer en `dependencies` **solo** `@electron-toolkit/preload` y `@electron-toolkit/utils` (externalizados por electron-vite en main/preload y resueltos desde `node_modules` en runtime). `react`/`react-dom` ya están bien clasificados.

**Verificación:** `npm run build:unpack` + arranque de la app desempaquetada; los tests de `preloadExposure` y `lmStudioHandlers` deben seguir verdes.

### R3 (P1) — SSOT de modalidad y pool

Extraer un módulo único (p. ej. `analytics/sessionModality.ts`) que exponga `resolveSessionMode(session)` y `resolvePoolSize(session, answers)`, derivando del `targetMode` canónico persistido (ya existe en `DbSessionRecord.targetMode`) con los strings de `presetName` solo como fallback legacy marcado. Consumirlo desde `sessionClassification`, `sessionFilters` y `longitudinal`.

Añadir un test de propiedad: para cada preset de `presets.ts`/`intervals.ts`/`sequences.ts`, el pool resuelto debe coincidir con `preset.notes.length` (rompe el acoplamiento a strings de forma verificable).

### R4 (P1) — Eliminar el export deprecado

1. En `latencyStats.ts` aceptar `mode` como parámetro y usar `getLatencyThresholds(mode)`.
2. En `AnalyticsCharts.tsx` derivar los umbrales del modo de la sesión activa (ya disponible en el store).
3. Borrar `COGNITIVE_LATENCY_THRESHOLDS` de `thresholds.ts:56-57` y su consumo en `latencyStats.test.ts:3`.

### R5 (P1) — Refactor de `computeAnalyticsMetrics`

1. Pre-agrupar respuestas: `const answersBySession = groupBy(filteredAnswers, a => a.sessionId)` (patrón ya existente en `sessionFilters.ts:50-58`).
2. Extraer `resolveSessionMode(session)` como helper único (elimina la duplicación de las líneas 113-121 / 187-195).
3. Sustituir el round-trip `" ➔ "` por `Map<string, ConfusionPair>` con clave compuesta numérica (`expectedNote * 128 + playedNote`).

### R6 (P2) — Release engineering

- `appId: com.ferwarno.midilaboratory` (o el dominio real).
- `maintainer` real.
- `publish` apuntando al servidor definitivo o comentado hasta activar auto-update.
- `electronApp.setAppUserModelId(appId)` sincronizado con el `appId`.
- `compression: maximum`.
- Evaluar eliminar `asarUnpack: resources/**` si el icono viaja embebido en `out/main`.

### R7 (P2) — electron-vite explícito

```ts
main: { build: { sourcemap: 'hidden' } },   // stack traces legibles sin exponer maps
preload: { build: { sourcemap: 'hidden' } },
renderer: {
  build: {
    sourcemap: false,
    rollupOptions: { output: { manualChunks: { vendor: ['react', 'react-dom'] } } }
  }
}
```

### R8 (P3) — Higiene

1. Eliminar los 3 archivos `.backup` y el directorio `renderer/` vacío.
2. Reexportar `formatInterSessionGap` solo si hay consumidor real.
3. Unificar `PITCH_CLASSES` = `NOTE_NAMES` (`confusionMatrix.ts` → `noteUtils.ts`).
4. Mover el import de `appConfig` del test de main a un fixture compartido o duplicar la constante mínima.
5. Añadir regla `no-restricted-imports` que prohíba importar el barrel `historyAnalytics` desde dentro de `domain/analytics/**` (previene el ciclo latente de F24).
6. Considerar `import/no-unused-modules` para detectar huérfanos como F25 de forma continua.

---

## 4. Estrategia de Verificación Global

1. Tras R1+R2: ejecutar `npm run build:unpack`, medir `app.asar` (objetivo: reducción ≈95 MB) y arrancar el binario desempaquetado.
2. Validar las 3 vistas de analítica contra la suite existente (`npm test` — 0 fallos esperados).
3. Los tests ya pinchan el comportamiento de F21/F22, por lo que R3/R4 requieren actualizarlos junto al refactor (protocolo TDD: actualizar expectativas primero, refactor después).
4. Re-ejecutar el análisis estático de REA sobre `src/` tras R3-R5 para confirmar la reducción de complejidad y la ausencia de nuevos ciclos.
