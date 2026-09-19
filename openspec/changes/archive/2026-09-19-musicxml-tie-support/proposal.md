## Why

La Auditoría V6 clasificó el hallazgo **H-05 (OLA 2.1)** en el parser nativo de MusicXML: el bucle de notas de `parseMusicXml` (src/renderer/src/domain/music/scoreParser.ts:194-255) reconoce `pitch`, `duration`, `chord`, `rest` y `fingering`, pero **ignora los tags `<tie>` y `<tied>`**. Como consecuencia, una nota ligada que se prolonga entre dos compases o dos pulsos se emite como dos `ScorePlaybackEvent` independientes: el sintetizador re-articula la segunda mitad (golpe acústico no escrito) y el evaluador de la Modalidad 04 exige al alumno **pulsar la tecla dos veces**, marcando como fallido a quien sostiene la ligadura correctamente. Es un defecto de fidelidad de partitura y, a la vez, una falsa penalización pedagógica.

## What Changes

- **Reconocimiento de ligaduras en el parser:** dentro de cada `<note>`, el parser DEBE leer `<tie type="start|stop"/>` (hijo directo de `<note>`, forma canónica de MuseScore Studio 4) y, como compatibilidad, `<tied type="start|stop"/>` bajo `<notations>`.
- **Consolidación de duración:** si una nota es continuación de ligadura (`type="stop"`) y coincide en **pitch (número MIDI, `alter` y `octava`), `staff` y `voice`** con el evento preexistente que abrió la ligadura, su duración (`durationDivisions`, `durationBeats`, `durationMs`) DEBE acumularse sobre ese evento, **avanzando el cursor temporal pero sin crear un nuevo `ScorePlaybackEvent`**.
- **Trazabilidad visual:** `ScorePlaybackEvent` gana una bandera opcional `isTied?: boolean` (valor ausente = `false`), que marca el evento resultante de la fusión. Es solo informativa; no altera la evaluación.
- **No consolidación segura:** si la nota de continuación **no** coincide en pitch/staff/voice con el evento abierto, o si no hay evento abierto memorable (p. ej. la partitura empieza con un `stop` huérfano), la nota DEBE emitirse como evento independiente —sin alterar `durationMs` ni descartar información— y el parser DEBE seguir procesando el resto del compás.
- **Pruebas (TDD, primeras en escribirse):** `src/renderer/src/domain/music/scoreParser.test.ts` gana un fixture MusicXML con dos notas ligadas entre compases contiguos (blanca + negra = 3 tiempos) y aserciones sobre la duración combinada, el conteo de eventos y la invariancia del cursor temporal.
- **Spec canónica:** se actualiza por delta el requisito "Parser Nativo de MusicXML 4.0 (Modalidad 04)" de `03-practice-modalities`.

**Compatibilidad:** no es un breaking change de API. `ScorePlaybackEvent.isTied` es opcional, de modo que los fixtures existentes de `useRepertoireTrainer.test.ts` y `repertoireEvaluator.test.ts` (que construyen eventos a mano sin la bandera) siguen tipando y comportándose igual. `parseMusicXml` conserva su firma y su salida para partituras sin ligaduras. Consumidores de `durationBeats` (`repertoireEvaluator.ts` modos rítmicos y `fuseConcurrentEvents`) consumen la duración combinada sin cambio alguno: es justamente el valor que ya esperaban.

## Capabilities

### New Capabilities

<!-- Ninguna: se refina el comportamiento de un requisito de una capacidad existente. -->

### Modified Capabilities

- `03-practice-modalities`: el requisito "Parser Nativo de MusicXML 4.0 (Modalidad 04)" pasa de ignorar `<tie>`/`<tied>` a exigir el reconocimiento de ligaduras de prolongación y la consolidación de duraciones acústicas en un único evento. Es la única capacidad con archivo delta formal (`specs/03-practice-modalities/spec.md`).

## Impact

- **Parser:** `src/renderer/src/domain/music/scoreParser.ts` (rama `note` del bucle de compás: lectura de tags de ligadura, acumulación de duración sobre `lastEventInVoice` y avance condicional del cursor). Única unidad de código que cambia lógica.
- **Tipos:** `src/renderer/src/domain/music/scoreTypes.ts` añade `isTied?: boolean` a `ScorePlaybackEvent`.
- **Pruebas:** `src/renderer/src/domain/music/scoreParser.test.ts` (fixture nuevo de ligadura entre compases + casos de no-consolidación por pitch/staff/voice y de `stop` huérfano).
- **Especificaciones:** delta `openspec/changes/musicxml-tie-support/specs/03-practice-modalities/spec.md`; tras validación, sincronizar a `openspec/specs/03-practice-modalities/spec.md`.
- **Consumidores (sin edición):** `hooks/useRepertoireTrainer.ts` (`fuseConcurrentEvents` y `getSliceForMeasures`), `domain/exercise/repertoireEvaluator.ts` (modos rítmicos que leen `durationBeats`) y `services/audio/stimulusScheduler.ts` — todos consumen eventos ya consolidados.
- **No afecta:** infraestructura MIDI/audio, kernel de sesión, persistencia IndexedDB, presets de Modalidades 01-03.
- **Verificación:** `npm run typecheck`, `npm run lint`, `npm run test` (vitest) y `openspec validate musicxml-tie-support --strict`.
