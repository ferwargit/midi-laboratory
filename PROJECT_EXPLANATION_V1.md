# midi-laboratory — Explicación Completa del Proyecto

---

## 🎯 Visión General

**midi-laboratory** (nombre del paquete: `midi-ear-trainer`) es una aplicación de escritorio **Electron + React** diseñada como **entrenador auditivo musical inteligente y adaptativo**. Combina:

- **Web MIDI API** nativa para interacción con hardware (controladores Korg, Roland, interfaces USB-MIDI)
- **Web Audio API** para síntesis de estímulos auditivos precisos
- **LM Studio local** para análisis pedagógico mediante LLM (vía IPC seguro)
- **IndexedDB** para persistencia local de sesiones, respuestas y reportes IA
- **Motor adaptativo propio** (spaced repetition SM-2 modificado + heurísticas de dificultad)

> **Stack principal**: Electron 43 · React 19 · TypeScript 5.9 · Vite 7 · Tailwind CSS 4 · Zustand 5

---

## 🏗️ Arquitectura de Carpetas (`src/`)

```text
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

---

## ⚙️ Flujo Principal (`App.tsx`)

### 5 Modos de Entrenamiento

| Modo | Descripción | Hook Principal |
|------|-------------|----------------|
| `single_note` | Reconocimiento de nota individual | `useSingleNoteTrainer` |
| `intervals` | Identificación de intervalos melódicos/armónicos | `useIntervalTrainer` |
| `sequences` | Dictado melódico / secuencias | `useSequenceTrainer` |
| `repertoire` | Práctica con partituras MusicXML | `useRepertoireTrainer` |
| `analytics` | Dashboard + consultas IA | `AnalyticsView` + `useAiStore` |

---

## 🔌 Comunicación Main ↔ Renderer

### Preload (`src/preload/index.ts`)

```typescript
const customAPI = {
  checkLmStudioModels: (baseUrl?) => ipcRenderer.invoke('lm-studio:check-models', baseUrl),
  chatLmStudio: (payload) => ipcRenderer.invoke('lm-studio:chat-completion', payload)
}
contextBridge.exposeInMainWorld('customAPI', customAPI)
```

### Main Process (`src/main/index.ts`)

- **IPC Handlers robustos** con `AbortController` + timeouts:
  - `lm-studio:check-models` → 2.5s timeout
  - `lm-studio:chat-completion` → 15 min timeout (deep reasoning GPU)
- **Seguridad**: `contextIsolation: true`, `sandbox: false` (documentado intencional)
- **CSP en `index.html`** permite `connect-src http://127.0.0.1:1234` para fallback fetch directo

---

## 🎹 Subsistema MIDI (`useMidi.ts`)

**Web MIDI API nativa** — *sin librerías externas*

### Características

- Enumeración dinámica de inputs/outputs
- **Soft-thru** configurable (reenvío input → output)
- **Filtro de rebote** (`MidiInputFilter` con ventana de debounce)
- **Watchdog de notas colgadas** (configurable via `DEFAULT_APP_CONFIG.midi.hungNoteWatchdogMs`)
- **Logs estructurados** con timestamp (IN/OUT/AI/EVAL)
- Detección de desconexión/reconexión de dispositivos
- API de envío: `sendNote(note, duration, velocity, channel)`, `changeProgram()`, `sendAllNotesOff()`

### Parser MIDI (`services/midi/midiParser.ts`)

```typescript
parseMidiData(data: Uint8Array): ParsedMidiMessage | null
// Extrae: command, channel (1-16), noteNumber, velocity, isNoteOn, isNoteOff
```

---

## 🎵 Subsistema Audio (`services/audio/stimulusScheduler.ts`)

**Web Audio API** para estímulos auditivos precisos:

- `ScheduledNoteEvent` — nota + tiempo absoluto + duración
- Planificación basada en `AudioContext.currentTime`
- Soporte para **cues visuales asistidos** (sincronía audio-visual)
- Limpieza automática de timers/osciladores

---

## 🧠 Dominio: Lógica de Negocio Pura (`domain/`)

### Adaptación Inteligente (`adaptation/`)

| Archivo | Responsabilidad |
|---------|-----------------|
| `adaptiveEngine.ts` | Motor principal: ajusta dificultad, selecciona ejercicios según historial |
| `spacedRepetitionEngine.ts` | SM-2 modificado: intervalos de repaso basados en facilidad/precisión |
| `types.ts` | Tipos compartidos: `AdaptationState`, `ExerciseSelection`, `DifficultyLevel` |

### IA / LM Studio (`ai/`)

```text
appConfig.ts           # Config centralizada (timeouts, prompts, modelo default)
circuitBreaker.ts      # Patrón Circuit Breaker para resiliencia LM Studio
fallbackGenerator.ts   # Generación local si IA no disponible
lmStudioService.ts     # Cliente HTTP + IPC fallback
promptBuilder.ts       # Construcción de prompts pedagógicos estructurados
prescriptionSanitizer.ts # Validación/sanitización de respuestas JSON del LLM
schemaValidator.ts     # Validador Zod-like para esquemas de respuesta
```

### Base de Datos (`database/`)

- **`DatabaseEngine`** — Wrapper IndexedDB con:
  - Object stores: `sessions`, `answers`, `aiReports`, `aiConsultations`
  - Índices compuestos para queries eficientes
  - Migraciones de versión automáticas
  - `exportDatabase()` / `importDatabase()` → JSON backup portable
- **`recordValidator.ts`** — Validación estricta de registros antes de persistir
- **`types.ts`** — Tipos `DbSessionRecord`, `DbAnswerRecord`, `DatabaseSummary`, etc.

### Ejercicios (`exercise/`)

- `evaluator.ts` / `intervalEvaluator.ts` — Evaluación respuesta vs objetivo
- `evalPolicy.ts` — Políticas de puntuación (ventana temporal, tolerancia)
- `exerciseGeneratorRules.ts` — Reglas generativas por modo/dificultad
- `visualAudioSync.ts` — Modos: `none` | `assisted` | `guided`

### Música (`music/`)

- `noteUtils.ts` — `midiNoteToName()`, `isBlackKey()`, `generateMidiRange()`
- `tonalContext.ts` — `TonalContextMode`, `getTonalContextSteps()`
- `scoreParser.ts` — `parseMusicXML()` → estructura tipada para Repertoire

### Orquestación en `App.tsx`

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
// ...
```

---

## 🗄️ Estado Global (Zustand Stores)

### `useDatabaseStore.ts`

```typescript
interface DatabaseState {
  engine: DatabaseEngine | null
  summary: DatabaseSummary
  sessions: DbSessionRecord[]
  answers: DbAnswerRecord[]
  aiReports: DbAiReportRecord[]
  aiConsultations: DbAiConsultationRecord[]
  initialize(): Promise<void>
  saveSession(session, answers): Promise<void>
  deleteSession(id): Promise<void>
  exportBackupJson(): Promise<string>
  importBackupJson(json, mode): Promise<ImportResult>
  clearDatabase(): Promise<void>
}
```

### `useAiStore.ts` (no mostrado pero referenciado)

- Cache de prescripciones IA
- Historial de consultas
- `resetAiMemory()` llamado al limpiar BD

---

## 📦 Dependencias Principales

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
| `fake-indexeddb` | 6.2.5 | Mock IndexedDB para tests |

### Lint / Format

| Paquete | Versión |
|---------|---------|
| `eslint` | 9.39.1 |
| `prettier` | 3.7.4 |
| `eslint-plugin-react*` | 7.x |

> **Nota**: **Cero dependencias MIDI/audio externas** — usa APIs nativas del navegador.
> **Cero SDK de IA** — HTTP directo a LM Studio local.

---

## 🔧 Configuración de Build

### `electron.vite.config.ts`

```typescript
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: { alias: { '@renderer': resolve('src/renderer/src') } },
    plugins: [react(), tailwindcss()]
  }
})
```

### Scripts `package.json`

```json
{
  "dev": "electron-vite dev",
  "build": "npm run typecheck && electron-vite build",
  "build:win": "npm run build && electron-builder --win",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "lint": "eslint . --ext .ts,.tsx --fix",
  "typecheck": "npm run typecheck:node && npm run typecheck:web"
}
```

---

## 🔐 Seguridad

- `contextIsolation: true` — aisla contexto renderer de Node.js
- `sandbox: false` — **intencional** (documentado en `main/index.ts:16-22`)
  - Razón: `window.customAPI` deja de estar disponible con sandbox
  - Fallback a `fetch()` directo choca con CSP
  - Mitigación real: `contextIsolation` + CSP estricto
- **CSP** en `index.html`:
  ```html
  connect-src 'self' http://127.0.0.1:1234
  ```
- IPC validado con timeouts y `AbortController`
- No `nodeIntegration` en renderer

---

## 🧪 Testing

- **Vitest** + **jsdom** environment
- **@testing-library/react** para componentes
- **fake-indexeddb** para tests de `DatabaseEngine`
- Tests colocalizados: `*.test.ts(x)` junto al código
- Cobertura con `@vitest/coverage-v8` (v8 provider nativo)

---

## 🚀 Cómo Ejecutar

```bash
# Desarrollo
npm run dev

# Producción (typecheck + build)
npm run build

# Ejecutable Windows
npm run build:win

# Tests
npm run test
npm run test:coverage

# Lint + Format
npm run lint
npm run format
```

---

## 📄 Documentación Adicional en Repo

| Archivo | Contenido |
|---------|-----------|
| `ARCHITECTURE.md` | Decisiones arquitectónicas detalladas |
| `REPERTOIRE_LEARNING_V1_SPEC.md` | Especificación modo repertoire v1 |
| `REPERTOIRE_LEARNING_V2_SPEC.md` | Especificación modo repertoire v2 |
| `AUDIT_REPORT_V*_ARCHIVE.md` | Auditorías históricas |

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

*Generado automáticamente desde análisis de código — `midi-laboratory` v1.0.0*