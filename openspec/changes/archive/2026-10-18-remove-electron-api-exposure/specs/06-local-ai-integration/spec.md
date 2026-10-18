# Spec Delta

## ADDED Requirements

### Requirement: Exposición exclusiva de customAPI en el preload
El preload MUST (DEBE) exponer al Renderer única y exclusivamente el objeto `customAPI` (con sus contratos `checkLmStudioModels` y `chatLmStudio` intactos) y MUST NOT exponer `electronAPI` ni ningún otro puente genérico de Electron. En particular, MUST NOT existir exposición de `window.electron` bajo `contextIsolation` ni asignación de respaldo de `window.electron` fuera de ella.

#### Scenario: con contextIsolation solo se expone customAPI
- **WHEN** el preload se ejecuta con `contextIsolation` activo
- **THEN** el puente expone únicamente `customAPI` y no existe ninguna propiedad `electron` expuesta en `window`

#### Scenario: sin contextIsolation solo se asigna window.customAPI
- **WHEN** el preload se ejecuta sin `contextIsolation`
- **THEN** solo se asigna `window.customAPI` y no se realiza ninguna asignación de `window.electron`

#### Scenario: los contratos de customAPI permanecen intactos
- **WHEN** el Renderer invoca `window.customAPI.checkLmStudioModels(baseUrl?)` o `window.customAPI.chatLmStudio(payload)`
- **THEN** las llamadas se resuelven contra los handlers IPC `lm-studio:check-models` y `lm-studio:chat-completion` con las mismas firmas y contratos de retorno que antes del cambio

### Requirement: Tipos globales Window saneados
La declaración global de tipos del preload MUST (DEBE) declarar en la interfaz `Window` únicamente `customAPI` con su contrato completo, y MUST NOT declarar la propiedad `electron` ni importar el tipo `ElectronAPI` de `@electron-toolkit/preload`.

#### Scenario: Window declara únicamente customAPI
- **WHEN** se inspecciona la declaración global de tipos del preload
- **THEN** la interfaz `Window` contiene únicamente la propiedad `customAPI` con las firmas de `checkLmStudioModels` y `chatLmStudio`

#### Scenario: sin declaración ni import de ElectronAPI
- **WHEN** se inspecciona la declaración global de tipos del preload
- **THEN** no existe la propiedad `electron` en `Window` ni ningún import de `ElectronAPI`

### Requirement: Ausencia de dependencia del Renderer sobre window.electron
El Renderer MUST (DEBE) funcionar sin `window.electron`: ningún componente, servicio o módulo del Renderer MAY depender de esa propiedad, de forma que su eliminación no rompa la compilación ni el comportamiento de la aplicación.

#### Scenario: la compilación no se rompe al eliminar la declaración
- **WHEN** se elimina la declaración de `window.electron` de los tipos globales y se ejecuta el typecheck del proceso node y del renderer
- **THEN** ambos typechecks compilan sin errores, demostrando que ningún código del Renderer dependía de `window.electron`

#### Scenario: la suite completa no registra regresiones
- **WHEN** se ejecuta la suite completa de pruebas tras la eliminación de la exposición
- **THEN** todos los tests existentes pasan sin modificaciones, incluidos los del servicio LM Studio del frontend
