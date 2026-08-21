# 🎹 MIDI Ear Trainer (Entrenador Auditivo Inteligente con IA Local)

Aplicación de escritorio desarrollada en **Electron, React, TypeScript y Tailwind CSS** para el entrenamiento y discriminación auditiva musical de alta precisión, asistida por **Inteligencia Artificial Local (LM Studio / Qwen 3.5 en GPU NVIDIA)** y comunicación de baja latencia con hardware MIDI físico (**Roland FP-8, Roland UM-ONE mk2 y Korg NS5R**).

---

## 🚀 Características Principales

### 1. Tres Modalidades de Entrenamiento Musical
- **🎵 Modalidad 1: Nota Individual:** Reconocimiento de altura absoluta con selección libre en teclado de 3 octavas ($C3-C6$), progresión diatónica/cromática, presets y *Modo Maestría* (entrena hasta dominar todas las notas con $\ge 85\%$ de acierto).
- **📏 Modalidad 2: Reconocimiento de Intervalos (2 Notas):** 13 clases de intervalos (desde $2\text{m}$ hasta $8\text{J}$) con direcciones (ascendente, descendente o mixta), canciones-ancla mnemotécnicas pedagógicas y evaluador que aísla el error de discriminación auditiva del error motor de transporte.
- **🎼 Modalidad 3: Memoria Melódica / Secuencias (3 a 6 Notas):** Retención y reproducción melódica evaluada en 3 capas (coincidencia nota a nota, contorno melódico $\nearrow\searrow$ y distancia de edición Levenshtein con puntaje porcentual).

### 2. Motor Adaptativo Inteligente (Strategy Pattern)
- **Adaptativo v1:** Ponderación probabilística por matriz de confusión de semitonos y tasa de error.
- **Repetición Espaciada (Leitner / SM-2):** Organización en 3 cajas de memoria con re-evaluación inmediata de fallos y espaciamiento largo de notas consolidadas.
- **Aleatorio Clásico:** Distribución uniforme para evaluación libre.

### 3. Psicometría Psicoacústica y Analítica Científica
- **Corrección por Azar (Teoría de Respuesta al Ítem):** Cálculo de precisión normalizada eliminando la suerte estadística según el tamaño del pool ($c = 1/\text{PoolSize}$).
- **Entropía Contextual (Teoría de Shannon):** Medición de la carga de incertidumbre en bits ($H = \log_2(\text{PoolSize})$).
- **Espectro de Latencia Cognitiva:** Segmentación de respuestas en *Reflejo Inmediato* ($< 1.2\text{s}$), *Deducción Activa* ($1.2\text{s}-2.8\text{s}$) e *Incertidumbre* ($> 2.8\text{s}$).
- **Sesgo de Semitono:** Histograma direccional de errores ($+st$ hacia lo agudo vs. $-st$ hacia lo grave).

### 4. Inteligencia Artificial Local (Zero Cloud / Privacidad Total)
- Conexión vía IPC nativo con **LM Studio** (`http://127.0.0.1:1234`) ejecutando modelos de razonamiento profundo (**Qwen 3.5 9B / Llama 3**) sobre GPU NVIDIA RTX.
- Diagnóstico clínico exhaustivo en lenguaje natural y **Prescripción de Ejercicios Ejecutables en 1 Clic** (la IA diseña y configura automáticamente el timbre, notas, criterios y modo de avance).
- **Circuit Breaker & Fallback:** Si el servidor local está apagado, el sistema conmuta instantáneamente a su motor heurístico local sin bloquear la práctica.

### 5. Hardware y UX de Estudio
- **Timbres General MIDI en Korg NS5R:** Envío de `Program Change` nativo para alternar entre *Piano Acústico*, *Flauta*, *Violín*, *Clarinete* y *Bajo*.
- **Teclado 3D Isomórfico:** Renderizado continuo de 3 octavas sin scroll horizontal con Heatmap en vivo.
- **Sincronización Audiovisual:** Selector de modo `[ 👂 Oído Puro / A Ciegas ]` vs. `[ 👁️ Asistido ]`.
- **Modos de Avance:** Avance Inteligente (pausa solo al fallar para analizar el error), Manual (barra espaciadora) o Automático.

---

## 🛠️ Tecnologías y Arquitectura

- **Runtime:** Electron (Chromium / Node.js)
- **Frontend:** React 19 + TypeScript + Vite
- **Estilos:** Tailwind CSS v4 (Dark Studio Theme)
- **Gestión de Estado:** Zustand (Segmentado: `useDatabaseStore`, `useAnalyticsStore`, `useAiStore`)
- **Persistencia:** IndexedDB Nativo con validación estricta de esquemas
- **Testing:** Vitest + Testing Library + v8 Coverage (> 86% cobertura de líneas, 138+ tests)
