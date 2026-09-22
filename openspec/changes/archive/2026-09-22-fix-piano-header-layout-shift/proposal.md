## Why

Al conmutar entre las cuatro modalidades de entrenamiento, la cabecera de sesión superior cambia de altura: `SingleNoteView`, `IntervalsView` y `SequencesView` usan una cabecera de una sola línea con altura fija (`h-14` = 56 px), mientras que `RepertoireView` renderiza un bloque de título de dos líneas (título de la obra + autor / métrica / BPM) sin altura fija. Esta diferencia desplaza verticalmente el `PianoKeyboard` (~24 px) cada vez que el usuario cambia de modalidad, produciendo un salto de layout (CLS) que viola la regla de _Zero Layout Shifts (CLS = 0)_ del sistema de diseño y degrada la percepción de estabilidad del rack de hardware.

## What Changes

- Se unifica la altura del contenedor de la cabecera de sesión en las cuatro vistas a un valor fijo e idéntico en reposo: `min-h-[72px] h-[72px] flex items-center justify-between`, con márgenes exteriores idénticos en las cuatro vistas.
- El bloque de título izquierdo de las cuatro vistas pasa a reservar de forma estable el espacio vertical de dos líneas centradas:
  - **Línea 1:** Título principal con `text-lg font-bold text-slate-100 leading-tight`.
  - **Línea 2:** Subtítulo de metadatos descriptivos con `text-xs text-slate-400 leading-normal`.
- `RepertoireView` mantiene su información de obra (título, autor, métrica, BPM) pero dentro de la nueva altura uniforme, dejando de expandir el contenedor.
- `SingleNoteView`, `IntervalsView` y `SequencesView` añaden una segunda línea de subtítulo con información de preset / pool / configuración activa para coherencia visual, de modo que las cuatro modalidades presentan la misma huella vertical.
- Se elimina el estado `flex-col`/`items-start` responsivo de la cabecera de `RepertoireView` en favor de la disposición horizontal uniforme, de modo que la altura no dependa del ancho de viewport.
- **(Añadido tras verificación en vivo)** Se estandariza también la barra de herramientas que está directamente sobre el piano (Nivel 2), segunda fuente de CLS detectada: en las cuatro vistas pasa a `h-10 min-h-[40px] max-h-10 flex items-center justify-between mb-3`. En `RepertoireView`, el bloque central del metrónomo libre y su botón pasan a `h-8` (32 px), centrados sin desbordar los 40 px de la barra; se elimina su `flex-wrap sm:flex-nowrap` y el título toma `min-w-0` para que el truncado sea efectivo.
- Se verificationa que la posición Y del `PianoKeyboard` es idéntica al conmutar entre las cuatro modalidades.
- Formateo con Prettier y verificación con `npm run typecheck` y `npm run test`.

## Capabilities

### New Capabilities

Ninguna. Este cambio es una corrección puramente visual de layout (CSS/Tailwind) en componentes de presentación existentes; no introduce ninguna nueva capacidad funcional.

### Modified Capabilities

Ninguna. Las capacidades existentes (`03-practice-modalities` y demás) describen comportamiento de dominio (generación de estímulos, evaluación, persistencia, temporización) y ninguna requirement cubre geometría de layout de la cabecera. Este cambio no altera ninguna requirement observable: la lógica de cada modalidad, los hooks orquestadores y los evaluadores se mantienen intactos. Por ello el cambio declara `skip_specs: true`.

## Impact

- **Componentes afectados (solo estilos de layout, sin cambios de lógica):**
  - `src/renderer/src/components/views/SingleNoteView.tsx` (cabecera de sesión, línea ~147).
  - `src/renderer/src/components/views/IntervalsView.tsx` (cabecera dinámica, línea ~66).
  - `src/renderer/src/components/views/SequencesView.tsx` (cabecera dinámica, línea ~58).
  - `src/renderer/src/components/views/RepertoireView.tsx` (cabecera dinámica, línea ~76).
- **Componente de anclaje:** `src/renderer/src/components/trainer/PianoKeyboard.tsx` no se modifica; su posición Y debe permanecer invariable al conmutar modalidades (es el observable de verificación).
- **Ensamblado:** `src/renderer/src/App.tsx` (conmutador `appMode` en `<main>`) no se modifica; las cuatro vistas siguen siendo hijas directas condicionales.
- **Dependencias y APIs:** Ninguna cambia. No hay alteraciones de hooks, dominio, evaluadores ni persistencia.
- **Sistema de diseño:** Refuerza la regla _Zero Layout Shifts (CLS = 0)_ y la tipografía tabular/monoespaciada del Dark Studio DAW; no introduce nuevos tokens de color.
- **Riesgos:** Modificación del espacio vertical reservado en `RepertoireView` en viewports estrechos: la segunda línea de metadatos (autor / métrica / BPM) debe caber dentro de los 72 px o truncarse de forma controlada, sin desbordar.
