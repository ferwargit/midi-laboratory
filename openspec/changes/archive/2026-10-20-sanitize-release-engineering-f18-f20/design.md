# Design

## Context

Ver proposal.md — Why. Estado actual verificado en el repositorio:

- `electron-builder.yml` (líneas 1, 20-21, 44, 49-51): `appId: com.electron.app`, `asarUnpack: resources/**`, `maintainer: electronjs.org` y `publish` con `https://example.com/auto-updates`.
- `src/main/index.ts` (línea 110): `electronApp.setAppUserModelId('com.electron')` — valor distinto del `appId` del empaquetado.
- `electron.vite.config.ts`: secciones `main: {}` y `preload: {}` vacías, sin configuración de `build.sourcemap`.
- Existe una guarda de regresión previa (`src/main/packageDependenciesGuard.test.ts`) que lee archivos de configuración con `readFileSync` y los valida contra constantes — patrón reutilizable para la nueva guarda de identidad.

## Goals / Non-Goals

**Goals:**

- Identidad de aplicación coherente y canónica: `appId` de electron-builder ≡ AppUserModelId de runtime ≡ `com.ferwarno.midilaboratory`.
- Metadatos de distribución reales (maintainer) y eliminación del bloque `publish` placeholder.
- Instalador optimizado (`compression: maximum`) y ASAR sin `asarUnpack` innecesario.
- Diagnóstico de crashes de producción mediante sourcemaps `hidden` en Main y Preload.
- Guarda de regresión automatizada que impida divergencia futura entre `appId` y `appUserModelId`.

**Non-Goals:**

- Configurar un canal real de auto-actualizaciones (se elimina el placeholder; un `publish` real es un cambio futuro con infraestructura propia).
- Habilitar sourcemaps para el renderer o subir sourcemaps a un servicio de símbolos (Sentry, etc.).
- Cambiar `productName`, `executableName`, targets de distribución o la clasificación de dependencias ya cubierta por `10-build-packaging`.

## Decisions

1. **`appId` = `com.ferwarno.midilaboratory` como única fuente de verdad.** El AppUserModelId del runtime se deriva conceptualmente del `appId`; la sincronización se garantiza con una guarda de test que parsea ambos archivos y compara los valores estrictamente. Alternativa considerada: leer el `appId` en runtime desde el `package.json`/config — rechazada porque introduce lógica runtime innecesaria y acoplamiento con el formato de electron-builder; la guarda estática es suficiente y determinista.

2. **Eliminar el bloque `publish` en lugar de comentarlo.** Un `publish` con `provider: generic` y URL `example.com` hace que electron-builder intente resolver un canal de actualizaciones inexistente y confunde a `electron-updater` si algún día se incluye. Eliminarlo es más limpio que comentarlo; el historial de git preserva la referencia. Alternativa considerada: comentarlo — rechazada por dejar ruido de plantilla en el YAML.

3. **Retirar `asarUnpack: resources/**`.** Verificado que el proyecto no empaqueta binarios nativos bajo `resources/` que requieran acceso por ruta de filesystem (no hay referencias a `resources/` en el código Main). La directiva proviene de la plantilla original de electron-vite. Alternativa considerada: conservarla "por si acaso" — rechazada porque desempaqueta contenido innecesario y agranda el instalador.

4. **`compression: maximum` a nivel raíz de `electron-builder.yml`.** Aplica a todos los targets (NSIS, DMG, AppImage). Trade-off aceptado: el build es más lento (máxima compresión LZMA), pero es un build de release, no de desarrollo.

5. **`sourcemap: 'hidden'` en `main` y `preload` de `electron.vite.config.ts`.** El modo `hidden` genera los `.map` pero omite el comentario `//# sourceMappingURL` en el bundle, evitando que herramientas o usuarios finales localicen los mapas mientras los crash reporters pueden simbolizar con los archivos aparte. Alternativa considerada: `sourcemap: true` — rechazada porque expone la referencia en el bundle; `sourcemap: false` — rechazada porque pierde la capacidad de diagnóstico que motiva F20. El renderer se mantiene sin sourcemaps (comportamiento actual de producción).

6. **Guarda de identidad en un nuevo test junto al patrón existente.** Se crea `src/main/releaseIdentityGuard.test.ts` siguiendo el patrón de `packageDependenciesGuard.test.ts` (parseo estático de `electron-builder.yml` — YAML plano, parseable con lectura de texto o parser YAML ya disponible en devDependencies — y regex/extracción del literal en `src/main/index.ts`). Alternativa considerada: extender `packageDependenciesGuard.test.ts` — rechazada para mantener una guarda por dominio (dependencias vs. identidad de release).

## Risks / Trade-offs

- [Cambio de AppUserModelId rompe notificaciones/accesos directos de instalaciones existentes] → Aceptado: el proyecto está en fase pre-release sin base de usuarios consolidada; el valor anterior (`com.electron`) era un placeholder sin identidad real. Se documenta en la propuesta.
- [`compression: maximum` alarga el build de release] → Aceptado: solo afecta builds de distribución; el flujo de desarrollo usa `build:unpack`/dev server sin compresión.
- [Sourcemaps `hidden` aumentan el tamaño de `out/` (no del instalador si no se empaquetan)] → Verificar en el build de prueba que los `.map` de `out/main`/`out/preload` no viajan al ASAR (la sección `files` de electron-builder solo incluye `out/**`; si los `.map` quedaran incluidos, se añade exclusión `!out/**/*.map` — decisión registrada en tasks).
- [La guarda parsea YAML con dependencia nueva] → Preferir un parser YAML ya presente en `devDependencies` (p. ej. `js-yaml` si está disponible transitivamente) o lectura por regex del campo `appId` para evitar añadir dependencias; decisión final en implementación, sin cambiar el contrato del test.

## Migration Plan

1. Aplicar los tres cambios de configuración/código (electron-builder.yml, index.ts, electron.vite.config.ts).
2. Añadir la guarda de identidad y ejecutar `npm test`, `npm run typecheck`, `npm run lint`.
3. Ejecutar `npm run build` y verificar: `.map` presentes en `out/main` y `out/preload`, ausentes en `out/renderer`, sin `sourceMappingURL` en los bundles de Main/Preload, y que el ASAR no incluye `.map` (añadir exclusión si fuera necesario).
4. Rollback: revertir los commits del cambio; no hay migración de datos ni estado persistente afectado.

## Open Questions

(ninguna — el alcance y los valores concretos fueron especificados por el usuario en la solicitud)
