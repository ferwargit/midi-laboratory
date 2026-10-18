# Proposal

## Why

La auditoría V8 (hallazgo **F12.3**, recomendación **R1** P0) demostró que la cascada de memoización del renderer está neutralizada a nivel sistémico: `useMidi` y `useTrainerCore` retornan un objeto literal nuevo en cada render, por lo que todo `useCallback`/`useMemo` consumidor (p. ej. `triggerNextQuestion`, `startSession`, `stopSession`, `handleUserNotePlayed` en `useSingleNoteTrainer`, y `playTonalContextMidi`/`handleVirtualKeyPress` en `App.tsx`) se recrea en cada ciclo de render. El `useMemo` final de cada entrenador nunca cortocircuita y el objeto `trainer`/`midi` que llega a las vistas siempre tiene identidad fresca, dejando la memoización existente (PianoKeyboard, DatabaseCard, StudioBottomDock) aislada e inefectiva para el resto del árbol.

## What Changes

- Memoizar el objeto de retorno de `useMidi` (`UseMidiReturn`) con `useMemo`, preservando la identidad referencial cuando sus dependencias reactivas reales no cambian (`status`, `inputs`, `outputs`, `selectedInputId`, `selectedOutputId`, `isDeviceDisconnected`, `pressedNotes`, `activeStimulusNotes` y los métodos estables).
- Garantizar que todos los métodos exportados por `useMidi` (`sendNote`, `sendAllNotesOff`, `changeProgram`, `clearAllPressedNotes`, `addLog`, setters) mantengan identidad estable vía `useCallback` (los ya estables se conservan; los que falten se estabilizan).
- Memoizar el objeto de retorno de `useTrainerCore` (`UseTrainerCoreReturn<TResult>`) con `useMemo`, separando los métodos de acción estables del estado reactivo de pregunta/sesión, sin alterar la semántica de los getters en vivo (`isSessionActive`, `sessionId`, `answersBuffer`, `questionToken`).
- Añadir pruebas de estabilidad referencial: dos re-renders sin cambios de estado deben devolver la misma referencia del objeto retornado (`result.current` idéntico) y de sus métodos clave; un cambio de estado reactivo debe invalidar la identidad solo cuando corresponde.
- No se modifica ningún comportamiento funcional observable: envío MIDI, pánico, watchdog, máquina de estados del kernel, tokens anti-carrera y persistencia quedan intactos.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `01-midi-audio-hardware`: nuevo requisito de **estabilidad referencial del retorno de `useMidi`** — el objeto `UseMidiReturn` y sus métodos deben preservar identidad entre re-renders sin cambios de estado reactivo, de modo que los consumidores (`App`, callbacks dependientes de `midi`) no se invaliden en cada ciclo de render.
- `02-trainer-core-engine`: nuevo requisito de **estabilidad referencial del retorno de `useTrainerCore`** — el objeto `UseTrainerCoreReturn` debe preservar identidad entre re-renders sin cambios de estado reactivo, habilitando que los `useCallback`/`useMemo` de los plug-ins de entrenador (`useSingleNoteTrainer` y equivalentes) cortocircuiten correctamente.

## Impact

- **Código afectado:**
  - `src/renderer/src/hooks/useMidi.ts` (retorno memoizado; verificación de `useCallback` en todos los métodos expuestos).
  - `src/renderer/src/hooks/useTrainerCore.ts` (retorno memoizado; los getters en vivo sobre refs se preservan tal cual).
  - Opcionalmente `src/renderer/src/hooks/useSingleNoteTrainer.ts` y los demás plug-ins de entrenador: sin cambios de lógica, pero sus deps de `useCallback`/`useMemo` pasan a cortocircuitar de forma efectiva.
- **Pruebas afectadas:** `src/renderer/src/hooks/useMidi.test.ts` y `src/renderer/src/hooks/useTrainerCore.test.ts` (nuevos bloques de estabilidad referencial con `renderHook` + re-render).
- **Riesgos:** una deps de `useMemo` incompleta congelaría valores reactivos obsoletos (stale reads). Mitigación: enumerar explícitamente todas las dependencias reactivas del retorno y cubrir con pruebas que un cambio de cada valor reactivo produce identidad nueva y valor fresco.
- **Sin cambios** en: contratos MIDI (mensajes, canales, pánico), máquina de estados del kernel, persistencia, ni en la API pública de los hooks (mismas propiedades y firmas).
