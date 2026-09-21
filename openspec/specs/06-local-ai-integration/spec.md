# Capability: Local AI Integration & Resilient Diagnostics

## Purpose

Esta capacidad define la **capa de inferencia LLM local en GPU** de `midi-laboratory`, integrada con LM Studio como backend de razonamiento, y su **andamiaje de tolerancia a fallos**. El sistema no asume que la IA está disponible: la trata como un servicio _best-effort_ sobre el que se construye un canal de comunicación híbrido (IPC de Electron primario + `fetch()` directo de respaldo), un circuit breaker que suprime llamadas condenadas al fracaso, un generador de _fallback_ algorítmico determinista, un parser léxico balanceado inmune a los bloques de pensamiento de los modelos de razonamiento modernos, y un sanitizador de prescripciones.

El contrato es de **dominio puro en el renderer**: `LmStudioService`, `CircuitBreaker`, `promptBuilder`, `schemaValidator`, `prescriptionSanitizer` y `fallbackGenerator` son unidades independientes de React. Toda la configuración de red es **SSOT** (`DEFAULT_APP_CONFIG.lmStudio`), y la directiva CSP de `index.html` está acoplada contractualmente a esa misma fuente mediante un test de regresión.

| Frente             | Unidad canónica                                                  | Responsabilidad                                                    |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| Configuración SSOT | `domain/ai/appConfig.ts` → `DEFAULT_APP_CONFIG.lmStudio`         | `baseUrl`, timeouts y temperatura canónicos                        |
| Canal IPC          | `main/index.ts` (handlers) + `preload/index.ts` (`customAPI`)    | `AbortController`, timeouts por operación, puente `contextBridge`  |
| Servicio           | `domain/ai/lmStudioService.ts` → `sendChat`                      | Método único DRY: IPC primario, `fetch()` de respaldo              |
| Seguridad          | `renderer/index.html` (CSP `connect-src`) + `index-csp.test.ts`  | Habilita el _fallback_ a `fetch()` sin bloqueo silencioso          |
| Resiliencia        | `domain/ai/circuitBreaker.ts` → `CircuitBreaker`                 | Estados `CLOSED`/`OPEN`/`HALF_OPEN`, umbral, _cooldown_, supresión |
| Degradación        | `domain/ai/fallbackGenerator.ts` → `generateAlgorithmicFallback` | Diagnóstico y prescripción determinista sin red                    |
| Prompts            | `domain/ai/promptBuilder.ts`                                     | Prompts especializados, tutor multi-turn, comparativa multi-sesión |
| Parseo             | `domain/ai/schemaValidator.ts`                                   | JSON balanceado, purgado de bloques de pensamiento, validación     |
| Sanitización       | `domain/ai/prescriptionSanitizer.ts`                             | Corrección de octavas, campos huérfanos, viabilidad mínima         |
| Estado             | `stores/useAiStore.ts`                                           | Respuestas segregadas por modalidad, persistencia de reportes      |
| Contrato           | `domain/ai/aiDecoupling.test.ts`                                 | Inmutabilidad de métricas grabadas ante fallos de la IA            |

**Alcance (in-scope):** configuración SSOT, handlers IPC con timeouts, puente `customAPI`, método `sendChat`, CSP, circuit breaker, generador de _fallback_, construcción de prompts, validación de respuestas del LLM, sanitización y desacoplamiento de métricas.

**Fuera de alcance (out-of-scope):** cálculo de métricas psicométricas (Módulo 05), evaluación musical (Módulo 03), persistencia en IndexedDB (Módulo 02) y síntesis audio/MIDI (Módulo 01).

## Requirements

### Requirement: Fuente Única de Verdad de la Configuración LM Studio

Todo el sistema MUST (DEBE) leer la configuración de red de LM Studio exclusivamente desde `DEFAULT_APP_CONFIG.lmStudio` en `domain/ai/appConfig.ts`, prohibiendo la codificación rígida del host, los timeouts o la temperatura en cualquier otro archivo.

- `LmStudioConfig` MUST contener exactamente:
  - `baseUrl: 'http://127.0.0.1:1234'`
  - `checkModelTimeoutMs: 2500`
  - `chatTimeoutMs: 900000` (15 minutos para deep reasoning en GPU)
  - `defaultTemperature: 0.3`
- `LmStudioService` MUST instanciarse sin argumentos con esa configuración por defecto, aceptando overrides como string o `Partial<LmStudioConfig>`. `getBaseUrl()` MUST exponer el baseUrl resuelto.

#### Scenario: Configuración por defecto y overrides

- **GIVEN** la instanciación `new LmStudioService()`
- **WHEN** se consulta `getBaseUrl()`
- **THEN** devuelve `'http://127.0.0.1:1234'`
- **WHEN** se instancia `new LmStudioService('http://192.168.1.100:8080')`
- **THEN** `getBaseUrl()` devuelve `'http://192.168.1.100:8080'`

### Requirement: Handlers IPC de Electron con AbortController y Timeouts

El proceso principal MUST (DEBE) exponer exactamente dos handlers IPC bajo el namespace `lm-studio:*`, ambos con `AbortController` acoplado a un temporizador.

- `lm-studio:check-models(baseUrl?)` MUST crear un `AbortController` con timeout de 2500 ms hacia `GET /v1/models` y devolver el primer modelo cargado o `null`.
- `lm-studio:chat-completion(payload)` MUST resolver `timeoutMs` (por defecto 900.000 ms), ejecutar `POST /v1/chat/completions` con `AbortController` y devolver `{ success: true, content, model }` o `{ success: false, error }` sin lanzar excepciones. MUST extraer `content` o `reasoning_content`.
- El `BrowserWindow` MUST construirse con `contextIsolation: true` y `sandbox: false`.

#### Scenario: Servidor caído no bloquea el renderer

- **GIVEN** el handler `lm-studio:check-models` y un LM Studio inalcanzable
- **WHEN** se invoca el handler
- **THEN** la promesa se resuelve con `null` en un tiempo cercano a 2500 ms

#### Scenario: Modelo de razonamiento con reasoning_content

- **GIVEN** el handler `lm-studio:chat-completion` y un payload válido
- **WHEN** LM Studio responde con `choices[0].message.content` vacío pero `reasoning_content` poblado
- **THEN** la respuesta devuelve `{ success: true, content: <reasoning_content>, model: <id> }`

### Requirement: Puente customAPI del Preload

El preload MUST (DEBE) exponer al renderer exactamente el objeto `customAPI` bajo `contextIsolation`, mapeando 1:1 los handlers IPC.

- `preload/index.ts` MUST declarar `checkLmStudioModels(baseUrl?)` y `chatLmStudio(payload)`.
- El contrato de tipos global (`src/preload/index.d.ts`) MUST declarar `Window.customAPI` con la misma firma.

#### Scenario: Canal IPC disponible en el renderer

- **GIVEN** el renderer ejecutándose con `contextIsolation: true`
- **WHEN** el servicio invoca `window.customAPI.chatLmStudio(payload)`
- **THEN** la llamada se enruta al handler `lm-studio:chat-completion` y la respuesta tipada vuelve al renderer

### Requirement: Método Centralizado sendChat (Patrón DRY)

`LmStudioService` MUST (DEBE) implementar un único método privado `sendChat(messages, temperature, model)` como única puerta de salida hacia la red, aplicando la política de transporte híbrido.

- `sendChat` MUST dar prioridad al canal IPC (`window.customAPI?.chatLmStudio`).
- En la rama IPC, si `result.success` es falso o `result.content` está vacío, MUST lanzar un `Error` para que el circuit breaker lo cuente como fallo.
- Solo si la IPC no existe, `sendChat` MUST caer a `fetch()` directo contra `${baseUrl}/v1/chat/completions`.
- Los tres métodos públicos (`analyzeAndPrescribe`, `askCustomConsultation`, `askMultiSessionComparison`) MUST usar `sendChat`.
- `getLoadedModelId()` MUST ser fail-fast: devuelve `null` inmediatamente si `circuitBreaker.canExecute()` es falso.

#### Scenario: Diagnóstico exitoso vía IPC

- **GIVEN** `window.customAPI.chatLmStudio` presente y un modelo cargado
- **WHEN** se ejecuta `analyzeAndPrescribe(metrics)`
- **THEN** la respuesta tiene `source === 'lm_studio_ai'`

#### Scenario: Caída a fetch cuando no hay IPC

- **GIVEN** `window.customAPI` ausente
- **WHEN** se ejecuta `analyzeAndPrescribe(metrics)`
- **THEN** el servicio usa `global.fetch` hacia `/v1/chat/completions`

### Requirement: Content-Security-Policy Sincronizada con la Configuración

El renderer MUST (DEBE) declarar una CSP en `index.html` que permita explícitamente el host canónico de LM Studio, de forma que el fallback a `fetch()` nunca sea bloqueado en silencio por Chromium.

- La etiqueta CSP en `index.html` MUST contener una directiva `connect-src` que incluya literalmente `DEFAULT_APP_CONFIG.lmStudio.baseUrl` (`'http://127.0.0.1:1234'`) y `'self'`.
- El test de regresión `index-csp.test.ts` MUST verificar que el `connect-src` declarado contenga el `baseUrl` de `appConfig.ts`.

#### Scenario: Regresión de sincronización CSP ↔ appConfig

- **GIVEN** el archivo `src/renderer/index.html` en disco
- **WHEN** se ejecuta la suite `index-csp.test.ts`
- **THEN** el HTML contiene la etiqueta CSP y el valor `http://127.0.0.1:1234`

### Requirement: Máquina de Estados del Circuit Breaker

El sistema MUST (DEBE) envolver toda invocación a la red en un `CircuitBreaker` de tres estados que protege la interfaz de práctica musical.

- Los estados MUST ser exactamente `'CLOSED' | 'OPEN' | 'HALF_OPEN'`.
- `DEFAULT_CIRCUIT_CONFIG` MUST ser: `failureThreshold: 3`, `cooldownPeriodMs: 30000` y `requestTimeoutMs: 900000`.
- Si el estado es `OPEN` y `Date.now() - lastFailureTime >= cooldownPeriodMs`, MUST promover a `HALF_OPEN`.
- `canExecute()` MUST devolver `true` solo para `CLOSED` o `HALF_OPEN`.
- `recordSuccess()` MUST resetear `failureCount` a 0 y estado a `CLOSED`.
- `recordFailure()` MUST pasar a `OPEN` al alcanzar `failureThreshold`.

#### Scenario: Transición a HALF_OPEN tras el enfriamiento

- **GIVEN** un breaker `OPEN` con `cooldownPeriodMs: 1000` y tiempo de enfriamiento cumplido
- **WHEN** se invoca `getState()`
- **THEN** devuelve `'HALF_OPEN'` y `canExecute()` se vuelve `true`

### Requirement: Ejecución con Supresión y Degradación Instantánea

`execute(operation, fallbackOperation)` MUST (DEBE) ser el único punto de paso y DEBE garantizar que la interfaz nunca se bloquea.

- Si `canExecute()` es `false`, `execute` MUST devolver `fallbackOperation()` inmediatamente sin llamar a `operation` (supresión).
- En caso de poder ejecutar, MUST correr la operación con un temporizador `requestTimeoutMs`.
- Si la operación falla o agota el timeout, MUST llamar a `recordFailure()` y devolver `fallbackOperation()`. El error NUNCA MUST propagarse al llamador.

#### Scenario: Caída del servidor no bloquea la práctica

- **GIVEN** un breaker por defecto y una operación que rechaza con `Error('Network error')`
- **WHEN** se ejecuta `execute(brokenOperation, fallback)`
- **THEN** se resuelve con el valor del `fallback`, sin lanzar excepciones

#### Scenario: Circuito abierto suprime la tercera llamada

- **GIVEN** un breaker con `failureThreshold: 2` y una operación que siempre rechaza
- **WHEN** se ejecuta dos veces seguidas
- **THEN** el estado pasa a `OPEN`
- **WHEN** se ejecuta una tercera vez
- **THEN** el resultado es el `fallback` y la operación no fue invocada

### Requirement: Generador de Fallback Algorítmico

Cuando LM Studio está apagado, el circuito está abierto o la respuesta es inválida, el sistema MUST (DEBE) poder generar un diagnóstico clínico y una prescripción ejecutable sin ninguna red.

- `generateAlgorithmicFallback(metrics)` MUST devolver un `AiAnalysisResponse` con `source: 'algorithmic_fallback'` y `modelName: 'Motor Heurístico Local'`.
- El `targetMode` de la prescripción MUST ser `'intervals'` si `modeFilter === 'intervals'`, `'sequences'` si es `'sequences'`, o `'single_note'` en otro caso.
- La prescripción generada MUST ser válida y ejecutable (`limitType: 'questions'`, `questionsCount: 10`, `advanceMode: 'smart'`).
- El `analysisText` MUST construirse a partir de `generateDiagnosticReport`.

#### Scenario: Prescripción determinista por modalidad

- **GIVEN** métricas con `modeFilter: 'intervals'`
- **WHEN** se ejecuta `generateAlgorithmicFallback`
- **THEN** `source === 'algorithmic_fallback'` y `prescription.recommendedIntervals === [2, 4, 5, 7]`

#### Scenario: Diagnóstico algorítmico cuando no hay modelo cargado

- **GIVEN** un `LmStudioService` cuyo `getLoadedModelId` devuelve `null`
- **WHEN** se ejecuta `analyzeAndPrescribe(metrics)`
- **THEN** el resultado es `source: 'algorithmic_fallback'`

### Requirement: Prompts Especializados con Catálogo Formal

El sistema MUST (DEBE) construir los prompts con un único módulo `promptBuilder`, alineando las instrucciones con el catálogo real de parámetros del software.

- `buildSystemPrompt(mode)` MUST asumir el rol de "Profesor de Oído Musical y Psicoacústica de Élite" e incluir el catálogo formal de parámetros disponibles (`targetMode`, `instrumentId`, `recommendedNotes`, etc.).
- Las directivas MUST especializarse por `mode`: pool de notas para `single_note`, semitonos para `intervals` y longitud para `sequences`.
- El formato de respuesta MUST exigir JSON puro con `analysisText` y `prescription`.
- `buildUserPrompt(metrics, customQueryType?)` MUST empaquetar métricas, comparativas longitudinales y telemetría de las últimas 10 sesiones con las etiquetas SSOT.

#### Scenario: Prompt de nota individual con catálogo

- **GIVEN** `buildSystemPrompt('single_note')`
- **WHEN** se genera
- **THEN** contiene `Profesor de Oído Musical`, `CATÁLOGO FORMAL DE PARÁMETROS DISPONIBLES` y la directiva `targetMode DEBE ser 'single_note'`

### Requirement: Tutor Conversacional Multi-Turn y Comparativa Multi-Sesión

El sistema MUST (DEBE) mantener la continuidad pedagógica entre consultas y soportar análisis comparativos cruzados.

- `buildConsultationSystemPrompt(mode, recentReports?)` MUST inyectar un resumen de las últimas 3 prescripciones asignadas al alumno.
- `buildConsultationUserPrompt(userQuery, metrics, conceptId?)` MUST incluir la duda del alumno, el concepto pedagógico de referencia y el perfil del alumno.
- `buildConversationalMessages` MUST alternar `user`/`assistant` con el historial recortado a las últimas 4 consultas previas.
- `buildMultiSessionComparisonPrompt(selectedSessions, metrics)` MUST serializar la telemetría completa de cada sesión seleccionada.

#### Scenario: Secuencia multi-turn coherente

- **GIVEN** consultas previas y un reporte previo
- **WHEN** se ejecuta `buildConversationalMessages`
- **THEN** `messages[0]` es `system` citando la prescripción previa, seguido del historial `user`/`assistant` y la consulta actual

#### Scenario: Comparativa de N sesiones serializa telemetría cruzada

- **GIVEN** una selección de sesiones
- **WHEN** se ejecuta `buildMultiSessionComparisonPrompt`
- **THEN** el prompt contiene `SOLICITUD DE COMPARATIVA MULTI-SESIÓN` y la telemetría detallada

### Requirement: Parser Léxico Balanceado e Inmunidad a Bloques de Pensamiento

El sistema MUST (DEBE) extraer el JSON de la respuesta cruda del LLM con un parser léxico propio, inmune a los artefactos de los modelos de razonamiento modernos.

- `extractBalancedJsonObject(rawText)` MUST eliminar previamente cualquier bloque encerrado entre tags `<think>` y `</think>` antes de contar llaves.
- MUST extraer el interior de bloques cercados con la etiqueta `json` o quitar cercas de tres backticks.
- MUST localizar el primer carácter `{` y balancear la profundidad ignorando llaves y comillas dentro de strings literales.
- Si las llaves están desbalanceadas, MUST devolver `null`.

#### Scenario: Bloque de razonamiento con llaves trampa dentro

- **GIVEN** una respuesta con tags `<think>` que contienen llaves trampa `{ debug: "fail" }`, seguida de un bloque JSON válido
- **WHEN** se ejecuta `validateAndParseAiResponse`
- **THEN** el resultado no es `null` y `prescription.title` es el esperado

#### Scenario: Llaves dentro de un string literal

- **GIVEN** un texto que define `"analysisText": "Nota: {C4} es clave"`
- **WHEN** se ejecuta `extractBalancedJsonObject`
- **THEN** el JSON extraído conserva el texto intacto

### Requirement: Validación Estructural Estricta de la Respuesta

El sistema MUST (DEBE) rechazar cualquier respuesta del LLM que no cumpla el contrato estructural, antes de confiar en ella.

- `validateAndParseAiResponse(rawJsonString, modelName)` MUST devolver `null` si `JSON.parse` falla, si `analysisText` no es string no vacío, o si `prescription` no pasa `isValidPrescription`.
- `isValidPrescription(obj)` MUST rechazar valores no objeto, campos obligatorios vacíos o tipos incongruentes, notas fuera de rango MIDI [21, 108], o conteos `<= 0`.

#### Scenario: Payload 100% válido aceptado

- **GIVEN** el JSON stringificado de un payload válido
- **WHEN** se ejecuta `validateAndParseAiResponse(raw, 'qwen3.5')`
- **THEN** `result.source === 'lm_studio_ai'` y la prescripción es sanitizada

#### Scenario: Entradas malformadas o campos inválidos rechazados

- **GIVEN** una entrada con JSON incompleto o con `questionsCount: -1`
- **WHEN** se ejecuta la validación
- **THEN** devuelve `null` o `false`

### Requirement: Sanitizador Determinista de Prescripciones

El sistema MUST (DEBE) sanitizar toda prescripción corrigiendo las inconsistencias lógicas más frecuentes de los LLM antes de que sea ejecutable.

- `single_note` MUST eliminar `recommendedIntervals` y `sequenceLength`.
- `intervals` MUST eliminar `sequenceLength` y rellenar `recommendedIntervals` con `[2, 4, 5, 7]` si está vacío.
- `sequences` MUST eliminar `recommendedIntervals` y acotar `sequenceLength` en `[3, 6]` (default 3).
- **Corrección de octavas:** si el texto menciona notas concretas (ej. B4) pero `recommendedNotes` incluye notas a 12 semitonos de distancia (ej. B5/83), MUST corregirse a la octava mencionada.
- **Viabilidad mínima:** si `recommendedNotes` tiene menos de 2 notas, MUST reemplazarse por `[60, 62, 64]`.

#### Scenario: Corrección de octava B5 → B4 mencionada en el texto

- **GIVEN** una prescripción que menciona `B4` en el texto pero incluye `83` (B5) en `recommendedNotes`
- **WHEN** se ejecuta `sanitizePrescription`
- **THEN** `recommendedNotes` contiene `71` (B4 corregido)

#### Scenario: Campos huérfanos eliminados por modalidad

- **GIVEN** una prescripción `single_note` con `recommendedIntervals` presente
- **WHEN** se ejecuta `sanitizePrescription`
- **THEN** `recommendedIntervals` es `undefined`

### Requirement: Store de IA Segregado por Modalidad

El store MUST (DEBE) centralizar las respuestas de IA separadas por modalidad de análisis, de forma que el diagnóstico de una modalidad nunca pise el de otra.

- El estado MUST exponer `aiResponsesByMode` (mapa con entrada por cada `AnalyticsModeFilter`), `isLmStudioOnline` e `isAiAnalyzing`.
- `runAiDiagnostic(metrics, saveReportCallback?)` MUST almacenar la respuesta bajo `metrics.modeFilter`. En caso de error, MUST caer a `generateAlgorithmicFallback` sin propagar la excepción.
- `hydrateReportsByMode(reports, metrics)` MUST reconstruir las respuestas por modalidad desde los reportes persistidos.

#### Scenario: Hidratación segregada por modalidad

- **GIVEN** reportes persistidos para `single_note` e `intervals`
- **WHEN** se ejecuta `hydrateReportsByMode(reports, metrics)`
- **THEN** las respuestas quedan separadas bajo sus respectivas claves en `aiResponsesByMode`

#### Scenario: El error de IA degrada y no rompe el flujo

- **GIVEN** un servicio que rechaza en `analyzeAndPrescribe`
- **WHEN** se ejecuta `runAiDiagnostic(metrics, saveCallback)`
- **THEN** `isAiAnalyzing === false` y la respuesta es `source: 'algorithmic_fallback'`

### Requirement: Desacoplamiento Absoluto — Cero Impacto sobre las Métricas Grabadas

Las métricas psicométricas y las sesiones grabadas MUST (DEBE) ser inmutables respecto a la IA: un fallo total del pipeline de inferencia NO DEBE alterar, corromper ni bloquear las métricas, las sesiones ni la navegación.

- La evaluación de respuestas y el cálculo de métricas MUST ser funciones puras e independientes de la IA.
- Un fallo total de LM Studio (timeout, error 500, GPU crash) MUST resolverse con `algorithmic_fallback`, nunca mutando los campos de `DbSessionRecord` ni de `DbAnswerRecord`.
- Este contrato MUST estar blindado por `aiDecoupling.test.ts`.

#### Scenario: El diagnóstico posterior no altera las métricas inmutables

- **GIVEN** una sesión evaluada con `overallAccuracy: 100`
- **WHEN** se ejecuta `analyzeAndPrescribe` contra un LM Studio inalcanzable
- **THEN** la IA responde vía fallback y `overallAccuracy` sigue siendo `100`

#### Scenario: Un error crítico de la IA no corrompe la sesión

- **GIVEN** un breaker cuyo `execute` rechaza con `Error('GPU Out of Memory')`
- **WHEN** se invoca `analyzeAndPrescribe`
- **THEN** los registros de sesión y respuestas mantienen su integridad intacta
