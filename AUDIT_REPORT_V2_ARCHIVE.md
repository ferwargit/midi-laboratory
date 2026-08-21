# AUDIT REPORT V2 — MIDI Laboratory

Fecha: 2026-08-21
Autor: Auditoría técnica (Copilot CLI runtime in VS Code)

Resumen ejecutivo
-----------------
Esta segunda versión del informe (V2) documenta una auditoría técnica profunda orientada a código: búsqueda de bugs, análisis de flujo de sesiones, consistencia de métricas y robustez operacional. El proyecto está técnicamente sólido (build, typecheck y tests pasan), pero se identificaron fallos de lógica y riesgos operativos que deben corregirse antes de un despliegue de producción estable.

Síntesis rápida:
- Estado de build y pruebas: OK (vitest: 138 tests pasados localmente).
- TypeScript: OK (typecheck sin errores).
- Vulnerabilidades en dependencias (audit): none a nivel HIGH en la ejecución local.
- Riesgos funcionales detectados: timers/auto-advance que sobreviven entre sesiones, cálculo de métricas ponderado incorrectamente, parser de respuestas AI frágil, uso de alert() bloqueante, configuración de LM Studio hardcoded, y riesgo de reentrancia en flujos de sesión.

Alcance y metodología
---------------------
Se revisaron los artefactos y archivos relevantes del repo, se ejecutaron scripts de comprobación y pruebas, y se inspeccionó línea a línea la lógica crítica de:
- Proceso principal y preload de Electron: [src/main/index.ts](/D:/07-Repositorios/midi-laboratory/src/main/index.ts), [src/preload/index.ts](/D:/07-Repositorios/midi-laboratory/src/preload/index.ts)
- Servicios AI: [src/renderer/src/domain/ai/lmStudioService.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/domain/ai/lmStudioService.ts)
- Validador de respuesta AI: [src/renderer/src/domain/ai/schemaValidator.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/domain/ai/schemaValidator.ts)
- Engine de persistencia: [src/renderer/src/domain/database/databaseEngine.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/domain/database/databaseEngine.ts)
- Hooks de sesión y entrenamiento: [useSingleNoteTrainer.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/hooks/useSingleNoteTrainer.ts), [useIntervalTrainer.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/hooks/useIntervalTrainer.ts), [useSequenceTrainer.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/hooks/useSequenceTrainer.ts)

Hallazgos técnicos (detallado)
------------------------------
1) Timers y auto-advance persisten entre sesiones (SEVERIDAD: ALTA)
- Archivos implicados:
  - [useSingleNoteTrainer.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/hooks/useSingleNoteTrainer.ts)
  - [useIntervalTrainer.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/hooks/useIntervalTrainer.ts)
  - [useSequenceTrainer.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/hooks/useSequenceTrainer.ts)
- Descripción: `startSession()` no limpia timers previos (`autoAdvanceTimerRef`, `sessionCountdownTimerRef`). `stopSession()` / `resetToConfig()` no siempre limpian ambos tipos de timers. Resultado: timers antiguos pueden invocar `finalizeAndSaveSession()` o `advanceToNext...()` en sesiones nuevas, provocando saltos de preguntas, guardado doble o estado inconsistente.
- Impacto: experiencia de usuario rota, sesiones con datos corruptos, guardados duplicados.
- Recomendación: implementar `cleanupSessionTimers()` reutilizable y llamarlo en `startSession`, `stopSession`, `resetToConfig`, y justo antes de iniciar contadores nuevos. Añadir pruebas unitarias que simulen doble inicio y verifiquen que no hay timers activos previos.

2) Cálculo de métricas en DatabaseEngine incorrecto (SEVERIDAD: ALTA)
- Archivo implicado: [databaseEngine.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/domain/database/databaseEngine.ts)
- Descripción: `getSummary()` promedia `accuracyPercentage` y `avgResponseTimeMs` por número de sesiones, sin ponderar por número de preguntas. Esto hace que sesiones cortas y largas tengan el mismo peso.
- Impacto: KPIs engañosos, análisis erróneo de desempeño y decisiones AI mal informadas.
- Recomendación: calcular medias ponderadas por `totalQuestions` (o agregar consulta a `exercise_answers` y calcular métricas directas). Añadir tests que validen casos con sesiones de distinto tamaño.

3) Parser de respuesta AI frágil (SEVERIDAD: MEDIA)
- Archivo implicado: [schemaValidator.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/domain/ai/schemaValidator.ts)
- Descripción: extracción de JSON con regex (`/{[\s\S]*}/`) que puede devolver bloques incompletos si el texto contiene múltiples objetos o texto extra antes/después. También se confía en `isValidPrescription` que tiene validaciones estrictas (por ejemplo, `recommendedNotes` no vacío), lo que puede llevar a rechazar respuestas válidas que requieren mínima post-procesación.
- Impacto: prescripciones AI válidas descartadas, caídas silenciosas al fallback.
- Recomendación: implementar una extracción más robusta: primero buscar bloques ```json ... ```, si falla, localizar primera `{` y última `}` del área razonable y parsear. Probar múltiples variantes devueltas por LLMs. Usar un validador de esquema (Zod o ajv) que entregue mensajes de error para logging.

4) Reentrancia y estados dispersos en trainers (SEVERIDAD: MEDIA)
- Archivos implicados: los 3 trainers
- Descripción: mezcla de refs (`isAdvancingRef`, `isWaitingAnswerRef`, timers, setState) hace que la orquestación de la sesión sea propensa a condiciones de carrera: doble avance, estado inconsistente cuando el usuario ejecuta acciones rápidas o cuando timers viejos se disparan.
- Impacto: UX inconsistente y difíciles de reproducir en tests de integración.
- Recomendación: refactor a máquina de estados (xstate o simple enum) y centralizar las transiciones.

5) Configuración de LM Studio hardcoded (SEVERIDAD: MEDIA)
- Archivos implicados: [lmStudioService.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/domain/ai/lmStudioService.ts), [src/main/index.ts](/D:/07-Repositorios/midi-laboratory/src/main/index.ts)
- Descripción: la URL base (`http://127.0.0.1:1234`) y parámetros están embebidos. Limita pruebas y despliegue en entornos distintos.
- Recomendación: añadir módulo `appConfig` y exponer via IPC/env, permitir override en UI Dev Settings y logs de diagnóstico.

6) Uso de alert() en lógica (SEVERIDAD: BAJA / UX)
- Archivos implicados: hooks de entrenamiento
- Descripción: `alert()` se usa para mensajes de validación (por ejemplo, falta de notas) y bloquea UI.
- Recomendación: reemplazar por toast/snackbar / modales React y centralizar mensajes.

7) Logging y observabilidad insuficientes (SEVERIDAD: BAJA)
- Recomendación: añadir logging estructurado (nivel DEBUG/INFO/WARN/ERROR) y métricas operativas para IA, MIDI errors y health checks.

Plan de acción priorizado (tareas concretas)
--------------------------------------------
Formato: [Título] — Prioridad — Esfuerzo — Archivos — Descripción breve — Criterio de aceptación

P0 — Correcciones críticas (Semana 1)
------------------------------------
1. Cleanup de timers y robustez de lifecycle — P0 — Esfuerzo: S (1–2 días)
- Archivos: [useSingleNoteTrainer.ts], [useIntervalTrainer.ts], [useSequenceTrainer.ts]
- Descripción: crear y usar `cleanupSessionTimers()` que limpie `autoAdvanceTimerRef` y `sessionCountdownTimerRef`, reset de `questionTokenRef`, y demás refs relacionadas. Invocar desde `startSession`, `stopSession`, `resetToConfig`, `finalizeAndSaveSession` antes de iniciar nuevos timers.
- Criterio de aceptación:
  - Tests unitarios que inicien sesión dos veces consecutivas no dejan timers activos de la sesión anterior.
  - No se producen llamadas residuales a `finalizeAndSaveSession()` de sesiones previas.

2. Corregir agregación de métricas en DB — P0 — Esfuerzo: S (1 día)
- Archivo: [databaseEngine.ts]
- Descripción: cambiar `getSummary()` para calcular medias ponderadas o calcular métricas directamente a partir de `exercise_answers` cuando sea necesario.
- Criterio de aceptación:
  - Nuevo test que crea dos sesiones (10 y 100 preguntas) y verifica que el `overallAccuracy` se pondera por `totalQuestions`.

3. Mejorar parsing de respuestas AI — P0 — Esfuerzo: M (2–3 días)
- Archivo: [schemaValidator.ts]
- Descripción: implementar extracción robusta de JSON (buscar bloques ```json, intentar múltiples parseos, usar primera `{` y última `}` en un rango controlado), y aplicar validación de esquema con Zod/ajv. Loggear errores de parsing con el `modelName` y `rawJsonString` truncado para diagnóstico.
- Criterio de aceptación:
  - Tests que simulan respuestas con: texto+JSON, ```json bloque, múltiples objetos, JSON con texto antes/después — y validar que las respuestas válidas se aceptan.

P1 — Robusteamiento y UX (Semana 2)
----------------------------------
4. Centralizar configuración LM Studio — P1 — Esfuerzo: M (1–2 días)
- Archivos: [lmStudioService.ts], [src/main/index.ts]
- Descripción: añadir `src/shared/config/appConfig.ts` y exponer vía IPC para override. Añadir UI en Dev/Settings para cambiar host/puerto/modelo.
- Criterio de aceptación:
  - Tests que mockean config y verifican que `LmStudioService` usa la URL configurada.

5. Reemplazar `alert()` por notificaciones no bloqueantes — P1 — Esfuerzo: S (1 día)
- Archivos: hooks y componentes UI.
- Descripción: implementar `NotificationService` o usar componente `Toast` existente. Reemplazar llamadas a `alert()` por `notify.warn()`.
- Criterio de aceptación:
  - Manual: no aparecen `alert()` modals en flujos; todo feedback usa toasts.

P2 — Calidad y CI (Semana 2–3)
-----------------------------
6. Añadir CI/CD con gates — P2 — Esfuerzo: M (2–3 días)
- Tareas: GitHub Actions pipeline que ejecute: lint, typecheck, tests, build. Definir branch protection rules.
- Criterio: PR bloqueado si falla cualquiera de las etapas.

7. Tests de integración y E2E para sesiones — P2 — Esfuerzo: M (3–5 días)
- Contenido: pruebas que simulan ciclo completo de sesión (start, play notes, advance, stop), verificación de DB y summary.
- Criterio: suites E2E que corran en CI (modo headless o mocking de MIDI y LM Studio).

P3 — Refactor mayor y observabilidad (Semana 3)
----------------------------------------------
8. Refactor a máquina de estados (opcional/beneficioso) — P3 — Esfuerzo: L (1–2 semanas)
- Descripción: migrar la orquestación de cada trainer a una máquina de estados explícita (xstate u otro), reducir refs compartidas y unificar transiciones.
- Criterio: pruebas de regresión y tests E2E que confirman comportamiento idéntico o mejorado.

9. Logging y health checks — P3 — Esfuerzo: M (3 días)
- Descripción: agregar logging estructurado y health endpoints IPC para LM Studio/DB/ MIDI.
- Criterio: herramientas de diagnóstico muestran health OK / fallos detectables.

Tareas operativas y artefactos entregables
-----------------------------------------
- Branch: `audit/fix/session-timers-db-summary-ai-parser`
- PRs separados por tema (uno por P0, uno por P1, etc.)
- Tests unitarios y de integración acompañando cada PR
- Documentación: actualizar README con configuración LM Studio y debugging

Sugerencia de cronograma (backlog mínimo viable)
-------------------------------------------------
- Día 1–2: P0-1 fixes (timers, DB summary, AI parsing)
- Día 3–4: Reemplazo alert + config LM Studio
- Día 5–7: CI + tests de integración básicos
- Semana 2: E2E + máquina de estados (si se requiere mayor refactor)

Criterios de aceptación globales
-------------------------------
1. No hay timers activos de sesiones anteriores después de iniciar una nueva sesión.
2. `getSummary()` devuelve métricas ponderadas por preguntas y está cubierto por tests.
3. El validador AI acepta variantes razonables de respuestas JSON y las sanitiza; en caso de rechazo, el sistema registra un log diagnóstico con la respuesta recibida.
4. No se usan `alert()` en producción; reemplazado por notificaciones no bloqueantes.
5. Pipeline CI ejecuta lint, typecheck, tests y build en PRs.

Anexos técnicos y enlaces a archivos clave
-----------------------------------------
- [package.json](/D:/07-Repositorios/midi-laboratory/package.json)
- [ARCHITECTURE.md](/D:/07-Repositorios/midi-laboratory/ARCHITECTURE.md)
- Hooks de entrenamiento:
  - [useSingleNoteTrainer.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/hooks/useSingleNoteTrainer.ts)
  - [useIntervalTrainer.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/hooks/useIntervalTrainer.ts)
  - [useSequenceTrainer.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/hooks/useSequenceTrainer.ts)
- DB Engine: [databaseEngine.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/domain/database/databaseEngine.ts)
- AI: [schemaValidator.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/domain/ai/schemaValidator.ts), [lmStudioService.ts](/D:/07-Repositorios/midi-laboratory/src/renderer/src/domain/ai/lmStudioService.ts)

Conclusión
----------
La base del proyecto es buena y madura; la auditoría V2 identifica problemas concretos, reproducibles y con correcciones de bajo a moderado esfuerzo que aumentarán notablemente la fiabilidad, la calidad de datos analíticos y la experiencia del usuario. Corregir los items P0 debería ser la prioridad inmediata antes de preparar releases mayores o trabajo de despliegue.

---

*Archivo generado automáticamente como parte de la auditoría técnica (AUDIT_REPORT_V2_ARCHIVE.md).*
