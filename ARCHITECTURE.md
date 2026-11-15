# 🏛️ Arquitectura del Sistema (Clean Architecture & Data Flow)

## 1. Cadena de Hardware Físico

```text
[ Roland FP-8 (88 Teclas) ]
   │
   ├── MIDI OUT ──► [ Roland UM-ONE mk2 (IN) ] ──► [ PC Windows 11 / Electron ]
   │
   └── MIDI IN  ◄── [ Roland UM-ONE mk2 (OUT) ] ◄── [ PC Windows 11 / Electron ]
         │
    (MIDI THRU)
         │
         ▼
   [ Korg NS5R (Módulo de Sonido General MIDI) ]
         │ (Audio Line Out)
         ▼
   [ Yamaha MS20S (Monitores Amplificados) ] ──► 👂 Alumno
```

---

## 2. Diagrama de Capas de Software

```text
src/
├── main/                           ← PROCESO PRINCIPAL ELECTRON
│   ├── index.ts                    (Ventana BrowserWindow + cableado de permisos, guardas e IPC con AbortController/Timeouts hacia LM Studio)
│   ├── sessionPermissions.ts       (Allowlist fail-closed de permisos de sesión Web: solo 'midi' y 'midiSysex')
│   ├── windowNavigationGuard.ts    (Guardas fail-closed de navegación in-frame y shell.openExternal)
│   ├── lmStudioHandlers.ts         (Handlers IPC LM Studio: check-models / chat-completion, testeables sin Electron)
│   ├── lmStudioHostValidator.ts    (Allowlist anti-SSRF: solo destinos 127.0.0.1 / localhost con http/https)
│   └── chatPayloadValidator.ts     (Validación fail-closed del esquema del payload lm-studio:chat-completion)
│
├── preload/                        ← PUENTE IPC AISLADO
│   ├── index.ts                    (contextBridge seguro con electronAPI y customAPI)
│   └── index.d.ts                  (Declaración global ambiental de window.customAPI)
│
└── renderer/src/                   ← PROCESO DE RENDERIZADO (React 19 / UI)
    ├── domain/                     ← CAPA DE DOMINIO PURO (0 dependencias de React, 100% testeable)
    │   ├── music/                  (noteUtils, intervals, sequences, instruments, presets, tonalContext, scoreParser, scoreTypes, defaultScore)
    │   ├── exercise/               (evaluator, intervalEvaluator, sequenceEvaluator, repertoireEvaluator, evalPolicy, exerciseGeneratorRules, visualAudioSync, types)
    │   ├── adaptation/             (adaptiveEngine, spacedRepetitionEngine, types)
    │   ├── analytics/              (historyAnalytics, longitudinal, psychometrics, confusionMatrix, latencyStats, sessionClassification, sessionFilters, sessionModality, pedagogicalDictionary, diagnosticReportGenerator, thresholds, timelineTelemetry, types)
    │   ├── database/               (databaseEngine v6, recordValidator, types)
    │   └── ai/                     (appConfig, lmStudioService, promptBuilder, fallbackGenerator, schemaValidator, circuitBreaker, prescriptionSanitizer, types)
    │
    ├── stores/                     ← GESTIÓN DE ESTADO GLOBAL (Zustand Segmentado)
    │   ├── useDatabaseStore.ts     (Persistencia IndexedDB, sesiones con targetMode, respuestas, CRUD y cascada)
    │   ├── useAnalyticsStore.ts    (Filtrado por modalidad y cálculo psicométrico reactivo)
    │   ├── useAiStore.ts           (Conexión LM Studio, inferencia GPU, prescripciones e historial de reportes)
    │   └── useTelemetryStore.ts    (Log en vivo de eventos MIDI/IA/EVAL para el monitor de estudio)
    │
    ├── services/                   ← INFRAESTRUCTURA
    │   ├── midi/                   (midiParser: decodificación binaria NoteOn/Off; midiInputFilter: anti-rebote de 35ms y watchdog)
    │   ├── audio/                  (stimulusScheduler: programación Web Audio de estímulos y metrónomo)
    │   └── keyboard/               (shortcutDecision: decisión de atajos de teclado según modo de entrenamiento)
    │
    ├── hooks/                      ← MÁQUINAS DE ESTADO Y KERNEL DE PRÁCTICA
    │   ├── useTrainerCore.ts       (KERNEL CENTRAL: Temporizadores, auto-advance, tokens anti-carrera y persistencia)
    │   ├── useMidi.ts              (Web MIDI API, software Thru, auto-reconexión hotplug y MIDI Panic CC 120/123/64)
    │   ├── useSingleNoteTrainer.ts (Adaptador de 1 nota con Modo Maestría y Anclaje Tonal)
    │   ├── useIntervalTrainer.ts   (Adaptador de 2 notas secuenciales con direcciones y raíces)
    │   ├── useSequenceTrainer.ts   (Adaptador de secuencias melódicas de 3-6 notas con Levenshtein y contorno)
    │   └── useRepertoireTrainer.ts (Adaptador de repertorio MusicXML: hands-separate y tempo configurable)
    │
    └── components/                 ← DESIGN SYSTEM Y VISTAS
        ├── ui/                     (Button, Card, Badge, StatCard, ConfirmModal, ErrorBoundary, MarkdownRenderer, PedagogicalTooltip, markdownParser, tooltipPlacement)
        ├── trainer/                (PianoKeyboard 3D, FeedbackPanels por modalidad, SummaryCards, AnalyticsCharts, MidiMonitor, StudioTopBar, StudioBottomDock, Header, DbSaveAlert, MidiDeviceSelect, MidiDisconnectAlert)
        └── views/                  (SingleNoteView, IntervalsView, SequencesView, RepertoireView, AnalyticsView, DatabaseCard, sessionHeaderStyles)
            ├── analytics/          (Tabs de analítica: KPIs, tabla de sesiones, longitudinal, matriz de confusión, IA diagnóstico/consulta/historial)
            └── guide/              (KnowledgeGuideModal + diagramas pedagógicos: IRT, Leitner, entropía, latencia, sesgo de semitono)
```

---

## 3. Patrones de Diseño Implementados

1. **Micro-Kernel Pattern (`useTrainerCore`):** Extracción del ciclo de vida de sesión, temporizadores de cuenta regresiva y persistencia atómica en un kernel común parametrizable.
2. **Strategy Pattern:** Algoritmos de selección musical intercambiables (`AdaptiveV1`, `SpacedRepetition`, `Random`).
3. **Circuit Breaker Pattern:** Resiliencia ante latencias o caídas del servidor de IA local con fallback algorítmico instantáneo.
4. **Hardware MIDI Panic & Resiliencia Acústica:** Emisión de CC #120 (All Sound Off), CC #123 (All Notes Off) y CC #64 (Sustain Off) en desmontajes y cambios de programa para evitar tonos colgados en hardware Korg/Roland.
5. **Item Response Theory (IRT) & Shannon Entropy:** Modelado psicométrico que descuenta el factor azar ($c = 1/\text{PoolSize}$) y cuantifica la carga de incertidumbre ($H = \log_2(N)$).
6. **Robust Balanced Parser con Soporte `<think>`:** Extracción léxica inmune a bloques de razonamiento profundo generados por modelos como Qwen 2.5 / DeepSeek R1.
