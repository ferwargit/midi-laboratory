# Proposal

## Why

La auditoría V9 identificó tres hallazgos de release engineering (F18, F19, F20): `electron-builder.yml` conserva placeholders de plantilla (`appId: com.electron.app`, `maintainer: electronjs.org`, `publish` apuntando a `example.com/auto-updates`) que no corresponden a la identidad real del proyecto; la identidad de Windows declarada en runtime (`electronApp.setAppUserModelId('com.electron')` en `src/main/index.ts`) no coincide con el `appId` del empaquetado; y la configuración de build carece de `compression: maximum` y de sourcemaps `hidden` para diagnosticar crashes de producción en los procesos Main y Preload.

## What Changes

- En `electron-builder.yml`:
  - Establecer el `appId` canónico `com.ferwarno.midilaboratory`.
  - Reemplazar el `maintainer` placeholder por el autor real del proyecto (`Fernando Warno`).
  - Retirar el bloque `publish` placeholder (`example.com/auto-updates`), que no corresponde a un canal de actualizaciones real.
  - Configurar `compression: maximum` para optimizar el tamaño del instalador final.
  - Retirar la directiva redundante `asarUnpack: resources/**` (no existe contenido en `resources/` que requiera desempaquetado).
- En `src/main/index.ts`: sincronizar `electronApp.setAppUserModelId('com.ferwarno.midilaboratory')` para que coincida exactamente con el `appId` de electron-builder.
- En `electron.vite.config.ts`: configurar `build: { sourcemap: 'hidden' }` en las secciones `main` y `preload`, manteniendo el renderer sin sourcemaps en producción.
- Tests: crear una guarda de regresión que verifique que el `appId` de `electron-builder.yml` y el `appUserModelId` de `src/main/index.ts` coinciden estrictamente.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `10-build-packaging`: se añaden requisitos de identidad canónica de la aplicación (appId + AppUserModelId sincronizados), de optimización del instalador (`compression: maximum`, sin `asarUnpack` redundante, sin bloque `publish` placeholder) y de diagnósticos de producción (sourcemaps `hidden` en Main/Preload, renderer sin sourcemaps).

## Impact

- **Archivos**: `electron-builder.yml`, `src/main/index.ts`, `electron.vite.config.ts`, `src/main/packageDependenciesGuard.test.ts` (o un nuevo test de guarda de release).
- **Comportamiento observable**: la identidad de la aplicación en Windows (AppUserModelId) cambia de `com.electron` a `com.ferwarno.midilaboratory`, lo que afecta notificaciones toast y accesos directos del menú Inicio en instalaciones nuevas. Los sourcemaps `hidden` generan archivos `.map` en `out/main` y `out/preload` sin referencias en el bundle.
- **Riesgos**: bajo — cambios de configuración de build; se verifica con `npm test`, `npm run typecheck`, `npm run lint` y un build de prueba (`npm run build`).
