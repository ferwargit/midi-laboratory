# 🎼 ESPECIFICACIÓN TÉCNICA Y ARQUITECTURA: APRENDIZAJE AUDIOMOTOR DE REPERTORIO
### Modalidad 04: *Audiomotor Repertoire Chaining Engine*

**Fecha:** 25 de Agosto, 2026
**Proyecto:** MIDI Laboratory (`midi-ear-trainer`)
**Compatibilidad de Entrada:** MuseScore Studio 4.x (MusicXML 4.0 / `.xml`) y Standard MIDI Files (`.mid`)
**Hardware Objetivo:** Roland FP-8 (Entrada MIDI física) + Korg NS5R (Síntesis General MIDI)
**Estado:** 📐 Especificación y Diseño de Arquitectura

---

## 🧠 1. Fundamentación Psicoacústica y Neurocientífica

```text
    [ ESTIMULACIÓN ACÚSTICA ]                  [ PROCESAMIENTO CENTRAL ]                   [ RESPUESTA MOTORA ]
  ┌───────────────────────────┐               ┌───────────────────────────┐               ┌────────────────────┐
  │ Korg NS5R / Roland FP-8   │ ────────────► │ 1. Audiación (Gordon)     │ ────────────► │ Corteza Premotora  │
  │ • MusicXML MuseScore 4    │               │ 2. Memoria Fonológica     │               │ • Mapa de Teclas   │
  │ • Alberti / Melodía       │               │ 3. Percepción IOI (Repp)  │               └─────────┬──────────┘
  └───────────────────────────┘               └───────────────────────────┘                         │
                ▲                                           ▲                                       ▼
                │                                           │ (Bucle Feedforward/Feedback) ┌─────────────────┐
                └───────────────────────────────────────────┴───────────────────────────── │ Roland FP-8     │
                                                                                           │ • Entrada MIDI  │
                                                                                           └─────────────────┘
```

1. **El Bucle Auditivo-Motor (*Auditory Feedforward Model* - Zatorre, Chen & Penhune, 2007)** [1.1.4]:
   Aprender de oído obliga a la corteza auditiva a construir una predicción motora directa hacia las teclas del piano [1.1.4, 1.1.7]. Al no haber pantalla gráfica tipo *Synthesia* que guíe los ojos, el cerebro utiliza la disonancia percibida en el Roland FP-8 para ajustar el movimiento [1.1.4, 1.1.5].
2. **Audiación Interna (*Edwin Gordon's Music Learning Theory*)** [1.1.8]:
   Capacidad de escuchar mentalmente la frase musical antes de pulsar la tecla [1.1.8]. El ejercicio entrena al oído para que sea el director de orquesta de los dedos y no un mero espectador pasivo.
3. **Percepción Rítmica Proporcional (*Inter-Onset Intervals - IOI*, Repp, 2005; Jacoby & McDermott, 2024)** [1.3.2, 1.3.9]:
   El cerebro humano cuantifica el ritmo mediante relaciones de proporción ($1:1$, $2:1$, $4:1$) [1.3.2]. El motor evalúa la coherencia proporcional del motivo antes de exigir rigidez métrica absoluta [1.3.2].
4. **Encadenamiento Progresivo y Límites de la Memoria de Trabajo (*Chunking* - Cowan, 2001; Ericsson, 1993)** [1.1.3, 1.2.3]:
   La memoria de trabajo auditiva tiene un límite de retención de $4 \pm 1$ elementos acústicos nuevos. El encadenamiento progresivo (*Forward/Backward Chaining*) expande la longitud de la frase únicamente cuando las notas anteriores ya fueron consolidadas en la memoria procedural a largo plazo [1.2.1, 1.2.3].

---

## 🔬 2. Análisis del Formato Real de MuseScore Studio 4.7.3

Del análisis de la **Partitura 1**, se extrajeron las siguientes reglas canónicas que el parser (`scoreParser.ts`) procesa:

### A. Estructura Métrico-Temporal y `<divisions>`
* `<divisions>4</divisions>` en compás `<time><beats>2</beats><beat-type>4</beat-type></time>`.
* **Fórmula de Conversión:**
  $$\text{Negra (Quarter)} = 4 \text{ divisiones}$$
  $$\text{Corchea (Eighth)} = 2 \text{ divisiones}$$
  $$\text{Semicorchea (16th)} = 1 \text{ división}$$
  $$\text{Duración en ms} = \left( \frac{\text{duration}}{\text{divisions}} \right) \times \left( \frac{60000}{\text{BPM}} \right)$$
* En la Partitura 1: Tempo nominal = `86 BPM` (`<sound tempo="86"/>`), por lo tanto:
  * 1 Negra = $\frac{4}{4} \times \frac{60000}{86} \approx 697.67\text{ ms}$
  * 1 Corchea = $\frac{2}{4} \times 697.67 \approx 348.83\text{ ms}$
  * 1 Semicorchea = $\frac{1}{4} \times 697.67 \approx 174.41\text{ ms}$

### B. Gestión de Voces, Pentagramas y Rebobinado `<backup>`
* **Pentagrama 1 (Mano Derecha):** Usa `<staff>1</staff>` y `<voice>1</voice>`.
* **Pentagrama 2 (Mano Izquierda):** Usa `<staff>2</staff>` y `<voice>5</voice>`.
* **El tag `<backup>`:** MuseScore escribe primero toda la mano derecha del compás y luego emite `<backup><duration>8</duration></backup>`, retrocediendo el cursor temporal 8 divisiones (2 tiempos completos) para escribir el bajo de Alberti en la mano izquierda (`voice 5`).
* **Regla del Parser:** El parser mantendrá un cursor temporal por compás (`currentBeatOffset`) que avanza con cada `<note>` y retrocede exactamente lo indicado por `<backup>`.

### C. Detección de Acordes Polifónicos (`<chord/>`)
* En el Compás 8, la mano izquierda toca el acorde simultáneo $C3 + E3$:
  ```xml
  <note>
    <pitch><step>C</step><octave>3</octave></pitch>
    <duration>2</duration><voice>5</voice><staff>2</staff>
  </note>
  <note>
    <chord/>
    <pitch><step>E</step><octave>3</octave></pitch>
    <duration>2</duration><voice>5</voice><staff>2</staff>
  </note>
  ```
* **Regla del Parser:** Si una `<note>` contiene la etiqueta `<chord/>`, no avanza el cursor temporal, sino que agrupa su nota MIDI dentro del array `notes: [48, 52]` del evento anterior.

### D. Extracción de Cifrado Armónico (`<harmony>`)
* MuseScore 4 exporta etiquetas de armonía estándar:
  * Compás 1: `<harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>` $\to$ **C Mayor**.
  * Compás 3: `<harmony><root><root-step>G</root-step></root><kind>major</kind><bass><bass-step>B</bass-step></bass></harmony>` $\to$ **G/B** (Primera inversión).
* **Regla del Parser:** Los tags `<harmony>` se extraen como metadatos armónicos asociados al compás y tiempo exacto para alimentar el futuro módulo de análisis teórico.

### E. Metadatos de Digitación (`<fingering>`)
* MuseScore incluye sugerencias de digitación: `<technical><fingering>1</fingering></technical>`.
* **Regla del Parser:** Se preserva el número de dedo sugerido (1 a 5) como pista opcional en pantalla.

---

## 🏛️ 3. Modelo de Datos Canónico del Parser (TypeScript AST)

```typescript
// src/renderer/src/domain/music/scoreTypes.ts

export type HandSelection = 'RH' | 'LH' | 'both'

export interface HarmonicContextTag {
  chordSymbol: string        // "C", "G/B", "Am7", etc.
  rootStep: string           // "C", "G"
  kind: string               // "major", "minor", "dominant"
  bassStep?: string          // "B" (en caso de inversiones)
  measureNumber: number
  beatPosition: number
}

export interface ScoreNoteEvent {
  pitch: number              // Nota MIDI: 60 = C4, 48 = C3, etc.
  step: string               // "C", "D", "E", "F", "G", "A", "B"
  alter: number              // -1 (bemol), 0 (natural), 1 (sostenido)
  octave: number             // 3, 4, 5, 6
  fingering?: number         // 1 (pulgar) a 5 (meñique)
}

export interface ScorePlaybackEvent {
  id: string                 // UUID único (crypto.randomUUID())
  measureNumber: number      // Compás (1-indexado)
  beatPosition: number       // Posición métrica dentro del compás (1.0, 1.5, 2.0, etc.)
  notes: ScoreNoteEvent[]    // Array de notas (1 nota = melodía, 2+ notas = acorde)
  midiNotes: number[]        // Array plano de números MIDI (ej: [48, 52] o [67])
  durationDivisions: number  // Duración en divisiones del XML
  durationBeats: number      // Duración en tiempos métricos (1.0 = negra, 0.5 = corchea)
  durationMs: number         // Duración acústica calculada en ms
  isRest: boolean            // True si es un silencio
  hand: HandSelection        // Mano asignada (RH = staff 1, LH = staff 2)
  staff: 1 | 2               // 1: Clave de Sol (MD), 2: Clave de Fa (MI)
  voice: number              // 1, 5, etc.
  harmonicTag?: HarmonicContextTag // Etiqueta armónica si coincide con este pulso
}

export interface ScoreDataModel {
  title: string              // Título de la obra
  subtitle?: string          // Subtítulo
  composer?: string          // Compositor / arreglador
  timeSignature: {
    beats: number            // 2 (en 2/4)
    beatType: number         // 4 (en 2/4)
  }
  keySignature: {
    fifths: number           // 0 = C Mayor, 1 = G Mayor, -1 = F Mayor
    mode: 'major' | 'minor'
  }
  baseBpm: number            // Tempo nominal (ej: 86)
  divisionsPerQuarter: number// Divisiones por negra (ej: 4)
  totalMeasures: number      // Total de compases
  events: ScorePlaybackEvent[]// Línea de tiempo completa de eventos
  harmonicProgression: HarmonicContextTag[] // Lista ordenada de acordes
}
```

---

## 🎛️ 4. Parámetros de Control y Opciones Configurables

El entrenador de repertorio proporciona control total sobre todas las variables del ejercicio:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ CONFIGURACIÓN DEL ENTRENADOR DE REPERTORIO (MODALIDAD 04)                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 📁 Archivo: [ "Partitura_1.musicxml" (MuseScore Studio 4.7.3) / .mid ]                │
│ 🖐️ Mano a Entrenar:  [ ● Mano Derecha (MD)  ○ Mano Izquierda (MI)  ○ Ambas ]           │
│                                                                                        │
│ 🎯 RANGO PERSONALIZADO (Deliberate Practice Loop):                                     │
│    Desde: Compás [  1  ] Evento [ 1 ]  ➔  Hasta: Compás [  4  ] Evento [ 4 ]           │
│                                                                                        │
│ 🔁 ALGORITMO DE ENCADENAMIENTO:                                                        │
│    Dirección:       [ ➡️ Hacia Adelante (Forward) | ⬅️ Hacia Atrás (Backward) ]          │
│    Granularidad:    [ ● 1 Evento (Nota/Acorde) | ○ 2 Eventos | ○ 1 Compás ]            │
│    Streak Requerido: [ 3x ] aciertos consecutivos para desbloquear el siguiente paso   │
│                                                                                        │
│ ⏱️ RITMO Y EVALUACIÓN TEMPORAL:                                                        │
│    Modo Rítmico:    [ ○ 1: Rubato Libre  ○ 2: Proporcional (IOI)  ● 3: Metrónomo ]     │
│    Tolerancia:      [ ± 20% ]  (Slider ajustable: 5% a 50%)                            │
│    Tempo de Estudio: Inicio: [ 50% (43 BPM) ] ➔ Tope: [ 100% (86 BPM) ]               │
│    Rampa Automática: [✔] Aumentar +5% BPM tras completar el rango exitosamente        │
│                                                                                        │
│ 👂 MODOS DE RETROALIMENTACIÓN:                                                         │
│    Pistas Visuales: [ ● Oído Puro (Sin luces)  ○ Guiado (Teclado iluminado) ]         │
│    Pre-Roll:        [ 1 Compás de Cuenta Previa + Acorde Tónica de la Tonalidad ]      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ 5. Algoritmo Operativo de Evaluación Bimodal

```text
                          [ EVENTO MUSICAL ESPERADO ]
                         (ej: C3 + E3 en Alberti bass)
                                      │
                                      ▼
                        [ ENTRADA MIDI ROLAND FP-8 ]
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        1. VALIDACIÓN DE ALTURA                2. VALIDACIÓN RÍTMICA
           (Pitch & Cluster)                      (IOI / Grid ms)
                   │                                     │
    • Cluster Window: 45ms para acordes    • Modo 1: Libre (100% tolerante)
    • Notas exactas: 100% acierto          • Modo 2: IOI Ratio (Proporciones)
    • Tolerancia de octava configurable    • Modo 3: Grid de Metrónomo con ventana ±%
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      │
                                      ▼
                             [ RESULTADO COMBINADO ]
                   • ¿Acierto Completo? ➔ Streak +1 (Meta: 3x)
                   • ¿Fallo? ➔ Streak = 0 (Opción de escuchar con 'R')
                   • Si Streak == Meta ➔ Expande siguiente nota/acorde
```

---

## 🏛️ 6. Preparación para el Futuro Módulo de Análisis Armónico

Gracias al modelo de datos unificado, el análisis armónico queda preparado para una integración transparente:

1. **Fuente Única de Verdad (SSOT):**
   El array `harmonicProgression: HarmonicContextTag[]` contiene la secuencia exacta de acordes extraída de los tags `<harmony>` de MuseScore.
2. **Contexto Clínico para LLM Local (Qwen / DeepSeek):**
   Cuando se active la pestaña de *Análisis Teórico*, el sistema podrá construir un prompt estructurado pasando la estructura JSON sin necesidad de volver a leer el archivo XML:
   ```json
   {
     "obra": "Canto de los cazadores tiroleses",
     "tonalidad": "C Major",
     "compas": "2/4",
     "progresion": [
       { "compas": 1, "acorde": "C", "grado": "I", "funcion": "Tonica" },
       { "compas": 3, "acorde": "G/B", "grado": "V6", "funcion": "Dominante con bajo en 3ra" },
       { "compas": 4, "acorde": "C", "grado": "I", "funcion": "Tonica" }
     ]
   }
   ```

---

## 🚀 7. Fases de Implementación en Código

| Fase | Archivos Clave | Descripción |
| :--- | :--- | :--- |
| **Fase 1: Parsing MusicXML** | `scoreTypes.ts`<br>`scoreParser.ts`<br>`scoreParser.test.ts` | Parser puro DOM/XML con cobertura de tests usando *Partitura 1* como fixture real. |
| **Fase 2: Evaluador Bimodal** | `repertoireEvaluator.ts`<br>`repertoireEvaluator.test.ts` | Motor de validación de acordes (cluster 45ms) y ratios rítmicos IOI con tolerancia $\pm\%$. |
| **Fase 3: Kernel de Repertorio** | `useRepertoireTrainer.ts`<br>`useRepertoireTrainer.test.ts` | Hook con soporte de *Forward/Backward Chaining*, rampa de BPM, loops de compases y *Streaks*. |
| **Fase 4: Interfaz de Estudio** | `RepertoireView.tsx`<br>`RepertoireSummaryCard.tsx` | UI completa integrada en la barra principal (`MODO 04 \| Repertorio`) con selector de archivos. |

---
