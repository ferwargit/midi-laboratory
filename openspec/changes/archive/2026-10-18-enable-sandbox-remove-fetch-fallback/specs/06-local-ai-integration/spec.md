# Spec Delta

## MODIFIED Requirements

### Requirement: Handlers IPC de Electron con AbortController y Timeouts

El proceso principal MUST (DEBE) exponer exactamente dos handlers IPC bajo el namespace `lm-studio:*`, ambos con `AbortController` acoplado a un temporizador.

- `lm-studio:check-models(baseUrl?)` MUST crear un `AbortController` con timeout de 2500 ms hacia `GET /v1/models` y devolver el primer modelo cargado o `null`.
- `lm-studio:chat-completion(payload)` MUST resolver `timeoutMs` (por defecto 900.000 ms), ejecutar `POST /v1/chat/completions` con `AbortController` y devolver `{ success: true, content, model }` o `{ success: false, error }` sin lanzar excepciones. MUST extraer `content` o `reasoning_content`.
- El `BrowserWindow` MUST construirse con `contextIsolation: true` y `sandbox: true`.

#### Scenario: Servidor caído no bloquea el renderer

- **GIVEN** el handler `lm-studio:check-models` y un LM Studio inalcanzable
- **WHEN** se invoca el handler
- **THEN** la promesa se resuelve con `null` en un tiempo cercano a 2500 ms

#### Scenario: Modelo de razonamiento con reasoning_content

- **GIVEN** el handler `lm-studio:chat-completion` y un payload válido
- **WHEN** LM Studio responde con `choices[0].message.content` vacío pero `reasoning_content` poblado
- **THEN** la respuesta devuelve `{ success: true, content: <reasoning_content>, model: <id> }`

#### Scenario: El renderer opera con sandbox de Chromium activo

- **GIVEN** el archivo `src/main/index.ts` en disco
- **WHEN** se inspecciona la configuración `webPreferences` de `createWindow()`
- **THEN** declara `sandbox: true` y `contextIsolation: true`, sin comentario que justifique `sandbox: false`

### Requirement: Método Centralizado sendChat (Patrón DRY)

`LmStudioService` MUST (DEBE) implementar un único método privado `sendChat(messages, temperature, model)` como única puerta de salida hacia la red, aplicando la política de transporte IPC exclusivo: `window.customAPI` es el único canal de comunicación con LM Studio y NO DEBE existir ningún fallback a `fetch()` directo en el servicio.

- `sendChat` MUST invocar exclusivamente el canal IPC (`window.customAPI?.chatLmStudio`).
- En el canal IPC, si `result.success` es falso o `result.content` está vacío, MUST lanzar un `Error` para que el circuit breaker lo cuente como fallo.
- Si `window.customAPI` no está disponible, `sendChat` MUST lanzar un `Error` controlado sin intentar `fetch()` directo; el circuit breaker MUST resolver la operación con el fallback algorítmico correspondiente.
- `getLoadedModelId()` MUST ser fail-fast: devuelve `null` inmediatamente si `circuitBreaker.canExecute()` es falso, y MUST devolver `null` controlado si el canal IPC no está disponible, sin intentar `fetch()` directo.
- Los tres métodos públicos (`analyzeAndPrescribe`, `askCustomConsultation`, `askMultiSessionComparison`) MUST usar `sendChat`.

#### Scenario: Diagnóstico exitoso vía IPC

- **GIVEN** `window.customAPI.chatLmStudio` presente y un modelo cargado
- **WHEN** se ejecuta `analyzeAndPrescribe(metrics)`
- **THEN** la respuesta tiene `source === 'lm_studio_ai'`

#### Scenario: Caída a fetch cuando no hay IPC

- **GIVEN** `window.customAPI` ausente
- **WHEN** se ejecuta `analyzeAndPrescribe(metrics)`
- **THEN** el servicio NO emite ninguna petición `fetch` y la respuesta se resuelve con `source === 'algorithmic_fallback'` (degradación controlada por el circuit breaker; el antiguo fallback a `fetch()` directo queda eliminado)

#### Scenario: El servicio no contiene fallback a fetch

- **GIVEN** el archivo `src/renderer/src/domain/ai/lmStudioService.ts` en disco
- **WHEN** se inspecciona su fuente
- **THEN** no contiene ninguna llamada `fetch()` y `window.customAPI` es la única vía de comunicación referenciada

### Requirement: Content-Security-Policy Sincronizada con la Configuración

El renderer MUST (DEBE) declarar una CSP en `index.html` que NO permita ninguna salida de red directa del renderer hacia LM Studio: todo el tráfico hacia LM Studio MUST fluir por el canal IPC (`window.customAPI`), que no pasa por la CSP.

- La etiqueta CSP en `index.html` MUST contener una directiva `connect-src` limitada a `'self'` y MUST NOT incluir el host de LM Studio (`DEFAULT_APP_CONFIG.lmStudio.baseUrl`).
- El test de regresión `index-csp.test.ts` MUST verificar que el `connect-src` declarado NO contenga el `baseUrl` de `appConfig.ts` y que el proceso Main declara `sandbox: true`.

#### Scenario: Regresión de sincronización CSP ↔ appConfig

- **GIVEN** el archivo `src/renderer/index.html` en disco
- **WHEN** se ejecuta la suite `index-csp.test.ts`
- **THEN** el HTML contiene la etiqueta CSP con `connect-src 'self'` y NO contiene el valor `http://127.0.0.1:1234` (la apertura existía únicamente para el fallback a `fetch()`, ya eliminado)

#### Scenario: Postura de seguridad coherente entre Main y renderer

- **GIVEN** los archivos `src/main/index.ts` y `src/renderer/index.html` en disco
- **WHEN** se ejecuta la suite `index-csp.test.ts`
- **THEN** el Main declara `sandbox: true` y la CSP no permite `fetch()` directo del renderer hacia LM Studio
