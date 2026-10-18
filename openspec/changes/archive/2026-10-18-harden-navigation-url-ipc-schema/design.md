# Design

## Context

`src/main/index.ts:68-73` valida la URL de ventanas emergentes con `details.url.startsWith('https:')`/`startsWith('http:')` antes de `shell.openExternal` (F7); no existe listener `will-navigate` (F8); `webPreferences` no configura `devTools` (F9). `handleChatCompletion` en `src/main/lmStudioHandlers.ts:73-117` acepta `payload: ChatCompletionPayload` sin validar `model` ni `messages` (F10). El proyecto tiene un patrón establecido de guardas puras en el Main con tests Vitest sin Electron (`sessionPermissions.ts`, `lmStudioHostValidator.ts` + sus tests), que este diseño reutiliza. La app carga el dev server (`ELECTRON_RENDERER_URL`) en desarrollo y `file://` en producción (`index.ts:75-79`).

## Goals / Non-Goals

**Goals:**

- Fail-closed en las tres superficies de ventana/navegación del Main (openExternal, will-navigate, devTools) y en el esquema del payload de chat-completion.
- Lógica de validación pura y testeable sin Electron, integrada por cableado mínimo en `index.ts`.
- Camino feliz intacto: URLs http(s) legítimas se abren, la navegación al origen propio procede, payloads válidos fluyen idénticos.

**Non-Goals:**

- No se añade allowlist de dominios externos para `openExternal` (cualquier http/https sigue abriéndose; F7 solo endurece el esquema).
- No se implementa CSP de respuesta ni `setWindowOpenHandler` con allowlist de destinos: el handler ya deniega toda ventana emergente (`action: 'deny'`); solo cambia la condición para delegar a `shell.openExternal`.
- No se valida el resto del payload (temperature, timeoutMs) ni se cambia el contrato de `check-models` (F5 ya validó su baseUrl).
- No se abordan otros hallazgos de la auditoría.

## Decisions

1. **Módulo puro nuevo `src/main/windowNavigationGuard.ts` con dos funciones.** `isOpenExternalUrlAllowed(url: string): boolean` (F7: `new URL()` + protocolo estrictamente `http:`/`https:`) y `isAllowedNavigation(url: string, allowedOrigin: string): boolean` (F8: parseo + comparación de origen). Razón: testeabilidad sin Electron (patrón `lmStudioHostValidator.ts`) y separación de las dos políticas. Alternativa descartada: inline en `index.ts` — no testeable sin mockear `electron`.

2. **F7 con `new URL()` + comparación de `protocol`, no de prefijos.** `startsWith('https:')` acepta cadenas como `https:evil` o sufren bypass con mayúsculas/espacios; `new URL()` normaliza y lanza en malformadas. El protocolo se compara contra el set exacto `{'http:', 'https:'}`. Alternativa descartada: regex — frágil frente a normalización de URL.

3. **F8 con comparación de origen calculado, no de prefijos.** El origen permitido se calcula una vez por entorno: en desarrollo, el origen de `ELECTRON_RENDERER_URL` (ej. `http://localhost:5173`); en producción, `file://`. `isAllowedNavigation` compara `new URL(url).origin === allowedOrigin`; cualquier parseo fallido o origen distinto → denegar. **Nota técnica (detectada en implementación):** según el estándar WHATWG, `new URL('file:///...').origin` produce un origen opaco serializado como `'null'`, no `'file://'`; por ello la implementación en `src/main/windowNavigationGuard.ts` realiza la verificación en producción mediante comparación directa del protocolo `file:` (equivalente semántico a "el esquema file:// de la aplicación empaquetada" que exige el spec). Razón: cubre dev y prod con una sola regla y evita bypass por sufijos (`https://localhost:5173.evil.com`). Alternativa descartada: allowlist de esquemas — demasiado laxa (permitiría navegar a cualquier https).

4. **F9 con `devTools: is.dev` en `webPreferences`.** `is` ya está importado de `@electron-toolkit/utils` (`index.ts:3`); una sola línea, explícita en ambos entornos. Alternativa considerada: además cerrar DevTools ya abiertas con un listener `devtools-opened` — redundante con `devTools: false` en producción; se descarta por innecesaria.

5. **F10 con validador puro nuevo `src/main/chatPayloadValidator.ts`.** `isValidChatCompletionPayload(payload: unknown): boolean` verifica: `payload` objeto no nulo; `model` string no vacío (tras trim); `messages` arreglo no vacío; cada elemento objeto con `role` y `content` strings no vacíos. `handleChatCompletion` lo invoca ANTES de la resolución de baseUrl (validación más barata primero) y retorna `{ success: false, error: 'Payload de mensajes inválido' }` en fallo, sin log de rechazo (no es un intento de SSRF, es un payload malformado). Alternativa descartada: validar inline en el handler — mismo argumento de testeabilidad que la decisión 1.

6. **Cableado en `index.ts` mínimo y en el mismo estilo existente.** `setWindowOpenHandler` usa `isOpenExternalUrlAllowed(details.url)`; `createWindow` registra `mainWindow.webContents.on('will-navigate', (event, url) => { if (!isAllowedNavigation(url, allowedOrigin)) { event.preventDefault(); console.warn('[Navegación] Cancelada: ...') } })` con log auditable al estilo `[Permisos]`/`[LM Studio]`; `webPreferences` añade `devTools: is.dev`. El origen permitido se calcula en `createWindow` (dev: `new URL(process.env['ELECTRON_RENDERER_URL']).origin`; prod: `'file://'`).

7. **Tests en `src/main/` sin Electron.** `windowNavigationGuard.test.ts` (F7: https/http válidos, file/javascript/data/malformadas; F8: origen propio dev y file://, orígenes ajenos, URLs malformadas) y `chatPayloadValidator.test.ts` (F10: payload válido, model vacío/no string, messages vacío/no arreglo/elementos malformados, payload ausente). Además, un test de lectura de fuente sobre `index.ts` (patrón `index-csp.test.ts`) verifica el cableado: `will-navigate` registrado, `devTools: is.dev` presente y `shell.openExternal` solo tras la guarda. Los tests existentes de `lmStudioHandlers.test.ts` se amplían con el caso de payload malformado (sin fetch).

## Risks / Trade-offs

- [Falso positivo: navegación legítima in-frame cancelada] → Mitigación: la app es SPA sin navegación in-frame real; el único origen permitido cubre dev y prod; el log auditable hace el diagnóstico inmediato. Rollback trivial.
- [`openExternal` con URLs https de phishing sigue abriéndose] → Mitigación: fuera de alcance (F7 endurece el esquema, no el destino); el handler ya deniega la ventana emergente, el riesgo se limita al navegador del usuario.
- [`devTools: false` dificulta depurar el binario empaquetado] → Mitigación: es el objetivo del endurecimiento (F9); en desarrollo permanecen habilitadas.
- [Validación de payload rechaza mensajes legítimos con campos extra] → Mitigación: la validación exige presencia y tipo de `role`/`content`, no prohíbe campos adicionales; los prompts del proyecto (`promptBuilder`) siempre emiten ambos campos string.
- [Regresión en tests existentes de handlers] → Mitigación: la validación se añade antes de la resolución de baseUrl; los tests existentes usan payloads válidos y deben pasar sin modificaciones (verificado en tareas).

## Migration Plan

Sin migración de datos ni despliegue especial. Orden: validadores puros + tests (TDD Rojo→Verde) → integración en `lmStudioHandlers.ts` → cableado en `index.ts` (openExternal, will-navigate, devTools) + test de lectura de fuente → suite completa + typecheck + lint. Rollback trivial (revert del commit). Verificación manual recomendada post-implementación: `npm run dev` y confirmar que la app arranca, navega a su origen sin cancelaciones espurias y que un `window.open('javascript:alert(1)')` desde la consola no abre nada.

## Open Questions

(ninguna)
