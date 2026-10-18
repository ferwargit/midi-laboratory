# Proposal

## Why

La auditoría de seguridad (hallazgo **F5**) demostró que los handlers IPC `lm-studio:check-models` y `lm-studio:chat-completion` en `src/main/index.ts` aceptan un parámetro `baseUrl?: string` arbitrario proveniente del Renderer y ejecutan `fetch()` contra él sin ninguna validación. Un Renderer comprometido (o un script malicioso con acceso a `window.customAPI`) puede así evadir la CSP del renderer y hacer que el proceso Main emita peticiones HTTP hacia la red local o internet (SSRF), escaneando servicios internos o exfiltrando datos desde un contexto de mayor privilegio.

## What Changes

- Nuevo módulo de validación en el proceso Main (`src/main/lmStudioHostValidator.ts`) que resuelve el host de destino de un `baseUrl` opcional:
  - Si no se proporciona (o está vacío), resuelve al host canónico `LM_STUDIO_DEFAULT_HOST` (`http://127.0.0.1:1234`).
  - Si se proporciona, solo acepta URLs con protocolo `http:`/`https:` cuyo host sea estrictamente `127.0.0.1` o `localhost` (cualquier puerto local numérico válido 1–65535).
  - Rechaza cualquier otra IP privada/pública, dominio remoto, protocolo no HTTP o URL malformada.
- Integración de la validación en ambos handlers IPC **antes** de cualquier llamada de red: una `baseUrl` inválida deniega la petición sin ejecutar `fetch()` (devolviendo `null` / `{ success: false, error }` según el contrato existente de cada handler, sin lanzar excepciones no controladas).
- Registro auditable (consola del proceso Main) de cada `baseUrl` rechazada, análogo al patrón de denegaciones de la capacidad `08-electron-session-security`.
- Tests unitarios Vitest para el validador (casos válidos locales y casos de ataque/rechazo) y tests de cableado para ambos handlers.
- Los tests existentes del frontend (`lmStudioService.test.ts`, `lmStudioService.mock.test.ts`, `appConfig.test.ts`, `index-csp.test.ts`) no cambian: el renderer sigue enviando `DEFAULT_APP_CONFIG.lmStudio.baseUrl` (`http://127.0.0.1:1234`), que es un host aceptado.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `06-local-ai-integration`: se añade un requisito de validación estricta del host de destino en los handlers IPC `lm-studio:*` (allowlist `127.0.0.1`/`localhost`, denegación fail-closed antes del `fetch`, registro auditable de rechazos). El requisito existente "Handlers IPC de Electron con AbortController y Timeouts" no cambia: los timeouts, contratos de retorno y firmas se preservan.

## Impact

- **Código afectado:** `src/main/index.ts` (ambos handlers `lm-studio:*`), nuevo archivo `src/main/lmStudioHostValidator.ts`.
- **Sin cambios de API:** las firmas de `checkLmStudioModels(baseUrl?)` y `chatLmStudio(payload)` en `src/preload/index.ts` / `src/preload/index.d.ts` se mantienen idénticas; el renderer no requiere modificaciones.
- **Comportamiento observable:** peticiones con `baseUrl` no local ahora fallan de forma controlada (`null` en check-models, `{ success: false, error }` en chat-completion) en lugar de ejecutarse.
- **Tests:** nuevos tests en `src/main/` (siguiendo el patrón existente de `sessionPermissions.test.ts`); suite existente de `src/renderer/src/domain/ai/` debe seguir en verde.
- **Sin dependencias nuevas:** la validación usa `URL` (API estándar de Node/Electron).
