## Context

La rama `note` de `parseMusicXml` (src/renderer/src/domain/music/scoreParser.ts:194-255) ya resuelve el caso simultáneo con una variable local `lastEventInVoice: ScorePlaybackEvent | null` que se reasigna por cada nota melódica emitida y se **nulifica** en `<backup>` y `<forward>` (líneas 183 y 190). Las notas `<chord/>` se adjuntan a ese mismo evento sin avanzar cursor.

Esa variable es el punto de anclaje natural para la consolidación de ligaduras: `lastEventInVoice` es ya "la última nota sonora de esta voz". El cursor temporal `currentCursorDivisions` es local al compás, mientras que las ligaduras **cruzan la frontera entre compases** (el caso H-05 real: blanca al final del compás 1, negra al principio del compás 2), de modo que la solución no puede depender de un estado intra-compás.

La duración de un evento se computa al emitirlo (líneas 231-233): `durationBeats = duration / divisions`, `durationMs = round(durationBeats * (60000 / baseBpm))`. Tres campos derivados que deben mantenerse coherentes al acumular.

Los consumidores:

- `repertoireEvaluator.ts:160-177` usa `durationBeats` para los modos rítmicos (`relative_proportional` compara IOI, `strict_metronome` cuadrícula acumulada).
- `useRepertoireTrainer.ts:141-143` (`fuseConcurrentEvents`) toma `Math.min` de las duraciones al fusionar RH+LH.
- `stimulusScheduler.ts:32` usa `durationMs` para programar el Note Off del sintetizador.

En los tres, la consolidación entrega **exactamente el valor que ya esperaban**: una sola nota con la duración acústica real en lugar de dos mitades re-articuladas.

## Goals / Non-Goals

**Goals:**

- H-05: que una ligadura entre compases (o entre pulsos del mismo compás) produzca un único `ScorePlaybackEvent` con la duración acústica combinada.
- Que el cursor temporal siga avanzando con la nota de continuación, de modo que la nota posterior se posicione en el beat correcto.
- Que la consolidación sea **estrictamente condicional** en pitch + staff + voice, para no fundir notas distintas que un exportador roto pudiera marcar con un `stop` suelto.
- Conservar el comportamiento actual para partituras sin ligaduras y para los fixtures existentes (`isTied` opcional).

**Non-Goals:**

- No se dibuja la ligadura en la partitura visual: el renderer se limita a poder leer `isTied` si quiere; este cambio no toca componentes de UI.
- No se soportan slur (`<slur>`) ni ligaduras de frase: son indicaciones expresivas, no de prolongación de duración.
- No se soportan ligaduras _parciales_ sobre acordes (un `<tie>` que afecta a una sola voz interna de un acorde ya emitido con `<chord/>`): el dominio `ScorePlaybackEvent` es monolítico por voz; MuseScore 4 exporta esas voces como elementos `<note>` separados con `voice` distinto, que el parser ya trata como voces independientes.
- No se recorta `durationMs` por la articulación legada del sintetizador: la duración es la matemática de la partitura.
- No se alteran los modos de evaluación rítmica: consumen `durationBeats` sin cambio.

## Decisions

### Decisión 1: Reutilizar `lastEventInVoice` como ancla de consolidación

**Elección:** consolidar sobre `lastEventInVoice` en vez de introducir una pila/mapa de "ligaduras abiertas por voz".

**Rationale:** las ligaduras de prolongación de MusicXML no se anidan: sobre una voz, en un instante dado, hay a lo sumo una ligadura abierta y su siguiente `stop` la cierra. Un mapa `voice → eventoAbierto` sería una estructura más general pero equivalente en la práctica, y obligaría a gestionar su limpieza al resetear la voz. `lastEventInVoice` ya existe, ya se nulifica en `<backup>`/`<forward>` (que es justamente cuando pierde sentido anclarse a la nota anterior) y ya es el receptor de los `<chord/>`. Si una voz tiene ligaduras encadenadas (A→B, B→C), la consolidación es lineal: B se suma a A y queda como nueva ancla, C se suma a A. **Alternativa rechazada:** pila de ligaduras por voz — añade estados sin ganancia observable.

**Nota sobre el reset de voz:** `<backup>`/`<forward>` nulifican `lastEventInVoice`, así que un `stop` posterior no consolida (cumple el scenario "`stop` huérfano no consolida nada"). Eso es correcto: un `<forward>` entre medias significa que la segunda nota **no** es continuación inmediata.

### Decisión 2: Condición de coincidencia = pitch + staff + voice, no solo número MIDI

**Elección:** consolidar solo si `pitch`, `alter`, `octave`, `staff` y `voice` del `noteDetail` de la continuación coinciden con los del evento ancla.

**Rationale:** comparar solo `midiNotes[0]` aceptaría fusionar un C#4 con un Db4 enharmónico de la misma voz (exportadores mixtos) y, peor, fusionar notas de manos distintas si el `<tie>` está mal formado. La comparación triple `(step, alter, octave)` ya vive en `ScoreNoteDetail` y es barata. **Alternativa rechazada:** comparar solo número MIDI — un semitono equivocado enharmónicamente es improbable pero silenciosamente destructivo.

**Detalle de acordes:** la consolidación exige `midiNotes.length === 1` en el evento ancla y que la continuación sea también monofónica (`!isChord` en el tag leído, `!isRest`). Un `<chord/>` con `<tie>` queda fuera del dominio (ver Non-Goals) y se emite como evento normal.

### Decisión 3: Acumulación de los tres campos derivados, no recomputación

**Elección:** al consolidar, sumar directamente:

```ts
lastEventInVoice.durationDivisions += duration
lastEventInVoice.durationBeats = lastEventInVoice.durationDivisions / divisions
lastEventInVoice.durationMs = Math.round(lastEventInVoice.durationBeats * (60000 / baseBpm))
```

**Rationale:** derivar `durationBeats` y `durationMs` desde el nuevo `durationDivisions` total (en vez de sumar las partes por separado) evita el error de redondeo acumulado de `Math.round` y mantiene la invariante `durationMs == round(durationBeats * 60000/baseBpm)` que el scenario de spec exige (`2+1` divisiones → `0.75` beats → `375` ms a 120 BPM, sin resto). Usar `baseBpm` vigente en el momento de la consolidación es correcto porque un `<direction>` de tempo entre medias pertenece a la segunda nota y ya se habrá aplicado a la nota siguiente.

### Decisión 4: Detección de tags `<tie>` y `<tied>` con un único lector

**Elección:** una lectura por nota, priorizando la forma canónica de MuseScore 4:

```ts
const tieType =
  child.querySelector('tie')?.getAttribute('type') ??
  child.querySelector('notations > tied')?.getAttribute('type')
```

**Rationale:** MuseScore Studio 4 exporta `<tie type="start|stop"/>` como hijo directo de `<note>`; `<tied>` bajo `<notations>` es la forma del schema 4.0 que usan otros exportadores (Finale, MusicXML de muestra). `querySelector('tie')` sin descendente es deliberado: `<tied>` NO debe matchingar como hijo de `<notations>`. El `??` da prioridad a la forma nativa cuando ambas aparecen (algunos exportadores escriben ambas). **Alternativa rechazada:** leer solo `<tie>` — dejaría partituras reales sin consolidar y contradiría el objetivo del hallazgo.

### Decisión 5: `isTied` opcional, no enum de estado

**Elección:** `isTied?: boolean` en `ScorePlaybackEvent`, ausente = no consolidado.

**Rationale:** los fixtures de `useRepertoireTrainer.test.ts` y `repertoireEvaluator.test.ts` construyen `ScorePlaybackEvent` a mano sin la bandera; un campo opcional los mantiene válidos y sin ruido. Un enum (`'none' | 'start' | 'continued'`) expresaría información que ningún consumidor actual usa: el renderer solo necesita saber si el evento resulta de una ligadura, y el evaluador no la consume en absoluto. **Alternativa rechazada:** array `tiedSpanMeasures: number[]` — sobre-ingeniería sin consumidor.

### Decisión 6: `<tie type="start"/>` es puramente marcador

**Elección:** el `start` no muta duración ni bandera; solo deja que la siguiente nota de continuación encuentre un ancla válida (que ya es `lastEventInVoice`). Se marca `isTied = true` solo al consolidar.

**Rationale:** la bandera describe "este evento nació de una consolidación de ligadura", no "este evento tiene una ligadura abierta pendiente". Esa segunda lectura requeriría estado que sobreviviría a `<backup>`/`<forward>` de forma no obvia y no tiene consumidor. Si el renderer futuro quiere dibujar el arco, puede inferirlo de `isTied` + `durationBeats` mayor que la figura original.

## Risks / Trade-offs

- **[Ligaduras sobre la frontera de `<direction>` de tempo]** → si un cambio de BPM ocurre entre la nota de inicio y la de continuación, la duración consolidada usa el `baseBpm` vigente al consolidar (el de la segunda nota). Mitigación: es el valor audiblemente correcto para la **siguiente** programación; la parte ya transcurrida no se re-sintetiza. El error está limitado a partituras con cambio de tempo exactamente sobre una ligadura, caso raro y visible en el test.
- **[Exportadores que omiten `<voice>`/`<staff>` en la continuación]** → la continuación leería defaults `voice = 1`, `staff = 1`; si el evento ancla era `staff 2`, no consolida. Mitigación: comportamiento degrada a "dos eventos" (estado actual, no regresión) y el scenario "La consolidación exige coincidencia" lo cubre. No se infiere el staff del contexto: inferirlo podría fusionar notas equivocadas en partituras de dos pentagramas.
- **[Ligaduras en voces secundarias (voice 5, 6)]** → soportadas sin código extra: la condición incluye `voice`, y cada voz mantiene su propio `lastEventInVoice` naturalmente porque la variable se reasigna en cada nota melódica de la voz que recorre el cursor. **Excepción real:** si dos voces se intercalan en el mismo compás (voz 1, voz 5, voz 1...), `lastEventInVoice` se sobrescribe entre voces y la consolidación fallaría al comparar `voice`. Mitigación: la comparación estricta de `voice` evita la **fusión errónea** (caso peligroso) a costa de no consolidar partituras polifónicas intercaladas. MuseScore 4 exporta voces completas por compás sin intercalar, así que en la práctica no se da. Queda documentado como limitación conocida, no como defecto silencioso.
- **[Deriva spec canónica vs delta]** → la delta reescribe solo el requisito "Parser Nativo de MusicXML 4.0 (Modalidad 04)"; los requisitos adyacentes (Fusión Polifónica, Resolución Gestáltica, modos rítmicos) no se tocan. Mitigación: tarea explícita de sincronización a `openspec/specs/03-practice-modalities/spec.md` y `openspec validate --strict`.
- **[Fixtures de tests existentes]** → ningún fixture actual contiene `<tie>`, de modo que `npm run test` no puede regresar en casos previos. Los eventos construidos a mano en `useRepertoireTrainer.test.ts` / `repertoireEvaluator.test.ts` no necesitan edición (`isTied` opcional).

## Migration Plan

No requiere migración: `parseMusicXml` conserva firma y salida para partituras sin ligaduras, y `ScorePlaybackEvent.isTied` es un campo opcional nuevo. Un rollback consiste en restaurar el cuerpo de la rama `note` en `scoreParser.ts` y revertir la edición en `openspec/specs/03-practice-modalities/spec.md` y en `scoreTypes.ts`; los tests nuevos de ligadura fallarían, señalando la regresión — que es precisamente su función.
