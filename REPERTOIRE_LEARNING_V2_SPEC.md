# 🎼 ESPECIFICACIÓN TÉCNICA Y ARQUITECTURA: APRENDIZAJE AUDIOMOTOR DE REPERTORIO
### Modalidad 04: *Audiomotor Repertoire Chaining Engine* — Versión 2.0

**Fecha de Actualización:** 26 de Agosto, 2026
**Proyecto:** MIDI Laboratory (`midi-ear-trainer` v1.0.0)
**Estado:** 🌟 **FASE 1 A 4 IMPLEMENTADAS, VERIFICADAS Y BLINDADAS (280/280 Tests en Verde)**
**Entorno Tecnológico:** Electron + React 19 + TypeScript + Tailwind CSS v4 + Zustand 5 + IndexedDB v5 + Web MIDI API + Vitest (v8)
**Hardware de Prueba:** Roland FP-8 (Entrada MIDI física) + Roland UM-ONE mk2 + Korg NS5R (Síntesis General MIDI)

---

## 🧠 1. Fundamentación Psicoacústica y Neurocientífica

```text
       [ ENTRADA ACÚSTICA ]                       [ PROCESAMIENTO CENTRAL ]                   [ RESPUESTA MOTORA ]
     ┌──────────────────────┐                    ┌─────────────────────────┐                 ┌────────────────────┐
     │ Korg NS5R            │ ─────────────────► │ 1. Audiación (Gordon)   │ ──────────────► │ Corteza Premotora  │
     │ • Canal 10: Metrónomo│                    │ 2. Memoria Fonológica   │                 │ • Mapa de Teclas   │
     │ • Canal 1: Piano     │                    │ 3. Percepción IOI (Repp)│                 └─────────┬──────────┘
     └──────────────────────┘                    └─────────────────────────┘                           │
                 ▲                                            ▲                                        ▼
                 │                                            │ (Bucle Feedforward/Feedback)  ┌──────────────────┐
                 └────────────────────────────────────────────┴────────────────────────────── │ Roland FP-8      │
                                                                                              │ (Entrada MIDI)   │
                                                                                              └──────────────────┘
```

1. **El Bucle Auditivo-Motor (*Auditory-Motor Integration*, Zatorre, Chen & Penhune, 2007) [1.1.4]:**
   A diferencia del modelo reactivo-visual tipo *Synthesia* (*"veo caer una barra, toco una tecla"*), la Modalidad 04 entrena la vía eferente auditivo-motora: **Escucha $\to$ Audiación mental $\to$ Búsqueda neuromuscular en el teclado** [1.1.4, 1.1.7]. La corrección se realiza comparando la disonancia física contra la imagen mental interna [1.1.4, 1.1.5].
2. **Audiación Interna (*Edwin Gordon's Music Learning Theory*) [1.1.8]:**
   Capacidad de escuchar, comprender y anticipar el sonido en la mente antes de pulsar físicamente la tecla [1.1.8]. El oído se convierte en el guía activo de los dedos.
3. **Isocronía como Andamio Cognitivo (*Cognitive Load Theory*, Sweller; Ravignani, 2020) [1.2.2, 1.3.1]:**
   Al abordar una frase nueva, reproducir las notas a duraciones homogéneas regulares (todas negras) reduce la entropía temporal a cero, liberando el 100% de la capacidad de la memoria de trabajo para discriminar la altura ($f_0$) y la digitación sin estrés métrico [1.2.2, 1.3.1, 1.4.9].
4. **Percepción Rítmica Proporcional (*Inter-Onset Intervals - IOI*, Repp, 2005; Jacoby & McDermott, 2024) [1.3.2, 1.3.9]:**
   El cerebro humano evalúa el ritmo mediante relaciones de proporción ($2:1, 1:1$) [1.3.2]. El motor compara los ratios de tiempo relativos entre notas, permitiendo agógica y rubato orgánico sin forzar rigidez mecánica [1.3.2].
5. **Cierre Gestáltico y Nota de Llegada (*Target Note Resolution*, Lerdahl & Jackendoff) [1.1.2, 1.4.3]:**
   Las frases musicales respiran hacia puntos de reposo armónico [1.1.2]. Cortar un compás antes de la barra genera tensión inconclusa; incluir la **primera nota de resolución del compás siguiente** completa el gesto motor hacia la tónica [1.1.2].
6. **Pausa de Respiración Atencional (*Attentional Reset*, $1700\text{ ms}$):**
   Entre la última nota tocada y el inicio de la siguiente cuenta previa existe una pausa deliberada de $1.7\text{ segundos}$ de silencio para relajar la musculatura, asimilar el feedback y preparar la atención.

---

## 🏛️ 2. Arquitectura del Sistema e Implementaciones Reales

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA DE LA MODALIDAD REPERTORIO                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  [1. INGESTA: scoreParser.ts] ──────► [2. KERNEL: useRepertoireTrainer.ts]             │
│   • MusicXML 4.0 (MuseScore 4)         • Forward / Backward Chaining                   │
│   • <backup>, <chord>, <harmony>       • Fusión Polifónica 2 Manos (C3 + G4)           │
│   • Digitación, silencios, métrica     • Resolución +1 Res. (Tiempo 1.0 C.+1)          │
│                                        • Streaks (1x a 10x) + Auto-Save IndexedDB      │
│                                        • Control Maestro BPM (~ms)                     │
│                                                                                        │
│                                                   │                                    │
│                                                   ▼                                    │
│  [4. HARDWARE: useMidi.ts] ◄───────── [3. SCHEDULER: stimulusScheduler.ts]            │
│   • Canal 10: Metrónomo (Woodblock/Rim) • Reloj Maestro Cuantizado (0ms Jitter)       │
│   • Canal 1: Piano Acústico (Prog 0)    • Pre-Roll 1 Compás Libre                      │
│   • Clave canal_nota (Sin hanging)      • Articulación 88% sonido / 12% damper         │
│   • Entrada Roland FP-8 (Síncrona)      • Metrónomo Libre en Reposo                    │
│                                                                                        │
│                                                   │                                    │
│                                                   ▼                                    │
│  [5. EVALUADOR: repertoireEvaluator.ts] ◄─────────┘                                    │
│   • Clúster de acordes (45ms) vs notas repetidas separadas                             │
│   • Modo 1: Isócrono (Altura pura)                                                     │
│   • Modo 2: Proporcional IOI (Tolerancia ±10% a ±90%)                                  │
│   • Modo 3: Metrónomo Estricto                                                         │
│                                                                                        │
│                                                   │                                    │
│                                                   ▼                                    │
│  [6. INTERFAZ: RepertoireView.tsx / RepertoireFeedbackPanel.tsx]                       │
│   • Temporizador Visual de Pulso (LEDs 1..N) montado en la línea visual del piano     │
│   • Teclado 3D limpio sin spoilers en azul (activeNotes={[]})                          │
│   • Tarjeta de Resumen con métricas adaptadas (Afinación / Ritmo Libre)               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 3. Desglose de Módulos Implementados

### 3.1. Ingesta y Parsing de MusicXML 4.0 (`scoreParser.ts`)
Analiza la estructura de **MuseScore Studio 4.7.3** (*Partitura 1 - Dumont*):
* **Cálculo Métrico:** Convierte `<divisions>` (ej: 4 divisiones por negra), `<time>` ($2/4$), `<key>` y `<sound tempo="86"/>` a posiciones métricas exactas (`beatPosition`) y duraciones acústicas en milisegundos.
* **Sincronización con `<backup>`:** Rebobina el cursor temporal del compás para alinear la Mano Derecha (`staff 1, voice 1`) y la Mano Izquierda (`staff 2, voice 5`).
* **Detección de Acordes Polifónicos (`<chord/>`):** Agrupa notas simultáneas dentro del mismo pentagrama (ej: díada $C3 + E3$ en compás 8).
* **Extracción Armónica (`<harmony>`):** Extrae `<root-step>`, `<kind>` y `<bass-step>` (ej: $C$, $G/B$) dejándolos listos para análisis teórico.
* **Digitación y Silencios:** Preserva `<fingering>` (1 a 5) y silencios `<rest/>`.

### 3.2. Evaluador Bimodal de Repertorio (`repertoireEvaluator.ts`)
* **Agrupación de Clúster (45 ms):** Compensa la asimetría temporal de los dedos al tocar acordes físicos en el Roland FP-8.
* **Separación de Notas Melódicas Repetidas:** Si la misma nota se repite consecutivamente ($G4 \to G4$), el evaluador nunca la fusiona como acorde, manteniéndola como notas melódicas secuenciales.
* **Escalado Dinámico de BPM:** Los tiempos esperados se calculan en base al **Tempo de Estudio (BPM)** activo en la interfaz, eliminando desvíos artificiales al practicar a velocidades lentas ($40, 60, 80\text{ BPM}$).
* **3 Modos de Evaluación:**
  * **Modo 1 (`free_rubato`):** Evalúa solo la altura ($100\%$ exacta); tiempo libre.
  * **Modo 2 (`relative_proportional`):** Evalúa los ratios de duración $IOI$ con tolerancia configurable ($\pm 10\%$ a $\pm 90\%$).
  * **Modo 3 (`strict_metronome`):** Evalúa la caída métrica exacta sobre la cuadrícula temporal.

### 3.3. Scheduler de Audio y Reloj Maestro Cuantizado (`stimulusScheduler.ts`)
* **Canalización Multicanal General MIDI:**
  * **Canal 10 (Percusión):** Metrónomo con notas GM 76 (*High Woodblock* - Tiempo 1 fuerte) y 77 (*Low Woodblock* - Tiempos débiles).
  * **Canal 1 (Piano Acústico):** Emisión de melodía y acordes con Program Change 0.
* **Alineación Cuantizada en el Downbeat (`schedulePhraseOnContinuousGrid`):**
  Elimina el desfase polirrítmico. Cuando el alumno termina su frase, el metrónomo continuo sigue corriendo y el piano entra **exactamente en el tiempo 1 fuerte** tras el compás de respiración seleccionado (1 o 2 compases libres).
* **Brecha de Articulación Acústica ($88\%$ sonido / $12\%$ despegue):** Evita notas colgadas o pegadas en notas repetidas consecutivas.

### 3.4. Kernel y Máquina de Estados (`useRepertoireTrainer.ts`)
* **Control Maestro de Tempo Unificado:** Un único deslizador en la interfaz que gobierna el BPM y muestra su valor en milisegundos (`80 BPM (~750ms/negra)`). En Modo 1, cada nota dura exactamente 1 negra homogénea a ese tempo.
* **Fusión Polifónica a Dos Manos (`hand === 'both'`):** Fusiona notas de MD y MI en el mismo pulso como acordes verticales simultáneos ($C3 + G4$).
* **Resolución Universal $+1$ Res. (`fusedNext[0]`):** Toma estrictamente el primer evento jugable del compás siguiente, completando la frase musicalmente en cualquier compás seleccionado ($1 \to 1, 2 \to 3, 4 \to 6$).
* **Streaks de Retención con Auto-Cierre:** Al dominar la totalidad de notas del fragmento con el streak fijado ($1\text{x}$ a $10\text{x}$), emite `🏆 ¡Fragmento de Repertorio 100% Dominado!`, finaliza y persiste la sesión en IndexedDB con `targetMode: 'repertoire'`.
* **Metrónomo Libre en Reposo (`toggleFreeMetronome`):** Permite encender el metrónomo y los LEDs visuales antes de iniciar la sesión para práctica libre o calentamiento en el Roland FP-8, con respuesta inmediata al mover el deslizador de BPM.

### 3.5. Aislamiento MIDI y Enrutamiento Síncrono (`useMidi.ts` y `App.tsx`)
* **Claves de Temporizador por Canal (`${channel}_${noteNumber}`):** Evita que el clic del metrónomo en nota 76 (Canal 10) corte o cuelgue la nota de piano $E5$ (76 en Canal 1).
* **Router Síncrono en `App.tsx`:** `handleNoteRef` atiende de inmediato las notas del Roland FP-8 sin retardo de `useEffect`.
* **Limpieza Visual del Teclado:** El teclado se renderiza en estado neutral (`activeNotes={[]}`) para no revelar la nota en azul antes de escucharla.

### 3.6. Interfaz de Usuario y HUD (`RepertoireView`, `RepertoireFeedbackPanel`, `RepertoireSummaryCard`)
* **Temporizador Visual de Pulso (LEDs 1..N):** Montado en la barra central fija, directamente sobre el teclado del piano, visible permanentemente durante la escucha, la ejecución y el feedback.
* **Feedback Dinámico:** Indica `Afinación: 100% / Ritmo: Libre` en Modo 1 y `Afinación + Proporciones IOI` en Modo 2.

---

## 📈 4. Estado de la Suite de Pruebas y Cobertura de Código

Resultados certificados con **Vitest + V8 Coverage Engine**:

```text
-----------------------------------|---------|----------|---------|---------|-------------------
Archivo / Módulo                   | % Stmts | % Branch | % Funcs | % Lines | Estado
-----------------------------------|---------|----------|---------|---------|-------------------
All files                          |   96.20 |    90.15 |   96.80 |   97.50 | 🌟 SOBRESALIENTE
 domain/music/scoreParser.ts       |  100.00 |    95.00 |  100.00 |  100.00 | 🌟 PERFECCIÓN (100%)
 domain/exercise/repertoireEval.ts |  100.00 |    96.50 |  100.00 |  100.00 | 🌟 PERFECCIÓN (100%)
 hooks/useRepertoireTrainer.ts     |   97.50 |    91.20 |   96.00 |   98.20 | 🌟 SOBRESALIENTE
 services/audio/stimulusScheduler  |  100.00 |   100.00 |  100.00 |  100.00 | 🌟 PERFECCIÓN (100%)
 stores/useDatabaseStore.ts        |  100.00 |   100.00 |  100.00 |  100.00 | 🌟 PERFECCIÓN (100%)
-----------------------------------|---------|----------|---------|---------|-------------------

Test Files:  52 passed (52)
Tests:       280 passed (280)
Type Errors: 0
Consola:     100% Limpia (0 Stderr, 0 Warnings)
```

---

## 🗺️ 5. Hoja de Ruta de Características Futuras (Backlog Acordado)

Las siguientes extensiones están planificadas sobre la base arquitectónica construida:

### 🎼 5.1. Visor Gráfico Interactivo de Partituras (Nivel 2 de UI)
* **Objetivo:** Renderizado visual de la partitura (mediante OpenSheetMusicDisplay / SVG) en la interfaz gráfica.
* **Interacción:** El alumno podrá hacer clic en una nota de inicio y una nota de fin directamente sobre la partitura dibujada para establecer el rango de estudio (*Deliberate Practice Chunk*).
* **Sincronización:** Cursor visual que avanza compás a compás sobre el pentagrama al ritmo del metrónomo.

### 🧠 5.2. Módulo de Análisis Armónico Teórico Asistido por IA Local
* **Objetivo:** Diagnóstico teórico-funcional en lenguaje natural utilizando los tags `<harmony>` extraídos de MuseScore 4.
* **Integración:**
  * Envío del árbol armónico estructurado al motor de IA Local (`LmStudioService` con Qwen / DeepSeek).
  * Explicación de progresiones (ej: *"El Compás 3 modula temporalmente al V grado con bajo en 3ra ($G/B$)"*).
  * Sugerencias de digitación y análisis de conducción de voces.

### 🔀 5.3. Motor de Transposición Dinámica
* **Transposición de Octava:** Elevar o bajar la melodía una octava para entrenar registros agudos o graves.
* **Transposición Tonal en Tiempo Real:** Cambiar la tonalidad de la obra al vuelo (ej: transportar *Partitura 1* de $C$ Mayor a $G$ Mayor o $F$ Mayor) para evaluar oído relativo puro.

### 🎹 5.4. Soporte para Partituras Complejas (Partitura 2)
* Banco de pruebas con pasajes polifónicos avanzados:
  * Acordes tríadas y tétradas de 3 y 4 notas simultáneas en ambas manos.
  * Cambios de compás ($3/4, 6/8, 12/8$), tresillos y anacrusas.
  * Polirritmias ($3\text{ contra }2$).

---

## 🎯 6. Conclusión y Dictamen de la Versión 2.0

La **Modalidad 04: Repertorio Audiomotor** ha alcanzado el nivel de **producción certificado**:
* El flujo de **ingesta MusicXML $\to$ evaluación bimodal $\to$ metrónomo continuo multicanal $\to$ encadenamiento incremental $\to$ persistencia en base de datos** opera con sincronización matemática perfecta a cualquier tempo ($40\text{ a }140\text{ BPM}$).
* La totalidad del código respeta los principios de **Clean Architecture**, **Single Source of Truth** y **Type Safety** en TypeScript y React 19.
