# Spec Delta

## ADDED Requirements

### Requirement: Allowlist de host local para baseUrl en handlers IPC
Los handlers IPC `lm-studio:check-models` y `lm-studio:chat-completion` MUST (DEBE) validar el host de destino de `baseUrl` antes de cualquier llamada de red. Si `baseUrl` no se proporciona o está vacía, MUST resolverse al host canónico `http://127.0.0.1:1234`. Si se proporciona, SOLO MUST aceptarse cuando el protocolo es `http:` o `https:` y el host es estrictamente `127.0.0.1` o `localhost`, permitiendo cualquier puerto numérico válido (1–65535). Cualquier otro destino MUST rechazarse.

#### Scenario: baseUrl ausente resuelve al host canónico
- **WHEN** un handler IPC recibe `baseUrl` indefinida, vacía o solo con espacios
- **THEN** la petición de red se dirige al host canónico `http://127.0.0.1:1234` sin error

#### Scenario: hosts locales válidos con cualquier puerto
- **WHEN** un handler IPC recibe `baseUrl` con host `127.0.0.1` o `localhost` en puertos válidos (ej. `http://127.0.0.1:1234`, `http://localhost:8080`, `https://localhost:1234`)
- **THEN** la validación acepta la URL y la petición de red se ejecuta contra ese host

#### Scenario: rechazo de IPs privadas y públicas no locales
- **WHEN** un handler IPC recibe `baseUrl` apuntando a una IP privada o pública no local (ej. `http://192.168.1.10:1234`, `http://10.0.0.5:1234`, `http://172.16.0.1:1234`, `http://8.8.8.8:1234`)
- **THEN** la validación rechaza la URL y no se ejecuta ninguna petición de red

#### Scenario: rechazo de dominios remotos
- **WHEN** un handler IPC recibe `baseUrl` con un dominio remoto (ej. `http://evil.example.com`, `https://internal.corp.local`)
- **THEN** la validación rechaza la URL y no se ejecuta ninguna petición de red

#### Scenario: rechazo de protocolos no HTTP y URLs malformadas
- **WHEN** un handler IPC recibe `baseUrl` con protocolo distinto de http/https (ej. `file:///etc/passwd`, `ftp://127.0.0.1`) o una cadena que no parsea como URL (ej. `not-a-url`, `127.0.0.1:1234` sin esquema)
- **THEN** la validación rechaza la URL y no se ejecuta ninguna petición de red

### Requirement: Denegación controlada sin ejecutar la petición de red
Cuando la validación de `baseUrl` falla, los handlers IPC MUST (DEBE) denegar la petición de forma controlada, sin lanzar excepciones no capturadas hacia el Renderer y sin ejecutar `fetch()`. `lm-studio:check-models` MUST devolver `null`; `lm-studio:chat-completion` MUST devolver `{ success: false, error }` con un mensaje que indique el rechazo del host. Los contratos de retorno existentes para URLs válidas MUST preservarse sin cambios.

#### Scenario: check-models devuelve null ante host inválido
- **WHEN** `lm-studio:check-models` recibe una `baseUrl` rechazada por la validación
- **THEN** el handler devuelve `null` sin lanzar excepción y sin emitir ninguna petición HTTP

#### Scenario: chat-completion devuelve error controlado ante host inválido
- **WHEN** `lm-studio:chat-completion` recibe un payload con una `baseUrl` rechazada por la validación
- **THEN** el handler devuelve `{ success: false, error }` con un mensaje descriptivo del rechazo, sin lanzar excepción y sin emitir ninguna petición HTTP

#### Scenario: comportamiento intacto para hosts válidos
- **WHEN** los handlers reciben una `baseUrl` válida (o ninguna) con LM Studio activo
- **THEN** el comportamiento es idéntico al actual: `check-models` devuelve el primer modelo cargado o `null`, y `chat-completion` devuelve `{ success: true, content, model }` o `{ success: false, error }` según la respuesta del servidor

### Requirement: Registro auditable de baseUrl rechazadas
El proceso Main MUST (DEBE) emitir una salida de diagnóstico en consola cada vez que rechaza una `baseUrl`, incluyendo el valor rechazado y el handler involucrado, de forma que los intentos de SSRF sean observables durante auditorías y depuración.

#### Scenario: rechazo queda registrado en el proceso Main
- **WHEN** cualquiera de los handlers IPC rechaza una `baseUrl` inválida
- **THEN** la consola del proceso Main registra un mensaje de diagnóstico que identifica el handler y la `baseUrl` rechazada
