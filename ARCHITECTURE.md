# 🎹 Arquitectura del Sistema: Entrenador Auditivo MIDI

## 1. Cadena de Hardware Físico

```text
[ Roland FP-8 ] (Piano 88 teclas)
   │
   ├── MIDI OUT ──► [ Roland UM-ONE mk2 (IN) ] ──► [ PC Windows 11 ] (App)
   │
   └── MIDI IN  ◄── [ Roland UM-ONE mk2 (OUT) ] ◄── [ PC Windows 11 ] (App)
         │
    (MIDI THRU)
         │
         ▼
   [ Korg NS5R ] (Módulo de Sonido General MIDI)
         │ (Audio Line Out)
         ▼
   [ Yamaha MS20S ] (Monitores Amplificados) ──► 👂 Alumno
```

## 2. Capas de Software (Clean Architecture)

1. **`domain/` (Dominio Puro - 100% Testeado con Vitest)**
   - `music/`: Definiciones de notas, semitonos, intervalos (2m a 8J) y catálogo de timbres General MIDI.
   - `exercise/`: Evaluadores puros de notas aisladas e intervalos (detección de transporte motor vs. error auditivo).
   - `adaptation/`: Motor adaptativo con *Strategy Pattern* (Ponderación de errores, matriz de confusión y telemetría explicable).
   - `database/`: Motor de persistencia nativo con IndexedDB.

2. **`stores/` (Gestión de Estado Global con Zustand)**
   - `useDatabaseStore`: Fuente única de verdad para el historial de sesiones y reseteo atómico de datos.

3. **`services/` (Infraestructura y MIDI)**
   - `midiParser`: Decodificación binaria de paquetes `NoteOn` y `NoteOff`.

4. **`hooks/` (Capa de Aplicación y Máquinas de Estado)**
   - `useMidi`: Ciclo de vida de Web MIDI API, Software Thru y teclas presionadas en vivo.
   - `useSingleNoteTrainer`: Bucle de entrenamiento para 1 nota (Modo estándar y Modo Maestría).
   - `useIntervalTrainer`: Bucle de entrenamiento para intervalos de 2 notas.

5. **`components/` (Design System & Vistas)**
   - `ui/`: Componentes atómicos (Button, Card, Badge, StatCard, ConfirmModal).
   - `trainer/`: Teclado de piano 3D sin scroll con Heatmap en vivo, paneles de feedback y monitor de telemetría.
   - `views/`: Vistas modulares (`SingleNoteView`, `IntervalsView`, `DatabaseCard`).

