# Capability: Local AI Integration & Resilient Diagnostics

## Propósito y Alcance

Esta capacidad define la **capa de inferencia LLM local en GPU** de `midi-laboratory`, integrada con
LM Studio como backend de razonamiento, y su **andamiaje de tolerancia a fallos**. El sistema no
asume que la IA está disponible: la trata como un servicio _best-effort_ sobre el que se construye
un canal de comunicación híbrido (IPC de Electron primario + `fetch()` directo de respaldo), un
circuit breaker que suprime llamadas condenadas al fracaso, un generador de _fallback_ algorítmico
determinista, un parser léxico balanceado inmune a los bloques de pensamiento de los modelos de
razonamiento modernos, y un sanitizador que corrige las inconsistencias de octava más frecuentes de
los LLM.

El contrato es de **dominio puro en el renderer**: `LmStudioService`, `CircuitBreaker`,
`promptBuilder`, `schemaValidator`, `prescriptionSanitizer` y `fallbackGenerator` son unidades
testeables independientes de React; el store Zustand `useAiStore` orquesta la incursión de la IA en
la capa de presentación y la persistencia de reportes. Toda la configuración de red es **SSOT**
(`DEFAULT_APP_CONFIG.lmStudio`), y la directiva CSP de `index.html` está acoplada
contractualmente a esa misma fuente mediante un test de regresión.

| Frente | Unidad canónica | Responsabilidad |
| --- | --- | --- |
| Configuración SSOT | `domain/ai/appConfig.ts` → `DEFAULT_APP_CONFIG.lmStudio` | `baseUrl`, timeouts y temperatura canónicos de toda la app |
| Canal IPC | `main/index.ts` (handlers) + `preload/index.ts` (`customAPI`) | `AbortController`, timeouts por operación, puente `contextBridge` |
| Servicio | `domain/ai/lmStudioService.ts` → `sendChat` | Método único DRY: IPC primario, `fetch()` de respaldo |
| Seguridad | `renderer/index.html` (CSP `connect-src`) + `index-csp.test.ts` | Habilita el _fallback_ a `fetch()` sin bloqueo silencioso |
| Resiliencia | `domain/ai/circuitBreaker.ts` → `CircuitBreaker` | Estados `CLOSED`/`OPEN`/`HALF_OPEN`, umbral, _cooldown_, supresión |
| Degradación | `domain/ai/fallbackGenerator.ts` → `generateAlgorithmicFallback` | Diagnóstico y prescripción determinista sin red |
| Prompts | `domain/ai/promptBuilder.ts` | Sistema/usuario especializado, tutor multi-turn, comparativa multi-sesión |
| Parseo | `domain/ai/schemaValidator.ts` → `extractBalancedJsonObject`, `isValidPrescription` | JSON balanceado, purgado de bloques de razonamiento, validación estructural |
| Sanitización | `domain/ai/prescriptionSanitizer.ts` → `sanitizePrescription` | Corrección de octavas, campos huérfanos, viabilidad mínima |
| Estado | `stores/useAiStore.ts` | Respuestas segregadas por modalidad, persistencia de reportes |
| Contrato | `domain/ai/aiDecoupling.test.ts` | Inmutabilidad de las métricas grabadas ante fallos totales de la IA |

**Alcance (in-scope):** configuración SSOT y sus valores exactos, handlers IPC con timeouts, puente
`customAPI` del preload, método centralizado `sendChat`, CSP del renderer, máquina de estados del
circuit breaker, generador de _fallback_ algorítmico, construcción de prompts (diagnóstico, consulta
libre y comparativa multi-sesión), extracción y validación de la respuesta del LLM, sanitización de
prescripciones, el store de IA y el principio de desacoplamiento absoluto frente a las métricas
psicométricas.

**Fuera de alcance (out-of-scope):** el cálculo de las métricas psicométricas en sí (Módulo 05), la
generación y evaluación de estímulos musicales (Módulo 03), la persistencia en IndexedDB de
sesiones/respuestas (Módulo 02) y la síntesis audio/MIDI (Módulo 01). La IA consume métricas del
Módulo 05 como entrada inmutable y produce prescripciones ejecutables que el Módulo 03 consume.

> **Convención terminológica:** este documento usa términos RFC 2119. `MUST` (DEBE) y `MUST NOT`
> (NO DEBE) marcan requerimientos invariables del contrato. `SHOULD` (DEBERÍA) marca una práctica
> fuertemente recomendada con excepciones justificadas.

---

## Canal de Comunicación Híbrido y SSOT

### Requirement: Fuente Única de Verdad de la Configuración LM Studio

Todo el sistema DEBE leer la configuración de red de LM Studio exclusivamente desde
`DEFAULT_APP_CONFIG.lmStudio` en `domain/ai/appConfig.ts`, prohibiendo la codificación rígida del
_host_, los timeouts o la temperatura en cualquier otro archivo (incluido el proceso principal).

- `LmStudioConfig` MUST contener exactamente:
  - `baseUrl: 'http://127.0.0.1:1234'`
  - `checkModelTimeoutMs: 2500` (detección rápida de servidor caído)
  - `chatTimeoutMs: 900000` (**15 minutos**, deliberadamente generoso para permitir la inferencia
    de razonamiento profundo en GPU sin cancelaciones prematuras)
  - `defaultTemperature: 0.3`
- `LmStudioService` MUST instanciarse sin argumentos con esa configuración por defecto, y DEBE
  aceptar _overrides_ ya sea como `string` (se reescribe solo `baseUrl`, heredando el resto) o como
  `Partial<LmStudioConfig>` (fusión poco profunda sobre el default). La firma `getBaseUrl()` MUST
  exponer el `baseUrl` resuelto.
- El proceso principal (`main/index.ts`) MUST mantener su constante local
  `LM_STUDIO_DEFAULT_HOST` (`'http://127.0.0.1:1234'`) solo como respaldo de los payloads que no
  transporten `baseUrl`; el valor canónico es el de `appConfig.ts`.

#### Scenario: Configuración por defecto y overrides

- **GIVEN** la instanciación `new LmStudioService()`
- **WHEN** se consulta `getBaseUrl()`
- **THEN** devuelve `'http://127.0.0.1:1234'`
- **WHEN** se instancia `new LmStudioService('http://192.168.1.100:8080')`
- **THEN** `getBaseUrl()` devuelve `'http://192.168.1.100:8080'` y los timeouts y temperatura
  conservan los valores SSOT
- **WHEN** se instancia `new LmStudioService({ baseUrl: 'http://localhost:5000', defaultTemperature: 0.7 })`
- **THEN** `getBaseUrl()` devuelve `'http://localhost:5000'`

---

### Requirement: Handlers IPC de Electron con AbortController y Timeouts

El proceso principal DEBE exponer exactamente dos handlers IPC bajo el namespace `lm-studio:*`,
ambos con `AbortController` acoplado a un temporizador, de modo que un servidor caído o colgado
nunca bloquee el renderer.

- `lm-studio:check-models(baseUrl?)` MUST:
  - resolver el _host_ como `baseUrl || LM_STUDIO_DEFAULT_HOST`;
  - crear un `AbortController` y un `setTimeout(() => controller.abort(), 2500)`;
  - ejecutar `GET ${host}/v1/models` con la `signal`;
  - limpiar el temporizador inmediatamente tras la respuesta;
  - devolver `data.data[0].id` (el primer modelo cargado) o `null` si la respuesta no es `ok`, no
    tiene la forma esperada, o cualquier excepción (incluida la del `abort`) es capturada.
- `lm-studio:chat-completion(payload)` MUST aceptar `{ model, messages, temperature?, timeoutMs?, baseUrl? }` y:
  - resolver `timeoutMs` como `payload.timeoutMs || 900000` (15 minutos por defecto para _deep
    reasoning_ en GPU);
  - resolver la temperatura como `typeof payload.temperature === 'number' ? payload.temperature : 0.3`;
  - ejecutar `POST ${host}/v1/chat/completions` con la `signal` del `AbortController`;
  - ante respuesta no exitosa, devolver `{ success: false, error: <texto del cuerpo> }` **sin
    lanzar**;
  - ante éxito, extraer `data.choices?.[0]?.message` y devolver
    `{ success: true, content: message.content || message.reasoning_content || '', model: data.model || payload.model }`
    — es decir, DEBE considerar el campo `reasoning_content` de los modelos de razonamiento;
  - capturar cualquier excepción y devolver `{ success: false, error: message }`.
- El `BrowserWindow` DEBE construirse con `contextIsolation: true` y `sandbox: false` de forma
  intencional y documentada: con `sandbox: true`, el `contextBridge` deja de exponer
  `window.customAPI`, lo que fuerza el _fallback_ a `fetch()` directo y rompe la cadena de
  resiliencia. `contextIsolation` es la mitigación relevante para una app local de uso personal.

#### Scenario: Servidor caído no bloquea el renderer

- **GIVEN** el handler `lm-studio:check-models` y un LM Studio inalcanzable en `127.0.0.1:1234`
- **WHEN** se invoca el handler
- **THEN** la promesa se resuelve (no se rechaza) con `null` en un tiempo cercano a los `2500ms`
  del temporizador, y el temporizador se limpia

#### Scenario: Modelo de razonamiento con reasoning_content

- **GIVEN** el handler `lm-studio:chat-completion` y un payload válido
- **WHEN** LM Studio responde `200` con `choices[0].message.content` vacío pero `reasoning_content`
  poblado
- **THEN** la respuesta es `{ success: true, content: <reasoning_content>, model: <id> }`

---

### Requirement: Puente customAPI del Preload

El preload DEBE exponer al renderer exactamente el objeto `customAPI` bajo `contextIsolation`,
mapeando 1:1 los handlers IPC.

- `preload/index.ts` MUST declarar `checkLmStudioModels(baseUrl?)` →
  `ipcRenderer.invoke('lm-studio:check-models', baseUrl)` y `chatLmStudio(payload)` →
  `ipcRenderer.invoke('lm-studio:chat-completion', payload)`.
- La firma pública de `chatLmStudio` MUST aceptar `{ model, messages, temperature?, timeoutMs?, baseUrl? }`
  y devolver `Promise<{ success: boolean; content?: string; model?: string; error?: string }>`。
- Si `process.contextIsolated` es falso, el preload DEBE asignar `window.customAPI` directamente
  (rama tipada con `@ts-ignore` contra `index.d.ts`).
- El contrato de tipos global (`src/preload/index.d.ts`) MUST declarar `Window.customAPI` con la
  misma firma, de modo que el renderer pueda tipar el canal con independencia del modo de
  transporte.

#### Scenario: Canal IPC disponible en el renderer

- **GIVEN** el renderer ejecutándose en un `BrowserWindow` con `contextIsolation: true`
- **WHEN** el servicio invoca `window.customAPI.chatLmStudio(payload)`
- **THEN** la llamada se enruta al handler `lm-studio:chat-completion` del proceso principal y la
  respuesta tipada vuelve al renderer

---

### Requirement: Método Centralizado sendChat (Patrón DRY)

`LmStudioService` DEBE implementar un único método privado `sendChat(messages, temperature, model)`
como única puerta de salida hacia la red, aplicando la política de transporte híbrido.

- `sendChat` MUST dar **prioridad al canal IPC**: si
  `typeof window !== 'undefined' && window.customAPI?.chatLmStudio` está disponible, DEBE invocarlo
  con `{ model, messages, temperature, timeoutMs: this.config.chatTimeoutMs, baseUrl: this.config.baseUrl }`.
- En la rama IPC, si `result.success` es falso o `result.content` está vacío, `sendChat` MUST lanzar
  un `Error(result.error || 'Respuesta vacía de IPC')` para que el circuit breaker lo cuente como
  fallo. El `modelName` devuelto MUST ser `result.model || model`.
- Solo si la IPC no existe, `sendChat` MUST caer a `fetch()` directo contra
  `${baseUrl}/v1/chat/completions` (`POST`, `Content-Type: application/json`, body con
  `{ model, messages, temperature }`). Ante `!res.ok` MUST lanzar `Error('HTTP error <status>')`.
  El contenido MUST extraerse como `message?.content || message?.reasoning_content || ''`, y
  `modelName` como `data.model || model`.
- Los tres métodos públicos DEBEN usar `sendChat` sin duplicar lógica de transporte:
  - `analyzeAndPrescribe(metrics)` con `this.config.defaultTemperature` (`0.3`);
  - `askCustomConsultation(userQuery, metrics, conceptId?, pastConsultations?, recentReports?)` con
    temperatura `0.5`;
  - `askMultiSessionComparison(selectedSessions, metrics)` con temperatura `0.4`.
- `getLoadedModelId()` MUST ser _fail-fast_: devuelve `null` inmediatamente si
  `circuitBreaker.canExecute()` es falso (circuito abierto); en caso contrario aplica la misma
  prioridad IPC → `fetch` (`GET /v1/models`) con `checkModelTimeoutMs` y captura silenciosa a `null`.
- `checkConnection()` MUST devolver simplemente `getLoadedModelId() !== null`.

#### Scenario: Diagnóstico exitoso vía IPC

- **GIVEN** `window.customAPI.chatLmStudio` presente y un modelo cargado devuelto por
  `checkLmStudioModels`
- **WHEN** se ejecuta `analyzeAndPrescribe(metrics)`
- **THEN** la respuesta tiene `source === 'lm_studio_ai'`, `modelName` es el del modelo y la
  prescripción es la validada

#### Scenario: Caída a fetch cuando no hay IPC

- **GIVEN** `window.customAPI` ausente (p. ej. _sandbox_ activado por error)
- **WHEN** se ejecuta `analyzeAndPrescribe(metrics)`
- **THEN** el servicio usa `global.fetch` hacia `/v1/models` y `/v1/chat/completions` y, si ambos
  responden, devuelve `source === 'lm_studio_ai'`

---

### Requirement: Content-Security-Policy Sincronizada con la Configuración

El renderer DEBE declarar una CSP en `index.html` que permita explícitamente el _host_ canónico de
LM Studio, de forma que el _fallback_ a `fetch()` nunca sea bloqueado en silencio por Chromium.

- La etiqueta `<meta http-equiv="Content-Security-Policy">` MUST contener una directiva `connect-src`
  que incluya literalmente `DEFAULT_APP_CONFIG.lmStudio.baseUrl` (`'http://127.0.0.1:1234'`), además
  de `'self'`.
- El resto de directivas MUST permanecer restrictivo: `default-src 'self'`, `script-src 'self'`,
  `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`.
- La pareja (`index.html`, `appConfig.ts`) NO DEBE poder desincronizarse en silencio: el test de
  regresión `index-csp.test.ts` MUST leer el HTML del disco y afirmar que el `connect-src`
  declarado contiene `DEFAULT_APP_CONFIG.lmStudio.baseUrl`.
- El canal IPC principal NO pasa por CSP (es un mensaje entre procesos), por lo que la directiva
  existe específicamente para proteger el camino de degradación.

#### Scenario: Regresión de sincronización CSP ↔ appConfig

- **GIVEN** el archivo `src/renderer/index.html` en disco y `DEFAULT_APP_CONFIG` importado
- **WHEN** se ejecuta la suite `index-csp.test.ts`
- **THEN** el HTML contiene la etiqueta CSP, su contenido incluye `connect-src` y el valor
  `http://127.0.0.1:1234`

---

## Resiliencia: Circuit Breaker

### Requirement: Máquina de Estados del Circuit Breaker

El sistema DEBE envolver toda invocación a la red en un `CircuitBreaker` de tres estados que protege
la interfaz de práctica musical.

- Los estados MUST ser exactamente `'CLOSED' | 'OPEN' | 'HALF_OPEN'` (`CircuitState`).
- `DEFAULT_CIRCUIT_CONFIG` MUST ser: `failureThreshold: 3`, `cooldownPeriodMs: 30000` y
  `requestTimeoutMs: 900000` (15 minutos, intencionalmente generoso para razonamiento profundo).
- `getState()` MUST ser perezosamente transaccional: si el estado es `OPEN` y
  `Date.now() - lastFailureTime >= cooldownPeriodMs`, MUST promover a `HALF_OPEN` **y** devolver el
  nuevo estado; en caso contrario devuelve el estado vigente sin mutar.
- `canExecute()` MUST devolver `true` solo para `CLOSED` o `HALF_OPEN`, y `false` para `OPEN`.
- `recordSuccess()` MUST resetear `failureCount` a `0` y el estado a `CLOSED`.
- `recordFailure()` MUST incrementar `failureCount`, estampar `lastFailureTime` y, al alcanzar o
  superar `failureThreshold`, pasar a `OPEN`.
- `reset()` MUST restaurar `failureCount`, `state` y `lastFailureTime` a sus valores iniciales.

#### Scenario: Transición a HALF_OPEN tras el enfriamiento

- **GIVEN** un breaker `OPEN` con `cooldownPeriodMs: 1000` y un `lastFailureTime` con más de un
  segundo de antigüedad
- **WHEN** se invoca `getState()`
- **THEN** devuelve `'HALF_OPEN'` y `canExecute()` se vuelve `true`

---

### Requirement: Ejecución con Supresión y Degradación Instantánea

`execute(operation, fallbackOperation)` MUST ser el único punto de paso y DEBE garantizar que la
interfaz nunca se bloquea.

- Si `canExecute()` es `false` (circuito `OPEN`), `execute` MUST devolver `fallbackOperation()`
  **inmediatamente, sin llamar a `operation` y sin tocar la red** — suprime las llamadas condenadas
  al fracaso.
- En caso de poder ejecutar, MUST construir un `AbortController` con un `setTimeout` de
  `requestTimeoutMs` que aborta y rechaza con `Error('Operation timed out')`, poniendo en carrera la
  operación (que recibe la `signal`) contra la promesa de _timeout_.
- El temporizador MUST limpiarse tanto en el camino de éxito como en el de fallo.
- Si la operación tiene éxito, MUST llamarse `recordSuccess()` y devolver el resultado crudo.
- Si la operación falla o agota el _timeout_, MUST llamarse `recordFailure()` y devolver
  `fallbackOperation()` — el error NUNCA MUST propagarse al llamador.

#### Scenario: Caída del servidor no bloquea la práctica

- **GIVEN** un breaker por defecto y una operación que rechaza con `Error('Network error')`
- **WHEN** se ejecuta `execute(brokenOperation, fallback)`
- **THEN** se resuelve con el valor del `fallback` (`'datos_locales_seguros'`), sin lanzar

#### Scenario: El timeout degrada al instante

- **GIVEN** un breaker con `requestTimeoutMs: 50` y una operación que tarda `200ms` en resolverse
- **WHEN** se ejecuta con un `fallback` espía
- **THEN** el resultado es el valor del `fallback` y el espía fue llamado exactamente una vez

#### Scenario: Circuito abierto suprime la tercera llamada

- **GIVEN** un breaker con `failureThreshold: 2`, `cooldownPeriodMs: 5000` y una operación que
  siempre rechaza
- **WHEN** se ejecuta dos veces seguidas
- **THEN** tras el primer fallo el estado es `CLOSED` y tras el segundo es `OPEN`
- **WHEN** se ejecuta una tercera vez
- **THEN** el resultado es el `fallback` y la operación **no fue invocada** (supresión)

---

## Degradación: Fallback Algorítmico Determinista

### Requirement: Generador de Fallback Algorítmico

Cuando LM Studio está apagado, el circuito está abierto o la respuesta es inválida, el sistema DEBE
poder generar un diagnóstico clínico y una prescripción ejecutable **sin ninguna red**, de forma
determinista, partiendo únicamente de las métricas psicométricas puras.

- `generateAlgorithmicFallback(metrics)` MUST devolver un `AiAnalysisResponse` con
  `source: 'algorithmic_fallback'` y `modelName: 'Motor Heurístico Local'`.
- El `targetMode` de la prescripción MUST derivarse deterministamente: `'intervals'` si
  `metrics.modeFilter === 'intervals'`; `'sequences'` si es `'sequences'`; en cualquier otro caso
  `'single_note'` (con `recommendedNotes` por defecto `[60, 62, 64]` cuando hay dos o más notas
  difíciles, o `[60, 62, 64, 65, 67]` en caso contrario).
- Para `intervals` la prescripción MUST llevar `recommendedIntervals: [2, 4, 5, 7]`; para
  `sequences`, `sequenceLength: 3`.
- La prescripción generada MUST ser estructuralmente válida y ejecutable: `instrumentId:
  'acoustic_grand_piano'`, `limitType: 'questions'`, `questionsCount: 10`, `durationMinutes: 5`,
  `advanceMode: 'smart'`, `noteDurationMs: 500`.
- El `analysisText` MUST construirse a partir del informe clínico canónico
  (`generateDiagnosticReport` del Módulo 05), ensamblando el resumen ejecutivo, el diagnóstico
  perceptual, el análisis de latencia y el de sesgo direccional.
- Los _fallbacks_ conversacionales DEBEN ser coherentes con el contexto: `askCustomConsultation`
  DEGRADA a un `### Tutor Local (Respuesta Heurística)` que cita la consulta, el total de ejercicios
  y la precisión real IRT; `askMultiSessionComparison` DEGRADA a una
  `### Comparativa Cruzada Heurística (N Sesiones)` que contrasta la precisión de la primera y la
  última sesión seleccionada. Ambos MUST firmar como `modelName: 'Motor Heurístico Local'`.

#### Scenario: Prescripción determinista por modalidad

- **GIVEN** unas métricas con `modeFilter: 'intervals'`
- **WHEN** se ejecuta `generateAlgorithmicFallback`
- **THEN** `source === 'algorithmic_fallback'` y
  `prescription.recommendedIntervals === [2, 4, 5, 7]`
- **WHEN** las métricas tienen `modeFilter: 'sequences'`
- **THEN** `prescription.targetMode === 'sequences'` y `sequenceLength === 3`

#### Scenario: Diagnóstico algorítmico cuando no hay modelo cargado

- **GIVEN** un `LmStudioService` cuyo `getLoadedModelId` devuelve `null`
- **WHEN** se ejecuta `analyzeAndPrescribe(metrics)`
- **THEN** el resultado es `source: 'algorithmic_fallback'` y `prescription` está definido

---

## Construcción de Prompts

### Requirement: Prompts Especializados con Catálogo Formal

El sistema DEBE construir los prompts con un único módulo `promptBuilder`, alineando las
instrucciones con el catálogo real de parámetros del software, de forma que el LLM nunca reciba
opciones inexistentes.

- `buildSystemPrompt(mode)` MUST asumir el rol de "Profesor de Oído Musical y Psicoacústica de
  Élite" e incluir el `CATÁLOGO FORMAL DE PARÁMETROS` con los `targetMode` (`single_note` |
  `intervals` | `sequences`), los cinco `instrumentId`, la tabla de `recommendedNotes` por registro
  (grave C3=48…B3=59, central C4=60…B4=71, agudo C5=72…C6=84), los semitonos `1..12`,
  `sequenceLength` `3..6`, los cuatro `limitType`, `questionsCount` (`5, 10 o 20`),
  `durationMinutes` (`1, 3, 5 o 10`), `advanceMode` y `noteDurationMs`.
- Las directivas MUST especializarse por `mode`: para `single_note` exige `targetMode:
  'single_note'` y un pool de 2 a 8 notas MIDI; para `intervals` exige el array
  `recommendedIntervals` (1 a 12); para `sequences` exige `sequenceLength` entre 3 y 6. El modo
  global usa un enfoque integral.
- El formato de respuesta obligatorio MUST pedir **JSON puro** con `analysisText` (diagnóstico
  clínico en español, incluyendo felicitación o diagnóstico de los deltas Test-Retest) y
  `prescription`.
- `buildUserPrompt(metrics, customQueryType?)` MUST empaquetar: totales, precisión cruda, Oído Real
  (IRT), entropía media, tiempo medio de reacción, conteo rápido/medio/lento con las etiquetas SSOT
  del Módulo 05, sesgos `+st`/`-st`, _top_ confusiones, notas débiles y consolidadas; más
  `COMPARATIVAS LONGITUDINALES (TEST-RETEST DETECTADOS)` con sus deltas firmados; y la telemetría de
  las **últimas 10 sesiones** (incluyendo `cadenciaRPM`, `poolNotas`, `fuenteEntrada` — "Roland FP-8
  Físico" / "Ratón Virtual" / "Mixto" — y `scoreCPI`). `customQueryType`
  (`'general' | 'fatigue' | 'weekly_plan'`) MUST reescribir la instrucción final.
- Las etiquetas de latencia dentro de los prompts MUST tomarse de `COGNITIVE_LATENCY_THRESHOLDS`
  (Módulo 05), nunca de literales propias, para que una recalibración global se propague sola.

#### Scenario: Prompt de nota individual con catálogo

- **GIVEN** `buildSystemPrompt('single_note')`
- **WHEN** se genera
- **THEN** contiene `Profesor de Oído Musical`, `CATÁLOGO FORMAL DE PARÁMETROS DISPONIBLES`,
  `ENFOQUE CLÍNICO PARA NOTA INDIVIDUAL` y la directiva `targetMode DEBE ser 'single_note'`
- **WHEN** se genera `buildUserPrompt` con métricas de ejemplo
- **THEN** contiene `Precisión Cruda Global: 80%`, `Entropía Media del Contexto`,
  `COMPARATIVAS LONGITUDINALES (TEST-RETEST DETECTADOS)` y `"fuenteEntrada": "Roland FP-8 Físico"`

---

### Requirement: Tutor Conversacional Multi-Turn y Comparativa Multi-Sesión

El sistema DEBE mantener la continuidad pedagógica entre consultas y soportar análisis comparativos
cruzados.

- `buildConsultationSystemPrompt(mode, recentReports?)` MUST configurar el rol de tutor didáctico e
  inyectar, si hay reportes previos, un resumen de las **últimas 3 prescripciones** asignadas al
  alumno (fecha, ejercicio, objetivo, modo y timbre), además de cuatro directivas pedagógicas
  (español cercano, coherencia conversacional, uso de telemetría real y cierre con consejo aplicable
  al teclado físico).
- `buildConsultationUserPrompt(userQuery, metrics, conceptId?)` MUST incluir la duda literal del
  alumno y, si `conceptId` resuelve en el diccionario pedagógico, el bloque
  `CONCEPTO PEDAGÓGICO DE REFERENCIA` con título, definición, fórmula y _takeaway_; siempre debe
  adjuntar el `PERFIL Y TELEMETRÍA DEL ALUMNO`.
- `buildConversationalMessages` MUST devolver un arreglo que arranca con un mensaje `system`, luego
  alterna `user`/`assistant` con el **historial ordenado por `createdAt` y recortado a las últimas
  4** consultas previas, y termina con el `user` actual.
- `buildMultiSessionComparisonSystemPrompt(mode)` MUST exigir un análisis cronológico entre las
  sesiones seleccionadas sobre 4 variables (precisión/IRT, velocidad cognitiva y reflejo, timbre y
  motor, sesgo tonal y fatiga) con un diagnóstico de plasticidad y una recomendación final.
- `buildMultiSessionComparisonPrompt(selectedSessions, metrics)` MUST reordenar la selección
  cronológicamente y serializar la telemetría completa de cada sesión, junto con el contexto clínico
  global.

#### Scenario: Secuencia multi-turn coherente

- **GIVEN** consultas previas y un reporte previo
- **WHEN** se ejecuta `buildConversationalMessages('¿Y cómo practico ese semitono?', metrics, past, reports, 'irt_normalized_accuracy')`
- **THEN** `messages[0].role === 'system'` y su contenido cita el título de la prescripción previa,
  `messages[1]`/`messages[2]` alternan `user`/`assistant` con el texto histórico exacto, y
  `messages[3].role === 'user'` contiene la consulta actual

#### Scenario: Comparativa de N sesiones serializa telemetría cruzada

- **GIVEN** una selección de 1 sesión con `accuracyPercentage: 80`
- **WHEN** se ejecuta `buildMultiSessionComparisonPrompt`
- **THEN** el prompt contiene `SOLICITUD DE COMPARATIVA MULTI-SESIÓN`,
  `TELEMETRÍA DETALLADA DE LAS 1 SESIONES SELECCIONADAS` y `"precisionCruda": "80%"`

---

## Parseo Léxico y Validación

### Requirement: Parser Léxico Balanceado e Inmunidad a Bloques de Pensamiento

El sistema DEBE extraer el JSON de la respuesta cruda del LLM con un parser léxico propio, inmune a
los artefactos de los modelos de razonamiento modernos.

- `extractBalancedJsonObject(rawText)` MUST devolver `null` si la entrada no es un _string_ no
  vacío.
- **Paso 1 — Purgado de pensamiento:** MUST eliminar previamente cualquier bloque encerrado entre
  los tags `<think>` y `</think>` (patrón de modelo de razonamiento, caso-insensible y global),
  típico de modelos como DeepSeek R1 y Qwen 2.5/3.5, **antes** de cualquier conteo de llaves. Las
  llaves que aparezcan dentro de ese bloque NO DEBEN contar para el balanceo.
- **Paso 2 — Cercados de código:** si existe un bloque cercado con la etiqueta `json`, MUST extraer
  su interior con prioridad; en caso contrario MUST quitar las cercas genéricas de tres _backticks_.
- **Paso 3 — Balanceo:** MUST localizar el primer carácter `{` y recorrer contando la profundidad
  con un contador que se incrementa en `{` y se decrementa en `}`, devolviendo la subcadena cuando
  la profundidad vuelve a `0`.
- El escaneo MUST ignorar las llaves y comillas dentro de **strings literales**: debe rastrear el
  estado `inString` conmutándolo en cada comilla doble no escapada, y descartar el carácter que
  sigue a una barra de escape.
- Si el objeto nunca se cierra (llaves desbalanceadas), MUST devolver `null`.

#### Scenario: Bloque de razonamiento con llaves trampa dentro

- **GIVEN** una respuesta que abre el bloque de pensamiento, incluye el objeto trampa
  `{ debug: "fail", notes: [60] }`, lo cierra, y luego trae un bloque `json` cercado con un payload
  válido seguido de texto post-JSON
- **WHEN** se ejecuta `validateAndParseAiResponse`
- **THEN** el resultado no es `null`, `prescription.title` es el esperado y `recommendedNotes` son
  las notas válidas del payload

#### Scenario: Llaves dentro de un string literal

- **GIVEN** un texto que abre `{`, define `"analysisText": "Nota: {C4} es clave"` y cierra el objeto
- **WHEN** se ejecuta `extractBalancedJsonObject`
- **THEN** el JSON extraído, al parsearse, tiene `analysisText === 'Nota: {C4} es clave'`

---

### Requirement: Validación Estructural Estricta de la Respuesta

El sistema DEBE rechazar cualquier respuesta del LLM que no cumpla el contrato estructural, antes de
confiar en ella.

- `validateAndParseAiResponse(rawJsonString, modelName)` MUST devolver `null` si la entrada no es un
  _string_, si no contiene un objeto balanceado, si `JSON.parse` falla, si `analysisText` no es un
  _string_ no vacío, o si `prescription` no pasa `isValidPrescription`. Cualquier excepción MUST
  capturarse y devolverse como `null`.
- En caso válido, el resultado MUST tener `source: 'lm_studio_ai'`, el `modelName` recibido, el
  `analysisText` recortado con `.trim()` y la `prescription` **sanitizada**.
- `isValidPrescription(obj)` (type guard) MUST rechazar: valores no objeto; `title` o `rationale`
  vacíos o no _string_; `targetMode` fuera de `['single_note', 'intervals', 'sequences']`;
  `instrumentId` fuera de `['acoustic_grand_piano', 'flute', 'violin', 'clarinet', 'acoustic_bass']`;
  `limitType` fuera de `['questions', 'time', 'mastery', 'infinite']`; `advanceMode` fuera de
  `['smart', 'manual', 'auto_fast', 'auto_slow']`; `recommendedNotes` que no sea arreglo, esté vacío,
  o contenga un valor no entero fuera del rango MIDI `[21, 108]`; `questionsCount <= 0`; o
  `durationMinutes <= 0`.

#### Scenario: Payload 100% válido aceptado

- **GIVEN** el JSON stringificado de un payload con `recommendedNotes: [60, 62, 64]`
- **WHEN** se ejecuta `validateAndParseAiResponse(raw, 'qwen3.5')`
- **THEN** `result.source === 'lm_studio_ai'` y
  `result.prescription.recommendedNotes === [60, 62, 64]`

#### Scenario: Entradas malformadas o no string rechazadas

- **GIVEN** las entradas `'Esto no es un JSON { incompleto...'`, `null` y `12345`
- **WHEN** se ejecuta `validateAndParseAiResponse` con cada una
- **THEN** todas devuelven `null`

#### Scenario: Campos estructurales inválidos rechazados

- **GIVEN** una prescripción base válida
- **WHEN** se evalúa `isValidPrescription` con `title: ''`, `rationale: ''`, un `instrumentId`
  desconocido, un `limitType` desconocido, un `advanceMode` desconocido, `recommendedNotes: []`, un
  `recommendedNotes` no arreglo, `questionsCount: -1` o `durationMinutes: 0`
- **THEN** cada una de las nueve variantes devuelve `false`

---

## Sanitización de Prescripciones Pedagógicas

### Requirement: Sanitizador Determinista de Prescripciones

El sistema DEBE sanitizar toda prescripción —incluso la ya validada— corrigiendo las inconsistencias
lógicas más frecuentes de los LLM antes de que sea ejecutable.

- `sanitizePrescription(rawPrescription, contextText?)` MUST operar de forma determinista y devolver
  un nuevo objeto (sin mutar la entrada).
- **Limpieza por modalidad:**
  - `single_note` MUST eliminar `recommendedIntervals` y `sequenceLength`;
  - `intervals` MUST eliminar `sequenceLength` y, si `recommendedIntervals` falta o está vacío, MUST
    rellenarlo con `[2, 4, 5, 7]`;
  - `sequences` MUST eliminar `recommendedIntervals` y, si `sequenceLength` falta o está fuera de
    `[3, 6]`, MUST fijarlo en `3`.
- **Corrección heurística de octavas:** MUST escanear el texto formado por `title`, `rationale` y el
  `contextText` opcional (pasado a mayúsculas) buscando nombres científicos de notas del mapa
  canónico (C3=48 … C6=84, incluyendo sostenidos y bemoles). Si el texto menciona notas concretas,
  cada `recommendedNotes` que diste exactamente `12` semitonos de una nota mencionada MUST
  corregirse a dicha nota; el arreglo resultante MUST deduplicarse y ordenarse de forma ascendente.
- **Viabilidad mínima:** si `recommendedNotes` no es arreglo o tiene menos de `2` notas, MUST
  reemplazarse por `[60, 62, 64]`, garantizando que toda sesión sea ejecutable.

#### Scenario: Corrección de octava B5 → B4 mencionada en el texto

- **GIVEN** una prescripción cuyo `title` menciona `B4` y cuyo `rationale` cita `E4/F4/B4`, pero con
  `recommendedNotes: [64, 65, 83]` (el `83` es el erróneo B5)
- **WHEN** se ejecuta `sanitizePrescription`
- **THEN** `recommendedNotes === [64, 65, 71]` (B5 corregido a B4) y `recommendedIntervals` es
  `undefined` por ser modalidad `single_note`

#### Scenario: Campos huérfanos eliminados por modalidad

- **GIVEN** una prescripción `intervals` con `sequenceLength: 4` presente
- **WHEN** se ejecuta `sanitizePrescription`
- **THEN** `sequenceLength` es `undefined` y `recommendedIntervals` se conserva intacto
- **GIVEN** una prescripción `sequences` con `sequenceLength: 1`, `7` y ausente
- **WHEN** se sanitiza cada variante
- **THEN** las tres devuelven `sequenceLength === 3` y `recommendedIntervals === undefined`

#### Scenario: Intervalos por defecto cuando faltan

- **GIVEN** una prescripción `intervals` sin `recommendedIntervals` y otra con un arreglo vacío
- **WHEN** se ejecuta `sanitizePrescription`
- **THEN** ambas devuelven `recommendedIntervals === [2, 4, 5, 7]`

#### Scenario: Notas con sostenidos/bemoles y viabilidad mínima

- **GIVEN** una prescripción con `recommendedNotes: [37, 73, 90]` y un `contextText` que menciona
  `C#3` (49) y `DB4` (61)
- **WHEN** se ejecuta `sanitizePrescription`
- **THEN** el resultado contiene `49` y `61` (corrección de octava) y mantiene `90` (no dista 12 de
  ninguna mencionada)
- **GIVEN** una prescripción con `recommendedNotes: [60]` (una sola nota) o con un valor no arreglo
- **WHEN** se ejecuta `sanitizePrescription`
- **THEN** `recommendedNotes === [60, 62, 64]`

---

## Estado y Desacoplamiento

### Requirement: Store de IA Segregado por Modalidad

El store DEBE centralizar las respuestas de IA separadas por modalidad de análisis, de forma que el
diagnóstico de una modalidad nunca pise el de otra.

- El estado MUST exponer `aiResponsesByMode` (un mapa con una entrada por cada
  `AnalyticsModeFilter` — `all`, `single_note`, `intervals`, `sequences`, `repertoire` —, todas
  `null` al inicio), `isLmStudioOnline` (`false` al inicio) y `isAiAnalyzing` (`false` al inicio).
- `checkLmStudioStatus()` MUST delegar en `aiService.checkConnection()` y persistir el booleano en
  `isLmStudioOnline`.
- `runAiDiagnostic(metrics, saveReportCallback?)` MUST:
  - poner `isAiAnalyzing: true` y refrescar el estado de conexión **antes** de inferir;
  - invocar `analyzeAndPrescribe` y, al resolver, guardar la respuesta bajo `metrics.modeFilter`;
  - poner `isAiAnalyzing: false`;
  - si hay `saveReportCallback` y la prescripción existe, construir un `DbAiReportRecord` con
    `id: ai_rep_<timestamp>`, `createdAt` ISO actual, el `modelName`, el `modeFilter`, el
    `analysisText` y la `prescription`, y pasarlo al callback;
  - en cualquier error, MUST caer a `generateAlgorithmicFallback(metrics)`, guardar la respuesta y
    dejar `isAiAnalyzing: false` — el flujo NUNCA MUST propagar la excepción.
- `hydrateReportsByMode(reports, metrics)` MUST llenar el mapa por modalidad: si existe un reporte
  con `modeFilter` coincidente lo reconstruye con `source: 'lm_studio_ai'`; si no existe, genera un
  `algorithmic_fallback` para esa modalidad (usando métricas con el `modeFilter` sobreescrito).
- `setAiResponseForMode(mode, response)` y `resetAiMemory()` MUST actualizar/purgar el mapa sin
  alterar el resto del estado de la aplicación.

#### Scenario: Hidratación segregada por modalidad

- **GIVEN** reportes persistidos para `single_note` y `intervals`
- **WHEN** se ejecuta `hydrateReportsByMode(reports, metrics)`
- **THEN** `aiResponsesByMode.single_note.analysisText` es el del reporte de notas y
  `aiResponsesByMode.intervals.analysisText` es el de intervalos, sin cruzarse

#### Scenario: Diagnóstico con persistencia exitosa

- **GIVEN** un servicio que responde `lm_studio_ai` y un callback de guardado
- **WHEN** se ejecuta `runAiDiagnostic(metrics, saveCallback)`
- **THEN** `isAiAnalyzing === false`, la respuesta queda bajo la modalidad de las métricas y el
  callback fue llamado exactamente una vez

#### Scenario: El error de IA degrada y no rompe el flujo

- **GIVEN** un servicio cuya conexión es `false` y cuyo `analyzeAndPrescribe` rechaza
- **WHEN** se ejecuta `runAiDiagnostic(metrics, saveCallback)`
- **THEN** `isAiAnalyzing === false`, la respuesta bajo la modalidad es
  `source: 'algorithmic_fallback'` y ninguna excepción escapa al llamador

---

### Requirement: Desacoplamiento Absoluto — Cero Impacto sobre las Métricas Grabadas

Las métricas psicométricas y las sesiones grabadas DEBEN ser inmutables respecto a la IA: un fallo
total del pipeline de inferencia NO DEBE alterar, corromper ni bloquear ni las métricas, ni las
sesiones, ni la navegación de la interfaz.

- La evaluación de una respuesta (p. ej. `evaluateSingleNoteAnswer`) MUST ser determinista e
  inmediata, y NO DEBE depender de la disponibilidad de la IA.
- `computeAnalyticsMetrics` MUST ser una función pura:_same input, same output_, sin efectos
  secundarios sobre las sesiones o respuestas de entrada.
- Un fallo total de LM Studio —_timeout_, error HTTP 500, JSON malformado, GPU fuera de memoria o
  circuito abierto— MUST resolverse en el dominio de IA devolviendo una respuesta de
  `algorithmic_fallback`, **nunca** lanzándose hacia la capa de sesión ni alterando los registros.
- La invocación a la IA (sea exitosa, fallback o errónea) NO DEBE mutar los campos del
  `DbSessionRecord` (`correctAnswers`, `accuracyPercentage`, etc.), ni el arreglo de
  `DbAnswerRecord`, ni los valores previamente calculados (`overallAccuracy`, `totalAnswers`).
- Este contrato MUST estar blindado por `aiDecoupling.test.ts`, que ejecuta el diagnóstico
  posterior sobre una sesión grabada y afirma que las métricas y los registros originales quedan
  idénticos.

#### Scenario: El diagnóstico posterior no altera las métricas inmutables

- **GIVEN** una sesión con 2 respuestas correctas y `overallAccuracy: 100`
- **WHEN** se evalúa la sesión, se calculan las métricas y luego se ejecuta
  `analyzeAndPrescribe` contra un LM Studio inalcanzable (puerto cerrado)
- **THEN** la IA responde (vía _fallback_), `overallAccuracy` sigue siendo `100`,
  `totalAnswers` sigue siendo `2` y `mockSession.correctAnswers` sigue siendo `2`

#### Scenario: Un error crítico de la IA no corrompe la sesión

- **GIVEN** un `CircuitBreaker` cuyo `execute` rechaza con `Error('GPU Out of Memory / Crash')`
- **WHEN** se invoca `analyzeAndPrescribe` sobre métricas ya calculadas
- **THEN** `mockSession.accuracyPercentage` sigue siendo `100`, el arreglo de respuestas mantiene
  su longitud y sus flags `isCorrect` originales — la persistencia y el resultado quedan intactos

