## Context

Las cuatro vistas de modalidad (`SingleNoteView`, `IntervalsView`, `SequencesView`, `RepertoireView`) son hijas condicionales directas de `<main>` en `App.tsx:547-589`, seleccionadas por `appMode`. Cada vista renderiza su propia cabecera de sesión como primer elemento, seguida del bloque del piano (`PianoKeyboard`) con el mismo ritmo vertical (`space-y-3` en la raíz de las cuatro).

La altura de esa cabecera determina linealmente la posición Y del `PianoKeyboard`. Hoy:

- `SingleNoteView.tsx:147`, `IntervalsView.tsx:66`, `SequencesView.tsx:58`: `flex justify-between items-center ... h-14` (56 px) con título de **una sola línea**.
- `RepertoireView.tsx:76`: `flex flex-col sm:flex-row justify-between items-start sm:items-center ... gap-2`, **sin altura fija**, con un bloque de título de **dos líneas** (título de la obra + autor / métrica / BPM). En reposo mide ~62-80 px y, además, apila en columna por debajo del breakpoint `sm`, doblando su altura en viewports estrechos.

Ver `proposal.md - Why` para la motivación (violación de la regla CLS = 0).

Cotas medidas que fijan la altura objetivo (sistema de diseño Dark Studio DAW, tipografía tabular):

| Elemento                                         | Cálculo            | Altura      |
| ------------------------------------------------ | ------------------ | ----------- |
| Línea 1: `text-lg leading-tight`                 | 18 px × 1.25       | 22.5 px     |
| Línea 2: `text-xs leading-normal`                | 12 px × 1.5        | 18 px       |
| Padding vertical del contenedor `py-2.5`         | 10 px × 2          | 20 px       |
| Borde `border` (1 px × 2 lados)                  | —                  | 2 px        |
| **Contenido de cabecera más alto** (2 líneas)    | 22.5 + 18 + 20 + 2 | **62.5 px** |
| Botón más alto (`size="md"` con override `py-2`) | 16 px + 18 px      | 34 px       |

## Goals / Non-Goals

**Goals:**

- Que la posición Y del `PianoKeyboard` sea invariante al conmutar entre las cuatro modalidades.
- Que la cabecera de sesión tenga una huella vertical fija e idéntica en las cuatro vistas, en cualquier ancho de viewport.
- Que las cuatro modalidades presenten la misma estructura de título (dos líneas: título + subtítulo de metadatos), reforzando la coherencia visual del rack.

**Non-Goals:**

- Rediseñar la cabecera ni cambiar su contenido funcional (badge `MODO 0X`, botones de sesión, progreso dinámico): se conservan todos los elementos y comportamientos actuales.
- Modificar `PianoKeyboard`, los hooks orquestadores, los evaluadores o el dominio.
- Introducir tokens de color nuevos o alterar la paleta del Dark Studio DAW.
- Corregir otros saltos de layout fuera de la cabecera de sesión (paneles OLED, telemetría, docks).

## Decisions

### D1 — Altura fija uniforme de 72 px (`h-[72px] min-h-[72px] max-h-[72px] flex items-center justify-between mb-4`)

Los cuatro contenedores de cabecera usan la misma cadena de clases: `h-[72px] min-h-[72px] max-h-[72px] flex items-center justify-between mb-4`, conservando el resto del estilo actual (`bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 px-4 py-2.5 rounded-2xl shadow-lg`).

- **Por qué 72 px:** es el valor más cómodo por encima de los 62.5 px que necesita el contenido más alto (las dos líneas de título + padding + borde), dejando ~9.5 px de holgura para que el centrado vertical (`items-center`) respire y absorba la varianza de renderizado de fuentes. Es múltiplo de la cuadrícula de 8 px del sistema de diseño.
- **Por qué `min-h` y `max-h` además de `h`:** defensa en profundidad. `h-[72px]` fija la altura; `min-h-[72px]` garantiza que, si el contenido creciera patológicamente, la cabecera no se encoja por debajo de la cota de anclaje; `max-h-[72px]` añade el tope simétrico, de modo que ningún contenido puede empujar la cabecera por encima de la cota. La combinación con `truncate` en las líneas de texto (ver D4) mantiene el contenido acotado a dos líneas, de modo que la altura nunca se vea forzada a crecer.
- **Por qué `mb-4`:** la raíz de las cuatro vistas es un contenedor en bloque con `space-y-3`, por lo que el `margin-bottom` de la cabecera colapsa con el `margin-top` del siguiente hermano; el `mb-4` (16 px) impone la separación cabecera → siguiente bloque de forma idéntica en las cuatro modalidades (12 px del `space-y-3` ⇒ 16 px efectivos por colapso).
- **Alternativa rechazada — `h-14` (56 px) en las cuatro vistas:** 56 px < 62.5 px de contenido; el bloque de dos líneas desbordaría o se recortaría.
- **Alternativa rechazada — reservar espacio con una línea invisible/spacer en las tres vistas:** patrón frágil y opaco; la altura explícita es el mecanismo estándar para CLS = 0.

Contraparte: las tres vistas que hoy usan `h-14` suben su cabecera de 56 px a 72 px (+16 px). El piano baja 16 px **una sola vez**, pero a partir de ahí su posición Y es estable en toda conmutación. Ese desplazamiento puntual es aceptable y es justo lo que elimina el salto relativo entre modalidades.

### D2 — Bloque de título de dos líneas en las cuatro vistas

El bloque izquierdo (junto al badge `MODO 0X`) pasa a una estructura fija de dos líneas con tipografía uniforme:

- **Línea 1 (título, estático por modalidad):** `text-lg font-bold text-slate-100 leading-tight truncate block`.
- **Línea 2 (subtítulo dinámico):** `text-xs text-slate-400 leading-normal truncate block`.

El contenido existente se reuboca sin perderse:

| Vista          | Línea 1 (estática)                           | Línea 2 (dinámica)                                                                                  |
| -------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| SingleNoteView | Discriminación de Altura Absoluta            | En sesión: `getSessionProgressLabel()` (pregunta / tiempo / maestría). En reposo: `N tonos activos` |
| IntervalsView  | Reconocimiento Interválico                   | En sesión: `getSessionProgressLabel()`. En reposo: `N intervalos activos`                           |
| SequencesView  | Memoria Melódica                             | En sesión: `getSessionProgressLabel()`. En reposo: `N notas por frase`                              |
| RepertoireView | `currentScore?.title` o placeholder de carga | `composer • beats/beatType • studyBpm BPM (~ms/negra)`                                              |

- Los helper `getSessionProgressLabel()` ya existen en cada vista y se reutilizan tal cual para la Línea 2 durante la sesión, de modo que la información de progreso sigue visible y no se duplica.
- RepertoireView ya tenía este bloque de dos líneas: solo adopta las nuevas clases tipográficas y la altura fija, sin cambiar la información mostrada.
- **Alternativa rechazada — resolver el nombre canónico de preset (`resolveNotePresetName`) para la Línea 2 de las tres vistas:** acoplaría nuevos imports de dominio a las vistas para un beneficio puramente cosmético. Se usa solo datos ya presentes en cada vista (`activeNotes.length`, `activeIntervals.length`, `sequenceLength`). Ver Open Questions.

### D3 — Eliminar el apilado responsivo de la cabecera de RepertoireView

Se sustituye `flex flex-col sm:flex-row justify-between items-start sm:items-center ... gap-2` por la disposición horizontal uniforme (`flex items-center justify-between`, sin `gap` entre bloques).

- **Razón:** `flex-col` bajo `sm` apila los dos bloques y duplica la altura en viewports estrechos — es decir, CLS no solo al cambiar de modalidad, sino también al redimensionar. La altura debe ser independiente del ancho para que el anclaje sea total.
- **Control de desbordamiento en anchos pequeños:** el bloque de título recibe `min-w-0` (para que `truncate` funcione dentro de un flex) y el grupo de botones derecho recibe `shrink-0`. Así, si falta ancho, lo cede el título truncándose, no empujando la altura.
- **Contrapartida asumida:** en una ventana muy estrecha los botones (`Cambiar Partitura` + `COMENZAR SESIÓN`) pueden comprimir el título. Es aceptable: la app es un escritorio Electron con ancho mínimo controlado; se prioriza la estabilidad del anclaje sobre la densidad de texto.

### D4 — Truncamiento para mantener la cota de dos líneas

Ambas líneas llevan `truncate` (y `block`), de modo que ningún título de obra largo ni ninguna etiqueta de progreso larga puedan provocar un tercer renglón y, con ello, crecimiento de la cabecera. Esto hace que la cota de 62.5 px (D1) sea un máximo real, no una estimación.

### D5 — Uniformidad por construcción, no por copia

La cadena de clases de la cabecera y las dos clases tipográficas se extraen a un módulo compartido (p. ej. `src/renderer/src/components/views/sessionHeaderStyles.ts`) exportando constantes (`SESSION_HEADER_CLASS`, `SESSION_TITLE_CLASS`, `SESSION_SUBTITLE_CLASS`), importado por las cuatro vistas.

- **Razón:** cuatro cadenas idénticas copiadas a mano derivan (un developer cambia una y se rompe el anclaje sin que nada lo detecte). Con una sola fuente de verdad, la divergencia es imposible por construcción.
- **Alternativa rechazada — componente `<SessionHeader>` compartido:** refactor más amplio; el contenido de cada cabecera (badge, botones, lógica de progreso) difiere suficiente como para que el wrapper añada complejidad sin beneficio claro para un cambio de alcance visual.
- **Alternativa rechazada — clases inline duplicadas:** funciona, pero no protege contra la deriva futura.

### D6 — Verificación del anclaje

La posición Y del piano es función lineal de la altura de la cabecera (mismo `<main>`, mismas vistas como primer hijo, mismo `space-y-3`). La verificación se estructura en tres niveles:

1. **Estática / por construcción:** D5 garantiza que las cuatro cabeceras no pueden diverger.
2. **Automatizada no intrusiva:** `npm run typecheck` y `npm run test` (vitest) deben seguir limpios. No se añaden tests que midan layout: jsdom no computa geometría (todas las alturas son 0), y un test que asertara la presencia de la clase `h-[72px]` sería tautológico (espejo de la implementación, prohibido por la regla _No Tautological Tests_).
3. **Visual manual:** comprobación a cargo del usuario en la ventana Electron (cambiar entre las cuatro modalidades y confirmar que el piano no se desplaza), ya que la automatización de browser está excluida para esta app Electron.

### D7 — Estandarización de la barra de herramientas sobre el piano (Nivel 2)

La verificación visual en vivo (4.5) reveló una **segunda fuente de CLS**: la barra de herramientas que está inmediatamente encima del `PianoKeyboard` (la fila con la etiqueta de entrada MIDI a la izquierda y los selectores de estilo a la derecha).

- En `SingleNoteView`, `IntervalsView` y `SequencesView` esa fila mide ~30 px (su altura la define el contenido, sin cota fija).
- En `RepertoireView` además aparece, centrada, el bloque del metrónomo libre (botón 'Metro Libre' en reposo / etiqueta 'Pulso:' + LEDs de pulso en sesión), con `px-3 py-1` alrededor de LEDs de 14 px → ~42 px.

Esa diferencia de ~12 px seguía empujando el piano hacia abajo al conmutar a Repertorio aunque la cabecera (Nivel 1) ya estuviera anclada.

**Decisión:** fijar la barra en 40 px idénticos en las cuatro vistas con `h-10 min-h-[40px] max-h-10 flex items-center justify-between mb-3`, conservando las clases tipográficas existentes (`text-xs font-mono text-zinc-400 px-1`). El `mb-3` impone un margen inferior idéntico antes de `<PianoKeyboard />` (colapsa con el `mt-1.5` del envoltorio `space-y-1.5`, común a las cuatro vistas, dejando 12 px efectivos en todas).

Ajustes específicos de `RepertoireView` para que quepa en los 40 px:

- El bloque central del metrónomo pasa a `h-8 shrink-0` (32 px) y el botón 'Metro Libre' a `h-8`: centrados verticalmente por el `items-center` de la barra, sin desbordar los 40 px.
- Se elimina `flex-wrap sm:flex-nowrap`: con altura fija, un envoltorio a segunda línea quedaría recortado por `max-h-10` en vez de reservar espacio. Se reemplaza por el mismo patrón ya usado en la cabecera (D3): el `span` del título toma `min-w-0` (su `truncate` ya existente pasa a ser efectivo) y los bloques derechos llevan `shrink-0`, de modo que quien cede ancho es el título, no la altura.
- **Alternativa rechazada — reducir los LEDs o el padding del metrónomo:** degrada la legibilidad del feedback rítmico, que es información operativa en sesión. Preferimos contener el bloque en 32 px manteniendo sus dimensiones internas intactas.

Con esto, la posición Y del piano es invariante en los dos niveles que la determinan (cabecera + barra de herramientas) y en cualquier ancho de viewport.

## Risks / Trade-offs

- **[Riesgo] Títulos de obra muy largos en RepertoireView** (p. ej. piezas con título + subtítulo extenso) → **Mitigación:** `truncate` en la Línea 1 con `min-w-0` en el contenedor flexible; la información completa ya está en el panel de feedback y en la cabecera del deck de configuración.
- **[Riesgo] Apiñamiento de botones en viewports estrechos en RepertoireView** → **Mitigación:** `shrink-0` en el grupo derecho y truncado del título (D3). Asumido como trade-off aceptable para una app de escritorio.
- **[Riesgo] Crecimiento residual si el contenido supera los 72 px** (p. ej. zoom de fuente del usuario o traducciones más largas) → **Mitigación:** `min-h` fija el piso y `truncate` acota el contenido a dos líneas; el margen de ~9.5 px absorbe varianza. Si aun así creciera, el `min-h` mantiene la cota mínima de anclaje.
- **[Trade-off] Las tres vistas no-repertorio suben su cabecera de 56 px a 72 px** (+16 px de piano hacia abajo, una sola vez) → aceptado: es exactamente el precio de una posición Y estable en todas las conmutaciones.
- **[Trade-off] Reducción de densidad vertical** (16 px menos de piano visible en tres modalidades) → despreciable frente a la estabilidad perceptiva del rack; no se toca la altura del propio piano.

## Migration Plan

Cambio puro de presentación (clases Tailwind + un módulo de constantes). Sin migración de datos, sin cambios en dominio, hooks, evaluadores, persistencia ni formatos.

1. Crear el módulo de constantes compartido (D5).
2. Aplicar la nueva estructura en las cuatro vistas (D1-D4).
3. `npx prettier --write` sobre los archivos modificados.
4. `npm run typecheck` y `npm run test` (vitest run) — deben permanecer limpios.
5. Verificación visual manual en Electron (D6.3).

**Rollback:** revertir los archivos de vistas y borrar el módulo de constantes. Sin estado ni datos que migrar de vuelta.

## Open Questions

- ~~¿Enriquecer la Línea 2 de las tres vistas no-repertorio con el nombre canónico de preset resuelto (`resolveNotePresetName`, ya existente en el dominio y especificado en `03-practice-modalities`) en lugar de un conteo plano?~~ **RESUELTA (2026-09-22):** se optó por el conteo directo de tonos/intervalos/frases (`activeNotes.length`, `activeIntervals.length`, `sequenceLength`) tal como documenta D2, priorizando simplicidad, cero acoplamiento de dominio en la capa de vista y robustez (no requiere imports adicionales ni resolución de presets). Es puramente cosmético, no cambia ni el enfoque, ni las specs, ni el desglose de tareas; puede revisarse en un cambio futuro si se desea.
