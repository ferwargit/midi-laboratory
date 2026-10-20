# Capability: Electron Build Packaging

## Purpose

Define la política de empaquetado de la distribución Electron de `midi-laboratory`: qué contenido del repositorio queda excluido del `app.asar` y qué dependencias son runtime (viajan en `node_modules` dentro del ASAR) frente a build-time (solo `devDependencies`, bundleadas por Vite en `out/renderer`). Garantiza que el instalador no transporte peso muerto y que la aplicación empaquetada arranque con integridad funcional.

## Requirements

### Requirement: Exclusión de artefactos de trabajo del ASAR
La configuración de empaquetado MUST (DEBE) excluir explícitamente del `app.asar` los artefactos de trabajo del repositorio — directorios de tooling, cobertura de tests, especificaciones OpenSpec, reportes generados y documentación de auditoría de la raíz — y MUST (DEBE) seguir conteniendo los artefactos de producción.

#### Scenario: los artefactos de trabajo no aparecen en el ASAR
- **WHEN** se ejecuta el empaquetado (`npm run build:unpack`) y se inspecciona el contenido de `app.asar`
- **THEN** no existen entradas para `.opencode/`, `.engram/`, `.codebase-memory/`, `.vscode/`, `coverage/`, `openspec/`, `repomix-output.xml`, `*.backup`, los markdowns de auditoría/documentación de la raíz ni `renderer/`

#### Scenario: los artefactos de producción se preservan
- **WHEN** se inspecciona el contenido de `app.asar` tras el empaquetado
- **THEN** contiene `out/main/index.js`, `out/preload/index.js`, `out/renderer/**`, `package.json` y el `node_modules` de las dependencias runtime

### Requirement: Clasificación de dependencias runtime
El manifiesto del paquete MUST (DEBE) clasificar como `dependencies` únicamente los módulos resueltos desde `node_modules` en runtime por los procesos Main/Preload.

#### Scenario: dependencies contiene solo los módulos runtime
- **WHEN** se inspecciona `package.json`
- **THEN** `dependencies` contiene exactamente `@electron-toolkit/preload` y `@electron-toolkit/utils`

### Requirement: Exclusión de dependencias build-time del ASAR
Los paquetes consumidos exclusivamente por el renderer y bundleados por Vite en build time, y las herramientas de compilación CSS, MUST (DEBE) estar clasificados como `devDependencies`, de forma que electron-builder no los empaquete en el ASAR.

#### Scenario: los paquetes build-time quedan en devDependencies
- **WHEN** se inspecciona `package.json`
- **THEN** `lucide-react`, `zustand`, `@tailwindcss/vite` y `tailwindcss` aparecen en `devDependencies`

#### Scenario: el node_modules del ASAR no contiene paquetes build-time
- **WHEN** se inspecciona el contenido de `app.asar` tras el empaquetado
- **THEN** `node_modules` dentro del ASAR no contiene `lucide-react`, `zustand`, `@tailwindcss/vite`, `tailwindcss` ni sus transitivas de build (`@tailwindcss/oxide*`, `@tailwindcss/node`)

### Requirement: Integridad funcional tras el reempaquetado
Tras aplicar las exclusiones y la reclasificación, la aplicación MUST (DEBE) conservar integridad funcional completa: el arranque desempaquetado (`electron-builder --dir`) MUST (DEBE) completarse sin errores de módulos no encontrados; la suite de pruebas (`npm test`), la verificación de tipos (`npm run typecheck`) y el lint (`npm run lint`) MUST (DEBE) ejecutarse en verde.

#### Scenario: arranque desempaquetado sin errores de módulos
- **WHEN** se ejecuta `npm run build:unpack` y se arranca la aplicación desde el directorio desempaquetado
- **THEN** los procesos Main y Preload cargan sin errores de módulos no encontrados y la ventana del renderer se muestra correctamente

#### Scenario: suite de verificación en verde
- **WHEN** se ejecutan `npm test`, `npm run typecheck` y `npm run lint` tras los cambios
- **THEN** los tres comandos finalizan sin errores ni regresiones

### Requirement: Reducción medible del tamaño del ASAR
El reempaquetado MUST (DEBE) producir una reducción verificable del tamaño de `app.asar` de al menos 29 MB respecto a la línea base medida antes del cambio (35,05 MB, registrada en `verification.md`), dejando el ASAR final en 6 MB o menos. La medición MUST (DEBE) registrarse comparando el tamaño del `app.asar` generado por `npm run build:unpack` antes y después del cambio.

#### Scenario: la reducción se mide y supera el umbral
- **WHEN** se compara el tamaño de `app.asar` generado tras el cambio contra la línea base previa (35,05 MB)
- **THEN** la reducción medida es de al menos 29 MB, el ASAR final es de 6 MB o menos y ambos valores quedan registrados en la verificación del cambio

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
