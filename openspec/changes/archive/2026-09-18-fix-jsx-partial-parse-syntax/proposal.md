## Why

El indexador AST de codebase-memory-mcp (tree-sitter TSX) reporta **parse parcial** en tres
componentes de la interfaz gráfica, con rangos de error confirmados en exactamente cuatro
líneas. La causa única y compartida es un **`&` literal sin escapar embebido en texto JSX**:
en la gramática HTML/XML el carácter `&` inicia una referencia de entidad, de modo que un
`&` suelto que no forma una entidad válida obliga al parser a entrar en recuperación de
errores y degradar la precisión del grafo de conocimiento justo en los componentes que debe
indexar. Corregirlo ahora restaura la cobertura completa del grafo y alinea estos cuatro
puntos con la convención que el propio proyecto ya aplica en el resto de su JSX.

## What Changes

- Sustituir el `&` literal por la entidad HTML `&amp;` en cuatro líneas de texto JSX, sin
  alterar ninguna clase, estilo, estructura de componentes ni lógica:
  - `src/renderer/src/components/views/analytics/SessionsTableTab.tsx:257` —
    `<span>Fecha & ISI</span>` → `<span>Fecha &amp; ISI</span>`
  - `src/renderer/src/components/views/analytics/SessionsTableTab.tsx:267` —
    `<span>Contenido & Timbre</span>` → `<span>Contenido &amp; Timbre</span>`
  - `src/renderer/src/components/views/guide/KnowledgeGuideModal.tsx:43` —
    `Centro de Conocimiento Psicoacústico & Metacognición` →
    `Centro de Conocimiento Psicoacústico &amp; Metacognición`
  - `src/renderer/src/components/views/guide/LatencySpectrumDiagram.tsx:12` —
    `⚡ ESPECTRO DE LATENCIA COGNITIVA & FATIGA` →
    `⚡ ESPECTRO DE LATENCIA COGNITIVA &amp; FATIGA`
- Reindexar el proyecto en codebase-memory-mcp y verificar que los tres archivos dejan de
  figurar como `parse_partial` (cobertura completa, cero rangos de error).
- Validar la corrección con `npm run typecheck` y `npm run test` (sin regresiones).

No hay cambios disruptivos (**BREAKING**): ninguno. El DOM renderizado, el texto visible y
el comportamiento funcional son byte a byte idénticos — `&amp;` se renderiza como `&`.

## Capabilities

Este es un cambio de **refactor / corrección de sintaxis UI**. No crea ni modifica ninguna
capacidad: no altera el contrato funcional de las especificaciones canónicas de
`openspec/specs/`. Verificación realizada: ninguna de las siete specs canónicas
(`01-midi-audio-hardware`, `02-trainer-core-engine`, `03-practice-modalities`,
`04-adaptation-algorithms`, `05-analytics-psychometrics`, `06-local-ai-integration`,
`07-persistence-storage`) referencia las cadenas literales de UI afectadas; las apariciones
de "Fatiga" y "Timbre" en dichas specs corresponden a conceptos de dominio (umbrales de
latencia, timbres General MIDI) y no a las etiquetas mostradas por estos componentes.

### New Capabilities

- _Ninguna._

### Modified Capabilities

- _Ninguna._

El cambio declara formalmente `skip_specs: true` en `.openspec.yaml` porque no hay ningún
cambio de comportamiento a nivel de spec. No se inventa ningún requisito para satisfacer la
validación.

## Impact

- **Código afectado:** 4 líneas en 3 archivos `.tsx` de la capa renderer
  (`views/analytics/`, `views/guide/`). Solo contenido de texto JSX; cero cambios en
  lógica, props, tipos, hooks o estilos.
- **Evidencia de convención existente:** el proyecto ya escapa correctamente `&`, `<` y `>`
  en el resto de su JSX — `SingleNoteView.tsx:90,92`, `SessionDetailModal.tsx:626,628` y
  `AnalyticsFilterBar.tsx:256,288,290` usan `&gt;`/`&lt;`. Esta corrección alinea los cuatro
  puntos outliers con esa convención.
- **Exclusión deliberada:** el `&` dentro de literales de cadena de TS **no** se toca — es
  TS válido y no está flaggeado (ej. `KnowledgeGuideModal.tsx:26`,
  `label: 'Latencia & Fatiga'`). Solo se corrige el `&` embebido en texto JSX.
- **Dependencias/APIs:** ninguno afectado. No se agregan ni elevan versiones de paquetes.
- **Herramientas:** codebase-memory-mcp recupera cobertura completa tras la reindexación;
  `npm run typecheck` y `npm run test` deben pasar sin cambios en sus resultados.
- **Riesgo:** nulo a mínimo. La única diferencia observable es que los analizadores
  estáticos dejan de encontrar errores de sintaxis en esos rangos.
