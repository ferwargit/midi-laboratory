# Proposal

## Why

La auditoría de rendimiento V8 identificó dos cuellos de botella en la frecuencia de renderizado del hot-path MIDI (`AUDIT_REPORT_V8.md`, hallazgos F12.1 y F12.2): cada evento Note On/Off invoca `addLog` en `useMidi`, cuyo estado `logs` vive en el componente raíz `App`, de modo que cada pulsación de tecla re-renderiza y reconcilia el árbol completo (TopBar, alertas, vista activa, dock y modal) — con ráfagas de acordes (p. ej. 10 notas/s) son 10 reconciliaciones completas/s. Además, `StudioBottomDock` está envuelto en `React.memo` pero esta queda 100% neutralizada porque recibe `logs` (array fresco en cada nota) y `onOpenResetModal` como arrow function inline (`App.tsx:592`), por lo que la memoización nunca cortocircuita.

## What Changes

- **Store de telemetría dedicado:** nuevo store ligero (zustand, siguiendo el patrón establecido en `src/renderer/src/stores/`) que pasa a ser la única fuente de verdad del buffer de logs de telemetría MIDI, preservando intacto el contrato funcional: entradas tipadas `IN | OUT | AI | EVAL`, sello temporal `HH:MM:SS.mmm`, identificador único por evento y ventana deslizante de 35 entradas.
- **Desacople del stream de `App`:** `useMidi.addLog` delega en el store y el hook deja de mantener `logs` como estado de React. **BREAKING (API interna del hook):** `UseMidiReturn` elimina `logs`; los consumidores se suscriben directamente al store. Los call sites existentes (`midi.addLog(...)` en `App.tsx` y trainers) no cambian.
- **Suscripción directa de los consumidores:** `StudioBottomDock` deja de recibir `logs` como prop; el badge de conteo `Telemetría (N)` de su barra permanente se extrae a un componente aislado y memoizado que se suscribe al store; `MidiMonitor` se suscribe directamente al buffer (sin prop), de modo que solo el monitor re-renderiza cuando el drawer está abierto.
- **Restauración de la memoización del dock (F12.2):** `App.tsx` envuelve la apertura del modal de reset en un `useCallback` estable (`handleOpenResetModal`), de modo que `StudioBottomDock` recibe props de identidad estable y su `React.memo` vuelve a cortocircuitar.
- **Cobertura de regresión de render:** tests que demuestren (a) que `addLog` NO provoca re-render del consumidor del hook `useMidi`, (b) que `StudioBottomDock` preserva su memoización ante eventos de log y pulsaciones de tecla, y (c) que el badge de conteo y `MidiMonitor` se actualizan por suscripción propia.
- **Supuesto registrado:** el contrato actual de telemetría NO incluye limpieza de logs en pánico/reinicio (el buffer es una ventana deslizante de 35 entradas; ni el pánico ni el reset de DB borran el historial). Esta refactorización es preservadora del comportamiento: no añade ni elimina semántica de limpieza.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `01-midi-audio-hardware`: el requisito de **Registro de Actividad del Bus MIDI (Logs)** se modifica para ubicar el buffer en un store de telemetría dedicado (fuente única de verdad fuera del ciclo de render de `App`), con suscripción directa de los consumidores y contrato funcional intacto; se añade un requisito de **Aislamiento de Render del Stream de Telemetría** que garantiza que los eventos de log no re-renderizan el componente raíz `App`, que `StudioBottomDock` preserva su memoización ante eventos de log y que el badge de conteo y el monitor se actualizan por suscripción propia.

## Impact

- **Código afectado:**
  - `src/renderer/src/hooks/useMidi.ts` — eliminación del estado `logs`, delegación de `addLog` al store, cambio de `UseMidiReturn` (BREAKING interno: sin `logs`).
  - `src/renderer/src/stores/useTelemetryStore.ts` — **nuevo** store de telemetría (zustand).
  - `src/renderer/src/components/trainer/StudioBottomDock.tsx` — sin prop `logs`; extracción del badge de conteo aislado.
  - `src/renderer/src/components/trainer/MidiMonitor.tsx` — suscripción directa al store (sin prop `logs`).
  - `src/renderer/src/App.tsx` — `handleOpenResetModal` estable vía `useCallback`; sin prop `logs` al dock.
- **Tests afectados:**
  - `src/renderer/src/hooks/useMidi.test.ts` — el test de `addLog` (ventana de 35) pasa a leer del store; nuevo test de no-re-render por log.
  - `src/renderer/src/components/trainer/s3-render-performance.test.tsx` o nuevo test del dock — memoización del dock ante eventos de log.
- **Sin impacto en:** dependencias (zustand ya presente), secuencia canónica del pánico, watchdog, scheduler, persistencia. Sin cambios breaking externos (la API afectada es interna del renderer).
