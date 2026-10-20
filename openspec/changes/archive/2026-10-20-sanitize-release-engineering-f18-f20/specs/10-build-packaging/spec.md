# Spec Delta

## ADDED Requirements

### Requirement: Identidad canónica de la aplicación
La configuración de empaquetado MUST (DEBE) declarar el `appId` canónico `com.ferwarno.midilaboratory` y el proceso Main MUST (DEBE) registrar el AppUserModelId de Windows con exactamente el mismo valor, de forma que la identidad de la aplicación sea coherente entre el instalador y el runtime.

#### Scenario: el appId del empaquetado es el canónico del proyecto
- **WHEN** se inspecciona `electron-builder.yml`
- **THEN** la propiedad `appId` tiene el valor `com.ferwarno.midilaboratory` y no conserva el placeholder de plantilla `com.electron.app`

#### Scenario: el AppUserModelId del runtime coincide con el appId
- **WHEN** se arranca la aplicación y se consulta el AppUserModelId registrado por el proceso Main
- **THEN** el valor registrado es `com.ferwarno.midilaboratory`, idéntico al `appId` de `electron-builder.yml`

#### Scenario: la guarda de regresión verifica la sincronización
- **WHEN** se ejecuta la suite de pruebas (`npm test`)
- **THEN** la guarda de identidad de release falla si el `appId` de `electron-builder.yml` y el `appUserModelId` de `src/main/index.ts` dejan de coincidir estrictamente

### Requirement: Metadatos de distribución sin placeholders
La configuración de empaquetado MUST (DEBE) declarar metadatos de distribución reales del proyecto: el `maintainer` de la sección `linux` MUST (DEBE) identificar al autor del proyecto (`Fernando Warno`) y MUST (DEBE) no existir un bloque `publish` apuntando a un dominio placeholder (`example.com`).

#### Scenario: el maintainer identifica al autor real
- **WHEN** se inspecciona la sección `linux` de `electron-builder.yml`
- **THEN** `maintainer` es `Fernando Warno` y no conserva el placeholder `electronjs.org`

#### Scenario: no existe bloque publish placeholder
- **WHEN** se inspecciona `electron-builder.yml`
- **THEN** no existe ninguna propiedad `publish` cuyo proveedor o URL referencie `example.com`

### Requirement: Optimización del instalador
La configuración de empaquetado MUST (DEBE) habilitar `compression: maximum` y MUST (DEBE) no declarar `asarUnpack` para `resources/**`, de forma que el instalador final quede optimizado y el ASAR no contenga entradas desempaquetadas innecesarias.

#### Scenario: compresión máxima habilitada
- **WHEN** se inspecciona `electron-builder.yml`
- **THEN** la propiedad `compression` tiene el valor `maximum`

#### Scenario: sin asarUnpack redundante
- **WHEN** se inspecciona `electron-builder.yml`
- **THEN** no existe la directiva `asarUnpack: resources/**`

### Requirement: Sourcemaps ocultos para diagnóstico de producción
La configuración de build MUST (DEBE) generar sourcemaps en modo `hidden` para los procesos Main y Preload, y MUST (DEBE) no generar sourcemaps para el renderer en producción, de forma que los stack traces de crashes de producción sean simbolizables sin exponer referencias a los archivos de mapeo en el bundle.

#### Scenario: sourcemaps hidden en Main y Preload
- **WHEN** se ejecuta el build de producción (`npm run build`) y se inspecciona `out/main` y `out/preload`
- **THEN** se generan archivos `.map` para los bundles de Main y Preload y los bundles JavaScript no contienen referencias visibles a los sourcemaps (sin comentarios `//# sourceMappingURL`)

#### Scenario: renderer sin sourcemaps en producción
- **WHEN** se ejecuta el build de producción y se inspecciona `out/renderer`
- **THEN** no se generan archivos `.map` para el bundle del renderer
