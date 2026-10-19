# Verificación — reduce-asar-size

## 1. Línea base del `app.asar` (task 1.1)

- **Fecha**: 2026-10-19
- **Comando**: `npm run build:unpack` (sin cambios aplicados; electron-builder 26.15.3, electron 43.4.0)
- **Archivo**: `dist/win-unpacked/resources/app.asar`
- **Tamaño**: 36.752.748 bytes = **35,05 MB**

### Inspección del contenido de la línea base (`npx asar list`)

**Presentes en el ASAR (peso muerto confirmado empíricamente):**

| Entrada | Peso en disco (referencia) |
|---|---|
| `node_modules/lucide-react` (miles de iconos `.mjs` + `.map`) | 33,60 MB en disco — dominante en el ASAR |
| `node_modules` tooling Tailwind: `@tailwindcss/*`, `tailwindcss`, `lightningcss*`, `jiti`, `enhanced-resolve`, `capable`, `magic-string`, `source-map-js`, `detect-libc`, `graceful-fs`, `@jridgewell` | ~4 MB en disco |
| `node_modules/zustand` | 0,09 MB |
| `coverage/**` | 2,30 MB |
| `openspec/**` | 1,06 MB |
| `.codebase-memory/` (artifact.json, graph.db.zst) | 1,81 MB |
| `repomix-output.xml` | 315 KB |
| MDs de raíz (`AUDIT_REPORT_*.md`, `README_V1.md`, etc.) | ~80 KB |
| `.opencode/` (solo `commands/*.md`, `skills/*/SKILL.md`, `package.json`) | ~0,25 MB |
| `.engram/config.json` | ~0 |
| `vitest.config.ts` (no excluido por ningún patrón) | ~0 |

**Ausentes del ASAR (a diferencia de lo estimado en la auditoría V9):**

- `.opencode/node_modules` (52,51 MB en disco) — electron-builder NO lo empaqueta (prune de `node_modules` anidados ajenos al árbol de producción)
- `.vscode/`, `src/**`, `renderer/`, `*.backup`
- `build/`, `dist/`, `resources/` (salvo `icon.png` vía `asarUnpack`)

### Discrepancia con la auditoría V9

La estimación de F15 (~58 MB por artefactos de trabajo) se basó en tamaños de disco, no en el contenido real del ASAR. Empíricamente, el peso muerto real en el ASAR es:

- F16 (lucide-react + zustand): ~24–28 MB — **contribución dominante**
- F17 (árbol Tailwind): ~3–4 MB
- F15 (artefactos de trabajo): ~5,8 MB (no ~58 MB; el grueso de `.opencode` es su propio `node_modules`, que electron-builder ya excluye)

**Reducción total alcanzable: ~31–33 MB** (ASAR final estimado: ~2–4 MB), no los ≥ 90 MB fijados en el spec. El ASAR completo solo mide 35,05 MB, por lo que el umbral del spec es inalcanzable.

---

## 2. Reempaquetado con cambios aplicados (tasks 4.1 y 4.2)

- **Fecha**: 2026-10-19
- **Comando**: `npm run build:unpack` (tras aplicar exclusiones en `electron-builder.yml` y reclasificación en `package.json` + `npm install`)
- **Archivo**: `dist/win-unpacked/resources/app.asar`
- **Tamaño final**: 1.431.307 bytes = **1,37 MB**
- **Reducción medida**: 35.321.441 bytes = **33,69 MB** (35,05 MB → 1,37 MB)
- **Umbral del spec (corregido)**: reducción ≥ 29 MB ✓ — ASAR final ≤ 6 MB ✓

### Inspección del contenido del ASAR final (`npx asar list`) — task 4.2

**Contenido completo (24 entradas):**

```
\node_modules\@electron-toolkit\preload\...   (runtime — requerido)
\node_modules\@electron-toolkit\utils\...     (runtime — requerido)
\out\main\index.js                            (producción)
\out\preload\index.js                         (producción)
\out\renderer\assets\index-C4fwX76z.js        (producción)
\out\renderer\assets\index-CgEyzJA_.css       (producción)
\out\renderer\index.html                      (producción)
\package.json                                 (producción)
\resources\icon.png                           (producción)
\vitest.config.ts                             (observación, ver abajo)
```

**Ausencias confirmadas (escenarios del spec):** `.opencode/`, `.engram/`, `.codebase-memory/`, `.vscode/`, `coverage/`, `openspec/`, `repomix-output.xml`, `*.backup`, markdowns de auditoría/documentación de raíz, `renderer/` — ninguna presente. En `node_modules`: ausentes `lucide-react`, `zustand`, `@tailwindcss/*`, `tailwindcss` y todas sus transitivas (`lightningcss*`, `jiti`, `enhanced-resolve`, `capable`, `magic-string`, `source-map-js`, `detect-libc`, `graceful-fs`, `@jridgewell`).

**Presencias confirmadas (escenarios del spec):** `out/main/index.js`, `out/preload/index.js`, `out/renderer/**`, `package.json` y `node_modules` runtime (`@electron-toolkit/preload`, `@electron-toolkit/utils`).

**Observación (fuera de alcance del spec):** `vitest.config.ts` permanece en el ASAR (~0 KB) — ningún patrón del bloque `files` lo excluye y el spec no lo exige. Candidato de higiene para un cambio futuro (línea con la recomendación R8 de la auditoría).

---

## 3. Verificación de integridad funcional (tasks 5.1–5.4)

- **Fecha**: 2026-10-19
- **5.1 `npm test`**: 79 archivos de test, **767 tests passed**, 0 fallos.
- **5.2 `npm run typecheck`**: `typecheck:node` + `typecheck:web` sin errores.
- **5.3 `npm run lint`**: ESLint sin errores.
- **5.4 Arranque desempaquetado**: `dist/win-unpacked/midi-laboratory.exe` arrancó con 4 procesos Electron (main + gpu + renderer + utility), estable tras 18 segundos (sin crash por módulos no encontrados), cerrado limpiamente con `Stop-Process`.

## Resumen final

| Métrica | Línea base | Final | Umbral spec |
|---|---|---|---|
| `app.asar` | 35,05 MB (36.752.748 B) | **1,37 MB** (1.431.307 B) | ≤ 6 MB ✓ |
| Reducción | — | **33,69 MB** (−91,3 %) | ≥ 29 MB ✓ |
| Tests | — | 767/767 ✓ | 0 regresiones ✓ |
| Typecheck / Lint | — | sin errores ✓ | ✓ |
| Arranque desempaquetado | — | estable, sin errores de módulos ✓ | ✓ |

---

## 4. Remediación post-verificación (warnings 1-2 y sugerencias 3-4 del informe)

- **Fecha**: 2026-10-19
- **Warning 1**: `design.md` — Goals y D5 paso 3 alineados con el umbral enmendado (reducción ≥ 29 MB, ASAR final ≤ 6,0 MB, resultado real 1,37 MB); eliminadas las referencias obsoletas a ≥ 90 MB.
- **Warning 2**: `specs/10-build-packaging/spec.md` — descripción del requisito «Reducción medible del tamaño del ASAR» recortada a < 500 caracteres (el relato de la corrección permanece en `design.md` D4 y en este archivo); `openspec validate` limpio, sin advertencias.
- **Sugerencia 3**: `electron-builder.yml` — añadido el patrón `!vitest.config.*` al bloque `files`. Confirmación empírica: `npm run build:unpack` + `npx asar list` → el ASAR final (1.430.277 bytes = **1,36 MB**) ya NO contiene `vitest.config.ts`; su contenido es exclusivamente `out/**`, `package.json`, `node_modules/@electron-toolkit/{preload,utils}` y `resources/icon.png`.
- **Sugerencia 4**: creado el test de regresión `src/main/packageDependenciesGuard.test.ts` — afirma que `dependencies` contiene única y exclusivamente `@electron-toolkit/preload` y `@electron-toolkit/utils`, y que los 4 paquetes build-time permanecen en `devDependencies`. Suite completa tras la remediación: **80 archivos, 769/769 tests en verde**.
