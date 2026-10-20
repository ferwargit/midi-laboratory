# Tasks

## 1. Saneo de `electron-builder.yml` (F18 + F19)

- [x] 1.1 Cambiar `appId` a `com.ferwarno.midilaboratory` y verificar con lectura del archivo que no queda ningún placeholder (`com.electron.app`)
- [x] 1.2 Cambiar `linux.maintainer` a `Fernando Warno` y verificar que `electronjs.org` ya no aparece en el YAML
- [x] 1.3 Eliminar el bloque `publish` (provider generic / example.com) y verificar que `example.com` no aparece en el YAML
- [x] 1.4 Añadir `compression: maximum` a nivel raíz y verificar que la propiedad existe con ese valor
- [x] 1.5 Eliminar la directiva `asarUnpack: resources/**` y verificar que el YAML ya no contiene `asarUnpack`

## 2. Sincronización de identidad en runtime (F18)

- [x] 2.1 Cambiar `electronApp.setAppUserModelId('com.electron')` a `electronApp.setAppUserModelId('com.ferwarno.midilaboratory')` en `src/main/index.ts` y verificar con `npm run typecheck` que no hay errores de tipos

## 3. Sourcemaps hidden en Main y Preload (F20)

- [x] 3.1 Configurar `build: { sourcemap: 'hidden' }` en las secciones `main` y `preload` de `electron.vite.config.ts`, manteniendo el renderer sin sourcemaps, y verificar con `npm run typecheck` que la configuración tipa correctamente

## 4. Guarda de regresión de identidad de release

- [x] 4.1 Crear `src/main/releaseIdentityGuard.test.ts` (patrón de `packageDependenciesGuard.test.ts`) que parsee `electron-builder.yml` y `src/main/index.ts` y verifique que `appId` ≡ `appUserModelId` ≡ `com.ferwarno.midilaboratory`; verificar que el test pasa en verde y que falla si se altera manualmente uno de los dos valores (comprobación manual temporal)
- [x] 4.2 Ejecutar `npm test` completo y verificar 0 fallos ni regresiones en la suite existente

## 5. Verificación de build y cierre

- [x] 5.1 Ejecutar `npm run lint` y `npm run typecheck` y verificar 0 errores
- [x] 5.2 Ejecutar `npm run build` y verificar: archivos `.map` generados en `out/main` y `out/preload`, ausencia de `.map` en `out/renderer`, y ausencia de comentarios `//# sourceMappingURL` en los bundles de `out/main` y `out/preload`
- [x] 5.3 Inspeccionar el `app.asar` generado por `npm run build:unpack` y verificar que no incluye archivos `.map`; si los incluyera, añadir la exclusión `!out/**/*.map` a la sección `files` de `electron-builder.yml` y repetir 5.2-5.3
- [x] 5.4 Ejecutar `npm run build:unpack` completo y verificar que el empaquetado finaliza sin errores (integridad funcional, requisito existente de `10-build-packaging`)

## Workflow follow-up

- Ejecutar `/opsx-verify` antes de archivar.
- Archivar el cambio cuando la verificación esté en verde.
