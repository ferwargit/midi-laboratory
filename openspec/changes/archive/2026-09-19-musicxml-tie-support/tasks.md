## 1. Pruebas primero (TDD — Red)

- [x] 1.1 En `src/renderer/src/domain/music/scoreParser.test.ts`, añadir un `MOCK_TIE_ACROSS_MEASURES_XML` (divisions 4, 4/4, BPM 120): compás 1 con `<note>` G4 `<duration>2</duration>` + `<tie type="start"/>` y compás 2 con `<note>` G4 `<duration>1</duration>` + `<tie type="stop"/>` seguido de otra nota (p. ej. E4 `<duration>1</duration>`) — caso "Ligadura entre compases consolida la duración en un único evento".
- [x] 1.2 Añadir el caso que afirma la consolidación: `model.events` tiene exactamente un evento G4 con `durationDivisions === 3`, `durationBeats === 0.75`, `durationMs === 375`, `isTied === true`, ningún segundo evento con `midiNotes === [67]` en el compás 2, y la nota E4 posterior tiene `beatPosition` desplazada por las 3 divisiones acumuladas (demostrando que el cursor sí avanzó) — verificar con `npm run test` que **falla** (Red) antes de la tarea 2.x.
- [x] 1.3 Añadir caso "La consolidación exige coincidencia de pitch, staff y voice": fixture con `<tie type="stop"/>` sobre A4 (`voice 1`, `staff 1`) tras un G4 abierto — afirmar dos eventos independientes, cada uno con su duración original y sin `isTied === true`.
- [x] 1.4 Añadir caso "`stop` huérfano no consolida nada": fixture cuyo primer `<note>` lleva `<tie type="stop"/>` sin `start` previo — afirmar evento independiente con su duración original.
- [x] 1.5 Añadir caso "`<tied>` bajo `<notations>` consolida igual que `<tie>`": mismo contenido de 1.1 exportado con `<notations><tied type="start|stop"/></notations>` — afirmar un único evento consolidado con `isTied === true`.

## 2. Implementación (scoreParser.ts + scoreTypes.ts)

- [x] 2.1 En `src/renderer/src/domain/music/scoreTypes.ts`, añadir `isTied?: boolean` a `ScorePlaybackEvent` con comentario `// True si el evento resulta de consolidar una ligadura de prolongación <tie>` — verificar con `npm run typecheck`.
- [x] 2.2 En la rama `note` de `scoreParser.ts`, leer el tipo de ligadura con prioridad canónica: `child.querySelector('tie')?.getAttribute('type') ?? child.querySelector('notations > tied')?.getAttribute('type')`, con normalización a minúsculas y descarte de valores distintos de `start`/`stop`.
- [x] 2.3 Implementar la consolidación condicional **antes** del bloque `isChord`: si `tieType === 'stop'` y `lastEventInVoice` existe y `!isRest` y `!isChord` y la nota actual es monofónica, comparar `pitch`/`step`/`alter`/`octave`/`staff`/`voice` del `noteDetail` contra `lastEventInVoice.notes[0]` y exigir `lastEventInVoice.voice === voice` y `lastEventInVoice.staff === staff`.
- [x] 2.4 Al consolidar: `lastEventInVoice.durationDivisions += duration`, recalcular `durationBeats = durationDivisions / divisions` y `durationMs = Math.round(durationBeats * (60000 / baseBpm))`, marcar `lastEventInVoice.isTied = true`, avanzar `currentCursorDivisions += duration` y **no** crear nuevo evento ni reasignar `lastEventInVoice` (sigue siendo el ancla mientras la voz no se resetee).
- [x] 2.5 Asegurar que `<tie type="start"/>` no muta duración ni bandera (solo se emite la nota como evento normal y deja `lastEventInVoice` como ancla) — el caso 1.2 lo cubre implícitamente.
- [x] 2.6 Confirmar que el `else` existente (nota normal / acorde / silencio) conserva su comportamiento íntegro, incluyendo `crypto.randomUUID()` y los campos `hand`/`staff`/`voice` — verificar con `npm run test` que el caso existente "debe parsear acordes complejos..." sigue pasando.

## 3. Deltas y especificaciones canónicas

- [x] 3.1 Verificar que la delta `openspec/changes/musicxml-tie-support/specs/03-practice-modalities/spec.md` contiene el `## MODIFIED Requirements` del requisito "Parser Nativo de MusicXML 4.0 (Modalidad 04)" con los tres bullets de ligadura y los seis scenarios (los dos previos más los cuatro nuevos) — ejecutar `openspec validate musicxml-tie-support --strict`.
- [x] 3.2 Tras la validación, sincronizar la delta a `openspec/specs/03-practice-modalities/spec.md` reemplazando el bloque del requisito "Parser Nativo de MusicXML 4.0 (Modalidad 04)" por el de la delta, conservando los scenarios previos que se mantienen y añadiendo los nuevos.
- [x] 3.3 Releer `openspec/specs/03-practice-modalities/spec.md` y confirmar que la sección `## Purpose` y los requisitos adyacentes ("Selección de Manos y Fusión Polifónica", "Modos de Evaluación Rítmica y Tolerancia") siguen siendo coherentes con un evento consolidado de duración extendida — buscar "durationBeats" y "isTied" en `openspec/specs/`.

## 4. Verificación final

- [x] 4.1 Ejecutar `npm run typecheck` y confirmar salida sin errores.
- [x] 4.2 Ejecutar `npm run lint` y confirmar salida sin errores.
- [x] 4.3 Ejecutar `npm run test` (vitest) y confirmar que todos los casos, incluidos los cuatro nuevos de ligadura, pasan.
- [x] 4.4 Ejecutar `openspec validate musicxml-tie-support --strict` y confirmar "Change 'musicxml-tie-support' is valid".
