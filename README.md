# 🎹 MIDI Ear Trainer — Entrenador Auditivo Inteligente con IA Local

> Aplicación de escritorio **Electron + React + TypeScript** para entrenamiento y discriminación auditiva musical de alta precisión, asistida por **Inteligencia Artificial Local (LM Studio / Qwen 3.5 en GPU NVIDIA)** y comunicación de baja latencia con hardware MIDI físico (**Roland FP-8, Roland UM-ONE mk2, Korg NS5R**).

---

## 📋 Tabla de Contenidos

- [Visión General](#-visión-general)
- [Características Principales](#-características-principales)
- [Arquitectura Técnica](#-arquitectura-técnica)
- [Stack Tecnológico](#-stack-tecnológico)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación y Uso](#-instalación-y-uso)
- [Scripts Disponibles](#-scripts-disponibles)
- [Seguridad](#-seguridad)
- [Testing](#-testing)
- [Documentación Adicional](#-documentación-adicional)
- [Puntos Clave de Diseño](#-puntos-clave-de-diseño)

---

## 🎯 Visión General

**MIDI Ear Trainer** (paquete npm: `midi-ear-trainer`) es un **entrenador auditivo musical inteligente y adaptativo** que combina:

| Capa | Tecnología | Propósito |
|------|------------|-----------|
| **Entrada MIDI** | Web MIDI API nativa | Comunicación hardware (Korg, Roland, USB-MIDI) sin latencia |
| **Audio** | Web Audio API | Síntesis de estímulos auditivos precisos y *cues* sincronizados |
| **Inteligencia Artificial** | LM Studio local (IPC seguro) | Diagnóstico pedagógico + prescripción de ejercicios ejecutables |
| **Persistencia** | IndexedDB (Wrapper `DatabaseEngine`) | Sesiones, respuestas, reportes IA, backup JSON portable |
| **Adaptación** | Motor propio (SM-2 modificado + heurísticas) | Repetición espaciada + selección probabilística por matriz de confusión |

> **Stack principal**: Electron 43 · React 19 · TypeScript 5.9 · Vite 7 · Tailwind CSS 4 · Zustand 5

---

## ✨ Características Principales

### 1. Cinco Modalidades de Entrenamiento Musical

| Modo | Descripción | Hook Principal |
|------|-------------|----------------|
| **🎵 Nota Individual** | Reconocimiento de altura absoluta (3 octavas C3–C6), progresión diatónica/cromática, presets y *Modo Maestría* (≥85% acierto) | `useSingleNoteTrainer` |
| **📏 Intervalos (2 Notas)** | 13 clases (2m–8J), direcciones asc/desc/mixta, canciones-ancla mnemotécnicas, evaluador que separa error auditivo de error motor | `useIntervalTrainer` |
| **🎼 Secuencias (3–6 Notas)** | Memoria melódica evaluada en 3 capas: nota a nota, contorno (📈📉), distancia Levenshtein con puntaje % | `useSequenceTrainer` |
| **📚 Repertorio (MusicXML)** | Práctica con partituras reales parseadas (MusicXML 4.0), hands-separate, tempo configurable | `useRepertoireTrainer` |
| **📊 Analytics + IA** | Dashboard científico + consultas a LLM local para diagnóstico y prescripción 1-clic | `AnalyticsView` + `useAiStore` |

### 2. Motor Adaptativo Inteligente (Strategy Pattern)

| Estrategia | Algoritmo | Uso |
|------------|-----------|-----|
| **Adaptativo v1** | Ponderación probabilística por matriz de confusión de semitonos + tasa de error | Entrenamiento personalizado |
| **Repetición Espaciada** | Leitner / SM-2 modificado (3 cajas, re-evaluación inmediata de fallos) | Consolidación a largo plazo |
| **Aleatorio Clásico** | Distribución uniforme | Evaluación libre / baseline |

### 3. Psicometría Psicoacústica y Analítica Científica

- **Corrección por Azar (IRT / Teoría de Respuesta al Ítem)** — Precisión normalizada: $c = 1/\text{PoolSize}$
- **Entropía Contextual (Shannon)** — Carga de incertidumbre: $H = \log_2(\text{PoolSize})$ bits
- **Espectro de Latencia Cognitiva** — Segmentación: *Reflejo Inmediato* (<1.2s) · *Deducción Activa* (1.2–2.8s) · *Incertidumbre* (>2.8s)
- **Sesgo de Semitono** — Histograma direccional de errores (+st agudo vs –st grave)
- **Matriz de Confusión** — Heatmap interactivo por intervalo/nota

### 4. Inteligencia Artificial Local (Zero Cloud / Privacidad Total)

- **Conexión IPC nativa** con LM Studio (`http://127.0.0.1:1234`) — modelos *deep reasoning* (Qwen 3.5 9B, Llama 3) en GPU NVIDIA RTX
- **Diagnóstico clínico exhaustivo** en lenguaje natural
- **Prescripción de Ejercicios Ejecutables en 1 Clic** — La IA diseña y configura: timbre, notas, criterios, modo de avance
- **Circuit Breaker & Fallback Local** — Si LM Studio no está disponible, conmuta a motor heurístico interno sin bloquear la práctica

### 5. Hardware y UX de Estudio Profesional

| Característica | Detalle |
|----------------|---------|
| **Timbres GM en Korg NS5R** | `Program Change` nativo: Piano, Flauta, Violín, Clarinete, Bajo |
| **Teclado 3D Isomórfico** | 37 teclas (C3–C6) renderizado continuo, sin scroll horizontal, *heatmap* en vivo |
| **Sincronización Audiovisual** | Selector: `[ 👂 Oído Puro / A Ciegas ]` ↔ `[ 👁️ Asistido ]` |
| **Modos de Avance** | Inteligente (pausa al fallar) · Manual (Espacio) · Automático |
---

## 🏗️ Arquitectura Técnica

### Separación de Procesos (Electron)

```
┌─────────────────────────────────────────────────────────────┐
│                      MAIN PROCESS (Node.js)                 │
│  src/main/index.ts                                          │
│  - Ventana principal (BrowserWindow)                        │
│  - IPC Handlers: lm-studio:check-models, chat-completion    │
│  - AbortController + timeouts (2.5s / 15min)                │
└─────────────────────────┬───────────────────────────────────┘
                          │ contextBridge (preload)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS (React SPA)             │
│  src/renderer/src/                                          │
│  - App.tsx: orquesta 5 modos + hooks globales               │
│  - Domain: lógica pura (sin React, testeable)               │
│  - Stores: Zustand (DB, AI, Analytics)                      │
│  - Services: MIDI, Audio, AI (IPC)                          │
└─────────────────────────────────────────────────────────────┘
```

### Flujo Principal (`App.tsx`)

```typescript
// Estado global compartido
const midi = useMidi({ onNoteOn, onNoteOff, ... })
const singleNoteTrainer = useSingleNoteTrainer()
const intervalTrainer = useIntervalTrainer()
const sequenceTrainer = useSequenceTrainer()
const repertoireTrainer = useRepertoireTrainer()
const { clearDb, ... } = useDatabaseStore()

// Renderizado condicional por modo
{appMode === 'single_note' && <SingleNoteView ... />}
{appMode === 'intervals' && <IntervalsView ... />}
{appMode === 'sequences' && <SequencesView ... />}
{appMode === 'repertoire' && <RepertoireView ... />}
{appMode === 'analytics' && <AnalyticsView onLoadPrescription={...} />}
```

### Comunicación Main ↔ Renderer (Preload)

```typescript
// src/preload/index.ts
const customAPI = {
  checkLmStudioModels: (baseUrl?) => ipcRenderer.invoke('lm-studio:check-models', baseUrl),
  chatLmStudio: (payload) => ipcRenderer.invoke('lm-studio:chat-completion', payload)
}
contextBridge.exposeInMainWorld('customAPI', customAPI)
```

- **Seguridad**: `contextIsolation: true`, `sandbox: false` (intencional, documentado)
- **CSP** en `index.html`: `connect-src 'self' http://127.0.0.1:1234`
---

## 📁 Estructura del Proyecto

```
src/
├── main/                           # Proceso principal Electron (Node.js)
│   └── index.ts                   # Ventana principal, IPC handlers LM Studio
├── preload/                        # Puente seguro Main ↔ Renderer (contextBridge)
│   └── index.ts                   # Expone customAPI + electronAPI
└── renderer/                       # Proceso de renderizado (React SPA)
    ├── index.html                 # HTML base + CSP configurado
    └── src/
        ├── main.tsx               # Entry point React + ErrorBoundary
        ├── App.tsx                # Componente raíz - orquesta 5 modos
        ├── assets/                # CSS global (Tailwind v4 + base)
        ├── components/            # Componentes UI por dominio
        │   ├── trainer/           # Componentes específicos del entrenador
        │   ├── ui/                # Componentes genéricos reutilizables
        │   └── views/             # Vistas por modo + analytics
        ├── domain/                # Lógica de negocio PURA (sin React)
        │   ├── adaptation/        # Motor adaptativo + spaced repetition
        │   ├── ai/                # Integración LM Studio (prompts, circuit breaker)
        │   ├── analytics/         # Reportes, diccionario pedagógico, history
        │   ├── database/          # IndexedDB via DatabaseEngine
        │   ├── exercise/          # Evaluadores, generadores, políticas
        │   └── music/             # Utilidades musicales (notas, tonalidad, MusicXML)
        ├── hooks/                 # Custom React hooks
        │   ├── useMidi.ts         # Web MIDI API centralizada
        │   ├── use*Trainer.ts     # Hooks por modo de entrenamiento
        │   └── ...
        ├── services/              # Servicios de infraestructura
        │   ├── audio/             # StimulusScheduler (Web Audio API)
        │   └── midi/              # Parser MIDI, InputFilter
        └── stores/                # Estado global con Zustand
            ├── useDatabaseStore.ts
            ├── useAiStore.ts
            └── ...
```

### Dominio: Lógica de Negocio Pura (`domain/`)

| Módulo | Archivos Clave | Responsabilidad |
|--------|----------------|-----------------|
| **Adaptación** | `adaptiveEngine.ts`, `spacedRepetitionEngine.ts`, `types.ts` | Motor adaptativo + SM-2 modificado |
| **IA / LM Studio** | `appConfig.ts`, `circuitBreaker.ts`, `lmStudioService.ts`, `promptBuilder.ts`, `prescriptionSanitizer.ts`, `schemaValidator.ts` | Cliente LLM resiliente, prompts estructurados, validación |
| **Base de Datos** | `databaseEngine.ts`, `recordValidator.ts`, `types.ts` | Wrapper IndexedDB, stores, índices, backup JSON |
| **Ejercicios** | `evaluator.ts`, `intervalEvaluator.ts`, `evalPolicy.ts`, `exerciseGeneratorRules.ts`, `visualAudioSync.ts` | Evaluación, políticas, generación, sync A/V |
| **Música** | `noteUtils.ts`, `tonalContext.ts`, `scoreParser.ts` | Utilidades notas, tonalidad, parser MusicXML |
---

## 🛠️ Stack Tecnológico

### Runtime / Framework

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `electron` | 43.4.0 | Runtime desktop |
| `react` / `react-dom` | 19.2.1 | UI framework |
| `electron-vite` | 5.0.0 | Build tooling integrado |
| `typescript` | 5.9.3 | Tipado estático |

### Estado & Estilos

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `zustand` | 5.0.15 | Stores reactivos simples |
| `tailwindcss` | 4.3.3 | Utility-first CSS (v4, plugin Vite) |
| `@tailwindcss/vite` | 4.3.3 | Integración Vite nativa |

### Electron Tooling

| Paquete | Versión |
|---------|---------|
| `@electron-toolkit/utils` | 4.0.0 |
| `@electron-toolkit/preload` | 3.0.2 |
| `@electron-toolkit/tsconfig` | 2.0.0 |
| `@electron-toolkit/eslint-config-*` | 3.x |
| `electron-builder` | 26.0.12 |

### Testing

| Paquete | Versión |
|---------|---------|
| `vitest` | 4.1.10 |
| `@testing-library/react` | 16.3.2 |
| `jsdom` | 29.1.1 |
| `@vitest/coverage-v8` | 4.1.11 |
| `fake-indexeddb` | 6.2.5 |

### Lint / Format

| Paquete | Versión |
|---------|---------|
| `eslint` | 9.39.1 |
| `prettier` | 3.7.4 |
| `eslint-plugin-react*` | 7.x |

> **Nota**: **Cero dependencias MIDI/audio externas** — usa APIs nativas del navegador.  
### Estado Global (Zustand)

```typescript
// useDatabaseStore.ts — Persistencia IndexedDB
interface DatabaseState {
  engine: DatabaseEngine | null
  summary: DatabaseSummary
  sessions: DbSessionRecord[]
  answers: DbAnswerRecord[]
  aiReports: DbAiReportRecord[]
  aiConsultations: DbAiConsultationRecord[]
  initialize(): Promise<void>
  saveSession(session, answers): Promise<void>
  exportBackupJson(): Promise<string>
  importBackupJson(json, mode): Promise<ImportResult>
  clearDatabase(): Promise<void>
}

// useAiStore.ts — Cache IA + historial consultas
// - Cache de prescripciones
// - Historial de consultas
// - resetAiMemory() vinculado a clearDatabase()
```

---

## 🚀 Instalación y Uso

### Requisitos Previos

- **Node.js** ≥ 20.x
- **npm** ≥ 10.x
- **LM Studio** ejecutándose localmente (`http://127.0.0.1:1234`) con modelo cargado (ej. Qwen 3.5 9B)
- Hardware MIDI opcional (Roland FP-8, UM-ONE mk2, Korg NS5R, etc.)

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/ferwargit/midi-laboratory.git
cd midi-laboratory

# Instalar dependencias
npm install

# Desarrollo (hot reload)
npm run dev
```

### Construcción para Producción

```bash
# Typecheck + Build completo
npm run build

# Ejecutable Windows (.exe + installer)
npm run build:win

# Solo desempaquetado (para testing)
npm run build:unpack
```

---

## 📜 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (electron-vite + Vite HMR) |
| `npm run build` | Typecheck completo + build producción |
| `npm run build:win` | Build + electron-builder (instalador Windows) |
| `npm run build:unpack` | Build + carpeta desempaquetada |
| `npm run test` | Tests unitarios (vitest run) |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:coverage` | Tests + cobertura v8 |
| `npm run lint` | ESLint + auto-fix |
| `npm run format` | Prettier --write |
| `npm run typecheck` | TypeScript check (node + web) |
| `npm run typecheck:node` | Solo config main/preload |
| `npm run typecheck:web` | Solo config renderer |
| `npm run postinstall` | electron-builder install-app-deps |

---

## 🔐 Seguridad

| Medida | Configuración | Justificación |
|--------|---------------|---------------|
| **Context Isolation** | `true` | Aísla renderer de Node.js (mitigación principal) |
| **Sandbox** | `false` | Intencional: `window.customAPI` requiere `sandbox: false` |
| **CSP** | `connect-src 'self' http://127.0.0.1:1234` | Permite fallback fetch directo a LM Studio |
| **IPC Validation** | `AbortController` + timeouts | Previene bloqueos indefinidos |
| **Node Integration** | `false` | Renderer sin acceso a Node.js APIs |

> Ver `src/main/index.ts:16-22` para documentación detallada de la decisión `sandbox: false`.

---

## 🧪 Testing

- **Framework**: Vitest 4 + jsdom environment
- **Component Testing**: @testing-library/react
- **IndexedDB Mock**: fake-indexeddb (tests de `DatabaseEngine`)
- **Cobertura**: @vitest/coverage-v8 (provider nativo V8)
- **Organización**: Tests colocalizados `*.test.ts(x)` junto al código fuente
- **Cobertura actual**: >86% líneas, 138+ tests

```bash
# Ejecutar tests
npm run test

# Con cobertura
npm run test:coverage

# Modo watch
npm run test:watch
```

---

## 📄 Documentación Adicional en Repo

| Archivo | Contenido |
|---------|-----------|
| `ARCHITECTURE.md` | Decisiones arquitectónicas detalladas (ADR-style) |
| `REPERTOIRE_LEARNING_V1_SPEC.md` | Especificación modo repertoire v1 |
| `REPERTOIRE_LEARNING_V2_SPEC.md` | Especificación modo repertoire v2 |
| `AUDIT_REPORT_V*_ARCHIVE.md` | Auditorías históricas de código/arquitectura |
| `PROJECT_EXPLANATION.md` | Análisis técnico exhaustivo generado automáticamente |

---

## 💡 Puntos Clave de Diseño

1. **Domain-Driven** — Lógica pura en `domain/` testeable sin React ni Electron
2. **Native First** — Web MIDI + Web Audio + IndexedDB + fetch (sin wrappers pesados)
3. **Local-First IA** — LM Studio en localhost, sin claves API, datos no salen de la máquina
4. **Resiliencia** — Circuit breaker, timeouts generosos, fallbacks locales
5. **Persistencia Portable** — Backup JSON importable/exportable (migración entre máquinas)
6. **Adaptación Real** — Spaced repetition + heurísticas de dificultad basadas en datos
7. **DX Moderna** — TypeScript strict, ESLint 9 flat config, Prettier, Vitest, Tailwind v4

---

## 🤝 Contribución

1. Fork del repositorio
2. Crea rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit con conventional commits: `git commit -m "feat: descripción"`
4. Push y abre Pull Request

---

## 📄 Licencia

MIT License — ver `LICENSE` para detalles.

---

## 🔗 Enlaces

- **Repositorio**: https://github.com/ferwargit/midi-laboratory
- **Issues**: https://github.com/ferwargit/midi-laboratory/issues
- **LM Studio**: https://lmstudio.ai/

---

*MIDI Ear Trainer v1.0.0 — Desarrollado con ❤️ para músicos que buscan precisión auditiva científica.*