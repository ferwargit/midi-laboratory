# Design

## Context

Los handlers IPC `lm-studio:check-models` y `lm-studio:chat-completion` en `src/main/index.ts` (líneas 86–160) resuelven hoy `const host = baseUrl || LM_STUDIO_DEFAULT_HOST` y ejecutan `fetch()` directamente contra ese valor, sin validar el destino. El renderer solo envía `DEFAULT_APP_CONFIG.lmStudio.baseUrl` (`http://127.0.0.1:1234`, SSOT en `src/renderer/src/domain/ai/appConfig.ts`), pero el canal IPC acepta cualquier string. El proyecto ya tiene un patrón de hardening en el proceso Main con tests unitarios Vitest sin Electron (`src/main/sessionPermissions.test.ts`, `src/main/permissionHandlers.test.ts`), que este diseño reutiliza.

## Goals / Non-Goals

**Goals:**

- Validación de destino estricta y fail-closed en el proceso Main, en el único punto por donde puede salir tráfico HTTP hacia LM Studio (los dos handlers `lm-studio:*`).
- Contratos de retorno existentes intactos: `null` en check-models, `{ success: false, error }` en chat-completion, sin excepciones no capturadas.
- Observabilidad de rechazos en consola del proceso Main (patrón de la capacidad `08-electron-session-security`).
- Cero cambios en preload, tipos (`index.d.ts`) o código del renderer.

**Non-Goals:**

- No se elimina el fallback a `fetch()` directo del renderer (`lmStudioService.sendChat`): ese canal está acotado por la CSP `connect-src` de `index.html` y queda fuera del alcance de F5.
- No se añade configuración nueva ni UI para hosts permitidos: el allowlist es fijo (`127.0.0.1`/`localhost`).
- No se abordan otros hallazgos de la auditoría (F1–F4, F6+).
- No se valida el resto del payload de `chat-completion` (model, messages, temperature): solo el destino de red.

## Decisions

1. **Módulo dedicado `src/main/lmStudioHostValidator.ts` con función pura.** Se extrae la validación a un módulo independiente (análogo a `sessionPermissions.ts`) en lugar de validar inline en `index.ts`. Razón: testeabilidad sin Electron (los handlers viven en `index.ts`, que importa `electron` y no es importable en Vitest), y reutilización por ambos handlers. Alternativa descartada: validar inline — obligaría a mockear `electron` o duplicar lógica en tests.

2. **API del validador: `resolveLmStudioHost(baseUrl?: string): { ok: true; host: string } | { ok: false; reason: string }`.** Resultado discriminado en lugar de lanzar excepciones: los handlers ya tienen contratos de retorno controlado y el validador no debe acoplarse a cómo cada handler reporta el fallo (`null` vs `{ success: false }`). Alternativa descartada: `throw` — obligaría a try/catch en cada handler y confundiría el rechazo de validación con errores de red.

3. **Parsing con `new URL()` + comparación exacta de hostname.** Se usa la API estándar `URL` de Node/Electron: `protocol` debe ser `http:` o `https:`, y `hostname` (no `host`, para ignorar el puerto) debe ser exactamente `127.0.0.1` o `localhost`. El puerto, si existe, debe ser numérico válido 1–65535 (garantizado por `URL`; se rechaza `URL` con puerto no numérico porque `new URL` ya lanza). Razón: `URL` normaliza casos de evasión triviales (mayúsculas, `HTTP://`, espacios finales) y evita regex frágiles. Alternativa descartada: regex manual — propensa a bypass por normalización de URL.

4. **Allowlist fijo, no configurable.** `127.0.0.1` y `localhost` como únicos hosts. No se aceptan `::1`, `[::1]` ni `0.0.0.0` en esta iteración: LM Studio por defecto escucha en `127.0.0.1:1234` y la SSOT del renderer solo usa ese host; ampliar el allowlist sería una decisión de producto separada. Alternativa considerada: incluir `::1` — se deja como extensión futura trivial del validador (un solo array de hosts permitidos).

5. **Integración en los handlers: validar antes de crear `AbortController`/timer.** En `check-models`: si `resolveLmStudioHost` falla → log + `return null`. En `chat-completion`: si falla → log + `return { success: false, error: <reason> }`. El `fetch()` solo se ejecuta con el host resuelto por el validador (nunca con el `baseUrl` crudo). Razón: garantiza que ninguna rama de error pueda disparar red.

6. **Log de rechazo con prefijo de diagnóstico.** `console.warn('[LM Studio] baseUrl rechazada: "<valor>" (handler: <nombre>)')`, siguiendo el estilo del log de denegaciones de permisos (`[Permisos] Denegado: ...`). Se registra el valor crudo recibido para auditoría.

7. **Tests en `src/main/` con Vitest, sin Electron.** Dos archivos nuevos: `lmStudioHostValidator.test.ts` (unitario: casos válidos locales, IPs privadas/públicas, dominios remotos, protocolos no HTTP, URLs malformadas, puertos) y `lmStudioHandlers.test.ts` (cableado: mock de `global.fetch` + import dinámico de la lógica de los handlers). Para el test de cableado sin cargar `electron`, la lógica de resolución de host de cada handler se ejercita a través del validador real y se verifica que `fetch` nunca recibe un host rechazado; si el acoplamiento a `index.ts` resulta no testeable, los handlers delegan en una pequeña función exportable (`handleCheckModels`, `handleChatCompletion`) movida a un módulo sin dependencia de `electron`. Decisión de detalle diferida a implementación, sin impacto en specs.

## Risks / Trade-offs

- [Falsa negativa: un usuario legítimo con LM Studio en otra interfaz local (ej. `192.168.x.x` en LAN)] → Mitigación: el allowlist cubre el caso estándar (`127.0.0.1`/`localhost`) y la SSOT del renderer solo usa ese host; el mensaje de error controlado hace el fallo diagnosticable. Extensión futura: allowlist configurable.
- [Bypass por variantes de localhost no cubiertas (`::1`, `0.0.0.0`, `127.0.0.2`…)] → Mitigación: fail-closed por diseño (solo 2 hosts exactos); cualquier variante nueva requiere cambio explícito del allowlist, revisado en código.
- [Doble canal: el fallback `fetch()` del renderer sigue existiendo] → Mitigación: fuera de alcance (CSP `connect-src` lo acota a `127.0.0.1:1234` y `'self'`); se documenta en Non-Goals para no inflar este cambio.
- [Regresión en tests existentes del renderer] → Mitigación: no se toca código de renderer ni preload; `lmStudioService.test.ts` y `lmStudioService.mock.test.ts` deben pasar sin modificaciones (verificado en la fase de tareas).

## Migration Plan

Sin migración de datos ni despliegue especial: cambio interno del proceso Main. Rollback trivial (revert del commit). Orden de implementación: validador + tests unitarios (TDD) → integración en handlers → tests de cableado → suite completa (`npm test`, `npm run typecheck`).

## Open Questions

(ninguna)
