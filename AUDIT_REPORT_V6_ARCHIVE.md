# 📋 AUDIT REPORT V6 — MIDI Laboratory

### Auditoría Técnica Exhaustiva, Concurrencia, Resiliencia Acústica, Exactitud Psicoacústica y Gobernanza OpenSpec

**Fecha de Auditoría:** 19 de Septiembre, 2026
**Proyecto:** MIDI Laboratory (`midi-ear-trainer` v1.0.0)
**Entorno Tecnológico:** Electron 43 + React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS v4 + Zustand 5 + IndexedDB v6 + Web MIDI API + Vitest 4 (v8 coverage) + OpenSpec 1.13 + Engram 2.0
**Hardware de Laboratorio:** Roland FP-8 (88 teclas) + Roland UM-ONE mk2 + Korg NS5R (Síntesis GM multitimbral)
**Estado:** 🔍 **DIAGNÓSTICO INTEGRAL COMPLETO — BASELINE AUDITADO (Score: 9.3 / 10)**

---

## 📊 1. Resumen Ejecutivo y Matriz Evolutiva de Versiones (V1 a V6)

La Auditoría V6 representa el hito de transición definitiva desde el desarrollo iterativo (_vibe coding_) hacia el **Desarrollo Guiado por Especificaciones (Spec-Driven Development - SDD)** bajo OpenSpec y memoria semántica (Engram + Codebase Memory).

Tras congelar la **constitución formal de 7 capacidades canónicas** (93 requisitos y ~206 escenarios con 100% de aprobación estricta), se ejecutó una inspección pura de diagnóstico en 5 frentes de profundidad clínica sobre el 100% de la superficie del código fuente.

| Métrica / Dimensión            |    V1 (Inicial)     |  V3 (Consolidación)  |   V5 (Repertorio)    |                 V6 (Auditoría Integral SDD)                  |
| :----------------------------- | :-----------------: | :------------------: | :------------------: | :----------------------------------------------------------: |
| **Puntaje Global**             |    **7.5 / 10**     |     **9.8 / 10**     |    **10.0 / 10**     |    **9.3 / 10** (Score Realista Post-Inspección Profunda)    |
| **Batería de Tests**           | 36 tests (9 arch.)  | 241 tests (47 arch.) | 279 tests (52 arch.) |           **293 tests (52 archivos - 100% PASS)**            |
| **Especificación Canónica**    |    README básico    |   ARCHITECTURE.md    |  REPERTOIRE_V2_SPEC  | **7 Capabilities OpenSpec (93 Requisitos / 206 Scenarios)**  |
| **Gobernanza de Memoria**      |   Memoria volátil   |       Volátil        |       Volátil        | **Engram v2 (SQLite en D:\) + Codebase Memory (1780 nodos)** |
| **Esquema de Persistencia**    |    IndexedDB v1     |     IndexedDB v5     |     IndexedDB v5     |    **IndexedDB v6 (Índices secundarios en Stores de IA)**    |
| **Umbral Crítico Maestría**    |      50% / 85%      |      50% / 85%       |      50% / 85%       |       **60% / 85% (SSOT Unificada en 9 Consumidores)**       |
| **Identificadores del Kernel** | `Date.now() + rand` | `Date.now() + rand`  | `Date.now() + rand`  |       **`crypto.randomUUID()` Nativo y Criptográfico**       |
| **Retardos de Auto-Avance**    | Acoplados (1500ms)  |  Acoplados (1500ms)  |  Acoplados (1500ms)  |   **Desacoplados (`smart`: 1500ms / `auto_fast`: 1500ms)**   |
| **Total Hallazgos Detectados** |       2 CVEs        |      5 mejoras       |    4 expansiones     |       **84 hallazgos (4 P0 · 24 P1 · 29 P2 · 27 P3)**        |

---

## 🔬 2. Radiografía de los 5 Frentes de Inspección

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MAPA DE COBERTURA DE LA AUDITORÍA V6                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Frente 1: Concurrencia, Estado Global y Micro-Kernel  ➔ 16 Hallazgos (F01–F16)       │
│ • Frente 2: Hardware MIDI, Scheduler de Audio y MusicXML ➔ 19 Hallazgos (H01–H19)      │
│ • Frente 3: Dominio Psicoacústico y Analítica Científica ➔ 16 Hallazgos (F-01–F-16)    │
│ • Frente 4: Persistencia, IA Local y Seguridad IPC       ➔ 15 Hallazgos (F4-01–F4-15)  │
│ • Frente 5: UI/UX, Performance de Render y Atajos        ➔ 18 Hallazgos (F5-01–F5-18)  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TOTAL GENERAL: 84 Hallazgos clasificados y documentados con evidencia de código real   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚨 3. Detalle de Hallazgos Críticos (🔴 Severidad P0)

Los siguientes 4 hallazgos representan vulnerabilidades de integridad, condiciones de carrera o fugas acústicas que deben remediarse de forma prioritaria:

### 1. `F4-01` · Importación en modo `replace` no es atómica (Riesgo de Pérdida Total de Datos)

- **Ubicación:** `src/renderer/src/domain/database/databaseEngine.ts:347–349`.
- **Causa Raíz:** En `importDatabase(backup, 'replace')`, la llamada a `this.clearDatabase()` abre y **commitea su propia transacción antes** de que se abra la transacción de importación (`tx #2`).
- **Impacto:** Si la segunda transacción aborta por cuota de disco excedida (`QuotaExceededError`), IndexedDB revierte únicamente la importación, pero el vaciado de la base ya quedó grabado. La base de datos queda **100% vacía**.
- **Remediación:** Unificar `.clear()` y `.put()` dentro de una única transacción `readwrite` atómica sobre los 4 almacenes.

### 2. `F01` · Guard incompleto en `recordAnswer` y temporizador de avance huérfano

- **Ubicación:** `src/renderer/src/hooks/useTrainerCore.ts:437, 469–472`.
- **Causa Raíz:** `recordAnswer` no verifica `isWaitingAnswerRef.current` ni valida el `questionToken` como argumento. Además, programa `autoAdvanceTimerRef` sin ejecutar un `clearTimeout` previo.
- **Impacto:** Una segunda pulsación MIDI rápida dentro de la misma pregunta puede registrar una respuesta duplicada con el mismo `questionIndex`, y temporizadores residuales de preguntas anteriores pueden disparar avances fantasma.
- **Remediación:** Exigir `questionToken` vigente en `recordAnswer`, validar `isWaitingAnswerRef` y ejecutar `clearTimeout` preventivo.

### 3. `F02` · Efectos secundarios dentro de un updater de `setState` en Secuencias

- **Ubicación:** `src/renderer/src/hooks/useSequenceTrainer.ts:277–313`.
- **Causa Raíz:** La evaluación y la invocación a `core.recordAnswer(...)` se ejecutan dentro del callback de actualización de `setCapturedNotes((prev) => { ... })`.
- **Impacto:** En React 19 bajo `<StrictMode>`, los updaters se ejecutan dos veces deliberadamente para verificar pureza funcional. Esto provoca que la última nota de una secuencia melódica se evalúe y persista dos veces en base de datos.
- **Remediación:** Mover la evaluación y persistencia fuera del updater de estado, usando un buffer síncrono en `useRef` (el patrón canónico ya aplicado en Repertorio).

### 4. `F03` · Pre-roll huérfano en Nota Individual dispara estímulo sobre sesión finalizada

- **Ubicación:** `src/renderer/src/hooks/useSingleNoteTrainer.ts:272–284`.
- **Causa Raíz:** `preRollTimerRef` (el retardo acústico de la cadencia de 2840 ms) vive en el hook de notas y no está registrado en `cleanupTimers()` del micro-kernel.
- **Impacto:** En sesiones por tiempo, si el reloj de cuenta regresiva expira durante la cadencia previa, el kernel finaliza la sesión pero el pre-roll sigue corriendo en segundo plano y hace sonar una nota sobre una sesión ya muerta.
- **Remediación:** Exponer un slot de cancelación en `TrainerCoreOptions` o agregar un guard defensivo `if (!core.isSessionActive) return` al inicio de `triggerNextQuestion`.

---

## ⚠️ 4. Resumen de Hallazgos de Severidad Alta (🟠 Severidad P1)

| ID          | Módulo / Archivo                  | Síntesis del Defecto                                             | Impacto Técnico / Musical                                                                                        |
| :---------- | :-------------------------------- | :--------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **`H-01`**  | `useMidi.ts:98-130`               | Pánico MIDI mono-canal (solo canal 1).                           | Cancela timer de Note-Off del Canal 10 y deja el clic de metrónomo sonando en el NS5R.                           |
| **`H-02`**  | `useMidi.ts:118-124`              | Pánico no resetea CC 121 ni Pitch Bend.                          | Ruedas de modulación o desafinaciones manuales sobreviven al pánico.                                             |
| **`H-03`**  | `stimulusScheduler.ts:52-82`      | Drift temporal por throttling de Chromium.                       | Al minimizar ventana, `setInterval` se ralentiza pero `clockStartTime` corre en wall-clock, desfasando el pulso. |
| **`H-04`**  | `useRepertoireTrainer.ts:719`     | `autoSpeedRamp` (+5 BPM) no reinicia metrónomo continuo.         | La melodía acelera al nuevo tempo pero la cuadrícula sigue a tempo viejo, escapándose del pulso.                 |
| **`H-05`**  | `scoreParser.ts:194-254`          | Ausencia total de soporte para ligaduras `<tie>`.                | Notas ligadas se re-articulan como dos Note-On y exigen dos pulsaciones al alumno.                               |
| **`H-06`**  | `repertoireEvaluator.ts:105, 177` | `relative_proportional` y `strict` ignoran silencios en IOI.     | Al filtrar `isRest`, omite la pausa; obras con silencios fallan siempre. Duración 0 provoca `NaN`/`Infinity`.    |
| **`F-01`**  | `historyAnalytics.ts:31, 698`     | Filtros fantasma en `filterSessionsAdvanced`.                    | `inputSource`, `biasFilter` e `isiFilter` declarados en la interfaz pero no implementados en el motor.           |
| **`F-02`**  | `AnalyticsView.tsx:159-176`       | Filtrado psicométrico fugado a componente React.                 | La lógica de filtrado real se ejecuta en la UI con `.filter()`, rompiendo el pipeline de dominio puro.           |
| **`F-03`**  | `AnalyticsView.tsx:170-173`       | Bug en primera sesión sin intervalo previo (`gap === null`).     | La primera sesión ("Inicio") se clasifica erróneamente como "Espaciada > 48h".                                   |
| **`F-04`**  | `diagnosticReportGenerator.ts:84` | Incoherencia de ratio de sesgo (1.4 en motor vs 1.5 en informe). | Diagnóstico de "Sesgo Agudo" e indicador "Equilibrado" para los mismos datos simultáneamente.                    |
| **`F-05`**  | `useTrainerCore.ts:111`           | Crecimiento $O(n^2)$ en sesiones de formato `infinite`.          | El array de historial crece sin tope y las estrategias reescanean todo el historial en cada nota.                |
| **`F-06`**  | `App.tsx:596-600`                 | Cambio de pestaña sin detención de trainers salientes.           | Cambiar de modalidad corta audio pero deja trainers con estados y timers internos activos.                       |
| **`F-07`**  | `useTrainerCore.ts:451-459`       | `isWaitingManualAdvance` no se resetea a `false` en ramas auto.  | Tras el primer error en modo smart, el botón de avance manual queda permanentemente habilitado.                  |
| **`F4-02`** | `useAiStore` / `AnalyticsView`    | 3 instancias aisladas de `LmStudioService` y `CircuitBreaker`.   | Servidor de IA caído no comparte estado `OPEN`; una pestaña reintenta llamadas de 15 min en vano.                |
| **`F4-03`** | `useDatabaseStore.ts:113`         | `JSON.stringify` de exportación es 100% síncrono.                | En bases con decenas de miles de respuestas, congela el event loop de React y el audio.                          |
| **`F4-04`** | `useDatabaseStore.ts:62-73`       | Recarga completa de 5 tablas tras cada mutación (hot path).      | Guardar una respuesta dispara 5 transacciones completas `getAll()`.                                              |
| **`F4-05`** | `lmStudioService.ts:91-99`        | Rama fallback de `fetch` no propaga signal de cancelación.       | Si el servidor abre conexión pero no responde, la promesa queda colgada indefinidamente sin timeout.             |
| **`F4-06`** | `main/index.ts:47, 84`            | Handlers IPC aceptan `baseUrl` sin allowlist local.              | Proceso privilegiado de Electron carece de restricción estricta a `127.0.0.1` / `localhost`.                     |
| **`F5-01`** | `App.tsx:626, 525`                | Memoización de `PianoKeyboard` neutralizada en renders.          | `liveStimulusNotes` pasa `[]` nuevo cada render y `handleVirtualKeyPress` cambia de identidad siempre.           |
| **`F5-02`** | `PianoKeyboard.tsx:199-256`       | Las 37 teclas son botones inline sin memoizar.                   | Cada mensaje MIDI entrante fuerza la reconciliación completa de las 37 teclas.                                   |
| **`F5-03`** | `AiConsultationTab.tsx:54`        | Ticker de 1s de la IA re-parsea todo el historial markdown.      | Durante el razonamiento del LLM, un `setInterval` fuerza el re-parseo de todo el historial cada segundo.         |

---

## 🛠️ 5. Resumen de Deuda Técnica Media y Leve (🟡 P2 y 🟢 P3)

- **Arquitectura & SRP (`F10`):** `App.tsx` acumula 708 líneas, incluyendo 130 líneas de partitura XML inline y 107 líneas de lógica de playback de repertorio que pertenecen al dominio.
- **Modularización de Analítica (`F-17`):** `historyAnalytics.ts` acumula 1.244 líneas y 14 responsabilidades; requiere extracción a 9 submódulos limpios con un _barrel export_.
- **MusicXML Avanzado (`H-07, H-08`):** Compases compuestos ($6/8, 12/8$) generan metrónomos con pulsos de corchea en vez de negra con puntillo; soporte multi-part aplana instrumentos.
- **Evaluación Rítmica (`H-09, H-10`):** Clúster de 45 ms fijo fusiona notas melódicas en pasajes virtuosos $\ge 167\text{ BPM}$; falta alineación elástica tipo Levenshtein.
- **Tipado Estricto (`F11, H-19`):** Uso de `timerKey as unknown as number` en `useMidi.ts` para indexar un `Map<number>` con strings `"1_60"`.
- **Accesibilidad UI (`F5-04 a F5-08`):** La barra espaciadora suprime el scroll nativo en analítica; los tooltips no son accesibles por teclado; los modales carecen de focus-trap y cierre con tecla Escape.

---

## 🗺️ 6. Plan Maestro de Remediación en 4 Olas (OpenSpec Workflow)

Las correcciones se ejecutarán de forma metódica mediante propuestas atómicas de OpenSpec (`openspec/changes/`):

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        HOJA DE RUTA DE REMEDIACIÓN (4 OLAS)                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🌊 OLA 1: Integridad Crítica, Pánico Acústico y Anti-Carrera (P0 + P1 Críticos)        │
│   • F4-01: Atomicidad de importación replace en una sola transacción IndexedDB.        │
│   • F01 + F02: Token guard en recordAnswer + extracción de updater impuro en secuencia.│
│   • F03: Cancelación garantizada de pre-roll ante finalización por tiempo.             │
│   • H-01 + H-02: Pánico MIDI multicanal (Canal 1 + Canal 10) + CC 121 + Pitch Bend.    │
│                                                                                        │
│ 🌊 OLA 2: Exactitud Musical, Rítmica y Pipeline de Dominio Puro (P1 de Dominio)        │
│   • H-06: Inclusión de silencios en cómputo IOI/offset y blindaje contra división por 0.│
│   • H-04: Sincronización de autoSpeedRamp con el reloj del metrónomo continuo.         │
│   • H-05: Soporte para ligaduras de prolongación <tie> en scoreParser.ts.              │
│   • F-01 + F-02 + F-03: Traslado de filtros ISI/input/bias al motor (sessionFilters.ts)│
│   • F-04: Unificación de ratio de sesgo a 1.4 canónico entre motor e informe.          │
│                                                                                        │
│ 🌊 OLA 3: Rendimiento de Render, Teclado 3D y Ergonomía UI/UX (P1 + P2 Frontend)       │
│   • F5-01 + F5-02: Resurrección de la memoización de PianoKeyboard y teclas aisladas.  │
│   • F5-03: Memoización de MarkdownRenderer y aislamiento del ticker de razonamiento.   │
│   • F5-04 + F5-15: Desbloqueo de Space en analítica y filtro de modificadores en 'R'.  │
│   • F5-05 + F5-06 + F5-07: Focus-trap, Escape en modales y accesibilidad de tooltips.  │
│                                                                                        │
│ 🌊 OLA 4: Arquitectura Limpia, Modularización de Monolitos e Higiene (P2 + P3)         │
│   • F10: Extracción de defaultScore.ts y repertoirePlaybackService.ts fuera de App.tsx.│
│   • F-17: Modularización de historyAnalytics.ts (1244L) en 9 submódulos con barrel.    │
│   • F4-02: Singleton compartido de LmStudioService para CircuitBreaker unificado.      │
│   • F11 + H-19: Tipado estricto Map<string, number> en useMidi.ts.                     │
│   • F12 + F15: Telemetría metacognitiva completa y medición real de latencia.          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 7. Dictamen Final de la Auditoría V6

El proyecto **MIDI Laboratory (v1.0.0)** cuenta con una base de arquitectura moderna, tipado estricto y cobertura de tests sobresaliente (**293 tests pasando al 100%**).

Los 84 hallazgos detectados en esta auditoría no representan fallas de concepto, sino los desajustes naturales propios de la transición desde un prototipado ágil hacia un **sistema de software de estudio profesional**.

Con la adopción de **OpenSpec**, la constitución canónica de especificaciones y la memoria persistente en **Engram**, el proyecto cuenta con el andamiaje técnico definitivo para ejecutar las 4 Olas de remediación con **cero regresiones y máxima elegancia de ingeniería**.
