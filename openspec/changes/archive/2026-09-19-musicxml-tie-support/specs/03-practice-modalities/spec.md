## MODIFIED Requirements

### Requirement: Parser Nativo de MusicXML 4.0 (Modalidad 04)

`parseMusicXml` MUST (DEBE) producir el modelo canónico `ScoreDataModel` desde MusicXML exportado por MuseScore Studio 4.

- El parser MUST rechazar contenido vacío y detectar errores de sintaxis XML lanzando una excepción con "Error de sintaxis".
- `pitchToMidiNote(step, alter, octave)` MUST computar `(octave + 1) * 12 + offset + alter` clampeado a `[0, 127]`.
- El parser MUST soportar: `<divisions>`, `<backup>` / `<forward>`, `<chord/>` (sin avanzar cursor), `<harmony>` (cifrado armónico), `<fingering>` y `<rest/>`.
- La mano MUST derivarse del `staff` (`1 → 'RH'`, `2 → 'LH'`).
- La duración acústica MUST precomputarse como `durationMs = round(durationBeats * (60000 / baseBpm))`.
- El parser MUST reconocer las **ligaduras de prolongación** declaradas como `<tie type="start|stop"/>` (hijo directo de `<note>`, forma canónica de MuseScore Studio 4) y, por compatibilidad con exportadores alternativos, `<tied type="start|stop"/>` bajo `<notations>`.
- Una nota con `<tie type="stop"/>` (o `<tied type="stop"/>`) MUST consolidarse con el evento que abrió la ligadura **solo si** coincide con él en pitch (número MIDI, `alter` y `octava`), `staff` y `voice`; en ese caso MUST acumular sus `durationDivisions`, `durationBeats` y `durationMs` sobre ese evento preexistente y MUST **no** crear un nuevo `ScorePlaybackEvent`, avanzando el cursor temporal como si la nota se hubiera emitido.
- El evento resultante de una consolidación MUST llevar `isTied === true` como bandera de trazabilidad visual; `isTied` es opcional y, cuando está ausente o es `false`, no altera la evaluación.
- El evento ancla de cada voz MUST persistir a través de la frontera entre compases (es lo que permite consolidar ligaduras entre compases contiguos) y MUST nulificarse únicamente ante `<backup>` o `<forward>`, que son los cortes reales de continuidad temporal.
- Si la nota de continuación **no** cumple la condición de coincidencia (pitch, `staff` o `voice` distintos), o si no existe un evento ancla memorable en la misma voz (`stop` huérfano, o uno tras un `<backup>`/`<forward>`), la nota MUST emitirse como evento independiente con su propia duración, sin descartarse.
- Un `<tie type="start"/>` MUST simplemente marcar el evento en curso como el origen de una ligadura pendiente; no MUST por sí mismo fusionar nada ni alterar la duración.

#### Scenario: Conversión de altura y duración

- **GIVEN** un `<note>` con `<pitch><step>C</step><octave>4</octave></pitch>`, `<duration>2</duration>` y `divisions = 4`
- **WHEN** se parsea el fragmento
- **THEN** el evento resultante tiene `midiNotes = [60]`, `durationBeats = 0.5` y `beatPosition = 1.0`

#### Scenario: `<backup>` alinea ambas manos en el mismo tiempo

- **GIVEN** un compás cuya voz aguda avanza 2 divisiones y luego aparece `<backup><duration>2</duration></backup>`
- **WHEN** se parsea
- **THEN** el evento grave resultante comparte `beatPosition` con el evento agudo inicial

#### Scenario: Ligadura entre compases consolida la duración en un único evento

- **GIVEN** un score a `divisions = 4` y `baseBpm = 120` donde el compás 1 termina con `<note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><staff>1</staff><tie type="start"/></note>` y el compás 2 empieza con `<note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice><staff>1</staff><tie type="stop"/></note>`
- **WHEN** se parsea el score
- **THEN** `model.events` contiene exactamente **un** evento para esa altura con `durationDivisions === 3`, `durationBeats === 0.75`, `durationMs === 375` e `isTied === true`
- **AND** no existe ningún segundo evento con `midiNotes === [67]` en el compás 2
- **AND** la nota siguiente del compás 2 conserva su `beatPosition` desplazada por la duración acumulada, demostrando que el cursor temporal sí avanzó

#### Scenario: La consolidación exige coincidencia de pitch, staff y voice

- **GIVEN** un score cuyo `<tie type="stop"/>` recae sobre una altura, `staff` o `voice` distinta a la del evento que abrió la ligadura
- **WHEN** se parsea
- **THEN** se emiten dos `ScorePlaybackEvent` independientes, cada uno con su propia duración original
- **AND** ninguno de los dos eventos lleva `isTied === true`

#### Scenario: `stop` huérfano no consolida nada

- **GIVEN** un score cuyo primer elemento `<note>` lleva `<tie type="stop"/>` sin ningún `<tie type="start"/>` previo en su voz
- **WHEN** se parsea
- **THEN** esa nota se emite como un evento independiente con su duración original y `isTied` ausente o `false`

#### Scenario: `<tied>` bajo `<notations>` consolida igual que `<tie>`

- **GIVEN** un score exportado por un exportador alternativo que declara la ligadura como `<notations><tied type="start"/></notations>` y `<notations><tied type="stop"/></notations>` sobre dos notas de igual pitch, `staff` y `voice`
- **WHEN** se parsea
- **THEN** el resultado es un único evento consolidado con `isTied === true` y la duración sumada de ambas notas
