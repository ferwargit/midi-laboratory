
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
│   └── index.ts                    (Ventana BrowserWindow + Handlers IPC hacia LM Studio sin CORS)
│
├── preload/                        ← PUENTE IPC AISLADO
│   ├── index.ts                    (contextBridge seguro)
│   └── index.d.ts                  (Tipado de window.customAPI)
│
└── renderer/src/                   ← PROCESO DE RENDERIZADO (React / UI)
    ├── domain/                     ← CAPA DE DOMINIO PURO (0 dependencias de React, 100% testeable)
    │   ├── music/                  (noteUtils, intervals, sequences, instruments, presets)
    │   ├── exercise/               (evaluator, intervalEvaluator, sequenceEvaluator, evalPolicy, rules, sync)
    │   ├── adaptation/             (adaptiveEngine, spacedRepetitionEngine, types)
    │   ├── database/               (databaseEngine, recordValidator, types)
    │   └── ai/                     (lmStudioService, promptBuilder, fallbackGenerator, schemaValidator, circuitBreaker)
    │
    ├── stores/                     ← GESTIÓN DE ESTADO GLOBAL (Zustand Segmentado)
    │   ├── useDatabaseStore.ts     (Persistencia IndexedDB, sesiones, respuestas, CRUD)
    │   ├── useAnalyticsStore.ts    (Filtrado por modalidad y cálculo psicométrico reactivo)
    │   └── useAiStore.ts           (Conexión LM Studio, inferencia GPU, prescripciones e historial de reportes)
    │
    ├── services/midi/              ← INFRAESTRUCTURA MIDI
    │   ├── midiParser.ts           (Decodificación binaria NoteOn/Off y canales)
    │   └── midiInputFilter.ts      (Filtro anti-rebote de 35ms y watchdog de notas colgadas)
    │
    ├── hooks/                      ← MÁQUINAS DE ESTADO DE PRÁCTICA
    │   ├── useMidi.ts              (Web MIDI API, software Thru, auto-reconexión hotplug)
    │   ├── useSingleNoteTrainer.ts (Bucle de práctica de 1 nota con Modo Maestría y Temporizadores)
    │   ├── useIntervalTrainer.ts   (Bucle de práctica de 2 notas secuenciales)
    │   └── useSequenceTrainer.ts   (Bucle de práctica de secuencias melódicas de 3-6 notas)
    │
    └── components/                 ← DESIGN SYSTEM Y VISTAS
        ├── ui/                     (Button, Card, Badge, StatCard, ConfirmModal, ErrorBoundary)
        ├── trainer/                (PianoKeyboard 3D, FeedbackPanels, AnalyticsCharts, MidiMonitor)
        └── views/                  (SingleNoteView, IntervalsView, SequencesView, AnalyticsView, DatabaseCard)
```

---

## 3. Patrones de Diseño Implementados
1. **Strategy Pattern:** Algoritmos de selección intercambiables (`AdaptiveV1`, `SpacedRepetition`, `Random`).
2. **Circuit Breaker Pattern:** Resiliencia ante fallos o latencias del servidor de IA local con fallback instantáneo.
3. **Single Source of Truth & Store Segmentation:** Separación estricta entre DB, Analítica e IA en Zustand.
4. **Item Response Theory (IRT) Normalization:** Corrección matemática de aciertos por probabilidad de azar.
5. **Deterministic Prescription Sanitization:** Capa post-LLM que corrige alucinaciones de octavas ($B4$ vs $B5$) y elimina campos huérfanos.

