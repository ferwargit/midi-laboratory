# Spec Delta

## Purpose

Define la política de endurecimiento de la ventana del proceso Main de `midi-laboratory`: validación estricta de esquemas en la apertura de URLs externas, prevención de navegaciones in-frame no autorizadas y deshabilitación explícita de DevTools en producción, de forma que un renderer comprometido no pueda pivotar hacia el sistema operativo ni hacia orígenes ajenos a la aplicación.

## ADDED Requirements

### Requirement: Validación estricta de esquema en apertura de URLs externas
El proceso Main MUST (DEBE) validar la URL de cualquier ventana emergente con un parser de URL real antes de invocar `shell.openExternal`: SOLO MUST abrirse cuando la URL parsea correctamente y su protocolo es estrictamente `https:` o `http:`. Cualquier otro esquema (incluidos `file:`, `javascript:`, `data:`) o URL malformada MUST denegar la acción sin invocar `shell.openExternal`.

#### Scenario: URLs https y http legítimas se abren
- **WHEN** una ventana emergente solicita abrir una URL con protocolo `https:` o `http:` (ej. `https://github.com/ferwargit/midi-laboratory`)
- **THEN** la acción se delega a `shell.openExternal` y la ventana emergente se deniega

#### Scenario: esquemas peligrosos se deniegan sin abrir
- **WHEN** una ventana emergente solicita abrir una URL con esquema distinto de http/https (ej. `file:///C:/secrets.txt`, `javascript:alert(1)`, `data:text/html,...`)
- **THEN** la acción se deniega y `shell.openExternal` NO es invocado

#### Scenario: URLs malformadas se deniegan sin abrir
- **WHEN** una ventana emergente solicita abrir una cadena que no parsea como URL (ej. `not-a-url`, `https:`)
- **THEN** la acción se deniega y `shell.openExternal` NO es invocado

### Requirement: Prevención de navegaciones in-frame no autorizadas
El proceso Main MUST (DEBE) registrar un listener `will-navigate` sobre el `webContents` de la ventana principal que cancele con `event.preventDefault()` cualquier navegación cuyo origen no coincida con el origen local de la aplicación: el dev server configurado en desarrollo y el esquema `file://` de la aplicación empaquetada en producción.

#### Scenario: navegación al origen propio se permite
- **WHEN** el webContents navega a una URL cuyo origen coincide con el origen local de la aplicación (dev server en desarrollo, `file://` en producción)
- **THEN** la navegación procede sin cancelación

#### Scenario: navegación a origen ajeno se cancela
- **WHEN** el webContents intenta navegar in-frame a un origen ajeno (ej. `https://evil.example.com`, `http://192.168.1.10/`)
- **THEN** la navegación se cancela con `event.preventDefault()` y la aplicación permanece en su página actual

### Requirement: DevTools deshabilitados en producción
El `BrowserWindow` MUST (DEBE) configurar explícitamente `devTools` en `webPreferences` según el entorno: habilitadas en desarrollo y deshabilitadas en producción, de forma que las herramientas de desarrollo no estén disponibles en el binario empaquetado.

#### Scenario: DevTools deshabilitadas en producción
- **WHEN** la aplicación se ejecuta en producción y se inspecciona la configuración `webPreferences` del `BrowserWindow`
- **THEN** `devTools` está configurado explícitamente con el valor del entorno de desarrollo (deshabilitado en producción)

#### Scenario: DevTools disponibles en desarrollo
- **WHEN** la aplicación se ejecuta en desarrollo
- **THEN** `devTools` permanece habilitado para depuración
