# Proposal

## Why

La auditoría V8 identificó (recomendación **R3**, P1) dos fuentes de re-renders invisibles y sostenidos en segundo plano:

- **F12.4**: `useMidi.ts` ejecuta `setActiveStimulusNotes` en cada nota melódica programada (`sendNote`, Canal 1). En modo `blind` (el default pedagógico, `App.tsx:40`), la prop se filtra después en `App.tsx:529` (`visualCueMode === 'assisted' ? midi.activeStimulusNotes : EMPTY_STIMULUS_NOTES`), pero el `setState` en la raíz ya ocurrió: cada nota del repertorio/metrónomo provoca un re-render de `App` cuyo único efecto visible es ninguno.
- **F12.5**: `useRepertoireTrainer.ts:250-260` registra `stimulusScheduler.onBeatTick` incondicionalmente (efecto con deps `[]`), ejecutando `setActiveBeatIndex` más un temporizador de apagado de LED en cada pulso. A 86-120 BPM son 2-4 re-renders por segundo sostenidos durante toda la sesión de repertorio, aunque `visualBeatEnabled` esté en `false`.

## What Changes

- **Gating de notas de estímulo (F12.4)**: `useMidi` acepta una opción `visualCuesEnabled` (default `true`, preserva el comportamiento vigente) que `App` alimenta con `visualCueMode === 'assisted'`. `sendNote` omite el alta en `activeStimulusNotes` cuando las pistas están desactivadas; la liberación programada usa una actualización funcional con cortocircuito (retorna `prev` si la nota no está) para no provocar re-renders espurios.
- **Gating del pulso de metrónomo (F12.5)**: el registro de `stimulusScheduler.onBeatTick` en `useRepertoireTrainer` pasa a depender de `visualBeatEnabled`: con el indicador desactivado el callback se desregistra (y `activeBeatIndex` se limpia); con el indicador activado el LED funciona con la precisión actual. La sincronización auditiva (metrónomo, frases, tempo) queda intacta.
- **Sin cambios** en el contrato de audio: los mensajes MIDI, canales GM, temporizadores por clave compuesta y el reloj maestro del scheduler no se alteran; solo se omite la actualización de estado visual cuando no hay consumidor.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `01-midi-audio-hardware`: nuevo requisito de **gating en origen de la pista visual de estímulo** — cuando las pistas visuales están desactivadas, la articulación de notas melódicas MUST NOT actualizar `activeStimulusNotes` (cero `setState` espurio en la raíz); al reactivarlas, el registro visual se restaura sin residuos.
- `03-practice-modalities`: nuevo requisito de **gating del indicador visual de pulso (Modalidad 04)** — con el indicador de beat desactivado, el callback visual del scheduler MUST estar desregistrado y `activeBeatIndex` MUST permanecer estable; con el indicador activado, el LED sigue el pulso con la precisión vigente.

## Impact

- **Código afectado:**
  - `src/renderer/src/hooks/useMidi.ts` (nueva opción `visualCuesEnabled`, ref sincronizada, gate en `sendNote`, liberación con cortocircuito).
  - `src/renderer/src/App.tsx` (pasa `visualCuesEnabled: visualCueMode === 'assisted'` a `useMidi`).
  - `src/renderer/src/hooks/useRepertoireTrainer.ts` (efecto de `onBeatTick` dependiente de `visualBeatEnabled`, limpieza al desactivar).
- **Pruebas afectadas:** `useMidi.test.ts` (blind no muta `activeStimulusNotes`; assisted sí; liberación sin re-render espurio) y `useRepertoireTrainer.test.ts` (callback desregistrado con LED apagado; registrado y preciso con LED encendido).
- **Riesgos:** nota emitida con pistas activadas y desactivadas a mitad de vuelo → la liberación programada la retira igualmente (el gate solo omite el alta); flag desincronizado entre `App` y el hook → mitigado con ref sincronizada en cada render (patrón existente de callbacks).
- **Sin cambios** en: `StimulusScheduler`, contratos MIDI, máquina de estados de los entrenadores, persistencia.
