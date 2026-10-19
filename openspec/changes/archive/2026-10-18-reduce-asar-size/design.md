# Design

## Context

Ver propuesta.md — Why. Estado actual verificado en el repositorio:

- `electron-builder.yml:5-11`: el bloque `files` contiene solo patrones de negación; electron-builder antepone la inclusión por defecto `**/*` cuando el matcher no tiene inclusiones explícitas (`app-builder-lib/out/fileMatcher.js:281-284`), con `dot: true` (directorios ocultos sí emparejan) y sin respetar `.gitignore`. Resultado: ~58 MB de artefactos de trabajo dentro del ASAR (F15).
- `package.json:25-32`: `dependencies` incluye `lucide-react` (33,6 MB), `zustand` (0,09 MB), `@tailwindcss/vite` y `tailwindcss` (~3,94 MB con transitivas), todos empaquetados por electron-builder pese a ser build-time (F16, F17).
- `electron.vite.config.ts`: el renderer se bundlea con Vite (`react()` + `tailwindcss()`); main y preload usan la configuración por defecto de electron-vite, que externaliza las `dependencies` de `package.json` para resolverlas desde `node_modules` en runtime.
- Inspección de imports: `src/main/index.ts` importa únicamente `electron` (built-in) y `@electron-toolkit/utils`; `src/preload/index.ts` usa solo built-ins de `electron`. Ningún proceso Main/Preload importa `lucide-react`, `zustand` ni Tailwind.
- `npmRebuild: false` ya está configurado; los binarios nativos de Tailwind (`@tailwindcss/oxide-win32-x64-msvc`) viajan al ASAR sin reconstrucción.

## Goals / Non-Goals

**Goals:**

- ASAR sin artefactos de trabajo, mediante exclusiones explícitas y verificables en `files`.
- `dependencies` reducida al conjunto mínimo runtime (`@electron-toolkit/preload`, `@electron-toolkit/utils`).
- Reducción empírica y registrada del tamaño de `app.asar`: reducción ≥ 29 MB y tamaño final de `app.asar` ≤ 6,0 MB (resultado empírico real: 1,37 MB).
- Cero regresiones: suite de tests, typecheck, lint y arranque desempaquetado en verde.

**Non-Goals:**

- No se abordan los placeholders de release engineering ni `compression: maximum` (F18/F19, recomendación R6 de la auditoría — cambio separado).
- No se borran archivos del repositorio (`.backup`, MDs de raíz, `renderer/` residual): solo se excluyen del empaquetado; su limpieza es la recomendación R8/F24, fuera de alcance.
- No se modifica ningún código de `src/` ni la configuración de electron-vite.
- No se cambia la estrategia de `asarUnpack: resources/**`.

## Decisions

### D1 — Exclusiones como patrones de negación adicionales en `files` (no allowlist explícita)

Se añaden los patrones de negación del informe de auditoría (R1) al bloque `files` existente, conservando los patrones actuales:

```yaml
files:
  # ... patrones existentes ...
  - '!coverage/**'
  - '!{.opencode,.engram,.codebase-memory,.vscode}/**'
  - '!openspec/**'
  - '!repomix-output.xml'
  - '!*.backup'
  - '!{AUDIT_REPORT_*.md,PROJECT_EXPLANATION_*.md,README_V1.md,TECH_STACK_ANALYSIS.md,REPERTOIRE_LEARNING_*.md,ARCHITECTURE.md}'
  - '!renderer/**'
```

**Por qué**: es el cambio mínimo sobre el mecanismo que electron-builder ya usa; el matcher solo-negaciones ya incluye `**/*` por defecto, así que las negaciones nuevas son aditivas y no alteran lo que hoy viaja correctamente (`out/**`, `node_modules` runtime, `resources` vía `asarUnpack`).

**Alternativas descartadas**:
- *Allowlist explícita* (`out/**`, `package.json`, … como inclusiones positivas): más segura en teoría, pero frágil ante cualquier artefacto de producción nuevo que se olvide declarar; el riesgo de romper el empaquetado supera el beneficio.
- *Confiar en `.gitignore`*: electron-builder no lo respeta (verificado en la auditoría, F15 evidencia 2).

**Nota sobre `!*.backup`**: el patrón sin `**/` solo empareja en la raíz; los `.backup` dentro de `src/` ya quedan fuera por `!src/*`. La exclusión raíz cubre el caso de futuros backups en la raíz.

**Nota sobre `!renderer/**`**: el directorio residual está vacío, por lo que no aporta peso al ASAR; la exclusión documenta la intención y blinda contra contenido futuro.

### D2 — Reclasificación vía `devDependencies` (no exclusión de subrutas de `node_modules`)

Se mueven `lucide-react`, `zustand`, `@tailwindcss/vite` y `tailwindcss` a `devDependencies` y se regenera `package-lock.json` con `npm install`.

**Por qué**: la clasificación en `package.json` es el mecanismo canónico por el que electron-builder decide qué empaquetar en `node_modules`; excluir subrutas de `node_modules` vía `files` es frágil porque las transitivas (`@tailwindcss/oxide*`, `@tailwindcss/node`) quedarían huérfanas o requerirían mantenimiento manual.

**Seguridad verificada**: electron-vite externaliza las `dependencies` para main/preload; como ningún módulo de `src/main` o `src/preload` importa los paquetes reclasificados, el build de main/preload no cambia. El renderer nunca resuelve `node_modules` en runtime (carga desde `file://` con el bundle de Vite).

### D3 — Mantener `@electron-toolkit/preload` en `dependencies`

Aunque `src/preload/index.ts` no lo importa directamente, se conserva en `dependencies` (criterio de la auditoría R2 y de la petición): forma parte de la superficie de contrato runtime del preload (tipado del `window.api` expuesto) y su peso es marginal. Eliminarlo sería una decisión de limpieza separada, no de tamaño.

### D4 — Umbral de verificación corregido empíricamente (≥ 29 MB, ASAR final ≤ 6 MB)

La estimación inicial de la auditoría (~95 MB, umbral ≥ 90 MB) se basó en tamaños de disco, no en el contenido real del ASAR. La medición de la línea base (2026-10-19, `verification.md`) arrojó un `app.asar` de **35,05 MB**, con este desglose empírico:

- lucide-react + zustand (F16): ~24–28 MB — contribución dominante.
- Árbol Tailwind (F17): ~3–4 MB.
- Artefactos de trabajo (F15): ~5,8 MB — no ~58 MB: el grueso de `.opencode` (52,5 MB) es su propio `node_modules`, que electron-builder 26.15.3 ya no empaqueta (prune de `node_modules` anidados).

El umbral se corrige a **reducción ≥ 29 MB** con **ASAR final ≤ 6 MB**, dejando ~2–3 MB de margen sobre la reducción esperada (~31–33 MB). Los cambios de configuración (D1, D2) no varían: siguen siendo correctos y beneficiosos.

### D5 — Orden de ejecución de la verificación

1. Medir línea base: `npm run build:unpack` + tamaño de `app.asar` (antes de tocar configs).
2. Aplicar D1 y D2; `npm install` para reclasificar y regenerar el lockfile.
3. `npm run build:unpack` + medir de nuevo; comparar (reducción ≥ 29 MB y tamaño final de `app.asar` ≤ 6,0 MB).
4. Inspección del contenido del ASAR (presencias/ausencias de los escenarios del spec).
5. `npm test`, `npm run typecheck`, `npm run lint`.
6. Arranque desempaquetado sin errores de módulos.

## Risks / Trade-offs

- [Patrón de exclusión demasiado amplio borra algo de producción] → Los patrones nuevos solo apuntan a directorios/archivos de trabajo verificados en la raíz; la inspección del ASAR (escenario "los artefactos de producción se preservan") es la guarda.
- [Dependencia reclasificada resultara necesaria en runtime] → Inspección previa de imports de main/preload (negativa) + arranque desempaquetado como guarda empírica; rollback trivial (revertir `package.json`).
- [`npm install` regenera el lockfile con cambios colaterales] → Revisar el diff de `package-lock.json` limitado a la reclasificación de los cuatro paquetes.
- [`!*.backup` no cubre subdirectorios] → Aceptado: los de `src/` ya están excluidos por `!src/*`; el patrón raíz es defensa en profundidad.
- [El tamaño del ASAR depende de factores ambientales] → El umbral corregido (reducción ≥ 29 MB, ASAR final ≤ 6 MB) deja ~2–3 MB de margen sobre la reducción esperada (~31–33 MB); la medición se hace en la misma máquina y flujo para comparabilidad.

## Migration Plan

1. Medir y registrar la línea base del `app.asar`.
2. Editar `electron-builder.yml` (D1) y `package.json` (D2); ejecutar `npm install`.
3. Reconstruir, medir, inspeccionar ASAR y ejecutar la suite de verificación (D5).
4. Rollback: `git checkout -- electron-builder.yml package.json package-lock.json` y `npm install`; sin migración de datos ni de estado persistente.

## Open Questions

Ninguna. Las decisiones D1–D5 cubren todo el alcance; el único supuesto registrado es el umbral de D4.
